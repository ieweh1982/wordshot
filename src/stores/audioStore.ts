import { create } from 'zustand';

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

export interface Song {
  id: string;
  name: string;
  audioFile: string; // base64 or blob URL
  audioDuration: number;
  lyricFile: string | null; // base64 or blob URL
  lyrics: LyricLine[];
}

// Extended BGM track with persist capability
export interface BgmLibraryItem {
  id: string;
  name: string;
  file: string;
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

  // Song queue
  addSong: (song: Omit<Song, 'id'>) => void;
  removeSong: (id: string) => void;
  clearSongs: () => void;
  setCurrentSongIndex: (index: number) => void;
  setCurrentSongTime: (time: number) => void;
  setCurrentSongPlaying: (playing: boolean) => void;
  setCurrentLyricLine: (line: number) => void;
  playNextSong: () => void;
  playPrevSong: () => void;
}

const STORAGE_KEY = 'wordshot-audio-config';

const loadFromStorage = () => {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      soundEffects: state.soundEffects,
      bgmVolume: state.bgmVolume,
      bgmLoop: state.bgmLoop,
      bgmLibrary: state.bgmLibrary,
      songs: state.songs,
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
};

const savedConfig = loadFromStorage();
const persistedState: Partial<AudioPlayerState> = savedConfig ? {
  soundEffects: savedConfig.soundEffects || [],
  bgmVolume: savedConfig.bgmVolume ?? 0.7,
  bgmLoop: savedConfig.bgmLoop ?? true,
  bgmLibrary: savedConfig.bgmLibrary || [],
  songs: savedConfig.songs || [],
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
      // Dispatch event for AudioPlayerPanel to handle
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
  addSong: (song) => {
    const newSong: Song = {
      ...song,
      id: `song-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => {
      const newSongs = [...state.songs, newSong];
      // Auto-play if first song
      const newIndex = state.currentSongIndex === -1 ? 0 : state.currentSongIndex;
      return { songs: newSongs, currentSongIndex: newIndex };
    });
  },

  removeSong: (id) => {
    set((state) => {
      const index = state.songs.findIndex((s) => s.id === id);
      const newSongs = state.songs.filter((s) => s.id !== id);
      let newIndex = state.currentSongIndex;
      if (index < state.currentSongIndex) {
        newIndex = state.currentSongIndex - 1;
      } else if (index === state.currentSongIndex) {
        newIndex = Math.min(state.currentSongIndex, newSongs.length - 1);
      }
      return { songs: newSongs, currentSongIndex: newIndex };
    });
  },

  clearSongs: () => set({ songs: [], currentSongIndex: -1, currentSongTime: 0, currentSongPlaying: false }),

  setCurrentSongIndex: (index) => set({ currentSongIndex: index, currentSongTime: 0, currentLyricLine: 0 }),
  setCurrentSongTime: (time) => set({ currentSongTime: time }),
  setCurrentSongPlaying: (playing) => set({ currentSongPlaying: playing }),
  setCurrentLyricLine: (line) => set({ currentLyricLine: line }),

  playNextSong: () => {
    const { songs, currentSongIndex } = get();
    if (songs.length === 0) return;
    const nextIndex = (currentSongIndex + 1) % songs.length;
    set({ currentSongIndex: nextIndex, currentSongTime: 0, currentLyricLine: 0 });
  },

  playPrevSong: () => {
    const { songs, currentSongIndex } = get();
    if (songs.length === 0) return;
    const prevIndex = currentSongIndex <= 0 ? songs.length - 1 : currentSongIndex - 1;
    set({ currentSongIndex: prevIndex, currentSongTime: 0, currentLyricLine: 0 });
  },
}));

export const useAudioStore = audioStore;