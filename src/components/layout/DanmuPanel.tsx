import { useState, useEffect, useRef, useCallback } from 'react';
import { danmuStore } from '../../stores/danmuStore';
import { scriptStore } from '../../stores/scriptStore';
import { themeStore } from '../../stores/themeStore';
import { layoutStore } from '../../stores/layoutStore';
import { getDanmuReplyService } from '../../services/DanmuReplyService';
import { getPersonaService } from '../../services/PersonaService';
import type { Danmu, DanmuType, Script, AIReplyItem, DanmuReplyResponse } from '../../types';

export interface DanmuPanelProps {
  className?: string;
}

// Danmu type to color mapping
const DANMU_TYPE_COLORS: Record<DanmuType, string> = {
  normal: '#888888',
  gift: '#ff4444',
  big_gift: '#ff0000',
  follower: '#00bcd4',
  question: '#2196f3',
  hater: '#ff9800',
  ribbit: '#9c27b0',
  provocative: '#ff5722',
  vip: '#ffd700',
  pk: '#e91e63',
  praise: '#4caf50',
};

// Importance to highlight style mapping
const IMPORTANCE_STYLES = {
  normal: '',
  highlight: 'rgba(33, 150, 243, 0.15)',
  danger: 'rgba(244, 67, 53, 0.15)',
};

const DANMU_STORAGE_KEY = 'wordshot-danmu-state';

interface DanmuPanelState {
  isScrolling: boolean;
  scrollSpeed: number;
}

const DEFAULT_DANMU_STATE: DanmuPanelState = {
  isScrolling: true,
  scrollSpeed: 1,
};

function loadDanmuState(): DanmuPanelState {
  try {
    const saved = localStorage.getItem(DANMU_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_DANMU_STATE, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('[DanmuPanel] Failed to load state:', e);
  }
  return DEFAULT_DANMU_STATE;
}

function saveDanmuState(state: DanmuPanelState): void {
  try {
    localStorage.setItem(DANMU_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[DanmuPanel] Failed to save state:', e);
  }
}

// Merge danmu with its recommendations for display
interface DanmuWithReply {
  danmu: Danmu;
  reply: AIReplyItem | null;
  matchType: 'trigger' | 'content' | 'llm' | null;
}

export default function DanmuPanel({ className = '' }: DanmuPanelProps) {
  const danmuList = danmuStore((state) => state.danmuList);
  const highlightedDanmu = danmuStore((state) => state.highlightedDanmu);
  const filteredDanmu = danmuStore((state) => state.filteredDanmu);
  const setHighlightedDanmu = danmuStore((state) => state.setHighlightedDanmu);
  const toggleSelectedForReply = danmuStore((state) => state.toggleSelectedForReply);

  const addScript = scriptStore((state) => state.addScript);
  const activeTheme = themeStore((state) => state.getActiveTheme());

  // Store recommendations by danmu id
  const recommendationsMapRef = useRef<Record<string, DanmuReplyResponse>>({});
  const [recommendationsMap, setRecommendationsMap] = useState<Record<string, DanmuReplyResponse>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [opacity, setOpacity] = useState(1);
  const [isScrolling, setIsScrolling] = useState(DEFAULT_DANMU_STATE.isScrolling);
  const [scrollSpeed, setScrollSpeed] = useState(DEFAULT_DANMU_STATE.scrollSpeed);
  const listRef = useRef<HTMLDivElement>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const prevDanmuLengthRef = useRef(0);
  const positionDragRef = useRef<{ startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);
  const sizeDragRef = useRef<{ startMouseX: number; startMouseY: number; startWidth: number; startHeight: number } | null>(null);

  const { floatingPositions, setFloatingPosition } = layoutStore();
  const floatingPos = floatingPositions.danmu || { x: 600, y: 80, width: 300, height: 400 };

  // Load state from storage
  useEffect(() => {
    const state = loadDanmuState();
    setIsScrolling(state.isScrolling);
    setScrollSpeed(state.scrollSpeed);
  }, []);

  // Sync opacity with transparency settings
  useEffect(() => {
    const handleTransparencyChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; value: number }>;
      if (customEvent.detail?.type === 'danmu') {
        setOpacity(customEvent.detail.value);
      }
    };
    const loadOpacity = () => {
      const saved = localStorage.getItem('wordshot-danmu-opacity');
      if (saved) setOpacity(parseFloat(saved));
    };
    loadOpacity();
    window.addEventListener('transparency-changed', handleTransparencyChange);
    return () => window.removeEventListener('transparency-changed', handleTransparencyChange);
  }, []);

  // Auto-highlight newest danmu when new ones arrive
  useEffect(() => {
    if (danmuList.length === 0) return;

    // Get the newest danmu (last in array)
    const newestDanmu = danmuList[danmuList.length - 1];
    if (!newestDanmu) return;

    // Skip if already highlighted
    if (newestDanmu.id === highlightedDanmu?.id) return;

    // Auto-highlight the newest danmu
    setHighlightedDanmu(newestDanmu);
  }, [danmuList, highlightedDanmu, setHighlightedDanmu]);

  // Generate recommendations for ALL danmu when danmuList changes
  useEffect(() => {
    const generateForDanmu = async (danmu: Danmu) => {
      if (recommendationsMapRef.current[danmu.id]) return; // Already have recommendation

      try {
        const danmuReplyService = getDanmuReplyService();
        const personaService = getPersonaService();
        const activePersona = personaService.getActivePersona();

        const response = await danmuReplyService.generateReply(
          { danmu, persona: activePersona },
          { maxReplies: 1 }
        );

        recommendationsMapRef.current[danmu.id] = response;
        setRecommendationsMap((prev) => ({
          ...prev,
          [danmu.id]: response,
        }));
      } catch (error) {
        console.error('Failed to generate reply for danmu:', error);
      }
    };

    // Generate recommendations for all danmu that don't have them yet
    danmuList.forEach((danmu) => {
      if (!recommendationsMapRef.current[danmu.id]) {
        generateForDanmu(danmu);
      }
    });
  }, [danmuList]);

  const handleSaveReply = useCallback(
    (danmuId: string) => {
      const response = recommendationsMap[danmuId];
      if (!response) return;

      const topReply = response.replies[0];
      if (!topReply) return;

      const newScript: Script = {
        id: `pending-${Date.now()}-${topReply.reply.order}`,
        category: 'interaction',
        content: topReply.reply.content,
        color: activeTheme?.accentColor || '#e94560',
        priority: Math.round(topReply.reply.confidence * 10),
        triggers: [],
        tags: ['ai-generated', 'danmu-reply'],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      scriptStore.setState((state) => ({
        pendingScripts: [...state.pendingScripts, newScript],
      }));
    },
    [recommendationsMap, activeTheme]
  );

  const handleTempFavorite = useCallback((danmu: Danmu) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(danmu.id)) {
        next.delete(danmu.id);
      } else {
        next.add(danmu.id);
      }
      return next;
    });
  }, []);

  const handleQuickAddToLibrary = useCallback(
    (danmu: Danmu) => {
      const newScript: Script = {
        id: `script-${Date.now()}`,
        category: 'interaction',
        content: danmu.content,
        color: activeTheme?.accentColor || '#e94560',
        priority: 5,
        triggers: [],
        tags: ['danmu-captured'],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addScript(newScript);
    },
    [addScript, activeTheme]
  );

  const getDanmuStyle = (danmu: Danmu): React.CSSProperties => {
    return {
      color: DANMU_TYPE_COLORS[danmu.type] || DANMU_TYPE_COLORS.normal,
      backgroundColor: IMPORTANCE_STYLES[danmu.importance],
      borderLeft: danmu.importance === 'danger' ? '3px solid #f44336' : danmu.importance === 'highlight' ? '3px solid #2196f3' : undefined,
    };
  };

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

  // Size drag handlers
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

  // Global mouse move/up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (positionDragRef.current) {
        const deltaX = e.clientX - positionDragRef.current.startMouseX;
        const deltaY = e.clientY - positionDragRef.current.startMouseY;
        setFloatingPosition('danmu', {
          ...floatingPos,
          x: positionDragRef.current.startPosX + deltaX,
          y: positionDragRef.current.startPosY + deltaY,
        });
      }
      if (sizeDragRef.current) {
        const deltaX = e.clientX - sizeDragRef.current.startMouseX;
        const deltaY = e.clientY - sizeDragRef.current.startMouseY;
        setFloatingPosition('danmu', {
          ...floatingPos,
          width: Math.max(150, Math.min(600, sizeDragRef.current.startWidth + deltaX)),
          height: Math.max(200, Math.min(600, sizeDragRef.current.startHeight + deltaY)),
        });
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
  }, [floatingPos, setFloatingPosition]);

  // Reverse to show newest at top
  const displayDanmu = filteredDanmu.length > 0 ? filteredDanmu : danmuList;
  const reversedDanmu = [...displayDanmu].reverse();

  // Build danmu with reply list
  const danmuWithReplies: DanmuWithReply[] = reversedDanmu.map((danmu) => {
    const response = recommendationsMap[danmu.id];
    const topReply = response?.replies[0];
    return {
      danmu,
      reply: topReply?.reply || null,
      matchType: topReply?.matchType || null,
    };
  });

  return (
    <div
      className="floating-panel floating-panel--danmu"
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
        <span className="floating-panel__title">公屏互动</span>
        <span
          className="floating-panel__resize-hint"
          onMouseDown={handleSizeDragStart}
        >⋮⋮</span>
      </div>
      <div
        className={`danmu-panel ${className}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'transparent',
          overflow: 'hidden',
          opacity,
        }}
      >
      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button
          onClick={() => {
            setIsScrolling(!isScrolling);
            saveDanmuState({ isScrolling: !isScrolling, scrollSpeed });
          }}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: isScrolling ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)',
            color: isScrolling ? '#4caf50' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
          }}
        >
          {isScrolling ? '⏸ 滚动中' : '▶ 开始滚动'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>速度:</span>
          {[0.5, 1, 1.5, 2].map((speed) => (
            <button
              key={speed}
              onClick={() => {
                setScrollSpeed(speed);
                saveDanmuState({ isScrolling, scrollSpeed: speed });
              }}
              style={{
                padding: '2px 6px',
                fontSize: '10px',
                border: 'none',
                borderRadius: '3px',
                backgroundColor: scrollSpeed === speed ? 'rgba(233, 69, 96, 0.3)' : 'transparent',
                color: scrollSpeed === speed ? '#e94560' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Danmu List - no visible scrollbar, push-up effect */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          scrollBehavior: 'smooth',
        }}
        className="danmu-list-container"
      >
        {danmuWithReplies.map(({ danmu, reply, matchType }) => (
          <DanmuItem
            key={danmu.id}
            danmu={danmu}
            reply={reply}
            matchType={matchType}
            isHighlighted={highlightedDanmu?.id === danmu.id}
            isFavorite={favorites.has(danmu.id)}
            isSelected={danmu.selectedForReply}
            style={getDanmuStyle(danmu)}
            onHighlight={() => setHighlightedDanmu(danmu)}
            onToggleFavorite={() => handleTempFavorite(danmu)}
            onQuickAdd={() => handleQuickAddToLibrary(danmu)}
            onToggleSelect={() => toggleSelectedForReply(danmu.id)}
            onSaveReply={() => handleSaveReply(danmu.id)}
          />
        ))}
        {displayDanmu.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
            }}
          >
            暂无弹幕
          </div>
        )}
      </div>

      <style>{`
        .danmu-list-container::-webkit-scrollbar {
          display: none;
        }
        .danmu-list-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      </div>
    </div>
  );
}

// Danmu Item Component with inline reply
interface DanmuItemProps {
  danmu: Danmu;
  reply: AIReplyItem | null;
  matchType: 'trigger' | 'content' | 'llm' | null;
  isHighlighted: boolean;
  isFavorite: boolean;
  isSelected: boolean;
  style: React.CSSProperties;
  onHighlight: () => void;
  onToggleFavorite: () => void;
  onQuickAdd: () => void;
  onToggleSelect: () => void;
  onSaveReply: () => void;
}

function DanmuItem({
  danmu,
  reply,
  matchType,
  isHighlighted,
  isFavorite,
  isSelected,
  style,
  onHighlight,
  onToggleFavorite,
  onQuickAdd,
  onToggleSelect,
  onSaveReply,
}: DanmuItemProps) {
  const [showActions, setShowActions] = useState(false);

  const typeLabel = matchType === 'trigger' ? '触发' : matchType === 'content' ? '内容' : matchType === 'llm' ? 'AI' : null;

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onHighlight}
      style={{
        ...style,
        padding: '10px 12px',
        marginBottom: '6px',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        opacity: isHighlighted ? 1 : 0.9,
        transform: isHighlighted ? 'scale(1.01)' : 'scale(1)',
        border: isSelected ? '1px solid rgba(233, 69, 96, 0.5)' : '1px solid transparent',
        position: 'relative',
      }}
    >
      {/* Main content - single line: 用户名：弹幕内容 */}
      <div
        style={{
          fontSize: '14px',
          lineHeight: 1.4,
          color: 'inherit',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
        }}
      >
        {/* Badges */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {danmu.type === 'vip' && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 5px',
                borderRadius: '3px',
                backgroundColor: '#ffd700',
                color: '#000',
                fontWeight: 700,
              }}
            >
              VIP
            </span>
          )}
          {danmu.type === 'big_gift' && (
            <span style={{ fontSize: '12px' }}>🎁</span>
          )}
          {isFavorite && <span style={{ fontSize: '12px' }}>⭐</span>}
        </div>

        {/* Danmu text */}
        <span style={{ fontWeight: 600, color: DANMU_TYPE_COLORS[danmu.type] || DANMU_TYPE_COLORS.normal }}>
          {danmu.username}：
        </span>
        <span style={{ flex: 1 }}>{danmu.content}</span>
      </div>

      {/* Inline reply - show for all danmu with generated reply */}
      {reply && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 10px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '5px',
            borderLeft: '3px solid #4caf50',
          }}
        >
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
            推荐回复：
          </div>
          <div style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.4 }}>
            {reply.content}
          </div>
          {typeLabel && (
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px',
                color: matchType === 'trigger' ? '#4caf50' : matchType === 'content' ? '#2196f3' : '#9c27b0',
                backgroundColor: matchType === 'trigger' ? 'rgba(76,175,80,0.2)' : matchType === 'content' ? 'rgba(33,150,243,0.2)' : 'rgba(156,39,176,0.2)',
                padding: '2px 5px',
                borderRadius: '3px',
              }}>
                {typeLabel}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveReply();
                }}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  border: 'none',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                }}
                title="存入话术库"
              >
                + 存入话术库
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {showActions && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            display: 'flex',
            gap: '5px',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isFavorite ? '#ffd700' : 'rgba(255,255,255,0.2)',
              color: isFavorite ? '#000' : '#fff',
              cursor: 'pointer',
            }}
            title={isFavorite ? '取消收藏' : '临时收藏'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'rgba(76, 175, 80, 0.8)',
              color: '#fff',
              cursor: 'pointer',
            }}
            title="快速加入话术库"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            style={{
              padding: '3px 8px',
              fontSize: '10px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isSelected ? '#e94560' : 'rgba(255,255,255,0.2)',
              color: '#fff',
              cursor: 'pointer',
            }}
            title={isSelected ? '取消选择' : '选择回复'}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}