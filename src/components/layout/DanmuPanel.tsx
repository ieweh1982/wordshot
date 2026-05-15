import { useState, useEffect, useRef, useCallback } from 'react';
import { danmuStore } from '../../stores/danmuStore';
import { scriptStore } from '../../stores/scriptStore';
import { themeStore } from '../../stores/themeStore';
import type { Danmu, DanmuType, Script, AIRecommendationResult, AIReplyItem } from '../../types';

export interface DanmuPanelProps {
  className?: string;
}

// Danmu type to color mapping
const DANMU_TYPE_COLORS: Record<DanmuType, string> = {
  normal: 'var(--danmu-normal, #888888)',
  gift: 'var(--danmu-gift, #ff4444)',
  big_gift: 'var(--danmu-big-gift, #ff0000)',
  follower: 'var(--danmu-follower, #00bcd4)',
  question: 'var(--danmu-question, #2196f3)',
  hater: 'var(--danmu-hater, #ff9800)',
  ribbit: 'var(--danmu-ribbit, #9c27b0)',
  provocative: 'var(--danmu-provocative, #ff5722)',
  vip: 'var(--danmu-vip, #ffd700)',
  pk: 'var(--danmu-pk, #e91e63)',
  praise: 'var(--danmu-praise, #4caf50)',
};

// Importance to highlight style mapping
const IMPORTANCE_STYLES = {
  normal: '',
  highlight: 'var(--danmu-highlight-bg, rgba(33, 150, 243, 0.2))',
  danger: 'var(--danmu-danger-bg, rgba(244, 67, 53, 0.2))',
};

export default function DanmuPanel({ className = '' }: DanmuPanelProps) {
  const danmuList = danmuStore((state) => state.danmuList);
  const highlightedDanmu = danmuStore((state) => state.highlightedDanmu);
  const filteredDanmu = danmuStore((state) => state.filteredDanmu);
  const setHighlightedDanmu = danmuStore((state) => state.setHighlightedDanmu);
  const toggleSelectedForReply = danmuStore((state) => state.toggleSelectedForReply);

  const addScript = scriptStore((state) => state.addScript);
  const activeTheme = themeStore((state) => state.getActiveTheme());

  const [recommendations, setRecommendations] = useState<AIRecommendationResult | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [opacity, setOpacity] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when new danmu arrives
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [danmuList]);

  // Auto-highlight high-quality or risk danmu based on importance
  useEffect(() => {
    if (danmuList.length === 0) return;

    // Find the most important unprocessed danmu
    const unprocessedDanmu = danmuList.find((d) => d.id !== highlightedDanmu?.id);

    if (unprocessedDanmu) {
      // Auto-highlight danger and highlight importance, or high sentiment
      if (
        unprocessedDanmu.importance === 'danger' ||
        unprocessedDanmu.importance === 'highlight' ||
        unprocessedDanmu.sentiment > 0.7 ||
        unprocessedDanmu.sentiment < -0.3
      ) {
        setHighlightedDanmu(unprocessedDanmu);
      }
    }
  }, [danmuList, highlightedDanmu, setHighlightedDanmu]);

  // Generate mock AI recommendations when a danmu is highlighted
  useEffect(() => {
    if (!highlightedDanmu) {
      setRecommendations(null);
      return;
    }

    // Simulate AI recommendation generation
    // In production, this would call AIRecommendationEngine
    const mockReplies: AIReplyItem[] = [
      { order: 1, content: `谢谢 ${highlightedDanmu.username} 的关注~`, confidence: 0.95 },
      { order: 2, content: `欢迎常来玩呀主播很努力的`, confidence: 0.88 },
      { order: 3, content: `觉得主播不错的记得点个关注哦`, confidence: 0.82 },
    ];

    setRecommendations({
      danmu: highlightedDanmu,
      replies: mockReplies,
      generatedAt: Date.now(),
    });
  }, [highlightedDanmu]);

  const handleSaveToScriptLibrary = useCallback(() => {
    if (!recommendations) return;

    recommendations.replies.forEach((reply) => {
      const newScript: Script = {
        id: `pending-${Date.now()}-${reply.order}`,
        category: 'interaction',
        content: reply.content,
        color: activeTheme?.accentColor || '#e94560',
        priority: Math.round(reply.confidence * 10),
        triggers: [],
        tags: ['ai-generated', 'danmu-reply'],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add to pending scripts for review
      scriptStore.setState((state) => ({
        pendingScripts: [...state.pendingScripts, newScript],
      }));
    });

    // Clear recommendations after saving
    setRecommendations(null);
  }, [recommendations, activeTheme]);

  const handleSaveSingleReply = useCallback(
    (reply: AIReplyItem) => {
      const newScript: Script = {
        id: `pending-${Date.now()}-${reply.order}`,
        category: 'interaction',
        content: reply.content,
        color: activeTheme?.accentColor || '#e94560',
        priority: Math.round(reply.confidence * 10),
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
    [activeTheme]
  );

  const handleTempFavorite = useCallback(
    (danmu: Danmu) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(danmu.id)) {
          next.delete(danmu.id);
        } else {
          next.add(danmu.id);
        }
        return next;
      });
    },
    []
  );

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

  const displayDanmu = filteredDanmu.length > 0 ? filteredDanmu : danmuList;

  return (
    <div
      className={`danmu-panel ${className}`}
      style={
        {
          '--danmu-normal': '#888888',
          '--danmu-gift': '#ff4444',
          '--danmu-big-gift': '#ff0000',
          '--danmu-follower': '#00bcd4',
          '--danmu-question': '#2196f3',
          '--danmu-hater': '#ff9800',
          '--danmu-ribbit': '#9c27b0',
          '--danmu-provocative': '#ff5722',
          '--danmu-vip': '#ffd700',
          '--danmu-pk': '#e91e63',
          '--danmu-praise': '#4caf50',
          '--danmu-highlight-bg': 'rgba(33, 150, 243, 0.15)',
          '--danmu-danger-bg': 'rgba(244, 67, 53, 0.15)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'transparent',
          overflow: 'hidden',
          opacity,
        } as React.CSSProperties
      }
    >
      {/* Header - hidden since panel already has title */}
      <div
        style={{
          display: 'none',
        }}
      />

      {/* Danmu List */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px',
          scrollBehavior: 'smooth',
        }}
      >
        {displayDanmu.map((danmu) => (
          <DanmuItem
            key={danmu.id}
            danmu={danmu}
            isHighlighted={highlightedDanmu?.id === danmu.id}
            isFavorite={favorites.has(danmu.id)}
            isSelected={danmu.selectedForReply}
            style={getDanmuStyle(danmu)}
            onHighlight={() => setHighlightedDanmu(danmu)}
            onToggleFavorite={() => handleTempFavorite(danmu)}
            onQuickAdd={() => handleQuickAddToLibrary(danmu)}
            onToggleSelect={() => toggleSelectedForReply(danmu.id)}
          />
        ))}
        {displayDanmu.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '13px',
            }}
          >
            暂无弹幕
          </div>
        )}
      </div>

      {/* AI Recommendation Panel */}
      {recommendations && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '8px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}
        >
          <div style={{ marginBottom: '6px', fontSize: '12px' }}>
            <span style={{ color: 'var(--theme-text, #ffffff)' }}>
              推荐答复
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recommendations.replies.map((reply) => (
              <div
                key={reply.order}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.4)', minWidth: '14px' }}>
                  {reply.order}.
                </span>
                <span style={{ color: 'var(--theme-text, #ffffff)', flex: 1 }}>
                  {reply.content}
                </span>
                <button
                  onClick={() => handleSaveSingleReply(reply)}
                  style={{
                    padding: '1px 5px',
                    fontSize: '10px',
                    border: 'none',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                  }}
                  title="存入话术库"
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              gap: '6px',
            }}
          >
            <button
              onClick={handleSaveToScriptLibrary}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: 'var(--theme-accent, #e94560)',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              一键存入话术库
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Danmu Item Component
interface DanmuItemProps {
  danmu: Danmu;
  isHighlighted: boolean;
  isFavorite: boolean;
  isSelected: boolean;
  style: React.CSSProperties;
  onHighlight: () => void;
  onToggleFavorite: () => void;
  onQuickAdd: () => void;
  onToggleSelect: () => void;
}

function DanmuItem({
  danmu,
  isHighlighted,
  isFavorite,
  isSelected,
  style,
  onHighlight,
  onToggleFavorite,
  onQuickAdd,
  onToggleSelect,
}: DanmuItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onHighlight}
      style={{
        ...style,
        padding: '6px 8px',
        marginBottom: '4px',
        borderRadius: '5px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        opacity: isHighlighted ? 1 : 0.85,
        transform: isHighlighted ? 'scale(1.01)' : 'scale(1)',
        border: isSelected ? '1px solid rgba(233, 69, 96, 0.5)' : '1px solid transparent',
        position: 'relative',
      }}
    >
      {/* Username */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '3px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}
      >
        <span>{danmu.username}</span>
        {danmu.type === 'vip' && (
          <span
            style={{
              fontSize: '10px',
              padding: '1px 4px',
              borderRadius: '2px',
              backgroundColor: '#ffd700',
              color: '#000',
              fontWeight: 700,
            }}
          >
            VIP
          </span>
        )}
        {danmu.type === 'big_gift' && (
          <span style={{ fontSize: '10px' }}>🎁</span>
        )}
        {isFavorite && <span style={{ fontSize: '10px' }}>⭐</span>}
      </div>

      {/* Content */}
      <div
        style={{
          fontSize: '12px',
          lineHeight: 1.35,
          color: 'inherit',
        }}
      >
        {danmu.content}
      </div>

      {/* Quick Actions */}
      {showActions && (
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            style={{
              padding: '2px 6px',
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
              padding: '2px 6px',
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
              padding: '2px 6px',
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
