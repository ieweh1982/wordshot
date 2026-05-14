import { useState, useEffect, useCallback } from 'react';
import { useDisplayStore } from '../../stores/displayStore';
import { useScriptStore } from '../../stores/scriptStore';
import type { AmmoSlotConfig, DisplayProfile, ScriptCategory } from '../../types';
import './DisplayConfig.css';
import { getDisplayProfiles, saveDisplayProfiles, DisplayProfilesConfig } from '../../services/configStorage';

const CATEGORY_OPTIONS: { value: ScriptCategory; label: string }[] = [
  { value: 'thanks', label: '感谢类' },
  { value: 'rebuttal', label: '回击类' },
  { value: 'interaction', label: '互动类' },
  { value: 'ad', label: '带货类' },
  { value: 'praise', label: '夸奖类' },
  { value: 'opening', label: '开播类' },
  { value: 'closing', label: '闭播类' },
  { value: 'lottery', label: '抽奖类' },
  { value: 'crisis', label: '危机类' },
];

// Default slot definitions (9 slots)
const DEFAULT_SLOTS: Omit<AmmoSlotConfig, 'enabled' | 'autoRotateEnabled' | 'autoRotateIntervalMs' | 'displayCount'>[] = [
  { slotId: 'slot-1', hotkey: '1', displayName: '感谢', sourceCategory: 'thanks' },
  { slotId: 'slot-2', hotkey: '2', displayName: '回击', sourceCategory: 'rebuttal' },
  { slotId: 'slot-3', hotkey: '3', displayName: '互动', sourceCategory: 'interaction' },
  { slotId: 'slot-4', hotkey: '4', displayName: '带货', sourceCategory: 'ad' },
  { slotId: 'slot-5', hotkey: '5', displayName: '夸奖', sourceCategory: 'praise' },
  { slotId: 'slot-6', hotkey: '6', displayName: '开播', sourceCategory: 'opening' },
  { slotId: 'slot-7', hotkey: '7', displayName: '闭播', sourceCategory: 'closing' },
  { slotId: 'slot-8', hotkey: '8', displayName: '抽奖', sourceCategory: 'lottery' },
  { slotId: 'slot-9', hotkey: '9', displayName: '危机', sourceCategory: 'crisis' },
];

export function DisplayConfig() {
  const { profiles, activeProfileId, setActiveProfile, addProfile, deleteProfile, updateSlotInProfile } = useDisplayStore();
  const { getScriptsByCategory } = useScriptStore();

  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  // Load profiles from disk on mount
  useEffect(() => {
    const savedConfig = getDisplayProfiles();
    if (savedConfig.profiles.length > 0) {
      // displayStore already has defaults, but we can merge with saved
      // For now, just ensure consistency
    }
  }, []);

  // Save profiles to disk when profiles change
  useEffect(() => {
    const config: DisplayProfilesConfig = {
      profiles,
      activeProfileId,
    };
    saveDisplayProfiles(config);
  }, [profiles, activeProfileId]);

  // Get script count for a category
  const getCategoryScriptCount = useCallback((category: ScriptCategory): number => {
    return getScriptsByCategory(category).length;
  }, [getScriptsByCategory]);

  // Update a single slot
  const handleSlotUpdate = (slotId: string, updates: Partial<AmmoSlotConfig>) => {
    if (!activeProfileId) return;
    updateSlotInProfile(activeProfileId, slotId, updates);
  };

  // Save current config as a new profile
  const handleSaveAsProfile = () => {
    if (!newProfileName.trim() || !activeProfile) return;

    const newProfile: DisplayProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      slots: [...activeProfile.slots],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addProfile(newProfile);
    setActiveProfile(newProfile.id);
    setNewProfileName('');
    setShowSaveDialog(false);
  };

  // Load a profile
  const handleLoadProfile = (profileId: string) => {
    setActiveProfile(profileId);
    setShowLoadDialog(false);
  };

  // Delete a profile
  const handleDeleteProfile = (profileId: string) => {
    if (profiles.length <= 1) return; // Don't delete the last profile
    deleteProfile(profileId);
  };

  // Render slot editor
  const renderSlotEditor = (slot: AmmoSlotConfig) => {
    const isEditing = editingSlot === slot.slotId;
    const scriptCount = getCategoryScriptCount(slot.sourceCategory);

    return (
      <div key={slot.slotId} className="display-config__slot">
        <div className="display-config__slot-header">
          <span className="display-config__slot-hotkey">{slot.hotkey}</span>
          <span className="display-config__slot-name">{slot.displayName}</span>
          <span className="display-config__slot-category">
            {CATEGORY_OPTIONS.find(c => c.value === slot.sourceCategory)?.label || slot.sourceCategory}
          </span>
          <span className="display-config__slot-count">{scriptCount}条话术</span>
          <button
            className="display-config__btn display-config__btn--edit"
            onClick={() => setEditingSlot(isEditing ? null : slot.slotId)}
          >
            {isEditing ? '收起' : '编辑'}
          </button>
        </div>

        {isEditing && (
          <div className="display-config__slot-editor">
            <div className="display-config__form-row">
              <label className="display-config__label">
                显示名称
                <input
                  type="text"
                  className="display-config__input"
                  value={slot.displayName}
                  onChange={(e) => handleSlotUpdate(slot.slotId, { displayName: e.target.value })}
                />
              </label>

              <label className="display-config__label">
                来源分类
                <select
                  className="display-config__select"
                  value={slot.sourceCategory}
                  onChange={(e) => handleSlotUpdate(slot.slotId, { sourceCategory: e.target.value as ScriptCategory })}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="display-config__label">
                显示数量
                <input
                  type="number"
                  className="display-config__input display-config__input--small"
                  value={slot.displayCount}
                  min={1}
                  max={20}
                  onChange={(e) => handleSlotUpdate(slot.slotId, { displayCount: parseInt(e.target.value, 10) || 1 })}
                />
              </label>
            </div>

            <div className="display-config__form-row">
              <label className="display-config__label">
                快捷键
                <input
                  type="text"
                  className="display-config__input display-config__input--small"
                  value={slot.hotkey}
                  maxLength={1}
                  onChange={(e) => handleSlotUpdate(slot.slotId, { hotkey: e.target.value })}
                />
              </label>

              <label className="display-config__label display-config__label--switch">
                启用
                <input
                  type="checkbox"
                  className="display-config__checkbox"
                  checked={slot.enabled}
                  onChange={(e) => handleSlotUpdate(slot.slotId, { enabled: e.target.checked })}
                />
              </label>

              <label className="display-config__label display-config__label--switch">
                自动轮换
                <input
                  type="checkbox"
                  className="display-config__checkbox"
                  checked={slot.autoRotateEnabled}
                  onChange={(e) => handleSlotUpdate(slot.slotId, { autoRotateEnabled: e.target.checked })}
                />
              </label>

              {slot.autoRotateEnabled && (
                <label className="display-config__label">
                  轮换间隔(ms)
                  <input
                    type="number"
                    className="display-config__input display-config__input--small"
                    value={slot.autoRotateIntervalMs}
                    min={1000}
                    max={60000}
                    step={1000}
                    onChange={(e) => handleSlotUpdate(slot.slotId, { autoRotateIntervalMs: parseInt(e.target.value, 10) || 5000 })}
                  />
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="display-config">
      <div className="display-config__header">
        <h2 className="display-config__title">槽位配置</h2>

        <div className="display-config__actions">
          <button
            className="display-config__btn display-config__btn--primary"
            onClick={() => setShowSaveDialog(true)}
          >
            保存当前配置为预设
          </button>
          <button
            className="display-config__btn"
            onClick={() => setShowLoadDialog(true)}
          >
            加载预设方案
          </button>
        </div>
      </div>

      {/* Active profile info */}
      <div className="display-config__profile-info">
        <span>当前方案: <strong>{activeProfile?.name || '默认配置'}</strong></span>
        <span>共 {profiles.length} 个预设方案</span>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="display-config__dialog-overlay">
          <div className="display-config__dialog">
            <h3 className="display-config__dialog-title">保存为预设方案</h3>
            <input
              type="text"
              className="display-config__input display-config__input--full"
              placeholder="请输入预设方案名称"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              autoFocus
            />
            <div className="display-config__dialog-actions">
              <button
                className="display-config__btn display-config__btn--primary"
                onClick={handleSaveAsProfile}
                disabled={!newProfileName.trim()}
              >
                保存
              </button>
              <button
                className="display-config__btn"
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewProfileName('');
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load dialog */}
      {showLoadDialog && (
        <div className="display-config__dialog-overlay">
          <div className="display-config__dialog display-config__dialog--wide">
            <h3 className="display-config__dialog-title">加载预设方案</h3>
            <div className="display-config__profile-list">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className={`display-config__profile-item ${profile.id === activeProfileId ? 'display-config__profile-item--active' : ''}`}
                >
                  <div className="display-config__profile-details">
                    <span className="display-config__profile-name">{profile.name}</span>
                    <span className="display-config__profile-meta">
                      {profile.slots.length}个槽位 | 创建于 {new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="display-config__profile-actions">
                    <button
                      className="display-config__btn display-config__btn--small"
                      onClick={() => handleLoadProfile(profile.id)}
                    >
                      加载
                    </button>
                    {profiles.length > 1 && (
                      <button
                        className="display-config__btn display-config__btn--small display-config__btn--danger"
                        onClick={() => handleDeleteProfile(profile.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="display-config__dialog-actions">
              <button
                className="display-config__btn"
                onClick={() => setShowLoadDialog(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot list */}
      <div className="display-config__slots">
        <div className="display-config__slots-header">
          <span>快捷键</span>
          <span>名称</span>
          <span>来源分类</span>
          <span>话术数量</span>
          <span>操作</span>
        </div>

        {activeProfile?.slots.map(slot => renderSlotEditor(slot))}
      </div>

      {/* Slot mapping reference */}
      <div className="display-config__reference">
        <h3 className="display-config__reference-title">槽位定义参考</h3>
        <table className="display-config__reference-table">
          <thead>
            <tr>
              <th>槽位</th>
              <th>默认名称</th>
              <th>快捷键</th>
              <th>默认分类</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_SLOTS.map((slot, idx) => (
              <tr key={slot.slotId}>
                <td>{idx + 1}</td>
                <td>{slot.displayName}</td>
                <td>{slot.hotkey}</td>
                <td>{CATEGORY_OPTIONS.find(c => c.value === slot.sourceCategory)?.label || slot.sourceCategory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DisplayConfig;