import { useState, useMemo } from 'react';
import { useScriptStore } from '../../stores/scriptStore';
import type { Script, ScriptCategory } from '../../types';
import './ScriptSelector.css';

const SCRIPT_CATEGORIES: { value: ScriptCategory; label: string; color: string }[] = [
  { value: 'thanks', label: '感谢类', color: '#4CAF50' },
  { value: 'rebuttal', label: '回击类', color: '#F44336' },
  { value: 'interaction', label: '互动类', color: '#2196F3' },
  { value: 'ad', label: '带货类', color: '#FF9800' },
  { value: 'praise', label: '夸奖类', color: '#E91E63' },
  { value: 'opening', label: '开播类', color: '#9C27B0' },
  { value: 'closing', label: '闭播类', color: '#673AB7' },
  { value: 'lottery', label: '抽奖类', color: '#FFEB3B' },
  { value: 'crisis', label: '危机类', color: '#795548' },
];

interface ScriptSelectorProps {
  onConfirm: (scriptIds: string[]) => void;
  onClose: () => void;
  excludeScriptIds?: string[];
}

export function ScriptSelector({ onConfirm, onClose, excludeScriptIds = [] }: ScriptSelectorProps) {
  const { scripts, getScriptsByCategory } = useScriptStore();
  const [selectedCategories, setSelectedCategories] = useState<ScriptCategory[]>([]);
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);

  const filteredScripts = useMemo(() => {
    if (selectedCategories.length === 0) {
      return scripts.filter(s => !excludeScriptIds.includes(s.id));
    }
    return scripts.filter(
      s => selectedCategories.includes(s.category) && !excludeScriptIds.includes(s.id)
    );
  }, [scripts, selectedCategories, excludeScriptIds]);

  const toggleCategory = (category: ScriptCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleScript = (scriptId: string) => {
    setSelectedScriptIds(prev =>
      prev.includes(scriptId)
        ? prev.filter(id => id !== scriptId)
        : [...prev, scriptId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedScriptIds);
    onClose();
  };

  const categoryInfo = (category: ScriptCategory) => {
    return SCRIPT_CATEGORIES.find(c => c.value === category) || { label: category, color: '#888' };
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog script-selector">
        <div className="dialog__header">
          <h2>选择话术</h2>
          <button className="dialog__close" onClick={onClose}>×</button>
        </div>

        <div className="script-selector__body">
          {/* Category filter sidebar */}
          <div className="script-selector__sidebar">
            <h3>分类筛选</h3>
            <div className="script-selector__categories">
              {SCRIPT_CATEGORIES.map(cat => (
                <label
                  key={cat.value}
                  className={`script-selector__category ${selectedCategories.includes(cat.value) ? 'selected' : ''}`}
                  style={{ '--cat-color': cat.color } as React.CSSProperties}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.value)}
                    onChange={() => toggleCategory(cat.value)}
                  />
                  <span>{cat.label}</span>
                  <span className="script-selector__count">
                    ({getScriptsByCategory(cat.value).filter(s => !excludeScriptIds.includes(s.id)).length})
                  </span>
                </label>
              ))}
            </div>
            <button
              className="script-selector__clear-btn"
              onClick={() => setSelectedCategories([])}
            >
              清除筛选
            </button>
          </div>

          {/* Script list */}
          <div className="script-selector__list">
            <div className="script-selector__list-header">
              <span>共 {filteredScripts.length} 条话术</span>
            </div>
            <div className="script-selector__items">
              {filteredScripts.length === 0 ? (
                <div className="script-selector__empty">
                  {selectedCategories.length === 0 ? '请先选择分类' : '该分类暂无话术'}
                </div>
              ) : (
                filteredScripts.map(script => (
                  <div
                    key={script.id}
                    className={`script-selector__item ${selectedScriptIds.includes(script.id) ? 'selected' : ''}`}
                    onClick={() => toggleScript(script.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScriptIds.includes(script.id)}
                      onChange={() => {}}
                    />
                    <div className="script-selector__item-content">
                      <p className="script-selector__item-text">{script.content}</p>
                      <span
                        className="script-selector__item-tag"
                        style={{ backgroundColor: categoryInfo(script.category).color }}
                      >
                        {categoryInfo(script.category).label}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="dialog__footer">
          <div className="script-selector__selected-count">
            已选 {selectedScriptIds.length} 条话术
          </div>
          <div className="dialog__footer-actions">
            <button onClick={onClose} className="dialog__btn dialog__btn--cancel">取消</button>
            <button
              onClick={handleConfirm}
              className="dialog__btn dialog__btn--submit"
              disabled={selectedScriptIds.length === 0}
            >
              添加 ({selectedScriptIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScriptSelector;