import { create } from 'zustand';
import { saveAudioToDb, getAudioBlobUrl, deleteAudioFromDb } from './audioDb';

export interface SoundEffect {
  id: string;
  name: string;
  file: string; // base64 or blob URL
  volume: number;
}

export interface BgmTrack {
  id: string;
  name: string;
  file: string; // base64 or blob URL
  duration: number;
}

export interface LyricLine {
  time: number; // seconds
  text: string;
}

// Song stored in localStorage - only metadata, actual audio in IndexedDB
export interface Song {
  id: string;
  name: string;
  audioDbKey: string; // Key to retrieve audio from IndexedDB
  audioDuration: number;
  lyricFile: string | null; // base64 or blob URL
  lyrics: LyricLine[];
}

// Extended BGM track with persist capability
export interface BgmLibraryItem {
  id: string;
  name: string;
  file: string; // base64 or blob URL
  duration: number;
  addedAt: number;
}

export interface AudioPlayerState {
  // BGM Library (persistent)
  bgmLibrary: BgmLibraryItem[];
  // BGM
  bgmTrack: BgmTrack | null;
  bgmPlaying: boolean;
  bgmTime: number;
  bgmDuration: number;
  bgmVolume: number;
  bgmLoop: boolean;
  // Sound effects
  soundEffects: SoundEffect[];
  // Song queue
  songs: Song[];
  currentSongIndex: number;
  currentSongTime: number;
  currentSongPlaying: boolean;
  currentLyricLine: number;
  // 歌词时间偏移量（秒），正值提前，负值延后
  lyricTimeOffset: number;
  // 标记 songs 是否已从 IndexedDB 加载
  songsLoaded: boolean;
}

interface AudioPlayerActions {
  // BGM Library
  addBgmToLibrary: (track: Omit<BgmLibraryItem, 'id' | 'addedAt'>) => void;
  removeBgmFromLibrary: (id: string) => void;
  selectBgmFromLibrary: (id: string) => void;

  // Sound effects
  addSoundEffect: (effect: Omit<SoundEffect, 'id'>) => void;
  removeSoundEffect: (id: string) => void;
  updateSoundEffect: (id: string, updates: Partial<SoundEffect>) => void;
  playSoundEffect: (id: string) => void;

  // BGM
  setBgmTrack: (track: BgmTrack | null) => void;
  setBgmPlaying: (playing: boolean) => void;
  setBgmTime: (time: number) => void;
  setBgmDuration: (duration: number) => void;
  setBgmVolume: (volume: number) => void;
  setBgmLoop: (loop: boolean) => void;

  // Song queue - 返回 Promise 版本以便异步加载 IndexedDB 数据
  addSong: (song: Omit<Song, 'id' | 'audioDbKey'>, arrayBuffer: ArrayBuffer, mimeType: string) => Promise<void>;
  removeSong: (id: string) => Promise<void>;
  clearSongs: () => void;
  setCurrentSongIndex: (index: number) => void;
  setCurrentSongTime: (time: number) => void;
  setCurrentSongPlaying: (playing: boolean) => void;
  setCurrentLyricLine: (line: number) => void;
  setLyricTimeOffset: (offset: number) => void;
  adjustLyricTimeOffset: (delta: number) => void;
  playNextSong: () => void;
  playPrevSong: () => void;
  // 从 IndexedDB 加载歌曲音频数据
  loadSongAudioFromDb: (index: number) => Promise<string | null>;
  // 初始化时加载所有歌曲音频
  loadAllSongsAudioFromDb: () => Promise<void>;
}

const STORAGE_KEY = 'wordshot-audio-config';

// 存储到 localStorage 的数据结构（不含音频数据）
interface StoredConfig {
  soundEffects: SoundEffect[];
  bgmVolume: number;
  bgmLoop: boolean;
  bgmLibrary: BgmLibraryItem[];
  songs: Song[];
  currentSongIndex: number;
  lyricTimeOffset: number;
}

const loadFromStorage = (): StoredConfig | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('[audioStore] Failed to load from storage:', e);
  }
  return null;
};

const saveToStorage = (state: Partial<AudioPlayerState>) => {
  try {
    // 音频数据已存储在 IndexedDB，只存元数据到 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      soundEffects: state.soundEffects,
      bgmVolume: state.bgmVolume,
      bgmLoop: state.bgmLoop,
      bgmLibrary: state.bgmLibrary,
      songs: state.songs,
      currentSongIndex: state.currentSongIndex,
      lyricTimeOffset: state.lyricTimeOffset,
    }));
  } catch (e) {
    console.error('[audioStore] Failed to save to storage:', e);
  }
};

const initialState: AudioPlayerState = {
  bgmLibrary: [],
  bgmTrack: null,
  bgmPlaying: false,
  bgmTime: 0,
  bgmDuration: 0,
  bgmVolume: 0.7,
  bgmLoop: true,
  soundEffects: [],
  songs: [],
  currentSongIndex: -1,
  currentSongTime: 0,
  currentSongPlaying: false,
  currentLyricLine: 0,
  lyricTimeOffset: 0,
  songsLoaded: false,
};

const savedConfig = loadFromStorage();
const persistedState: Partial<AudioPlayerState> = savedConfig ? {
  soundEffects: savedConfig.soundEffects || [],
  bgmVolume: savedConfig.bgmVolume ?? 0.7,
  bgmLoop: savedConfig.bgmLoop ?? true,
  bgmLibrary: savedConfig.bgmLibrary || [],
  songs: savedConfig.songs || [],
  currentSongIndex: savedConfig.currentSongIndex ?? -1,
  lyricTimeOffset: savedConfig.lyricTimeOffset ?? 0,
} : {};

export const audioStore = create<AudioPlayerActions & AudioPlayerState>((set, get) => ({
  ...initialState,
  ...persistedState,

  // BGM Library
  addBgmToLibrary: (track) => {
    const newItem: BgmLibraryItem = {
      ...track,
      id: `bgm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: Date.now(),
    };
    set((state) => {
      const newState = { bgmLibrary: [...state.bgmLibrary, newItem] };
      saveToStorage(newState);
      return newState;
    });
  },

  removeBgmFromLibrary: (id) => {
    set((state) => {
      const newState = { bgmLibrary: state.bgmLibrary.filter((b) => b.id !== id) };
      saveToStorage(newState);
      return newState;
    });
  },

  selectBgmFromLibrary: (id) => {
    const bgm = get().bgmLibrary.find((b) => b.id === id);
    if (bgm) {
      set({ bgmTrack: { id: bgm.id, name: bgm.name, file: bgm.file, duration: bgm.duration }, bgmTime: 0, bgmDuration: 0, bgmPlaying: false });
    }
  },

  // Sound effects
  addSoundEffect: (effect) => {
    const newEffect: SoundEffect = {
      ...effect,
      id: `sfx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => {
      const newState = { soundEffects: [...state.soundEffects, newEffect] };
      saveToStorage(newState);
      return newState;
    });
  },

  removeSoundEffect: (id) => {
    set((state) => {
      const newState = {
        soundEffects: state.soundEffects.filter((e) => e.id !== id),
      };
      saveToStorage(newState);
      return newState;
    });
  },

  updateSoundEffect: (id, updates) => {
    set((state) => {
      const newState = {
        soundEffects: state.soundEffects.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      };
      saveToStorage(newState);
      return newState;
    });
  },

  playSoundEffect: (id) => {
    const effect = get().soundEffects.find((e) => e.id === id);
    if (effect) {
      window.dispatchEvent(new CustomEvent('audio:play-sfx', { detail: { id, effect } }));
    }
  },

  // BGM
  setBgmTrack: (track) => set({ bgmTrack: track, bgmTime: 0, bgmDuration: 0 }),
  setBgmPlaying: (playing) => set({ bgmPlaying: playing }),
  setBgmTime: (time) => set({ bgmTime: time }),
  setBgmDuration: (duration) => set({ bgmDuration: duration }),
  setBgmVolume: (volume) => {
    set({ bgmVolume: volume });
    saveToStorage({ bgmVolume: volume });
  },
  setBgmLoop: (loop) => {
    set({ bgmLoop: loop });
    saveToStorage({ bgmLoop: loop });
  },

  // Song queue
  addSong: async (song, arrayBuffer, mimeType) => {
    try {
      // 保存音频到 IndexedDB
      const dbKey = await saveAudioToDb(arrayBuffer, mimeType);
      console.log('[audioStore] Saved to IndexedDB with key:', dbKey);
      const newSong: Song = {
        ...song,
        id: `song-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        audioDbKey: dbKey,
      };
      console.log('[audioStore] Creating new song:', JSON.stringify(newSong).substring(0, 200));
      set((state) => {
        const newSongs = [...state.songs, newSong];
        const newIndex = state.currentSongIndex === -1 ? 0 : state.currentSongIndex;
        const newState = { songs: newSongs, currentSongIndex: newIndex };
        saveToStorage(newState);
        console.log('[audioStore] Song added, total songs:', newSongs.length);
        return newState;
      });
    } catch (e) {
      console.error('[audioStore] Failed to add song:', e);
      throw e;
    }
  },

  removeSong: async (id) => {
    const song = get().songs.find((s) => s.id === id);
    if (song) {
      try {
        await deleteAudioFromDb(song.audioDbKey);
      } catch (e) {
        console.error('[audioStore] Failed to delete audio from DB:', e);
      }
    }
    set((state) => {
      const index = state.songs.findIndex((s) => s.id === id);
      const newSongs = state.songs.filter((s) => s.id !== id);
      let newIndex = state.currentSongIndex;
      if (index < state.currentSongIndex) {
        newIndex = state.currentSongIndex - 1;
      } else if (index === state.currentSongIndex) {
        newIndex = Math.min(state.currentSongIndex, newSongs.length - 1);
      }
      const newState = { songs: newSongs, currentSongIndex: newIndex };
      saveToStorage(newState);
      return newState;
    });
  },

  clearSongs: () => {
    const songs = get().songs;
    // 清理 IndexedDB
    songs.forEach(async (song) => {
      try {
        await deleteAudioFromDb(song.audioDbKey);
      } catch (e) {
        console.error('[audioStore] Failed to delete audio from DB:', e);
      }
    });
    const newState = { songs: [], currentSongIndex: -1, currentSongTime: 0, currentSongPlaying: false };
    saveToStorage(newState);
    set(newState);
  },

  setCurrentSongIndex: (index) => {
    set({ currentSongIndex: index, currentSongTime: 0, currentLyricLine: 0 });
    saveToStorage({ songs: get().songs, currentSongIndex: index });
  },
  setCurrentSongTime: (time) => set({ currentSongTime: time }),
  setCurrentSongPlaying: (playing) => set({ currentSongPlaying: playing }),
  setCurrentLyricLine: (line) => set({ currentLyricLine: line }),
  setLyricTimeOffset: (offset) => {
    set({ lyricTimeOffset: offset });
    saveToStorage({ lyricTimeOffset: offset });
  },
  adjustLyricTimeOffset: (delta) => {
    const newOffset = get().lyricTimeOffset + delta;
    set({ lyricTimeOffset: newOffset });
    saveToStorage({ lyricTimeOffset: newOffset });
  },

  playNextSong: () => {
    const { songs, currentSongIndex } = get();
    if (songs.length === 0) return;
    const nextIndex = (currentSongIndex + 1) % songs.length;
    const newState = { currentSongIndex: nextIndex, currentSongTime: 0, currentLyricLine: 0 };
    saveToStorage({ songs, currentSongIndex: nextIndex });
    set(newState);
  },

  playPrevSong: () => {
    const { songs, currentSongIndex } = get();
    if (songs.length === 0) return;
    const prevIndex = currentSongIndex <= 0 ? songs.length - 1 : currentSongIndex - 1;
    const newState = { currentSongIndex: prevIndex, currentSongTime: 0, currentLyricLine: 0 };
    saveToStorage({ songs, currentSongIndex: prevIndex });
    set(newState);
  },

  // 从 IndexedDB 加载指定歌曲的音频数据（返回 Blob URL）
  loadSongAudioFromDb: async (index) => {
    const songs = get().songs;
    console.log('[audioStore] loadSongAudioFromDb called, index:', index, 'total songs:', songs.length);
    if (index < 0 || index >= songs.length) {
      console.error('[audioStore] Invalid index:', index, 'songs length:', songs.length);
      return null;
    }
    const song = songs[index];
    console.log('[audioStore] Song at index:', song?.name, 'key:', song?.audioDbKey);
    if (!song.audioDbKey) {
      console.error('[audioStore] No audioDbKey for song:', song.name);
      return null;
    }
    try {
      const blobUrl = await getAudioBlobUrl(song.audioDbKey);
      console.log('[audioStore] getAudioBlobUrl result:', blobUrl);
      return blobUrl;
    } catch (e) {
      console.error('[audioStore] Failed to load song audio from DB:', e);
      return null;
    }
  },

  // 初始化时加载所有歌曲音频到内存
  loadAllSongsAudioFromDb: async () => {
    set({ songsLoaded: true });
  },
}));

export const useAudioStore = audioStore;