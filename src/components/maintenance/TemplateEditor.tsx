import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTemplateStore, templateStore } from '../../stores/templateStore';
import { useScriptStore } from '../../stores/scriptStore';
import { ScriptSelector } from './ScriptSelector';
import type { ScriptSegment, TemplateTheme, ScriptCategory, SegmentPattern, Script } from '../../types';
import './TemplateEditor.css';

const TEMPLATE_THEMES: { value: TemplateTheme; label: string }[] = [
  { value: 'standup', label: '脱口秀直播' },
  { value: 'chat', label: '聊天互动' },
  { value: 'ecommerce', label: '日常带货' },
];

const SCRIPT_CATEGORIES: { value: ScriptCategory; label: string; color: string }[] = [
  { value: 'thanks', label: '感谢', color: '#4CAF50' },
  { value: 'rebuttal', label: '回击', color: '#F44336' },
  { value: 'interaction', label: '互动', color: '#2196F3' },
  { value: 'ad', label: '带货', color: '#FF9800' },
  { value: 'praise', label: '夸奖', color: '#E91E63' },
  { value: 'opening', label: '开播', color: '#9C27B0' },
  { value: 'closing', label: '闭播', color: '#673AB7' },
  { value: 'lottery', label: '抽奖', color: '#FFEB3B' },
  { value: 'crisis', label: '危机', color: '#795548' },
];

const QUICK_PATTERNS: { name: string; category: ScriptCategory; durationMinutes: number }[] = [
  { name: '开场', category: 'opening', durationMinutes: 5 },
  { name: '互动', category: 'interaction', durationMinutes: 10 },
  { name: '幽默', category: 'thanks', durationMinutes: 5 },
  { name: '夸人', category: 'praise', durationMinutes: 5 },
  { name: '怼人', category: 'rebuttal', durationMinutes: 5 },
  { name: '拉票', category: 'lottery', durationMinutes: 5 },
  { name: '感谢', category: 'thanks', durationMinutes: 5 },
  { name: '带货', category: 'ad', durationMinutes: 10 },
  { name: '闭播', category: 'closing', durationMinutes: 5 },
];

function getCategoryInfo(category: ScriptCategory) {
  return SCRIPT_CATEGORIES.find(c => c.value === category) || { label: category, color: '#888' };
}

interface SortableScriptItemProps {
  script: Script;
  segment: ScriptSegment;
  onRemove: (scriptId: string) => void;
}

function SortableScriptItem({ script, segment, onRemove }: SortableScriptItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${segment.id}-${script.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const categoryInfo = getCategoryInfo(script.category);

  return (
    <div ref={setNodeRef} style={style} className="script-sequence-item">
      <button className="script-sequence-item__drag" {...attributes} {...listeners}>
        <svg className="sortable-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <div className="script-sequence-item__content">
        <span className="script-sequence-item__text">{script.content}</span>
        <span
          className="script-sequence-item__tag"
          style={{ backgroundColor: categoryInfo.color }}
        >
          {categoryInfo.label}
        </span>
      </div>
      <button
        className="script-sequence-item__remove"
        onClick={() => onRemove(script.id)}
        title="移除"
      >
        ×
      </button>
    </div>
  );
}

export default function TemplateEditor() {
  const {
    templates,
    selectedTemplateId,
    themeFilter,
    loadTemplates,
    selectTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    generateSegments,
    clearSegments,
    addScriptsToSegment,
    removeScriptFromSegment,
    getSelectedTemplate,
    getFilteredTemplates,
    setThemeFilter,
  } = useTemplateStore();

  const { scripts, loadScripts, getScriptById } = useScriptStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showScriptSelector, setShowScriptSelector] = useState(false);
  const [selectedSegmentIdForAdd, setSelectedSegmentIdForAdd] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Create template form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateTheme, setNewTemplateTheme] = useState<TemplateTheme>('standup');
  const [newTemplateDuration, setNewTemplateDuration] = useState(60);

  // Pattern editing state
  const [editingPatterns, setEditingPatterns] = useState<SegmentPattern[]>([]);
  const [repeatCount, setRepeatCount] = useState(1);
  const [showPatternEditor, setShowPatternEditor] = useState(false);
  const [localFreeContent, setLocalFreeContent] = useState('');

  useEffect(() => {
    loadTemplates();
    loadScripts();
  }, []);

  const selectedTemplate = getSelectedTemplate();
  const filteredTemplates = getFilteredTemplates();

  // Sync editing patterns when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const patterns = selectedTemplate.patterns;
      setEditingPatterns(Array.isArray(patterns) ? patterns : []);
      setRepeatCount(selectedTemplate.repeatCount || 1);
      setLocalFreeContent(selectedTemplate.freeContent || '');
    }
  }, [selectedTemplate?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Flatten all scripts from all segments for display
  const scriptSequence = useMemo(() => {
    if (!selectedTemplate) return [];
    const items: { script: Script; segment: ScriptSegment }[] = [];
    selectedTemplate.segments.forEach(segment => {
      (segment.scriptIds || []).forEach(scriptId => {
        const script = getScriptById(scriptId);
        if (script) {
          items.push({ script, segment });
        }
      });
    });
    return items;
  }, [selectedTemplate, scripts]);

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) return;
    createTemplate(newTemplateTheme, newTemplateName, newTemplateDuration);
    setNewTemplateName('');
    setNewTemplateDuration(60);
    setShowCreateDialog(false);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || editingPatterns.length === 0) return;
    setIsGenerating(true);
    try {
      // Clear existing segments first
      clearSegments(selectedTemplate.id);
      // Then generate new ones
      await generateSegments(selectedTemplate.id, editingPatterns, repeatCount);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddPattern = (pattern: typeof QUICK_PATTERNS[0]) => {
    setEditingPatterns(prev => [...(prev || []), pattern]);
  };

  const handleRemovePattern = (index: number) => {
    setEditingPatterns(prev => (prev || []).filter((_, i) => i !== index));
  };

  const handlePatternChange = (index: number, field: keyof SegmentPattern, value: any) => {
    setEditingPatterns(prev => (prev || []).map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const handleSavePatterns = () => {
    if (!selectedTemplate) return;
    updateTemplate(selectedTemplate.id, {
      patterns: editingPatterns || [],
      repeatCount,
    });
    setShowPatternEditor(false);
  };

  const handleAddScriptToSegment = (segmentId: string, scriptIds: string[]) => {
    addScriptsToSegment(segmentId, scriptIds);
  };

  const handleRemoveScriptFromSegment = (segmentId: string, scriptId: string) => {
    removeScriptFromSegment(segmentId, scriptId);
  };

  const openScriptSelector = (segmentId: string) => {
    setSelectedSegmentIdForAdd(segmentId);
    setShowScriptSelector(true);
  };

  return (
    <div className="template-editor">
      {/* Header */}
      <div className="template-editor__header">
        <h1>模板编辑</h1>
      </div>

      <div className="template-editor__content">
        {/* Left Panel - Template List */}
        <div className="template-list-panel">
          {/* Theme Filter */}
          <div className="template-list-panel__filter">
            <button
              onClick={() => setThemeFilter('all')}
              className={`filter-btn ${themeFilter === 'all' ? 'filter-btn--active' : ''}`}
            >
              全部
            </button>
            {TEMPLATE_THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => setThemeFilter(theme.value)}
                className={`filter-btn ${themeFilter === theme.value ? 'filter-btn--active' : ''}`}
              >
                {theme.label}
              </button>
            ))}
          </div>

          {/* Template List */}
          <div className="template-list-panel__list">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => selectTemplate(template.id)}
                className={`template-list-panel__item ${selectedTemplateId === template.id ? 'template-list-panel__item--selected' : ''}`}
              >
                <h3>{template.name}</h3>
                <div className="template-list-panel__item-meta">
                  <span className="template-list-panel__tag">
                    {TEMPLATE_THEMES.find((t) => t.value === template.theme)?.label}
                  </span>
                  <span className="template-list-panel__stats">
                    {template.segments?.length || 0} 话术
                  </span>
                  <span className="template-list-panel__stats">
                    {template.totalDurationMinutes} 分钟
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Create Template Button */}
          <div className="template-list-panel__footer">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="create-template-btn"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建模板
            </button>
          </div>
        </div>

        {/* Right Panel - Template Detail */}
        <div className="template-detail-panel">
          {selectedTemplate ? (
            <>
              {/* Template Info */}
              <div className="template-detail-panel__info">
                <div className="template-detail-panel__info-row">
                  <input
                    type="text"
                    value={selectedTemplate.name}
                    onChange={(e) => updateTemplate(selectedTemplate.id, { name: e.target.value })}
                    className="template-detail-panel__name-input"
                  />
                  <div className="template-detail-panel__controls">
                    <div className="control-group">
                      <label>主题:</label>
                      <select
                        value={selectedTemplate.theme}
                        onChange={(e) => updateTemplate(selectedTemplate.id, { theme: e.target.value as TemplateTheme })}
                      >
                        {TEMPLATE_THEMES.map((theme) => (
                          <option key={theme.value} value={theme.value}>
                            {theme.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="control-group">
                      <label>总时长:</label>
                      <input
                        type="number"
                        value={selectedTemplate.totalDurationMinutes}
                        onChange={(e) => updateTemplate(selectedTemplate.id, { totalDurationMinutes: parseInt(e.target.value) || 0 })}
                      />
                      <span>分钟</span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('确定要删除这个模板吗？')) {
                          deleteTemplate(selectedTemplate.id);
                        }
                      }}
                      className="delete-template-btn"
                      title="删除模板"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Free Content Section - 无需话术库的自由输入 */}
              <div className="free-content-section">
                <div className="free-content-section__header">
                  <h2>自由输入内容</h2>
                  <span className="free-content-section__hint">直接输入模板文本，无需配置节奏模式</span>
                </div>
                <textarea
                    className="free-content-section__textarea"
                    value={localFreeContent || selectedTemplate.freeContent || ''}
                    onChange={(e) => {
                      setLocalFreeContent(e.target.value);
                    }}
                    onBlur={(e) => {
                      updateTemplate(selectedTemplate.id, {
                        freeContent: e.target.value,
                      });
                    }}
                    placeholder="在此输入模板的全部内容，每行一条...\n不依赖话术库，直接自定义文本内容"
                    rows={8}
                  />
              </div>

              {/* Script Sequence List */}
              <div className="script-sequence">
                <div className="script-sequence__header">
                  <h2>话术序列</h2>
                  <span className="script-sequence__count">共 {scriptSequence.length} 条</span>
                </div>

                {scriptSequence.length > 0 ? (
                  <div className="script-sequence__list">
                    {scriptSequence.map((item, index) => (
                      <SortableScriptItem
                        key={`${item.segment.id}-${item.script.id}`}
                        script={item.script}
                        segment={item.segment}
                        onRemove={(scriptId) => handleRemoveScriptFromSegment(item.segment.id, scriptId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="script-sequence__empty">
                    暂无话术，请先配置节奏模式并点击"生成话术序列"
                  </div>
                )}
              </div>

              {/* Add Script Button */}
              {selectedTemplate.segments.length > 0 && (
                <div className="script-sequence__add">
                  <select
                    className="script-sequence__segment-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        openScriptSelector(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>添加到段落...</option>
                    {selectedTemplate.segments.map(seg => (
                      <option key={seg.id} value={seg.id}>
                        {seg.name} ({getCategoryInfo(seg.category).label})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pattern Config Section - 仅在有段落时显示 */}
              {selectedTemplate.segments.length > 0 && (
                <div className="pattern-config">
                  <div className="pattern-config__header">
                    <h2>节奏配置</h2>
                    <button
                      className="pattern-config__edit-btn"
                      onClick={() => setShowPatternEditor(!showPatternEditor)}
                    >
                      {showPatternEditor ? '收起' : '编辑'}
                    </button>
                  </div>

                  {showPatternEditor ? (
                    <div className="pattern-config__editor">
                      <div className="pattern-config__quick-add">
                        <span>快速添加:</span>
                        {QUICK_PATTERNS.map((p, i) => (
                          <button
                            key={i}
                            className="pattern-config__quick-btn"
                            onClick={() => handleAddPattern(p)}
                          >
                            {p.name}({p.durationMinutes}min)
                          </button>
                        ))}
                      </div>

                      <div className="pattern-config__list">
                        {(editingPatterns || []).map((pattern, index) => (
                          <div key={index} className="pattern-config__item">
                            <input
                              type="text"
                              value={pattern.name}
                              onChange={(e) => handlePatternChange(index, 'name', e.target.value)}
                              className="pattern-config__name-input"
                            />
                            <select
                              value={pattern.category}
                              onChange={(e) => handlePatternChange(index, 'category', e.target.value as ScriptCategory)}
                              className="pattern-config__category-select"
                            >
                              {SCRIPT_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={pattern.durationMinutes}
                              onChange={(e) => handlePatternChange(index, 'durationMinutes', parseInt(e.target.value) || 0)}
                              className="pattern-config__duration-input"
                            />
                            <span>分钟</span>
                            <button
                              className="pattern-config__remove-btn"
                              onClick={() => handleRemovePattern(index)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pattern-config__repeat">
                        <label>循环次数:</label>
                        <input
                          type="number"
                          value={repeatCount}
                          onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                          min="1"
                          max="10"
                          className="pattern-config__repeat-input"
                        />
                        <span>次 (共 {(editingPatterns || []).reduce((sum: number, p: any) => sum + p.durationMinutes, 0) * repeatCount} 分钟)</span>
                      </div>

                      <div className="pattern-config__actions">
                        <button onClick={handleSavePatterns} className="btn btn--primary">
                          保存节奏配置
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pattern-config__preview">
                      {(editingPatterns || []).map((pattern, i) => (
                        <span key={i} className="pattern-config__tag" style={{ backgroundColor: getCategoryInfo(pattern.category).color }}>
                          {pattern.name} {pattern.durationMinutes}min
                        </span>
                      ))}
                      <span className="pattern-config__repeat-badge">×{repeatCount}</span>
                    </div>
                  )}

                  <div className="pattern-config__generate">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || (editingPatterns || []).length === 0}
                      className="btn btn--primary"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {isGenerating ? '生成中...' : '生成话术序列'}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Content Section - 每个段落的自定义文本 */}
              {selectedTemplate.segments.length > 0 && (
                <div className="custom-content-section">
                  <div className="custom-content-section__header">
                    <h2>自定义内容</h2>
                    <span className="custom-content-section__hint">每个段落可输入独立的自定义文本</span>
                  </div>
                  <div className="custom-content-section__list">
                    {selectedTemplate.segments.map(seg => (
                      <div key={seg.id} className="custom-content-item">
                        <div className="custom-content-item__label">
                          <span className="custom-content-item__name">{seg.name}</span>
                          <span
                            className="custom-content-item__tag"
                            style={{ backgroundColor: getCategoryInfo(seg.category).color }}
                          >
                            {getCategoryInfo(seg.category).label}
                          </span>
                        </div>
                        <textarea
                          className="custom-content-item__textarea"
                          value={seg.customContent || ''}
                          onChange={(e) => {
                            templateStore.setState(state => ({
                              templates: state.templates.map(t => ({
                                ...t,
                                segments: t.segments.map(s =>
                                  s.id === seg.id ? { ...s, customContent: e.target.value } : s
                                ),
                              })),
                            }));
                          }}
                          onBlur={(e) => {
                            templateStore.getState().updateSegment(seg.id, {
                              customContent: e.target.value,
                            });
                          }}
                          placeholder="在此输入自定义文本，每行一条..."
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="template-detail-panel__empty">
              选择一个模板进行编辑，或创建新模板
            </div>
          )}
        </div>
      </div>

      {/* Create Template Dialog */}
      {showCreateDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog__header">
              <h2>新建模板</h2>
            </div>
            <div className="dialog__body">
              <div className="form-group">
                <label>模板名称</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="输入模板名称"
                />
              </div>
              <div className="form-group">
                <label>模板主题</label>
                <select
                  value={newTemplateTheme}
                  onChange={(e) => setNewTemplateTheme(e.target.value as TemplateTheme)}
                >
                  {TEMPLATE_THEMES.map((theme) => (
                    <option key={theme.value} value={theme.value}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>总时长（分钟）</label>
                <input
                  type="number"
                  value={newTemplateDuration}
                  onChange={(e) => setNewTemplateDuration(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="dialog__footer">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewTemplateName('');
                  setNewTemplateDuration(60);
                }}
                className="dialog__btn dialog__btn--cancel"
              >
                取消
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim()}
                className="dialog__btn dialog__btn--submit"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Selector Dialog */}
      {showScriptSelector && selectedSegmentIdForAdd && (
        <ScriptSelector
          onConfirm={(scriptIds) => handleAddScriptToSegment(selectedSegmentIdForAdd, scriptIds)}
          onClose={() => {
            setShowScriptSelector(false);
            setSelectedSegmentIdForAdd(null);
          }}
        />
      )}
    </div>
  );
}