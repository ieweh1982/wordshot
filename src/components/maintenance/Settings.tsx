import React, { useState, useEffect, useCallback } from 'react';
import { getHotkeysConfig, saveHotkeysConfig, HotkeysConfig } from '../../services/configStorage';
import './Settings.css';

// Hotkey action labels
const HOTKEY_ACTIONS: Record<string, string> = {
  switch_script_1: '切换话术 1',
  switch_script_2: '切换话术 2',
  switch_script_3: '切换话术 3',
  switch_script_4: '切换话术 4',
  switch_script_5: '切换话术 5',
  switch_script_6: '切换话术 6',
  switch_script_7: '切换话术 7',
  switch_script_8: '切换话术 8',
  switch_script_9: '切换话术 9',
  preview_up: '预览上一句',
  preview_down: '预览下一句',
  toggle_pause: '暂停/继续',
  show_help: '显示帮助',
  hide_help: '隐藏帮助',
};

// Default hotkey config
const DEFAULT_HOTKEYS_CONFIG: HotkeysConfig = {
  globalShortcuts: {
    switch_script_1: '1',
    switch_script_2: '2',
    switch_script_3: '3',
    switch_script_4: '4',
    switch_script_5: '5',
    switch_script_6: '6',
    switch_script_7: '7',
    switch_script_8: '8',
    switch_script_9: '9',
    preview_up: 'Up',
    preview_down: 'Down',
    toggle_pause: 'Space',
    show_help: '?',
    hide_help: 'Escape',
  },
  ammoSlotShortcuts: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
};

// App version
const APP_VERSION = '1.0.0';

// Deduplication time window options
const TIME_WINDOW_OPTIONS = [
  { value: 15 * 60 * 1000, label: '15 分钟' },
  { value: 30 * 60 * 1000, label: '30 分钟' },
  { value: 60 * 60 * 1000, label: '1 小时' },
  { value: 2 * 60 * 60 * 1000, label: '2 小时' },
];

interface Props {
  className?: string;
}

// Other settings interface
interface OtherSettings {
  autoLaunch: boolean;
  minimizeToTray: boolean;
  danmuVolume: number;
  autoSaveLayout: boolean;
}

const DEFAULT_OTHER_SETTINGS: OtherSettings = {
  autoLaunch: false,
  minimizeToTray: true,
  danmuVolume: 80,
  autoSaveLayout: true,
};

// Deduplication settings interface
interface DeduplicationSettings {
  enabled: boolean;
  timeWindowMs: number;
  maxRepeatPerWindow: number;
}

const DEFAULT_DEDUP_SETTINGS: DeduplicationSettings = {
  enabled: true,
  timeWindowMs: 30 * 60 * 1000,
  maxRepeatPerWindow: 3,
};

export const Settings: React.FC<Props> = ({ className }) => {
  // Hotkey state
  const [hotkeyConfig, setHotkeyConfig] = useState<HotkeysConfig>(DEFAULT_HOTKEYS_CONFIG);
  const [editingHotkey, setEditingHotkey] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictResult, setConflictResult] = useState<{ hasConflict: boolean; conflictingKeys: string[] } | null>(null);

  // Transparency state
  const [scriptOpacity, setScriptOpacity] = useState(1);
  const [ammoOpacity, setAmmoOpacity] = useState(1);
  const [danmuOpacity, setDanmuOpacity] = useState(1);

  // Deduplication state
  const [dedupSettings, setDedupSettings] = useState<DeduplicationSettings>(DEFAULT_DEDUP_SETTINGS);

  // Other settings state
  const [otherSettings, setOtherSettings] = useState<OtherSettings>(DEFAULT_OTHER_SETTINGS);

  // Active tab
  const [activeTab, setActiveTab] = useState<'hotkey' | 'transparency' | 'dedup' | 'other' | 'about'>('hotkey');

  // Load all settings on mount
  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = useCallback(() => {
    // Load hotkey config
    const savedHotkeys = getHotkeysConfig();
    setHotkeyConfig(savedHotkeys);

    // Load dedup settings from localStorage
    const savedDedup = localStorage.getItem('wordshot-dedup-settings');
    if (savedDedup) {
      try {
        setDedupSettings(JSON.parse(savedDedup));
      } catch (e) {
        console.error('Failed to parse dedup settings:', e);
      }
    }

    // Load other settings from localStorage
    const savedOther = localStorage.getItem('wordshot-other-settings');
    if (savedOther) {
      try {
        setOtherSettings(JSON.parse(savedOther));
      } catch (e) {
        console.error('Failed to parse other settings:', e);
      }
    }

    // Load transparency from layout
    const savedScriptOpacity = localStorage.getItem('wordshot-script-opacity');
    const savedAmmoOpacity = localStorage.getItem('wordshot-ammo-opacity');
    const savedDanmuOpacity = localStorage.getItem('wordshot-danmu-opacity');

    if (savedScriptOpacity) setScriptOpacity(parseFloat(savedScriptOpacity));
    if (savedAmmoOpacity) setAmmoOpacity(parseFloat(savedAmmoOpacity));
    if (savedDanmuOpacity) setDanmuOpacity(parseFloat(savedDanmuOpacity));
  }, []);

  // Save dedup settings
  const saveDedupSettings = useCallback((settings: DeduplicationSettings) => {
    setDedupSettings(settings);
    localStorage.setItem('wordshot-dedup-settings', JSON.stringify(settings));
  }, []);

  // Save other settings
  const saveOtherSettings = useCallback((settings: OtherSettings) => {
    setOtherSettings(settings);
    localStorage.setItem('wordshot-other-settings', JSON.stringify(settings));
  }, []);

  // Save transparency
  const saveTransparency = useCallback((type: 'script' | 'ammo' | 'danmu', value: number) => {
    localStorage.setItem(`wordshot-${type}-opacity`, String(value));
  }, []);

  // Handle hotkey editing
  const handleHotkeyClick = useCallback((action: string) => {
    setEditingHotkey(action);
    setConflictWarning(null);
    setConflictResult(null);
  }, []);

  // Handle hotkey key press
  const handleHotkeyKeyDown = useCallback(async (e: React.KeyboardEvent, action: string) => {
    e.preventDefault();

    // Build accelerator string
    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Control');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');

    const key = e.key;
    if (key !== 'Control' && key !== 'Alt' && key !== 'Shift' && key !== 'Meta') {
      keys.push(key.length === 1 ? key.toUpperCase() : key);
    }

    if (keys.length === 0) return;

    const accelerator = keys.join('+');

    // Check for conflicts
    try {
      const result = await window.electronAPI?.checkHotkeyConflict(accelerator);
      if (result) {
        setConflictResult(result);
        if (result.hasConflict) {
          setConflictWarning(`热键冲突: ${result.conflictingKeys.join(', ')}`);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to check conflict:', e);
    }

    // Update hotkey
    const newConfig = {
      ...hotkeyConfig,
      globalShortcuts: {
        ...hotkeyConfig.globalShortcuts,
        [action]: accelerator,
      },
    };

    try {
      const success = await window.electronAPI?.updateHotkeyConfig(action, accelerator);
      if (success !== false) {
        setHotkeyConfig(newConfig);
        saveHotkeysConfig(newConfig);
      }
    } catch (e) {
      console.error('Failed to update hotkey:', e);
    }

    setEditingHotkey(null);
    setConflictWarning(null);
    setConflictResult(null);
  }, [hotkeyConfig, saveHotkeysConfig]);

  // Reset hotkeys to defaults
  const handleResetHotkeys = useCallback(() => {
    setHotkeyConfig(DEFAULT_HOTKEYS_CONFIG);
    saveHotkeysConfig(DEFAULT_HOTKEYS_CONFIG);

    // Also notify main process
    Object.entries(DEFAULT_HOTKEYS_CONFIG.globalShortcuts).forEach(([action, accelerator]) => {
      window.electronAPI?.updateHotkeyConfig(action, accelerator);
    });
  }, [saveHotkeysConfig]);

  // Handle transparency change
  const handleOpacityChange = useCallback((type: 'script' | 'ammo' | 'danmu', value: number) => {
    switch (type) {
      case 'script':
        setScriptOpacity(value);
        saveTransparency('script', value);
        break;
      case 'ammo':
        setAmmoOpacity(value);
        saveTransparency('ammo', value);
        break;
      case 'danmu':
        setDanmuOpacity(value);
        saveTransparency('danmu', value);
        break;
    }
  }, [saveTransparency]);

  // Render hotkey tab
  const renderHotkeyTab = () => (
    <div className="settings__section">
      <div className="settings__section-header">
        <h3 className="settings__section-title">快捷键配置</h3>
        <button className="settings__btn settings__btn--secondary" onClick={handleResetHotkeys}>
          恢复默认
        </button>
      </div>

      <p className="settings__hint">点击热键列，然后按下新的按键组合来修改快捷键</p>

      <div className="settings__hotkey-list">
        {Object.entries(HOTKEY_ACTIONS).map(([action, label]) => (
          <div key={action} className="settings__hotkey-item">
            <span className="settings__hotkey-label">{label}</span>
            <div
              className={`settings__hotkey-input ${editingHotkey === action ? 'is-editing' : ''} ${conflictResult?.hasConflict && editingHotkey === action ? 'has-conflict' : ''}`}
              onClick={() => handleHotkeyClick(action)}
              onKeyDown={(e) => editingHotkey === action && handleHotkeyKeyDown(e, action)}
              tabIndex={0}
            >
              {editingHotkey === action ? (
                <span className="settings__hotkey-recording">按下按键...</span>
              ) : (
                <span className="settings__hotkey-value">
                  {hotkeyConfig.globalShortcuts[action] || '-'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {conflictWarning && (
        <div className="settings__conflict-warning">
          {conflictWarning}
        </div>
      )}
    </div>
  );

  // Render transparency tab
  const renderTransparencyTab = () => (
    <div className="settings__section">
      <div className="settings__section-header">
        <h3 className="settings__section-title">透明度调节</h3>
      </div>

      <div className="settings__slider-group">
        <div className="settings__slider-item">
          <label className="settings__slider-label">
            <span>主提词区透明度</span>
            <span className="settings__slider-value">{Math.round(scriptOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            className="settings__slider"
            min="0.1"
            max="1"
            step="0.05"
            value={scriptOpacity}
            onChange={(e) => handleOpacityChange('script', parseFloat(e.target.value))}
          />
        </div>

        <div className="settings__slider-item">
          <label className="settings__slider-label">
            <span>弹药带透明度</span>
            <span className="settings__slider-value">{Math.round(ammoOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            className="settings__slider"
            min="0.1"
            max="1"
            step="0.05"
            value={ammoOpacity}
            onChange={(e) => handleOpacityChange('ammo', parseFloat(e.target.value))}
          />
        </div>

        <div className="settings__slider-item">
          <label className="settings__slider-label">
            <span>公屏区域透明度</span>
            <span className="settings__slider-value">{Math.round(danmuOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            className="settings__slider"
            min="0.1"
            max="1"
            step="0.05"
            value={danmuOpacity}
            onChange={(e) => handleOpacityChange('danmu', parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  // Render dedup tab
  const renderDedupTab = () => (
    <div className="settings__section">
      <div className="settings__section-header">
        <h3 className="settings__section-title">去重配置</h3>
      </div>

      <div className="settings__form-group">
        <label className="settings__checkbox-label">
          <input
            type="checkbox"
            className="settings__checkbox"
            checked={dedupSettings.enabled}
            onChange={(e) => saveDedupSettings({ ...dedupSettings, enabled: e.target.checked })}
          />
          启用去重
        </label>
        <p className="settings__hint-text">开启后将自动过滤重复的话术内容</p>
      </div>

      <div className="settings__form-group">
        <label className="settings__label">时间窗口</label>
        <select
          className="settings__select"
          value={dedupSettings.timeWindowMs}
          onChange={(e) => saveDedupSettings({ ...dedupSettings, timeWindowMs: parseInt(e.target.value) })}
          disabled={!dedupSettings.enabled}
        >
          {TIME_WINDOW_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="settings__hint-text">在指定时间内重复的话术会被过滤</p>
      </div>

      <div className="settings__form-group">
        <label className="settings__label">
          最大重复次数
          <input
            type="number"
            className="settings__input settings__input--small"
            min="1"
            max="10"
            value={dedupSettings.maxRepeatPerWindow}
            onChange={(e) => saveDedupSettings({ ...dedupSettings, maxRepeatPerWindow: parseInt(e.target.value) || 1 })}
            disabled={!dedupSettings.enabled}
          />
        </label>
        <p className="settings__hint-text">同一话术在时间窗口内最多出现的次数</p>
      </div>
    </div>
  );

  // Render other tab
  const renderOtherTab = () => (
    <div className="settings__section">
      <div className="settings__section-header">
        <h3 className="settings__section-title">其他设置</h3>
      </div>

      <div className="settings__form-group">
        <label className="settings__checkbox-label">
          <input
            type="checkbox"
            className="settings__checkbox"
            checked={otherSettings.autoLaunch}
            onChange={(e) => saveOtherSettings({ ...otherSettings, autoLaunch: e.target.checked })}
          />
          开机启动
        </label>
        <p className="settings__hint-text">开机时自动启动 WordShot</p>
      </div>

      <div className="settings__form-group">
        <label className="settings__checkbox-label">
          <input
            type="checkbox"
            className="settings__checkbox"
            checked={otherSettings.minimizeToTray}
            onChange={(e) => saveOtherSettings({ ...otherSettings, minimizeToTray: e.target.checked })}
          />
          最小化到托盘
        </label>
        <p className="settings__hint-text">关闭按钮将最小化到系统托盘而不是退出</p>
      </div>

      <div className="settings__form-group">
        <label className="settings__checkbox-label">
          <input
            type="checkbox"
            className="settings__checkbox"
            checked={otherSettings.autoSaveLayout}
            onChange={(e) => saveOtherSettings({ ...otherSettings, autoSaveLayout: e.target.checked })}
          />
          自动保存布局
        </label>
        <p className="settings__hint-text">拖拽调整布局后自动保存</p>
      </div>

      <div className="settings__form-group">
        <label className="settings__slider-label">
          <span>弹幕音量</span>
          <span className="settings__slider-value">{otherSettings.danmuVolume}%</span>
        </label>
        <input
          type="range"
          className="settings__slider"
          min="0"
          max="100"
          step="5"
          value={otherSettings.danmuVolume}
          onChange={(e) => saveOtherSettings({ ...otherSettings, danmuVolume: parseInt(e.target.value) })}
        />
      </div>
    </div>
  );

  // Render about tab
  const renderAboutTab = () => (
    <div className="settings__section">
      <div className="settings__section-header">
        <h3 className="settings__section-title">关于</h3>
      </div>

      <div className="settings__about">
        <div className="settings__about-logo">
          <span className="settings__about-icon">W</span>
        </div>
        <h2 className="settings__about-name">WordShot</h2>
        <p className="settings__about-version">版本 {APP_VERSION}</p>
        <p className="settings__about-desc">直播话术提词器 - 让直播更专业</p>

        <div className="settings__about-section">
          <h4>开源许可证</h4>
          <p>MIT License</p>
          <p className="settings__about-link">https://opensource.org/licenses/MIT</p>
        </div>

        <div className="settings__about-section">
          <h4>技术栈</h4>
          <ul className="settings__about-tech">
            <li>Electron 28+</li>
            <li>React 18</li>
            <li>TypeScript</li>
            <li>Zustand</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`settings ${className || ''}`}>
      <div className="settings__header">
        <h2 className="settings__title">系统设置</h2>
      </div>

      <div className="settings__tabs">
        <button
          className={`settings__tab ${activeTab === 'hotkey' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('hotkey')}
        >
          热键配置
        </button>
        <button
          className={`settings__tab ${activeTab === 'transparency' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('transparency')}
        >
          透明度
        </button>
        <button
          className={`settings__tab ${activeTab === 'dedup' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('dedup')}
        >
          去重配置
        </button>
        <button
          className={`settings__tab ${activeTab === 'other' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('other')}
        >
          其他设置
        </button>
        <button
          className={`settings__tab ${activeTab === 'about' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          关于
        </button>
      </div>

      <div className="settings__content">
        {activeTab === 'hotkey' && renderHotkeyTab()}
        {activeTab === 'transparency' && renderTransparencyTab()}
        {activeTab === 'dedup' && renderDedupTab()}
        {activeTab === 'other' && renderOtherTab()}
        {activeTab === 'about' && renderAboutTab()}
      </div>
    </div>
  );
};

export default Settings;
