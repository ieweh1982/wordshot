import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAmmoStore } from '../../stores/ammoStore';
import { useScriptStore } from '../../stores/scriptStore';
import type { Script, AmmoSlotConfig, ScriptCategory } from '../../types';
import './SlotCardPanel.css';

interface SlotCardPanelProps {
  slot: AmmoSlotConfig;
  className?: string;
}

const CATEGORY_LABELS: Record<ScriptCategory, string> = {
  thanks: '感谢',
  rebuttal: '回击',
  interaction: '互动',
  ad: '带货',
  praise: '夸奖',
  opening: '开播',
  closing: '闭播',
  lottery: '抽奖',
  crisis: '危机',
};

export function SlotCardPanel({ slot, className = '' }: SlotCardPanelProps) {
  const { cardWidths, cardHeights, cardPositions, currentScripts, setCurrentScript, switchScript, setCardWidth, setCardHeight, setCardPosition } = useAmmoStore();
  const scripts = useScriptStore(state => state.scripts);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [playingSlots, setPlayingSlots] = useState<Set<string>>(new Set());
  const [flashingSlots, setFlashingSlots] = useState<Set<string>>(new Set());
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const scrollYRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const lineHeight = 20;
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const heightDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const positionDragRef = useRef<{ startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);

  const slotScripts = scripts.filter(s => s.category === slot.sourceCategory);
  const cardWidth = cardWidths[slot.slotId] || 180;
  const cardHeight = cardHeights[slot.slotId] || 120;
  const cardPosition = cardPositions[slot.slotId] || { x: 0, y: 0 };
  const isSelected = selectedSlot === slot.slotId;
  const isPlaying = playingSlots.has(slot.slotId);

  // Sync speed with ScriptView
  useEffect(() => {
    const handleSpeedChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ scrollSpeed: number }>;
      speedRef.current = customEvent.detail?.scrollSpeed || 1;
    };
    window.addEventListener('script-view-speed', handleSpeedChange);
    return () => window.removeEventListener('script-view-speed', handleSpeedChange);
  }, []);

  // Get highlighted index based on scroll position
  const getHighlightedIndex = useCallback(() => {
    if (slotScripts.length === 0) return -1;
    const itemHeight = lineHeight * 2;
    const scrollCycle = slotScripts.length * itemHeight;
    const normalizedScroll = scrollYRef.current % scrollCycle;
    const index = Math.floor(normalizedScroll / itemHeight);
    return index % slotScripts.length;
  }, [slotScripts.length]);

  // Animation effect
  useEffect(() => {
    if (!isPlaying || slotScripts.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const scrollAmount = (speedRef.current * delta * 0.05) % (lineHeight * 2);
      scrollYRef.current += scrollAmount;

      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(-${scrollYRef.current % (lineHeight * 4)}px)`;
      }

      const newHighlighted = getHighlightedIndex();
      if (newHighlighted !== highlightedIndex) {
        setHighlightedIndex(newHighlighted);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, slotScripts.length, getHighlightedIndex, highlightedIndex]);

  const toggleSlotPlay = useCallback((slotId: string) => {
    setPlayingSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startWidth = cardWidths[slot.slotId] || 180;
    dragRef.current = { startX: e.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [cardWidths, slot.slotId]);

  const handleHeightResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startHeight = cardHeights[slot.slotId] || 120;
    heightDragRef.current = { startY: e.clientY, startHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [cardHeights, slot.slotId]);

  const handlePositionDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const currentPos = cardPositions[slot.slotId] || { x: 0, y: 0 };
    positionDragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: currentPos.x,
      startPosY: currentPos.y
    };
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
  }, [cardPositions, slot.slotId]);

  // Mouse move/up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (positionDragRef.current) {
        const deltaX = e.clientX - positionDragRef.current.startMouseX;
        const deltaY = e.clientY - positionDragRef.current.startMouseY;
        setCardPosition(slot.slotId, {
          x: positionDragRef.current.startPosX + deltaX,
          y: positionDragRef.current.startPosY + deltaY
        });
      }
      if (dragRef.current) {
        const delta = e.clientX - dragRef.current.startX;
        const newWidth = Math.max(120, Math.min(400, dragRef.current.startWidth + delta));
        setCardWidth(slot.slotId, newWidth);
      }
      if (heightDragRef.current) {
        const delta = e.clientY - heightDragRef.current.startY;
        const newHeight = Math.max(80, Math.min(400, heightDragRef.current.startHeight + delta));
        setCardHeight(slot.slotId, newHeight);
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      heightDragRef.current = null;
      positionDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [slot.slotId, setCardWidth, setCardHeight, setCardPosition]);

  const getContrastTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  };

  const cardColor = '#4a9eff';

  return (
    <div
      className={`slot-card-panel ${className}`}
      style={{
        '--card-color': cardColor,
        '--card-text-color': getContrastTextColor(cardColor),
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        position: 'absolute',
        left: cardPosition.x,
        top: cardPosition.y,
      } as React.CSSProperties}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('.slot-card-panel__resize-handle')) return;
        if ((e.target as HTMLElement).closest('.slot-card-panel__height-handle')) return;
        handlePositionDragStart(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        toggleSlotPlay(slot.slotId);
      }}
    >
      <div
        className="slot-card-panel__resize-handle"
        onMouseDown={handleResizeStart}
      />
      <div
        className="slot-card-panel__height-handle"
        onMouseDown={handleHeightResizeStart}
      />
      <div className="slot-card-panel__header">
        <span className="slot-card-panel__hotkey">{slot.hotkey}</span>
        <span className="slot-card-panel__label">{CATEGORY_LABELS[slot.sourceCategory]}</span>
        {slot.autoRotateEnabled && <span className="slot-card-panel__auto-badge">A</span>}
      </div>
      <div className="slot-card-panel__content">
        <div ref={contentRef} className="slot-card-panel__scroll-container">
          {[...slotScripts, ...slotScripts].map((script, idx) => {
            const isHighlighted = idx === highlightedIndex + slotScripts.length || idx === highlightedIndex;
            return (
              <div
                key={`${script.id}-${idx}`}
                className={`slot-card-panel__script-block ${isHighlighted ? 'highlighted' : ''}`}
              >
                <p className="slot-card-panel__script">{script.content}</p>
                <div className="slot-card-panel__divider">---</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="slot-card-panel__footer">
        <span className="slot-card-panel__counter">
          {slotScripts.length > 0 ? `${slotScripts.length} 条` : '0 条'}
        </span>
        <span className={`slot-card-panel__status ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? '播放中' : '已暂停'}
        </span>
      </div>
    </div>
  );
}