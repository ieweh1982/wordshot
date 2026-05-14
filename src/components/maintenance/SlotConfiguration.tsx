import { useState, useEffect, useCallback } from 'react';
import { useAmmoStore } from '../../stores/ammoStore';
import type { AmmoSlotConfig, ScriptCategory } from '../../types';
import './SlotConfiguration.css';

const CATEGORY_OPTIONS: { value: ScriptCategory; label: string }[] = [
  { value: 'thanks', label: '感谢' },
  { value: 'rebuttal', label: '回击' },
  { value: 'interaction', label: '互动' },
  { value: 'ad', label: '带货' },
  { value: 'praise', label: '自定义' },
  { value: 'opening', label: '开播' },
  { value: 'closing', label: '闭播' },
  { value: 'lottery', label: '抽奖' },
  { value: 'crisis', label: '危机' },
];

const DEFAULT_SLOTS: AmmoSlotConfig[] = [
  { slotId: 'slot-1', hotkey: '1', displayName: '感谢', sourceCategory: 'thanks', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-2', hotkey: '2', displayName: '回击', sourceCategory: 'rebuttal', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-3', hotkey: '3', displayName: '互动', sourceCategory: 'interaction', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-4', hotkey: '4', displayName: '带货', sourceCategory: 'ad', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-5', hotkey: '5', displayName: '自定义', sourceCategory: 'praise', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-6', hotkey: '6', displayName: '开播', sourceCategory: 'opening', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-7', hotkey: '7', displayName: '闭播', sourceCategory: 'closing', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-8', hotkey: '8', displayName: '抽奖', sourceCategory: 'lottery', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-9', hotkey: '9', displayName: '危机', sourceCategory: 'crisis', displayCount: 5, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
];

interface SlotCardProps {
  slot: AmmoSlotConfig;
  scriptCount: number;
  onUpdate: (slotId: string, updates: Partial<AmmoSlotConfig>) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function SlotCard({ slot, scriptCount, onUpdate, isExpanded, onToggleExpand }: SlotCardProps) {
  const categoryLabel = CATEGORY_OPTIONS.find(c => c.value === slot.sourceCategory)?.label || slot.sourceCategory;

  return (
    <div className={`slot-config__card ${isExpanded ? 'slot-config__card--expanded' : ''}`}>
      <div className="slot-config__card-header" onClick={onToggleExpand}>
        <div className="slot-config__card-info">
          <span className="slot-config__hotkey">{slot.hotkey}</span>
          <div className="slot-config__card-details">
            <span className="slot-config__card-name">{slot.displayName}</span>
            <span className="slot-config__card-category">{categoryLabel}</span>
          </div>
        </div>
        <div className="slot-config__card-meta">
          <span className="slot-config__script-count">{scriptCount}条话术</span>
          <span className={`slot-config__status ${slot.enabled ? 'slot-config__status--enabled' : 'slot-config__status--disabled'}`}>
            {slot.enabled ? '已启用' : '已禁用'}
          </span>
          {slot.autoRotateEnabled && (
            <span className="slot-config__auto-rotate-badge">自动轮换</span>
          )}
        </div>
        <button className="slot-config__expand-btn" type="button">
          {isExpanded ? '收起' : '编辑'}
        </button>
      </div>

      {isExpanded && (
        <div className="slot-config__card-editor">
          <div className="slot-config__form-row">
            <label className="slot-config__label">
              显示名称
              <input
                type="text"
                className="slot-config__input"
                value={slot.displayName}
                onChange={(e) => onUpdate(slot.slotId, { displayName: e.target.value })}
              />
            </label>

            <label className="slot-config__label">
              来源分类
              <select
                className="slot-config__select"
                value={slot.sourceCategory}
                onChange={(e) => onUpdate(slot.slotId, { sourceCategory: e.target.value as ScriptCategory })}
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label className="slot-config__label">
              显示数量
              <input
                type="number"
                className="slot-config__input slot-config__input--small"
                value={slot.displayCount}
                min={1}
                max={20}
                onChange={(e) => onUpdate(slot.slotId, { displayCount: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })}
              />
            </label>
          </div>

          <div className="slot-config__form-row">
            <label className="slot-config__label">
              快捷键
              <input
                type="text"
                className="slot-config__input slot-config__input--small"
                value={slot.hotkey}
                maxLength={1}
                onChange={(e) => onUpdate(slot.slotId, { hotkey: e.target.value })}
              />
            </label>

            <label className="slot-config__label slot-config__label--toggle">
              启用
              <input
                type="checkbox"
                className="slot-config__checkbox"
                checked={slot.enabled}
                onChange={(e) => onUpdate(slot.slotId, { enabled: e.target.checked })}
              />
            </label>

            <label className="slot-config__label slot-config__label--toggle">
              自动轮换
              <input
                type="checkbox"
                className="slot-config__checkbox"
                checked={slot.autoRotateEnabled}
                onChange={(e) => onUpdate(slot.slotId, { autoRotateEnabled: e.target.checked })}
              />
            </label>

            {slot.autoRotateEnabled && (
              <label className="slot-config__label">
                轮换间隔(ms)
                <input
                  type="number"
                  className="slot-config__input slot-config__input--small"
                  value={slot.autoRotateIntervalMs}
                  min={1000}
                  max={60000}
                  step={1000}
                  onChange={(e) => onUpdate(slot.slotId, { autoRotateIntervalMs: Math.max(1000, Math.min(60000, parseInt(e.target.value, 10) || 5000)) })}
                />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SlotConfiguration() {
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const slots = useAmmoStore((state) => state.slots);
  const setSlots = useAmmoStore((state) => state.setSlots);

  // Get script counts by category
  const [scriptCounts, setScriptCounts] = useState<Record<ScriptCategory, number>>(() => {
    const counts: Record<ScriptCategory, number> = {
      thanks: 0, rebuttal: 0, interaction: 0, ad: 0, praise: 0,
      opening: 0, closing: 0, lottery: 0, crisis: 0,
    };
    return counts;
  });

  // Try to get actual script counts from store if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem('wordshot_scripts');
      if (stored) {
        const scripts = JSON.parse(stored);
        const counts: Record<ScriptCategory, number> = {
          thanks: 0, rebuttal: 0, interaction: 0, ad: 0, praise: 0,
          opening: 0, closing: 0, lottery: 0, crisis: 0,
        };
        scripts.forEach((s: { category: ScriptCategory }) => {
          if (counts[s.category] !== undefined) {
            counts[s.category]++;
          }
        });
        setScriptCounts(counts);
      }
    } catch {
      // Scripts not yet loaded, use defaults
    }
  }, []);

  const handleUpdateSlot = useCallback((slotId: string, updates: Partial<AmmoSlotConfig>) => {
    const currentSlots = useAmmoStore.getState().slots;
    setSlots(currentSlots.map(slot =>
      slot.slotId === slotId ? { ...slot, ...updates } : slot
    ));
  }, [setSlots]);

  const handleResetToDefaults = useCallback(() => {
    if (window.confirm('确定要重置所有槽位配置为默认值吗？')) {
      setSlots([...DEFAULT_SLOTS]);
    }
  }, [setSlots]);

  const handleToggleExpand = useCallback((slotId: string) => {
    setExpandedSlot(prev => prev === slotId ? null : slotId);
  }, []);

  return (
    <div className="slot-config">
      <div className="slot-config__header">
        <h2 className="slot-config__title">槽位配置</h2>
        <div className="slot-config__actions">
          <button
            className="slot-config__btn slot-config__btn--secondary"
            onClick={handleResetToDefaults}
            type="button"
          >
            重置为默认
          </button>
        </div>
      </div>

      <p className="slot-config__description">
        配置9个弹药槽位，分别对应不同的快捷键和话术分类。每个槽位可独立设置来源分类、显示数量、自动轮换等参数。
      </p>

      <div className="slot-config__grid">
        {slots.map(slot => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            scriptCount={scriptCounts[slot.sourceCategory] || 0}
            onUpdate={handleUpdateSlot}
            isExpanded={expandedSlot === slot.slotId}
            onToggleExpand={() => handleToggleExpand(slot.slotId)}
          />
        ))}
      </div>

      <div className="slot-config__reference">
        <h3 className="slot-config__reference-title">槽位定义参考</h3>
        <table className="slot-config__reference-table">
          <thead>
            <tr>
              <th>槽位</th>
              <th>快捷键</th>
              <th>默认名称</th>
              <th>默认分类</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_SLOTS.map((slot, idx) => (
              <tr key={slot.slotId}>
                <td>{idx + 1}</td>
                <td><span className="slot-config__ref-hotkey">{slot.hotkey}</span></td>
                <td>{slot.displayName}</td>
                <td>{CATEGORY_OPTIONS.find(c => c.value === slot.sourceCategory)?.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
