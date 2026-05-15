import React, { useEffect, useRef, useState } from 'react';
import { useAmmoStore } from '../../stores/ammoStore';
import { useThemeStore } from '../../stores/themeStore';
import type { Script } from '../../types';
import './ScriptView.css';

interface ScriptViewProps {
  className?: string;
  scripts?: Script[]; // Optional scripts from template
}

const STORAGE_KEY = 'wordshot-script-state';

interface ScriptState {
  isPlaying: boolean;
  scrollSpeed: number; // 0.5 to 5
}

const DEFAULT_STATE: ScriptState = {
  isPlaying: false,
  scrollSpeed: 1,
};

function loadScriptState(): ScriptState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_STATE, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load script state:', e);
  }
  return DEFAULT_STATE;
}

function saveScriptState(state: ScriptState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save script state:', e);
  }
}

export const ScriptView: React.FC<ScriptViewProps> = ({ className = '', scripts: externalScripts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scriptRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const scrollYRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const highlightedIdRef = useRef<string | null>(null);

  const [state, setState] = useState<ScriptState>(loadScriptState);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [highlightedScriptId, setHighlightedScriptId] = useState<string | null>(null);
  const [displayFontSize, setDisplayFontSize] = useState(28);
  const [opacity, setOpacity] = useState(1);

  const { slots, currentScripts } = useAmmoStore();
  const activeTheme = useThemeStore().getActiveTheme();

  // Sync font size with display settings
  useEffect(() => {
    const handleDisplayChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ scriptFontSize: number }>;
      setDisplayFontSize(customEvent.detail?.scriptFontSize || 28);
    };
    const loadDisplaySettings = () => {
      try {
        const saved = localStorage.getItem('wordshot-display-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setDisplayFontSize(settings.scriptFontSize || 28);
        }
      } catch {}
    };
    loadDisplaySettings();
    window.addEventListener('display-settings-changed', handleDisplayChange);
    return () => window.removeEventListener('display-settings-changed', handleDisplayChange);
  }, []);

  // Sync opacity with transparency settings
  useEffect(() => {
    const handleTransparencyChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; value: number }>;
      if (customEvent.detail?.type === 'script') {
        setOpacity(customEvent.detail.value);
      }
    };
    const loadOpacity = () => {
      const saved = localStorage.getItem('wordshot-script-opacity');
      if (saved) setOpacity(parseFloat(saved));
    };
    loadOpacity();
    window.addEventListener('transparency-changed', handleTransparencyChange);
    return () => window.removeEventListener('transparency-changed', handleTransparencyChange);
  }, []);

  // Get all scripts
  const scripts: Script[] = (externalScripts && externalScripts.length > 0)
    ? externalScripts
    : Object.values(currentScripts).filter(Boolean) as Script[];

  // Get CSS variables from theme
  const backgroundColor = activeTheme?.background || 'var(--script-bg, #1a1a2e)';
  const textColor = activeTheme?.textColor || 'var(--script-text, #ffffff)';
  const accentColor = activeTheme?.accentColor || 'var(--script-accent, #e94560)';
  const fontSize = displayFontSize;

  // Keep speedRef in sync with state
  speedRef.current = state.scrollSpeed;

  // Find highlighted script using DOM measurements
  const updateHighlight = () => {
    if (!containerRef.current || scripts.length === 0) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenterY = containerRect.top + containerRect.height / 2;

    // Find which script element is at the center
    const content = contentRef.current;
    if (!content) return;

    const children = content.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      const rect = child.getBoundingClientRect();

      // Check if this element overlaps with the center
      const elementTop = rect.top;
      const elementBottom = rect.bottom;

      if (containerCenterY >= elementTop && containerCenterY <= elementBottom) {
        // Get script id from the data-key attribute
        const key = child.getAttribute('data-key');
        if (key) {
          // Extract the original script id (before the -idx suffix)
          const lastDashIndex = key.lastIndexOf('-');
          const scriptId = lastDashIndex > 0 ? key.substring(0, lastDashIndex) : key;

          // Only highlight from first copy (index < scripts.length)
          if (i < scripts.length && highlightedIdRef.current !== scriptId) {
            highlightedIdRef.current = scriptId;
            setHighlightedScriptId(scriptId);
          }
        }
        break;
      }
    }
  };

  // Smooth scrolling animation
  useEffect(() => {
    // Initial highlight check when scripts load
    if (scripts.length > 0) {
      setTimeout(updateHighlight, 100);
    }
  }, [scripts]);

  // Emit playback state when playing changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('script-view-playback', {
      detail: { isPlaying: state.isPlaying }
    }));
  }, [state.isPlaying]);

  useEffect(() => {
    if (!state.isPlaying || scripts.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const lineHeight = fontSize * 1.6;
    const scrollUnit = lineHeight;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // Scroll upward at speed * lineHeight per second
      const pixelsPerSecond = scrollUnit * speedRef.current;
      scrollYRef.current += pixelsPerSecond * deltaTime;

      // Use a large max to allow continuous scrolling without reset
      const maxScroll = 100000;
      if (scrollYRef.current >= maxScroll) {
        scrollYRef.current = 0;
      }

      setScrollOffset(scrollYRef.current);

      // Update highlight after scroll position changes
      updateHighlight();

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [state.isPlaying, scripts.length, fontSize]);

  // Keyboard shortcuts (space, up, down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setState(prev => {
          const newState = { ...prev, isPlaying: !prev.isPlaying };
          saveScriptState(newState);

          // Notify AmmoZone of playback state change
          window.dispatchEvent(new CustomEvent('script-view-playback', {
            detail: { isPlaying: newState.isPlaying }
          }));

          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wheel speed adjustment
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.1 : -0.1;
      setState(prev => {
        const newSpeed = Math.max(0.1, Math.min(5, prev.scrollSpeed + delta));
        const newState = { ...prev, scrollSpeed: Math.round(newSpeed * 10) / 10 };
        saveScriptState(newState);
        window.dispatchEvent(new CustomEvent('script-view-speed', { detail: { scrollSpeed: newState.scrollSpeed } }));
        return newState;
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: textColor,
    '--script-accent': accentColor,
    opacity,
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`script-view ${className}`}
      style={containerStyle}
      data-opacity={opacity}
      tabIndex={0}
      onClick={() => {
        setState(prev => {
          const newState = { ...prev, isPlaying: !prev.isPlaying };
          saveScriptState(newState);
          window.dispatchEvent(new CustomEvent('script-view-playback', {
            detail: { isPlaying: newState.isPlaying }
          }));
          return newState;
        });
      }}
    >
      <div className="script-view-content">
        {scripts.length > 0 ? (
          <div className="script-view-scroll-container">
            <div
              ref={contentRef}
              className="script-view-text"
              style={{
                fontSize: `${fontSize}px`,
                transform: `translateY(-${scrollOffset}px)`,
              }}
            >
              {/* Render scripts twice for seamless loop */}
              {[...scripts, ...scripts].map((script, idx) => (
                <div key={`${script.id}-${idx}`} data-key={script.id} className="script-item">
                  <div className="script-content-wrapper">
                    {script.content.split('\n').map((line, lineIdx) => (
                      <div
                        key={lineIdx}
                        className={`script-line ${script.id === highlightedScriptId ? 'current-script' : ''}`}
                        style={{ background: 'transparent' }}
                      >
                        {line || ' '}
                      </div>
                    ))}
                  </div>
                  <div className="script-divider">
                    <span>---</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="script-view-empty">
            <span className="script-view-empty-text">暂无话术</span>
            <span className="script-view-empty-hint">
              选择模板开始直播
            </span>
          </div>
        )}
      </div>

      <div className="script-view-bottom">
        <div className="script-view-controls">
          <div className="script-view-status">
            {state.isPlaying ? (
              <span className="status-playing">播放中</span>
            ) : (
              <span className="status-paused">已暂停</span>
            )}
          </div>
          <div className="script-view-progress">
            {scripts.length > 0 ? `${scripts.length} 条话术` : '0 条话术'}
          </div>
          <div className="script-view-speed">速度: {state.scrollSpeed}x</div>
        </div>
        <div className="script-view-hint">
          空格: 暂停/继续 | 滚轮: 调速
        </div>
      </div>
    </div>
  );
};

export default ScriptView;