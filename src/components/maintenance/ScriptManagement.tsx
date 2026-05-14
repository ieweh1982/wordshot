import { useState, useEffect, useCallback, useMemo } from 'react';
import { useScriptStore } from '../../stores/scriptStore';
import * as scriptService from '../../services/scriptService';
import { generateNumericId } from '../../services/IdGenerator';
import type { Script, ScriptCategory, TriggerType } from '../../types';
import './ScriptManagement.css';

const CATEGORIES: { value: ScriptCategory; label: string; color: string }[] = [
  { value: 'thanks', label: '感谢', color: '#4CAF50' },
  { value: 'rebuttal', label: '回击', color: '#F44336' },
  { value: 'interaction', label: '互动', color: '#2196F3' },
  { value: 'ad', label: '带货', color: '#FF9800' },
  { value: 'praise', label: '夸奖', color: '#9C27B0' },
  { value: 'opening', label: '开播', color: '#00BCD4' },
  { value: 'closing', label: '闭播', color: '#795548' },
  { value: 'lottery', label: '抽奖', color: '#E91E63' },
  { value: 'crisis', label: '危机', color: '#607D8B' },
];

const TRIGGERS: { value: TriggerType; label: string }[] = [
  { value: 'gift', label: '礼物' },
  { value: 'big_gift', label: '大礼物' },
  { value: 'follower', label: '关注' },
  { value: 'vip', label: 'VIP' },
  { value: 'hater', label: '黑粉' },
  { value: 'ribbit', label: '节奏' },
  { value: 'provocative', label: '挑衅' },
  { value: 'silent', label: '冷场' },
  { value: 'vote', label: '投票' },
  { value: 'question', label: '问题' },
  { value: 'ad_break', label: '广告' },
  { value: 'lottery_time', label: '抽奖时间' },
  { value: 'negative', label: '负面' },
  { value: 'ban', label: '封禁' },
  { value: 'praise', label: '夸赞' },
];

function generateId(): string {
  return generateNumericId();
}

export default function ScriptManagement() {
  const {
    scripts,
    pendingScripts,
    filters,
    addScript,
    updateScript,
    deleteScript,
    approveScript,
    rejectScript,
    setCategoryFilter,
    setTagFilter,
    setSearchQuery,
    clearFilters,
    getFilteredScripts,
  } = useScriptStore();

  // Local state for UI
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [editingScript, setEditingScript] = useState<Partial<Script> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<'scripts' | 'pending'>('scripts');
  const [tagInput, setTagInput] = useState('');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Load scripts from service on mount
  useEffect(() => {
    async function loadScripts() {
      const allScripts = await scriptService.getAllScripts();
      allScripts.forEach(s => {
        if (!scripts.find(existing => existing.id === s.id)) {
          addScript(s);
        }
      });
    }
    loadScripts();
  }, []);

  // Filtered scripts
  const filteredScripts = useMemo(() => {
    if (searchInput.trim()) {
      return scripts.filter(s => s.content.toLowerCase().includes(searchInput.toLowerCase()));
    }
    let result = scripts;
    if (filters.category) {
      result = result.filter(s => s.category === filters.category);
    }
    if (filters.tags.length > 0) {
      result = result.filter(s => filters.tags.every(t => s.tags.includes(t)));
    }
    return result;
  }, [scripts, filters, searchInput]);

  // All tags from scripts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    scripts.forEach(s => s.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [scripts]);

  // Selected script
  const selectedScript = useMemo(() => {
    return scripts.find(s => s.id === selectedScriptId);
  }, [scripts, selectedScriptId]);

  // Handle select script
  const handleSelectScript = (id: string) => {
    setSelectedScriptId(id);
    setIsCreating(false);
    setEditingScript(null);
  };

  // Handle create new
  const handleCreate = () => {
    setIsCreating(true);
    setSelectedScriptId(null);
    setEditingScript({
      category: 'interaction',
      content: '',
      color: '#ffffff',
      priority: 5,
      triggers: [],
      tags: [],
    });
  };

  // Handle edit script
  const handleEdit = (script: Script) => {
    setEditingScript({ ...script });
    setIsCreating(false);
    setSelectedScriptId(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!editingScript) return;

    if (isCreating) {
      const newScript: Script = {
        id: generateId(),
        category: editingScript.category || 'interaction',
        content: editingScript.content || '',
        color: editingScript.color || '#ffffff',
        priority: editingScript.priority || 5,
        triggers: editingScript.triggers || [],
        tags: editingScript.tags || [],
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await scriptService.createScript({
        id: newScript.id,
        category: newScript.category,
        content: newScript.content,
        color: newScript.color,
        priority: newScript.priority,
        triggers: newScript.triggers,
        tags: newScript.tags,
      });
      addScript(newScript);
      setIsCreating(false);
      setEditingScript(null);
      setSelectedScriptId(newScript.id);
    } else if (editingScript.id) {
      const updated = await scriptService.updateScript(editingScript.id, {
        category: editingScript.category,
        content: editingScript.content,
        color: editingScript.color,
        priority: editingScript.priority,
        triggers: editingScript.triggers,
        tags: editingScript.tags,
      });
      if (updated) {
        updateScript(editingScript.id, updated);
        setEditingScript(null);
        setSelectedScriptId(editingScript.id);
      }
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    await scriptService.deleteScript(id);
    deleteScript(id);
    if (selectedScriptId === id) {
      setSelectedScriptId(null);
      setEditingScript(null);
    }
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      await scriptService.deleteScript(id);
      deleteScript(id);
    }
    setSelectedIds(new Set());
  };

  // Handle category filter
  const handleCategoryFilter = (category: ScriptCategory | undefined) => {
    setCategoryFilter(category);
  };

  // Handle tag filter toggle
  const handleTagFilter = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    setTagFilter(newTags);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchInput(query);
    setSearchQuery(query);
  };

  // Handle add tag to editing script
  const handleAddTag = () => {
    if (!editingScript || !tagInput.trim()) return;
    const newTags = [...(editingScript.tags || []), tagInput.trim()];
    setEditingScript({ ...editingScript, tags: newTags });
    setTagInput('');
  };

  // Handle remove tag from editing script
  const handleRemoveTag = (tag: string) => {
    if (!editingScript) return;
    const newTags = (editingScript.tags || []).filter(t => t !== tag);
    setEditingScript({ ...editingScript, tags: newTags });
  };

  // Handle trigger toggle
  const handleTriggerToggle = (trigger: TriggerType) => {
    if (!editingScript) return;
    const newTriggers = editingScript.triggers?.includes(trigger)
      ? editingScript.triggers.filter(t => t !== trigger)
      : [...(editingScript.triggers || []), trigger];
    setEditingScript({ ...editingScript, triggers: newTriggers });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedIds.size === filteredScripts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredScripts.map(s => s.id)));
    }
  };

  // Handle checkbox toggle
  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Handle export
  const handleExport = () => {
    const data = selectedIds.size > 0
      ? scripts.filter(s => selectedIds.has(s.id))
      : filteredScripts;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scripts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        const scriptsToAdd = Array.isArray(imported) ? imported : [imported];
        scriptsToAdd.forEach((input: any) => {
          const newScript: Script = {
            id: generateId(),
            category: input.category || 'interaction',
            content: input.content || '',
            color: input.color || '#ffffff',
            priority: input.priority || 5,
            triggers: input.triggers || [],
            tags: input.tags || [],
            usageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          scriptService.createScript({
            id: newScript.id,
            category: newScript.category,
            content: newScript.content,
            color: newScript.color,
            priority: newScript.priority,
            triggers: newScript.triggers,
            tags: newScript.tags,
          });
          addScript(newScript);
        });
      } catch (err) {
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Handle AI rewrite
  const handleAIRewrite = async () => {
    if (!selectedScript) return;
    setAiLoading(true);
    // Simulate AI rewrite - in real app, this would call AI service
    setTimeout(() => {
      const rewritten = `【AI改写】${selectedScript.content}`;
      setEditingScript({
        ...selectedScript,
        content: rewritten,
      });
      setAiLoading(false);
      setShowAIPanel(false);
    }, 1000);
  };

  // Handle AI batch generate
  const handleAIBatchGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    // Simulate AI batch generation - in real app, this would call AI service
    setTimeout(() => {
      const generated: Partial<Script>[] = [
        { category: 'interaction', content: `${aiPrompt} - 版本1`, priority: 5, tags: ['AI生成'], triggers: [] },
        { category: 'interaction', content: `${aiPrompt} - 版本2`, priority: 5, tags: ['AI生成'], triggers: [] },
        { category: 'interaction', content: `${aiPrompt} - 版本3`, priority: 5, tags: ['AI生成'], triggers: [] },
      ];
      generated.forEach(input => {
        const newScript: Script = {
          id: generateId(),
          category: input.category || 'interaction',
          content: input.content || '',
          color: '#ffffff',
          priority: input.priority || 5,
          triggers: input.triggers || [],
          tags: input.tags || [],
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        scriptService.createScript({
          id: newScript.id,
          category: newScript.category,
          content: newScript.content,
          color: newScript.color,
          priority: newScript.priority,
          triggers: newScript.triggers,
          tags: newScript.tags,
        });
        addScript(newScript);
      });
      setAiLoading(false);
      setAiPrompt('');
      setShowAIPanel(false);
    }, 1500);
  };

  // Handle approve pending script
  const handleApprove = (id: string) => {
    approveScript(id);
  };

  // Handle reject pending script
  const handleReject = (id: string) => {
    rejectScript(id);
  };

  return (
    <div className="script-management">
      {/* Header */}
      <div className="script-management__header">
        <h2>话术管理</h2>
        <div className="script-management__tabs">
          <button
            className={`tab ${activeTab === 'scripts' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('scripts')}
          >
            话术库 ({scripts.length})
          </button>
          <button
            className={`tab ${activeTab === 'pending' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            待审核 ({pendingScripts.length})
          </button>
        </div>
      </div>

      {activeTab === 'scripts' ? (
        <div className="script-management__content">
          {/* Left Panel - Script List */}
          <div className="script-management__list-panel">
            {/* Filters */}
            <div className="script-management__filters">
              <div className="filter-row">
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleCategoryFilter(e.target.value as ScriptCategory || undefined)}
                  className="category-select"
                >
                  <option value="">全部分类</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="搜索话术..."
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              {allTags.length > 0 && (
                <div className="tag-filters">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      className={`tag-filter ${filters.tags.includes(tag) ? 'tag-filter--active' : ''}`}
                      onClick={() => handleTagFilter(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                  {filters.tags.length > 0 && (
                    <button className="clear-filters" onClick={clearFilters}>
                      清除筛选
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Script List */}
            <div className="script-list">
              <div className="script-list__header">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredScripts.length && filteredScripts.length > 0}
                    onChange={handleSelectAll}
                  />
                  全选
                </label>
                <span className="script-count">{filteredScripts.length} 条话术</span>
              </div>
              {filteredScripts.map(script => (
                <div
                  key={script.id}
                  className={`script-item ${selectedScriptId === script.id ? 'script-item--selected' : ''}`}
                  onClick={() => handleSelectScript(script.id)}
                >
                  <label className="checkbox-label" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(script.id)}
                      onChange={() => handleToggleSelect(script.id)}
                    />
                  </label>
                  <div className="script-item__content">
                    <div className="script-item__header">
                      <span
                        className="script-item__category"
                        style={{ backgroundColor: CATEGORIES.find(c => c.value === script.category)?.color }}
                      >
                        {CATEGORIES.find(c => c.value === script.category)?.label}
                      </span>
                      <span className="script-item__priority">P{script.priority}</span>
                    </div>
                    <p className="script-item__text">{script.content}</p>
                    {script.tags.length > 0 && (
                      <div className="script-item__tags">
                        {script.tags.map(tag => (
                          <span key={tag} className="script-item__tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="script-item__actions">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(script); }}>编辑</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(script.id); }} className="delete-btn">删除</button>
                  </div>
                </div>
              ))}
              {filteredScripts.length === 0 && (
                <div className="empty-state">暂无话术</div>
              )}
            </div>

            {/* Batch Actions */}
            <div className="script-management__batch-actions">
              <button onClick={handleCreate}>+ 新增</button>
              <label className="import-btn">
                批量导入
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
              <button onClick={handleExport}>批量导出</button>
              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className="delete-btn"
              >
                批量删除 ({selectedIds.size})
              </button>
            </div>
          </div>

          {/* Right Panel - Editor */}
          <div className="script-management__editor-panel">
            {editingScript ? (
              <div className="script-editor">
                <h3>{isCreating ? '新增话术' : '编辑话术'}</h3>

                <div className="editor-field">
                  <label>内容</label>
                  <textarea
                    value={editingScript.content || ''}
                    onChange={(e) => setEditingScript({ ...editingScript, content: e.target.value })}
                    placeholder="输入话术内容..."
                    rows={6}
                  />
                </div>

                <div className="editor-row">
                  <div className="editor-field">
                    <label>分类</label>
                    <select
                      value={editingScript.category || 'interaction'}
                      onChange={(e) => setEditingScript({ ...editingScript, category: e.target.value as ScriptCategory })}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="editor-field">
                    <label>优先级</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={editingScript.priority || 5}
                      onChange={(e) => setEditingScript({ ...editingScript, priority: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                </div>

                <div className="editor-field">
                  <label>标签</label>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="输入标签，回车添加"
                    />
                    <button onClick={handleAddTag}>添加</button>
                  </div>
                  <div className="tag-list">
                    {(editingScript.tags || []).map(tag => (
                      <span key={tag} className="tag">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)}>x</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="editor-field">
                  <label>触发条件</label>
                  <div className="trigger-list">
                    {TRIGGERS.map(trigger => (
                      <label key={trigger.value} className="trigger-item">
                        <input
                          type="checkbox"
                          checked={editingScript.triggers?.includes(trigger.value) || false}
                          onChange={() => handleTriggerToggle(trigger.value)}
                        />
                        {trigger.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="editor-actions">
                  <button onClick={handleSave} className="save-btn">
                    保存
                  </button>
                  {!isCreating && selectedScript && (
                    <button onClick={handleAIRewrite} className="ai-btn" disabled={aiLoading}>
                      {aiLoading ? 'AI改写中...' : 'AI改写'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingScript(null);
                      setIsCreating(false);
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="editor-placeholder">
                <p>选择话术进行编辑，或点击"新增"创建新话术</p>
                <button onClick={() => setShowAIPanel(!showAIPanel)} className="ai-btn">
                  AI 批量生成
                </button>

                {showAIPanel && (
                  <div className="ai-panel">
                    <h4>AI 批量生成话术</h4>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="输入主题或关键词，AI将批量生成话术..."
                      rows={4}
                    />
                    <button
                      onClick={handleAIBatchGenerate}
                      disabled={aiLoading || !aiPrompt.trim()}
                      className="ai-btn"
                    >
                      {aiLoading ? '生成中...' : '开始生成'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Pending Scripts Tab */
        <div className="script-management__pending">
          <div className="pending-list">
            {pendingScripts.length === 0 ? (
              <div className="empty-state">暂无待审核话术</div>
            ) : (
              pendingScripts.map(pending => (
                <div key={pending.id} className="pending-item">
                  <div className="pending-item__content">
                    <span className="pending-item__category">{pending.category}</span>
                    <p className="pending-item__text">{pending.content}</p>
                  </div>
                  <div className="pending-item__actions">
                    <button onClick={() => handleApprove(pending.id)} className="approve-btn">
                      通过
                    </button>
                    <button onClick={() => handleReject(pending.id)} className="reject-btn">
                      拒绝
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}