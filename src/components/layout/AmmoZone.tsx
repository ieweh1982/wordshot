import { useEffect, useRef, useCallback, useState } from 'react';
import { useAmmoStore } from '../../stores/ammoStore';
import { useScriptStore } from '../../stores/scriptStore';
import { useThemeStore } from '../../stores/themeStore';
import type { Script, ScriptCategory, TriggerType, AmmoSlotConfig } from '../../types';
import './AmmoZone.css';

interface AmmoZoneProps {
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

// Individual card with scrolling content
function ScrollingCard({
  slot,
  scripts,
  cardColor,
  isSelected,
  isPlaying,
  onTogglePlay,
  onResizeStart,
  onPositionDragStart,
  cardWidth,
  cardPosition,
  fontSize,
}: {
  slot: AmmoSlotConfig;
  scripts: Script[];
  cardColor: string;
  isSelected: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResizeStart: (e: React.MouseEvent, slotId: string) => void;
  onPositionDragStart: (e: React.MouseEvent, slotId: string) => void;
  cardWidth?: number;
  cardPosition?: { x: number; y: number };
  fontSize?: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const scrollYRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const lineHeight = (fontSize ?? 13) * 1.5;

  // Sync speed with ScriptView
  useEffect(() => {
    const handleSpeedChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ scrollSpeed: number }>;
      speedRef.current = customEvent.detail?.scrollSpeed || 1;
    };
    window.addEventListener('script-view-speed', handleSpeedChange);
    return () => window.removeEventListener('script-view-speed', handleSpeedChange);
  }, []);

  const getHighlightedIndex = useCallback(() => {
    if (scripts.length === 0) return -1;
    const itemHeight = lineHeight * 2;
    const scrollCycle = scripts.length * itemHeight;
    const normalizedScroll = scrollYRef.current % scrollCycle;
    const index = Math.floor(normalizedScroll / itemHeight);
    return index % scripts.length;
  }, [scripts.length, lineHeight]);

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Animation effect
  useEffect(() => {
    if (!isPlaying || scripts.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const pixelsPerSecond = lineHeight * speedRef.current;
      scrollYRef.current += pixelsPerSecond * deltaTime;

      const maxScroll = 100000;
      if (scrollYRef.current >= maxScroll) {
        scrollYRef.current = 0;
      }

      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(-${scrollYRef.current % (lineHeight * 4)}px)`;
      }

      // Update highlight based on current scroll position
      const itemHeight = lineHeight * 2;
      const scrollCycle = scripts.length * itemHeight;
      const normalizedScroll = scrollYRef.current % scrollCycle;
      const newHighlight = Math.floor(normalizedScroll / itemHeight) % scripts.length;
      setHighlightedIndex(newHighlight);

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
  }, [isPlaying, scripts.length, lineHeight]);

  const getContrastTextColor = (bgColor: string): string => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  };

  return (
    <div
      className={`ammo-card ${isSelected ? 'ammo-card--selected' : ''} ${isPlaying ? 'ammo-card--playing' : ''}`}
      style={{
        '--card-color': cardColor,
        '--card-text-color': getContrastTextColor(cardColor),
        '--card-font-size': `${fontSize}px`,
        width: cardWidth ? `${cardWidth}px` : undefined,
        position: 'absolute',
        left: cardPosition?.x ?? 0,
        top: cardPosition?.y ?? 0,
      } as React.CSSProperties}
      onMouseDown={(e) => {
        // Don't start position drag if clicking on resize handle
        if ((e.target as HTMLElement).closest('.ammo-card__resize-handle')) return;
        onPositionDragStart(e, slot.slotId);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePlay();
      }}
    >
      <div
        className="ammo-card__resize-handle"
        onMouseDown={(e) => onResizeStart(e, slot.slotId)}
      />
      <div className="ammo-card__header">
        <span className="ammo-card__hotkey">{slot.hotkey}</span>
        <span className="ammo-card__label">{CATEGORY_LABELS[slot.sourceCategory]}</span>
        {slot.autoRotateEnabled && <span className="ammo-card__auto-badge">A</span>}
      </div>
      <div className="ammo-card__content">
        <div ref={contentRef} className="ammo-card__scroll-container">
          {/* Render scripts twice for seamless loop */}
          {[...scripts, ...scripts].map((script, idx) => {
            const isHighlighted = idx === highlightedIndex + scripts.length || idx === highlightedIndex;
            return (
              <div
                key={`${script.id}-${idx}`}
                className={`ammo-card__script-block ${isHighlighted ? 'highlighted' : ''}`}
              >
                <p className="ammo-card__script">{script.content}</p>
                <div className="ammo-card__divider">---</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ammo-card__footer">
        <span className="ammo-card__counter">
          {scripts.length > 0 ? `${scripts.length} 条` : '0 条'}
        </span>
        <span className={`ammo-card__status ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? '播放中' : '已暂停'}
        </span>
      </div>
    </div>
  );
}

export function AmmoZone({ className = '' }: AmmoZoneProps) {
  const { slots, cardWidths, cardPositions, currentScripts, setCurrentScript, switchScript, setCardWidth, setCardPosition } = useAmmoStore();
  const scripts = useScriptStore(state => state.scripts);
  const { getActiveTheme } = useThemeStore();
  const [selectedSlot, setSelectedSlot] = useState<string>('slot-1');
  const [playingSlots, setPlayingSlots] = useState<Set<string>>(new Set());
  const [flashingSlots, setFlashingSlots] = useState<Set<string>>(new Set());
  const [ammoFontSize, setAmmoFontSize] = useState(13);
  const [opacity, setOpacity] = useState(1);
  const autoRotateTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const lastUsedRef = useRef<Map<string, number>>(new Map());
  const dragRef = useRef<{ slotId: string; startX: number; startWidth: number } | null>(null);
  const positionDragRef = useRef<{ slotId: string; startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Sync font size with display settings
  useEffect(() => {
    const handleDisplayChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ ammoFontSize: number }>;
      setAmmoFontSize(customEvent.detail?.ammoFontSize || 13);
    };
    const loadDisplaySettings = () => {
      try {
        const saved = localStorage.getItem('wordshot-display-settings');
        if (saved) {
          const settings = JSON.parse(saved);
          setAmmoFontSize(settings.ammoFontSize || 13);
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
      if (customEvent.detail?.type === 'ammo') {
        setOpacity(customEvent.detail.value);
      }
    };
    const loadOpacity = () => {
      const saved = localStorage.getItem('wordshot-ammo-opacity');
      if (saved) setOpacity(parseFloat(saved));
    };
    loadOpacity();
    window.addEventListener('transparency-changed', handleTransparencyChange);
    return () => window.removeEventListener('transparency-changed', handleTransparencyChange);
  }, []);

  const theme = getActiveTheme();

  // Get scripts for a specific slot category
  const getSlotScripts = useCallback((sourceCategory: ScriptCategory): Script[] => {
    return scripts.filter(s => s.category === sourceCategory);
  }, [scripts]);

  // Toggle play/pause for a specific slot
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

  // Initialize current scripts for all enabled slots
  useEffect(() => {
    slots.filter(slot => slot.enabled).forEach((slot) => {
      if (!currentScripts[slot.slotId]) {
        const slotScripts = getSlotScripts(slot.sourceCategory);
        if (slotScripts.length > 0) {
          setCurrentScript(slot.slotId, slotScripts[0]);
        }
      }
    });
  }, [slots, currentScripts, getSlotScripts, setCurrentScript]);

  // Auto-rotation for each enabled slot
  useEffect(() => {
    slots.filter(slot => slot.enabled).forEach((slot) => {
      if (slot.autoRotateEnabled) {
        const existingTimer = autoRotateTimersRef.current.get(slot.slotId);
        if (existingTimer) {
          clearInterval(existingTimer);
        }

        const timer = setInterval(() => {
          const slotScripts = getSlotScripts(slot.sourceCategory);
          switchScript(slot.slotId, slotScripts);
        }, slot.autoRotateIntervalMs);

        autoRotateTimersRef.current.set(slot.slotId, timer);
      } else {
        const existingTimer = autoRotateTimersRef.current.get(slot.slotId);
        if (existingTimer) {
          clearInterval(existingTimer);
          autoRotateTimersRef.current.delete(slot.slotId);
        }
      }
    });

    return () => {
      autoRotateTimersRef.current.forEach((timer) => clearInterval(timer));
    };
  }, [slots, getSlotScripts, switchScript]);

  // Handle keyboard events - only for slot switching, not playback control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-9 for slot switching
      if (e.key >= '1' && e.key <= '9') {
        e.stopPropagation(); // Prevent event from bubbling to ScriptView
        const enabledSlots = slots.filter(slot => slot.enabled);
        const index = parseInt(e.key, 10) - 1;
        if (index < enabledSlots.length) {
          const slot = enabledSlots[index];
          setSelectedSlot(slot.slotId);

          const slotScripts = getSlotScripts(slot.sourceCategory);
          if (slotScripts.length > 0) {
            const newScript = switchScript(slot.slotId, slotScripts);
            if (newScript) {
              lastUsedRef.current.set(newScript.id, Date.now());
            }
          }
        }
        return;
      }

      // Arrow keys for cycling scripts in selected slot
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.stopPropagation();
        e.preventDefault();
        cycleScript(selectedSlot, e.key === 'ArrowUp' ? 'prev' : 'next');
        return;
      }

      // Space to toggle auto-rotate for selected slot (not playback)
      if (e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        const slot = slots.find(s => s.slotId === selectedSlot);
        if (slot) {
          if (slot.autoRotateEnabled) {
            useAmmoStore.getState().stopAutoRotate(slot.slotId);
          } else {
            useAmmoStore.getState().startAutoRotate(slot.slotId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slots, selectedSlot, getSlotScripts, switchScript]);

  // Cycle to next/previous script for a slot
  const cycleScript = useCallback((slotId: string, direction: 'prev' | 'next') => {
    const slot = slots.find(s => s.slotId === slotId);
    if (!slot) return;

    const slotScripts = getSlotScripts(slot.sourceCategory);
    if (slotScripts.length === 0) return;

    const currentScript = currentScripts[slotId];
    const currentIdx = currentScript
      ? slotScripts.findIndex(s => s.id === currentScript.id)
      : -1;

    let newIdx: number;
    if (direction === 'next') {
      newIdx = currentIdx >= 0 ? (currentIdx + 1) % slotScripts.length : 0;
    } else {
      newIdx = currentIdx >= 0
        ? (currentIdx - 1 + slotScripts.length) % slotScripts.length
        : slotScripts.length - 1;
    }

    setCurrentScript(slotId, slotScripts[newIdx]);
  }, [slots, currentScripts, getSlotScripts, setCurrentScript]);

  // Flash a slot when triggered
  const flashSlot = useCallback((slotId: string) => {
    setFlashingSlots((prev) => new Set(prev).add(slotId));
    setTimeout(() => {
      setFlashingSlots((prev) => {
        const next = new Set(prev);
        next.delete(slotId);
        return next;
      });
    }, 500);
  }, []);

  // Position drag handlers for slot cards
  const handlePositionDragStart = useCallback((e: React.MouseEvent, slotId: string) => {
    if (e.button !== 0) return; // Only left mouse button
    e.stopPropagation();
    e.preventDefault();
    const currentPos = cardPositions[slotId] || { x: 0, y: 0 };
    positionDragRef.current = {
      slotId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: currentPos.x,
      startPosY: currentPos.y
    };
    isDraggingRef.current = true;
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
  }, [cardPositions]);

  // Resize handlers for slot cards
  const handleResizeStart = useCallback((e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startWidth = cardWidths[slotId] || 140;
    dragRef.current = { slotId, startX: e.clientX, startWidth };
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [cardWidths]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle position drag
      if (positionDragRef.current) {
        const deltaX = e.clientX - positionDragRef.current.startMouseX;
        const deltaY = e.clientY - positionDragRef.current.startMouseY;
        const newX = positionDragRef.current.startPosX + deltaX;
        const newY = positionDragRef.current.startPosY + deltaY;
        setCardPosition(positionDragRef.current.slotId, { x: newX, y: newY });
      }
      // Handle resize drag
      if (dragRef.current) {
        const delta = e.clientX - dragRef.current.startX;
        const newWidth = Math.max(300, Math.min(650, dragRef.current.startWidth + delta));
        setCardWidth(dragRef.current.slotId, newWidth);
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      positionDragRef.current = null;
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setCardWidth, setCardPosition]);

  const getCardColor = (category: ScriptCategory): string => {
    return theme?.cardColors[category] || '#666666';
  };

  return (
    <div className={`ammo-zone ${className}`} style={{ opacity }}>
      <div className="ammo-zone__cards">
        {slots.filter(slot => slot.enabled).map((slot) => {
          const slotScripts = getSlotScripts(slot.sourceCategory);
          const cardColor = getCardColor(slot.sourceCategory);
          const isSelected = selectedSlot === slot.slotId;
          const isFlashing = flashingSlots.has(slot.slotId);
          const cardWidth = cardWidths[slot.slotId];
          const isPlaying = playingSlots.has(slot.slotId);

          return (
            <ScrollingCard
              key={slot.slotId}
              slot={slot}
              scripts={slotScripts}
              cardColor={cardColor}
              isSelected={isSelected}
              isPlaying={isPlaying}
              onTogglePlay={() => toggleSlotPlay(slot.slotId)}
              onResizeStart={handleResizeStart}
              onPositionDragStart={handlePositionDragStart}
              cardWidth={cardWidth}
              cardPosition={cardPositions[slot.slotId]}
              fontSize={ammoFontSize}
            />
          );
        })}
      </div>

      <div className="ammo-zone__shortcuts">
        <span>1-9 切换话术</span>
        <span>↑↓ 上下翻</span>
        <span>空格 自动轮换</span>
      </div>
    </div>
  );
}