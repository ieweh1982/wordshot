import { useState, useEffect, useCallback } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import type { Theme, ScriptCategory } from '../../types';
import { getThemesConfig, saveThemesConfig } from '../../services/configStorage';
import './ThemeConfig.css';

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

const DEFAULT_CARD_COLORS: Record<ScriptCategory, string> = {
  thanks: '#4CAF50',
  rebuttal: '#F44336',
  interaction: '#2196F3',
  ad: '#FF9800',
  praise: '#E91E63',
  opening: '#9C27B0',
  closing: '#673AB7',
  lottery: '#FFEB3B',
  crisis: '#795548',
};

interface ThemeEditorState {
  id: string;
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  highlightColor: string;
  fontSize: number;
  cardColors: Record<ScriptCategory, string>;
  isDark: boolean;
}

function createEmptyEditorState(): ThemeEditorState {
  return {
    id: '',
    name: '',
    background: '#1a1a2e',
    textColor: '#ffffff',
    accentColor: '#e94560',
    highlightColor: '#16213e',
    fontSize: 32,
    cardColors: { ...DEFAULT_CARD_COLORS },
    isDark: true,
  };
}

function themeToEditorState(theme: Theme): ThemeEditorState {
  return {
    id: theme.id,
    name: theme.name,
    background: theme.background,
    textColor: theme.textColor,
    accentColor: theme.accentColor,
    highlightColor: theme.highlightColor,
    fontSize: theme.fontSize || 32,
    cardColors: { ...theme.cardColors },
    isDark: theme.isDark,
  };
}

function editorStateToTheme(editor: ThemeEditorState): Theme {
  return {
    id: editor.id || `theme-${Date.now()}`,
    name: editor.name,
    background: editor.background,
    textColor: editor.textColor,
    accentColor: editor.accentColor,
    highlightColor: editor.highlightColor,
    fontSize: editor.fontSize,
    cardColors: { ...editor.cardColors },
    isDark: editor.isDark,
  };
}

export function ThemeConfig() {
  const {
    themes,
    activeThemeId,
    addTheme,
    updateTheme,
    deleteTheme,
    setTheme,
    getActiveTheme,
  } = useThemeStore();

  const [editingTheme, setEditingTheme] = useState<ThemeEditorState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newThemeName, setNewThemeName] = useState('');

  // Load themes from disk on mount
  useEffect(() => {
    const savedConfig = getThemesConfig();
    // Theme store is already initialized with defaults, saved config would be merged if needed
  }, []);

  // Save themes to disk when themes change
  useEffect(() => {
    const config = {
      themes,
      activeThemeId,
    };
    saveThemesConfig(config);
  }, [themes, activeThemeId]);

  // Start creating a new theme
  const handleCreateTheme = () => {
    setIsCreating(true);
    setEditingTheme(createEmptyEditorState());
    setNewThemeName('');
  };

  // Start editing an existing theme
  const handleEditTheme = (theme: Theme) => {
    setIsCreating(false);
    setEditingTheme(themeToEditorState(theme));
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTheme(null);
    setIsCreating(false);
    setNewThemeName('');
  };

  // Save the theme being edited
  const handleSaveTheme = () => {
    if (!editingTheme) return;

    const themeName = isCreating ? newThemeName.trim() : editingTheme.name;
    if (!themeName) return;

    const themeToSave = {
      ...editorStateToTheme(editingTheme),
      name: themeName,
    };

    if (isCreating) {
      addTheme(themeToSave);
      setTheme(themeToSave.id);
    } else {
      updateTheme(themeToSave.id, themeToSave);
    }

    setEditingTheme(null);
    setIsCreating(false);
    setNewThemeName('');
  };

  // Delete a theme
  const handleDeleteTheme = (themeId: string) => {
    if (themes.length <= 1) return;
    deleteTheme(themeId);
    setShowDeleteConfirm(null);
  };

  // Set a theme as active
  const handleSetActive = (themeId: string) => {
    setTheme(themeId);
  };

  // Update editor field
  const updateEditor = (updates: Partial<ThemeEditorState>) => {
    if (!editingTheme) return;
    setEditingTheme({ ...editingTheme, ...updates });
  };

  // Update card color for a specific category
  const updateCardColor = (category: ScriptCategory, color: string) => {
    if (!editingTheme) return;
    setEditingTheme({
      ...editingTheme,
      cardColors: {
        ...editingTheme.cardColors,
        [category]: color,
      },
    });
  };

  // Render theme preview
  const renderThemePreview = (theme: Theme) => {
    return (
      <div
        className="theme-preview"
        style={{
          backgroundColor: theme.background,
          color: theme.textColor,
        }}
      >
        <div className="theme-preview__header">标题</div>
        <div className="theme-preview__text">示例文字</div>
        <div
          className="theme-preview__accent"
          style={{ backgroundColor: theme.accentColor }}
        />
        <div
          className="theme-preview__cards"
        >
          {CATEGORY_OPTIONS.slice(0, 3).map((cat) => (
            <div
              key={cat.value}
              className="theme-preview__card"
              style={{ backgroundColor: theme.cardColors[cat.value] }}
            >
              {cat.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render color input
  const renderColorInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    className = ''
  ) => {
    return (
      <label className={`theme-config__label ${className}`}>
        <span>{label}</span>
        <div className="theme-config__color-input">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="theme-config__color-text"
          />
        </div>
      </label>
    );
  };

  return (
    <div className="theme-config">
      <div className="theme-config__header">
        <h2 className="theme-config__title">主题配置</h2>
        <button
          className="theme-config__btn theme-config__btn--primary"
          onClick={handleCreateTheme}
        >
          创建新主题
        </button>
      </div>

      {/* Theme list */}
      <div className="theme-config__theme-list">
        <div className="theme-config__theme-list-header">
          <span>主题名称</span>
          <span>类型</span>
          <span>预览</span>
          <span>操作</span>
        </div>

        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`theme-config__theme-item ${theme.id === activeThemeId ? 'theme-config__theme-item--active' : ''}`}
          >
            <div className="theme-config__theme-info">
              <span className="theme-config__theme-name">
                {theme.name}
                {theme.id === activeThemeId && (
                  <span className="theme-config__active-badge">使用中</span>
                )}
              </span>
            </div>

            <div className="theme-config__theme-type">
              {theme.isDark ? '暗色主题' : '亮色主题'}
            </div>

            <div className="theme-config__theme-preview-wrapper">
              {renderThemePreview(theme)}
            </div>

            <div className="theme-config__theme-actions">
              <button
                className="theme-config__btn theme-config__btn--small"
                onClick={() => handleEditTheme(theme)}
              >
                编辑
              </button>
              {theme.id !== activeThemeId && (
                <button
                  className="theme-config__btn theme-config__btn--small theme-config__btn--activate"
                  onClick={() => handleSetActive(theme.id)}
                >
                  设为当前
                </button>
              )}
              {themes.length > 1 && (
                <button
                  className="theme-config__btn theme-config__btn--small theme-config__btn--danger"
                  onClick={() => setShowDeleteConfirm(theme.id)}
                >
                  删除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Theme editor modal */}
      {editingTheme && (
        <div className="theme-config__dialog-overlay">
          <div className="theme-config__dialog">
            <h3 className="theme-config__dialog-title">
              {isCreating ? '创建新主题' : '编辑主题'}
            </h3>

            <div className="theme-config__form">
              {/* Theme name for new themes */}
              {isCreating && (
                <label className="theme-config__label theme-config__label--full">
                  <span>主题名称</span>
                  <input
                    type="text"
                    className="theme-config__input"
                    value={newThemeName}
                    onChange={(e) => setNewThemeName(e.target.value)}
                    placeholder="请输入主题名称"
                    autoFocus
                  />
                </label>
              )}

              {/* Theme name for existing themes */}
              {!isCreating && (
                <label className="theme-config__label theme-config__label--full">
                  <span>主题名称</span>
                  <input
                    type="text"
                    className="theme-config__input"
                    value={editingTheme.name}
                    onChange={(e) => updateEditor({ name: e.target.value })}
                  />
                </label>
              )}

              {/* Basic colors */}
              <div className="theme-config__form-row">
                {renderColorInput('背景色', editingTheme.background, (v) => updateEditor({ background: v }))}
                {renderColorInput('主文字色', editingTheme.textColor, (v) => updateEditor({ textColor: v }))}
              </div>

              <div className="theme-config__form-row">
                {renderColorInput('强调色', editingTheme.accentColor, (v) => updateEditor({ accentColor: v }))}
                {renderColorInput('高亮色', editingTheme.highlightColor, (v) => updateEditor({ highlightColor: v }))}
              </div>

              {/* 字体大小 */}
              <div className="theme-config__form-row">
                <label className="theme-config__label theme-config__label--full">
                  <span>字体大小 (px)</span>
                  <input
                    type="number"
                    className="theme-config__input"
                    value={editingTheme.fontSize}
                    onChange={(e) => updateEditor({ fontSize: parseInt(e.target.value) || 32 })}
                    min="16"
                    max="72"
                  />
                </label>
              </div>

              {/* Dark mode toggle */}
              <div className="theme-config__form-row">
                <label className="theme-config__label theme-config__label--switch">
                  <span>暗色主题</span>
                  <input
                    type="checkbox"
                    className="theme-config__checkbox"
                    checked={editingTheme.isDark}
                    onChange={(e) => updateEditor({ isDark: e.target.checked })}
                  />
                </label>
              </div>

              {/* Card colors */}
              <div className="theme-config__card-colors">
                <h4 className="theme-config__card-colors-title">分类卡片颜色</h4>
                <div className="theme-config__card-colors-grid">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <label key={cat.value} className="theme-config__label theme-config__label--card">
                      <span>{cat.label}</span>
                      <div className="theme-config__color-input">
                        <input
                          type="color"
                          value={editingTheme.cardColors[cat.value]}
                          onChange={(e) => updateCardColor(cat.value, e.target.value)}
                        />
                        <input
                          type="text"
                          value={editingTheme.cardColors[cat.value]}
                          onChange={(e) => updateCardColor(cat.value, e.target.value)}
                          className="theme-config__color-text"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="theme-config__preview-section">
                <h4 className="theme-config__preview-title">预览效果</h4>
                <div className="theme-config__preview-wrapper">
                  {renderThemePreview(editorStateToTheme(editingTheme))}
                </div>
              </div>
            </div>

            <div className="theme-config__dialog-actions">
              <button
                className="theme-config__btn theme-config__btn--primary"
                onClick={handleSaveTheme}
                disabled={isCreating && !newThemeName.trim()}
              >
                保存
              </button>
              <button
                className="theme-config__btn"
                onClick={handleCancelEdit}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="theme-config__dialog-overlay">
          <div className="theme-config__dialog theme-config__dialog--small">
            <h3 className="theme-config__dialog-title">确认删除</h3>
            <p className="theme-config__dialog-text">
              确定要删除这个主题吗？此操作无法撤销。
            </p>
            <div className="theme-config__dialog-actions">
              <button
                className="theme-config__btn theme-config__btn--danger"
                onClick={() => handleDeleteTheme(showDeleteConfirm)}
              >
                删除
              </button>
              <button
                className="theme-config__btn"
                onClick={() => setShowDeleteConfirm(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset themes info */}
      <div className="theme-config__presets">
        <h3 className="theme-config__presets-title">预设主题</h3>
        <div className="theme-config__presets-grid">
          <div className="theme-config__preset-item">
            <span className="theme-config__preset-name">暗色默认</span>
            <span className="theme-config__preset-desc">深蓝色背景，红色强调</span>
          </div>
          <div className="theme-config__preset-item">
            <span className="theme-config__preset-name">亮色默认</span>
            <span className="theme-config__preset-desc">浅灰背景，深色文字</span>
          </div>
          <div className="theme-config__preset-item">
            <span className="theme-config__preset-name">OLED黑</span>
            <span className="theme-config__preset-desc">纯黑背景，适合OLED屏幕</span>
          </div>
          <div className="theme-config__preset-item">
            <span className="theme-config__preset-name">暖棕色调</span>
            <span className="theme-config__preset-desc">棕色暖色调，护眼设计</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThemeConfig;