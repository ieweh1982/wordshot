import { useState, useEffect, useRef, useCallback } from 'react';
import { audioStore, SoundEffect, Song, LyricLine } from '../../stores/audioStore';
import { layoutStore } from '../../stores/layoutStore';
import './AudioPlayerPanel.css';

// LRC parser
// LRC parser - 支持多种格式的时间标签
// 也支持纯文本歌词（无时间标签）
function parseLRC(lrc: string): LyricLine[] {
  const lines = lrc.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lyrics: LyricLine[] = [];

  // 先尝试解析有时间标签的歌词
  let hasTimeTag = false;
  for (const line of lines) {
    if (line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/)) {
      hasTimeTag = true;
      break;
    }
  }

  if (hasTimeTag) {
    // 有时间标签的 LRC
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const msStr = match[3];
        const time = minutes * 60 + seconds + parseInt(msStr, 10) / (msStr.length === 2 ? 100 : 1000);
        const text = line.replace(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g, '').trim();
        if (text) {
          lyrics.push({ time, text });
        }
      }
    }
    return lyrics.sort((a, b) => a.time - b.time);
  } else {
    // 无时间标签的纯文本歌词，按行分割，每行间隔 4 秒
    let time = 0;
    for (const line of lines) {
      const text = line.trim();
      if (text && !text.startsWith('[')) {
        // 跳过可能是元数据的行（如 [ti:xxx] [ar:xxx] 等）
        if (text.startsWith('[')) continue;
        lyrics.push({ time, text });
        time += 4; // 每行间隔 4 秒
      }
    }
    return lyrics;
  }
}

function getVisibleLyrics(lyrics: LyricLine[], currentTime: number, offset: number = 0): { before: LyricLine[]; current: LyricLine | null; after: LyricLine[] } {
  if (!lyrics || lyrics.length === 0) {
    return { before: [], current: null, after: [] };
  }

  const adjustedTime = currentTime + offset;

  let currentIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= adjustedTime) {
      currentIndex = i;
    } else {
      break;
    }
  }

  return {
    before: currentIndex >= 0 ? lyrics.slice(0, currentIndex) : [],
    current: currentIndex >= 0 ? lyrics[currentIndex] : null,
    after: lyrics.slice(currentIndex + 1),
  };
}

type TabType = 'bgm' | 'sfx' | 'song';

const FLOATING_STORAGE_KEY_AUDIO = 'wordshot-audio-floating-position';

const DEFAULT_AUDIO_POSITION = { x: 920, y: 80, width: 320, height: 480 };

function loadAudioFloatingPosition() {
  try {
    const saved = localStorage.getItem(FLOATING_STORAGE_KEY_AUDIO);
    if (saved) {
      return { ...DEFAULT_AUDIO_POSITION, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('[AudioPlayerPanel] Failed to load position:', e);
  }
  return DEFAULT_AUDIO_POSITION;
}

function saveAudioFloatingPosition(pos: { x: number; y: number; width: number; height: number }) {
  try {
    localStorage.setItem(FLOATING_STORAGE_KEY_AUDIO, JSON.stringify(pos));
  } catch (e) {
    console.error('[AudioPlayerPanel] Failed to save position:', e);
  }
}

export default function AudioPlayerPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('bgm');
  const [floatingPos, setFloatingPos] = useState(loadAudioFloatingPosition);
  const positionDragRef = useRef<{ startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);
  const sizeDragRef = useRef<{ startMouseX: number; startMouseY: number; startWidth: number; startHeight: number } | null>(null);

  // Store state
  const soundEffects = audioStore((state) => state.soundEffects);
  const bgmLibrary = audioStore((state) => state.bgmLibrary);
  const bgmTrack = audioStore((state) => state.bgmTrack);
  const bgmPlaying = audioStore((state) => state.bgmPlaying);
  const bgmTime = audioStore((state) => state.bgmTime);
  const bgmDuration = audioStore((state) => state.bgmDuration);
  const bgmVolume = audioStore((state) => state.bgmVolume);
  const bgmLoop = audioStore((state) => state.bgmLoop);
  const songs = audioStore((state) => state.songs);
  const currentSongIndex = audioStore((state) => state.currentSongIndex);
  const currentSongTime = audioStore((state) => state.currentSongTime);
  const currentSongPlaying = audioStore((state) => state.currentSongPlaying);
  const currentLyricLine = audioStore((state) => state.currentLyricLine);
  const lyricTimeOffset = audioStore((state) => state.lyricTimeOffset);

  // Audio refs
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const songAudioRef = useRef<HTMLVideoElement | null>(null);
  const sfxAudioContextRef = useRef<AudioContext | null>(null);

  // BGM handlers
  const handleBgmPlay = useCallback(() => {
    if (!bgmAudioRef.current || !bgmTrack) return;
    if (bgmPlaying) {
      bgmAudioRef.current.pause();
      audioStore.getState().setBgmPlaying(false);
    } else {
      bgmAudioRef.current.play();
      audioStore.getState().setBgmPlaying(true);
    }
  }, [bgmPlaying, bgmTrack]);

  const handleBgmStop = useCallback(() => {
    if (!bgmAudioRef.current) return;
    bgmAudioRef.current.pause();
    bgmAudioRef.current.currentTime = 0;
    audioStore.getState().setBgmPlaying(false);
    audioStore.getState().setBgmTime(0);
  }, []);

  const handleBgmVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    audioStore.getState().setBgmVolume(volume);
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = volume;
    }
  }, []);

  const handleBgmLoopToggle = useCallback(() => {
    const newLoop = !bgmLoop;
    audioStore.getState().setBgmLoop(newLoop);
    if (bgmAudioRef.current) {
      bgmAudioRef.current.loop = newLoop;
    }
  }, [bgmLoop]);

  const handleBgmSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = time;
      audioStore.getState().setBgmTime(time);
    }
  }, []);

  // BGM audio setup
  useEffect(() => {
    if (bgmTrack) {
      if (!bgmAudioRef.current) {
        bgmAudioRef.current = new Audio(bgmTrack.file);
        bgmAudioRef.current.addEventListener('timeupdate', () => {
          if (bgmAudioRef.current) {
            audioStore.getState().setBgmTime(bgmAudioRef.current!.currentTime);
          }
        });
        bgmAudioRef.current.addEventListener('loadedmetadata', () => {
          if (bgmAudioRef.current) {
            audioStore.getState().setBgmDuration(bgmAudioRef.current!.duration);
          }
        });
        bgmAudioRef.current.addEventListener('ended', () => {
          if (!bgmLoop) {
            audioStore.getState().setBgmPlaying(false);
          }
        });
      } else {
        bgmAudioRef.current.src = bgmTrack.file;
      }
      bgmAudioRef.current.loop = bgmLoop;
      bgmAudioRef.current.volume = bgmVolume;
    }
    return () => {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current.src = '';
      }
    };
  }, [bgmTrack]);

  // Sound effect handlers
  const playSoundEffect = useCallback(async (effect: SoundEffect) => {
    try {
      let arrayBuffer: ArrayBuffer;

      if (effect.file.startsWith('data:')) {
        // Handle base64 data URL
        const base64 = effect.file.split(',')[1];
        if (!base64) {
          console.error('[AudioPlayerPanel] Invalid base64 data URL');
          return;
        }
        let binaryString: string;
        try {
          binaryString = atob(base64);
        } catch (decodeErr) {
          console.error('[AudioPlayerPanel] Failed to decode base64:', decodeErr);
          return;
        }
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        // Handle regular URL
        const response = await fetch(effect.file);
        arrayBuffer = await response.arrayBuffer();
      }

      if (!sfxAudioContextRef.current) {
        sfxAudioContextRef.current = new AudioContext();
      }
      const ctx = sfxAudioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = effect.volume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error('[AudioPlayerPanel] Failed to play sfx:', err);
    }
  }, []);

  // Song handlers
  const currentSong = currentSongIndex >= 0 ? songs[currentSongIndex] : null;

  const handleSongPlay = useCallback(async () => {
    if (!currentSong) return;

    const audioId = currentSong.id;

    // 如果已经有音频元素且正在播放或已加载，直接暂停/播放
    if (songAudioRef.current && songAudioRef.current.src && currentAudioIdRef.current === audioId) {
      if (currentSongPlaying) {
        songAudioRef.current.pause();
        audioStore.getState().setCurrentSongPlaying(false);
      } else {
        await songAudioRef.current.play();
        audioStore.getState().setCurrentSongPlaying(true);
      }
      return;
    }

    // 需要加载新歌曲
    if (songAudioRef.current) {
      songAudioRef.current.pause();
      songAudioRef.current.src = '';
    }
    currentAudioIdRef.current = audioId;

    const audioData = await audioStore.getState().loadSongAudioFromDb(currentSongIndex);
    if (!audioData || currentAudioIdRef.current !== audioId) {
      console.error('[AudioPlayerPanel] No audio data from IndexedDB or song changed');
      return;
    }

    const isUnsupportedVideo = audioData.startsWith('data:video/x-matroska');

    if (isUnsupportedVideo) {
      const audioEl = new Audio();
      audioEl.src = audioData;
      audioEl.addEventListener('loadedmetadata', () => {
        if (currentAudioIdRef.current === audioId) {
          audioStore.getState().setCurrentSongPlaying(true);
        }
      });
      audioEl.addEventListener('error', () => {
        console.error('[AudioPlayerPanel] MKV audio element error');
      });
      audioEl.addEventListener('timeupdate', () => {
        if (currentAudioIdRef.current === audioId) {
          audioStore.getState().setCurrentSongTime(audioEl.currentTime);
          const lyrics = currentSong.lyrics;
          const offset = audioStore.getState().lyricTimeOffset;
          if (lyrics && lyrics.length > 0) {
            const adjustedTime = audioEl.currentTime + offset;
            let lineIndex = 0;
            for (let i = 0; i < lyrics.length; i++) {
              if (lyrics[i].time <= adjustedTime) {
                lineIndex = i;
              } else {
                break;
              }
            }
            audioStore.getState().setCurrentLyricLine(lineIndex);
          }
        }
      });
      audioEl.addEventListener('ended', () => {
        if (currentAudioIdRef.current === audioId) {
          handleSongNext();
        }
      });
      songAudioRef.current = audioEl as unknown as HTMLVideoElement;
      audioEl.play().catch(console.error);
    } else {
      const videoEl = document.createElement('video');
      videoEl.style.display = 'none';
      videoEl.playsInline = true;
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = audioData;
      videoEl.addEventListener('timeupdate', () => {
        if (currentAudioIdRef.current === audioId) {
          audioStore.getState().setCurrentSongTime(videoEl.currentTime);
          // Update lyric line
          const lyrics = currentSong.lyrics;
          const offset = audioStore.getState().lyricTimeOffset;
          if (lyrics && lyrics.length > 0) {
            const adjustedTime = videoEl.currentTime + offset;
            let lineIndex = 0;
            for (let i = 0; i < lyrics.length; i++) {
              if (lyrics[i].time <= adjustedTime) {
                lineIndex = i;
              } else {
                break;
              }
            }
            audioStore.getState().setCurrentLyricLine(lineIndex);
          }
        }
      });
      videoEl.addEventListener('ended', () => {
        if (currentAudioIdRef.current === audioId) {
          handleSongNext();
        }
      });
      videoEl.addEventListener('error', () => {
        console.error('[AudioPlayerPanel] Song video error');
        if (currentAudioIdRef.current !== audioId) return;
        const audioEl = new Audio();
        audioEl.src = audioData;
        audioEl.addEventListener('loadedmetadata', () => {
          if (currentAudioIdRef.current === audioId) {
            audioStore.getState().setCurrentSongPlaying(true);
          }
        });
        audioEl.addEventListener('error', () => console.error('[AudioPlayerPanel] Fallback audio failed'));
        audioEl.addEventListener('timeupdate', () => {
          if (currentAudioIdRef.current === audioId) {
            audioStore.getState().setCurrentSongTime(audioEl.currentTime);
            // Update lyric line
            const lyrics = currentSong.lyrics;
            const offset = audioStore.getState().lyricTimeOffset;
            if (lyrics && lyrics.length > 0) {
              const adjustedTime = audioEl.currentTime + offset;
              let lineIndex = 0;
              for (let i = 0; i < lyrics.length; i++) {
                if (lyrics[i].time <= adjustedTime) {
                  lineIndex = i;
                } else {
                  break;
                }
              }
              audioStore.getState().setCurrentLyricLine(lineIndex);
            }
          }
        });
        audioEl.addEventListener('ended', () => {
          if (currentAudioIdRef.current === audioId) {
            handleSongNext();
          }
        });
        songAudioRef.current = audioEl as unknown as HTMLVideoElement;
        audioEl.play().catch(console.error);
      });
      songAudioRef.current = videoEl;
      videoEl.play().catch(console.error);
    }
    audioStore.getState().setCurrentSongPlaying(true);
  }, [currentSong, currentSongIndex, currentSongPlaying]);

  const handleSongNext = useCallback(() => {
    audioStore.getState().playNextSong();
  }, []);

  const handleSongPrev = useCallback(() => {
    audioStore.getState().playPrevSong();
  }, []);

  const handleSongSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (songAudioRef.current) {
      songAudioRef.current.currentTime = time;
      audioStore.getState().setCurrentSongTime(time);
    }
  }, []);

  // Song audio setup
  // Ref to track current audio element for cleanup
  const currentAudioIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentSong) return;

    const audioId = currentSong.id;
    currentAudioIdRef.current = audioId;

    const loadAndPlayAudio = async () => {
      // 强制停止之前的音频
      if (songAudioRef.current) {
        songAudioRef.current.pause();
        songAudioRef.current.src = '';
      }

      // 再次检查是否已被切换（因为是异步的）
      if (currentAudioIdRef.current !== audioId) {
        return;
      }

      // 从 IndexedDB 加载音频数据
      const audioData = await audioStore.getState().loadSongAudioFromDb(currentSongIndex);
      if (!audioData) {
        console.error('[AudioPlayerPanel] No audio data from IndexedDB');
        return;
      }

      // 再次检查是否已被切换
      if (currentAudioIdRef.current !== audioId) {
        return;
      }

      // 检测是否是浏览器不支持的视频格式（mkv 等），尝试只用 audio 元素播放音频轨道
      const isUnsupportedVideo = audioData.startsWith('data:video/x-matroska');

      if (isUnsupportedVideo) {
        const audioEl = new Audio();
        audioEl.src = audioData;
        audioEl.addEventListener('loadedmetadata', () => {
          if (currentAudioIdRef.current === audioId) {
            audioStore.getState().setCurrentSongPlaying(true);
          }
        });
        audioEl.addEventListener('error', () => {
          console.error('[AudioPlayerPanel] MKV audio element error');
        });
        audioEl.addEventListener('timeupdate', () => {
          if (currentAudioIdRef.current === audioId) {
            audioStore.getState().setCurrentSongTime(audioEl.currentTime);
            // Update lyric line
            const lyrics = currentSong.lyrics;
            const offset = audioStore.getState().lyricTimeOffset;
            if (lyrics && lyrics.length > 0) {
              const adjustedTime = audioEl.currentTime + offset;
              let lineIndex = 0;
              for (let i = 0; i < lyrics.length; i++) {
                if (lyrics[i].time <= adjustedTime) {
                  lineIndex = i;
                } else {
                  break;
                }
              }
              audioStore.getState().setCurrentLyricLine(lineIndex);
            }
          }
        });
        audioEl.addEventListener('ended', () => {
          if (currentAudioIdRef.current === audioId) {
            handleSongNext();
          }
        });
        songAudioRef.current = audioEl as unknown as HTMLVideoElement;
        audioEl.play().catch(console.error);
      } else {
        const videoEl = document.createElement('video');
        videoEl.style.display = 'none';
        videoEl.playsInline = true;
        videoEl.crossOrigin = 'anonymous';
        videoEl.src = audioData;
        videoEl.addEventListener('timeupdate', () => {
          if (currentAudioIdRef.current === audioId) {
            audioStore.getState().setCurrentSongTime(videoEl.currentTime);
            const lyrics = currentSong.lyrics;
            const offset = audioStore.getState().lyricTimeOffset;
            if (lyrics && lyrics.length > 0) {
              const adjustedTime = videoEl.currentTime + offset;
              let lineIndex = 0;
              for (let i = 0; i < lyrics.length; i++) {
                if (lyrics[i].time <= adjustedTime) {
                  lineIndex = i;
                } else {
                  break;
                }
              }
              audioStore.getState().setCurrentLyricLine(lineIndex);
            }
          }
        });
        videoEl.addEventListener('ended', () => {
          if (currentAudioIdRef.current === audioId) {
            handleSongNext();
          }
        });
        videoEl.addEventListener('error', () => {
          console.error('[AudioPlayerPanel] Song video error, trying audio fallback');
          if (currentAudioIdRef.current !== audioId) return;
          const audioEl = new Audio();
          audioEl.src = audioData;
          audioEl.addEventListener('loadedmetadata', () => {
            if (currentAudioIdRef.current === audioId) {
              audioStore.getState().setCurrentSongPlaying(true);
            }
          });
          audioEl.addEventListener('error', () => {
            console.error('[AudioPlayerPanel] Fallback audio also failed');
          });
          audioEl.addEventListener('timeupdate', () => {
            if (currentAudioIdRef.current === audioId) {
              audioStore.getState().setCurrentSongTime(audioEl.currentTime);
            }
          });
          audioEl.addEventListener('ended', () => {
            if (currentAudioIdRef.current === audioId) {
              handleSongNext();
            }
          });
          songAudioRef.current = audioEl as unknown as HTMLVideoElement;
          audioEl.play().catch(console.error);
        });
        songAudioRef.current = videoEl;
      }
    };

    loadAndPlayAudio();

    return () => {
      if (songAudioRef.current && currentAudioIdRef.current === audioId) {
        songAudioRef.current.pause();
        songAudioRef.current.src = '';
      }
    };
  }, [currentSong, currentSongIndex]);

  // Scroll to active lyric line
  useEffect(() => {
    const container = document.getElementById('lyrics-container');
    const activeLine = document.getElementById('lyric-active');
    if (container && activeLine) {
      const containerHeight = container.clientHeight;
      const activeLineTop = activeLine.offsetTop;
      const activeLineHeight = activeLine.clientHeight;
      const targetScroll = activeLineTop - containerHeight / 2 + activeLineHeight / 2;
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [currentLyricLine]);

  // File handlers
  const handleAddBgmFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      const audio = new Audio(fileData);
      audio.addEventListener('loadedmetadata', () => {
        // Add to library and select it
        audioStore.getState().addBgmToLibrary({
          name: file.name.replace(/\.[^/.]+$/, ''),
          file: fileData,
          duration: audio.duration,
        });
        // Select the last added item (newest)
        const library = audioStore.getState().bgmLibrary;
        if (library.length > 0) {
          audioStore.getState().selectBgmFromLibrary(library[library.length - 1].id);
        }
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleAddSfxFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      audioStore.getState().addSoundEffect({
        name: file.name.replace(/\.[^/.]+$/, ''),
        file: fileData,
        volume: 0.8,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleAddSongFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 扩展名检查
    const videoExtensions = ['.mp4', '.mkv', '.webm', '.m4v', '.mov'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];

    const audioFile = Array.from(files).find(f => {
      const nameLower = f.name.toLowerCase();
      const isVideo = videoExtensions.some(ext => nameLower.endsWith(ext));
      const isAudio = audioExtensions.some(ext => nameLower.endsWith(ext));
      return isVideo || isAudio || f.type.startsWith('audio/') || f.type.startsWith('video/');
    });
    const lrcFile = Array.from(files).find(f => f.name.toLowerCase().endsWith('.lrc'));

    if (!audioFile) {
      return;
    }

    try {
      // 处理歌词文件（如果存在）- 需要在 addSong 之前处理
      let lyrics: LyricLine[] = [];
      let lyricFile: string | null = null;

      if (lrcFile) {
        const lrcContent = await lrcFile.text();
        lyrics = parseLRC(lrcContent);
        lyricFile = await new Promise<string>((resolve, reject) => {
          const lrcReader = new FileReader();
          lrcReader.onload = (e) => resolve(e.target?.result as string);
          lrcReader.onerror = () => reject(lrcReader.error);
          lrcReader.readAsDataURL(lrcFile);
        });
      }

      // 读取音频文件
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (e) => reject(reader.error);
        reader.readAsArrayBuffer(audioFile);
      });

      // 保存到 IndexedDB
      const mimeType = audioFile.type || (audioFile.name.toLowerCase().endsWith('.mkv') ? 'video/x-matroska' : 'audio/mpeg');
      await audioStore.getState().addSong({
        name: audioFile.name.replace(/\.[^/.]+$/, ''),
        audioDuration: 0,
        lyricFile,
        lyrics,
      }, arrayBuffer, mimeType);

      // 获取时长（可选，不影响保存）
      const isVideo = videoExtensions.some(ext => audioFile.name.toLowerCase().endsWith(ext));
      if (!isVideo || (!audioFile.name.toLowerCase().endsWith('.mkv') && audioFile.type !== 'video/x-matroska')) {
        const tempBlob = new Blob([arrayBuffer], { type: mimeType });
        const tempUrl = URL.createObjectURL(tempBlob);
        const mediaEl = document.createElement(isVideo ? 'video' : 'audio');
        mediaEl.src = tempUrl;
        try {
          const duration = await new Promise<number>((resolve) => {
            mediaEl.addEventListener('loadedmetadata', () => resolve(mediaEl.duration));
            mediaEl.addEventListener('error', () => resolve(0));
          });
          if (duration > 0) {
            // Update song duration in store
          }
        } catch (e) {
          // Ignore duration errors
        }
      }
    } catch (err) {
      console.error('[AudioPlayerPanel] Error adding song:', err);
    }
    e.target.value = '';
  }, []);

  // Position drag handlers
  const handlePositionDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    positionDragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: floatingPos.x,
      startPosY: floatingPos.y,
    };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
  }, [floatingPos.x, floatingPos.y]);

  const handleSizeDragStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    sizeDragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: floatingPos.width,
      startHeight: floatingPos.height,
    };
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
  }, [floatingPos.width, floatingPos.height]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (positionDragRef.current) {
        const deltaX = e.clientX - positionDragRef.current.startMouseX;
        const deltaY = e.clientY - positionDragRef.current.startMouseY;
        const newPos = {
          ...floatingPos,
          x: positionDragRef.current.startPosX + deltaX,
          y: positionDragRef.current.startPosY + deltaY,
        };
        setFloatingPos(newPos);
        saveAudioFloatingPosition(newPos);
      }
      if (sizeDragRef.current) {
        const deltaX = e.clientX - sizeDragRef.current.startMouseX;
        const deltaY = e.clientY - sizeDragRef.current.startMouseY;
        const newPos = {
          ...floatingPos,
          width: Math.max(280, Math.min(500, sizeDragRef.current.startWidth + deltaX)),
          height: Math.max(300, Math.min(700, sizeDragRef.current.startHeight + deltaY)),
        };
        setFloatingPos(newPos);
        saveAudioFloatingPosition(newPos);
      }
    };

    const handleMouseUp = () => {
      positionDragRef.current = null;
      sizeDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [floatingPos]);

  // Listen for sfx play events
  useEffect(() => {
    const handleSfxPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; effect: SoundEffect }>;
      playSoundEffect(customEvent.detail.effect);
    };
    window.addEventListener('audio:play-sfx', handleSfxPlay);
    return () => window.removeEventListener('audio:play-sfx', handleSfxPlay);
  }, [playSoundEffect]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="floating-panel floating-panel--audio"
      style={{
        position: 'absolute',
        left: floatingPos.x,
        top: floatingPos.y,
        width: floatingPos.width,
        height: floatingPos.height,
        cursor: 'move',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={handlePositionDragStart}
    >
      <div className="floating-panel__header">
        <span className="floating-panel__title">音频播放器</span>
        <span
          className="floating-panel__resize-hint"
          onMouseDown={handleSizeDragStart}
        >⋮⋮</span>
      </div>

      {/* Tabs */}
      <div className="audio-tabs">
        <button
          className={`audio-tab ${activeTab === 'bgm' ? 'active' : ''}`}
          onClick={() => setActiveTab('bgm')}
        >
          背景音乐
        </button>
        <button
          className={`audio-tab ${activeTab === 'sfx' ? 'active' : ''}`}
          onClick={() => setActiveTab('sfx')}
        >
          音效
        </button>
        <button
          className={`audio-tab ${activeTab === 'song' ? 'active' : ''}`}
          onClick={() => setActiveTab('song')}
        >
          点歌
        </button>
      </div>

      <div className="audio-content">
        {/* BGM Section */}
        {activeTab === 'bgm' && (
          <div className="audio-section">
            {/* Current BGM info */}
            <div className="bgm-info">
              <span className="bgm-name">{bgmTrack?.name || '未选择背景音乐'}</span>
            </div>

            {/* Progress */}
            <div className="progress-row">
              <span className="time-label">{formatTime(bgmTime)}</span>
              <input
                type="range"
                className="progress-slider"
                min={0}
                max={bgmDuration || 100}
                value={bgmTime}
                onChange={handleBgmSeek}
                disabled={!bgmTrack}
              />
              <span className="time-label">{formatTime(bgmDuration)}</span>
            </div>

            {/* Controls */}
            <div className="controls-row">
              <button className="ctrl-btn" onClick={handleBgmStop} disabled={!bgmTrack}>
                ⏹
              </button>
              <button className="ctrl-btn ctrl-btn--play" onClick={handleBgmPlay} disabled={!bgmTrack}>
                {bgmPlaying ? '⏸' : '▶'}
              </button>
              <button
                className={`ctrl-btn ${bgmLoop ? 'ctrl-btn--active' : ''}`}
                onClick={handleBgmLoopToggle}
                title="循环"
              >
                🔁
              </button>
            </div>

            {/* Volume */}
            <div className="volume-row">
              <span className="volume-label">音量</span>
              <input
                type="range"
                className="volume-slider"
                min={0}
                max={1}
                step={0.01}
                value={bgmVolume}
                onChange={handleBgmVolumeChange}
              />
              <span className="volume-value">{Math.round(bgmVolume * 100)}%</span>
            </div>

            {/* BGM Library */}
            {bgmLibrary.length > 0 && (
              <div className="bgm-library">
                <div className="bgm-library-header">音乐库 ({bgmLibrary.length})</div>
                {bgmLibrary.map((bgm) => (
                  <div
                    key={bgm.id}
                    className={`bgm-library-item ${bgmTrack?.id === bgm.id ? 'bgm-library-item--active' : ''}`}
                    onClick={() => audioStore.getState().selectBgmFromLibrary(bgm.id)}
                  >
                    <span className="bgm-library-name">{bgm.name}</span>
                    <button
                      className="bgm-library-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        audioStore.getState().removeBgmFromLibrary(bgm.id);
                      }}
                      title="从库中移除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add BGM */}
            <label className="file-load-btn">
              添加到音乐库
              <input
                type="file"
                accept="audio/*,video/mp4,video/webm,video/*"
                onChange={handleAddBgmFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* SFX Section */}
        {activeTab === 'sfx' && (
          <div className="audio-section">
            <div className="sfx-grid">
              {soundEffects.map((effect) => (
                <button
                  key={effect.id}
                  className="sfx-btn"
                  onClick={() => playSoundEffect(effect)}
                  title={effect.name}
                >
                  {effect.name}
                </button>
              ))}
            </div>

            <label className="file-load-btn">
              添加音效
              <input
                type="file"
                accept="audio/*,video/mp4,video/webm,video/*"
                onChange={handleAddSfxFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* Song Section */}
        {activeTab === 'song' && (
          <div className="audio-section">
            {/* Current song with lyrics */}
            {currentSong ? (
              <div className="song-player">
                <div className="song-name">{currentSong.name}</div>

                {/* Lyrics offset controls */}
                <div className="song-lyric-offset">
                  <button
                    className="song-offset-btn"
                    onClick={() => audioStore.getState().adjustLyricTimeOffset(-0.5)}
                    title="歌词提前0.5秒"
                  >
                    -0.5
                  </button>
                  <button
                    className="song-offset-btn"
                    onClick={() => audioStore.getState().adjustLyricTimeOffset(-0.1)}
                    title="歌词提前0.1秒"
                  >
                    -0.1
                  </button>
                  <span className="song-offset-value">
                    {lyricTimeOffset > 0 ? '+' : ''}{lyricTimeOffset.toFixed(1)}s
                  </span>
                  <button
                    className="song-offset-btn"
                    onClick={() => audioStore.getState().adjustLyricTimeOffset(0.1)}
                    title="歌词延后0.1秒"
                  >
                    +0.1
                  </button>
                  <button
                    className="song-offset-btn"
                    onClick={() => audioStore.getState().adjustLyricTimeOffset(0.5)}
                    title="歌词延后0.5秒"
                  >
                    +0.5
                  </button>
                </div>

                {/* Lyrics display */}
                <div className="lyrics-container" id="lyrics-container">
                  {currentSong?.lyrics?.length > 0 ? (
                    (() => {
                      const { before, current, after } = getVisibleLyrics(currentSong.lyrics, currentSongTime, lyricTimeOffset);
                      return (
                        <div className="lyrics">
                          {before.map((line, idx) => (
                            <div key={`before-${idx}`} className="lyric-line lyric-line--passed">
                              {line.text}
                            </div>
                          ))}
                          {current && (
                            <div className="lyric-line lyric-line--active" id="lyric-active">
                              {current.text}
                            </div>
                          )}
                          {after.slice(0, 5).map((line, idx) => (
                            <div key={`after-${idx}`} className="lyric-line">
                              {line.text}
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="lyrics-empty">暂无歌词</div>
                  )}
                </div>

                {/* Progress */}
                <div className="progress-row">
                  <span className="time-label">{formatTime(currentSongTime)}</span>
                  <input
                    type="range"
                    className="progress-slider"
                    min={0}
                    max={currentSong.audioDuration}
                    value={currentSongTime}
                    onChange={handleSongSeek}
                  />
                  <span className="time-label">{formatTime(currentSong.audioDuration)}</span>
                </div>

                {/* Controls */}
                <div className="controls-row">
                  <button className="ctrl-btn" onClick={handleSongPrev}>⏮</button>
                  <button className="ctrl-btn ctrl-btn--play" onClick={handleSongPlay}>
                    {currentSongPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="ctrl-btn" onClick={handleSongNext}>⏭</button>
                </div>
              </div>
            ) : (
              <div className="song-empty">
                <div>未加载歌曲</div>
                <div className="song-hint">点击下方添加歌曲和歌词文件(.lrc)</div>
              </div>
            )}

            {/* Song list */}
            {songs.length > 0 && (
              <div className="song-list">
                <div className="song-list-header">播放列表 ({songs.length})</div>
                {songs.map((song, idx) => (
                  <div
                    key={song.id}
                    className={`song-list-item ${idx === currentSongIndex ? 'song-list-item--active' : ''}`}
                    onClick={() => audioStore.getState().setCurrentSongIndex(idx)}
                  >
                    <span className="song-list-name">{song.name}</span>
                    <button
                      className="song-list-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        audioStore.getState().removeSong(song.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Load song */}
            <label className="file-load-btn">
              添加歌曲 (音频 + 歌词)
              <input
                type="file"
                accept="audio/*,video/*,.mp4,.mkv,.m4a,.m4v,.mov,.webm,.wav,.ogg,.flac,.aac,.lrc"
                multiple
                onChange={handleAddSongFiles}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}