import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useScriptStore } from '../../stores/scriptStore';
import * as scriptService from '../../services/scriptService';
import { syncIdFromDatabase } from '../../services/IdGenerator';
import {
  parseTextFormat,
  parseMarkdown,
  useAIConversion,
  convertToScripts,
  exportToJSON,
  exportToMarkdown,
  exportToText,
  scriptsToExcelData,
  ParsedScript,
  ParseResult,
} from '../../services/ImportParser';
import type { Script, ScriptCategory } from '../../types';
import './ImportExport.css';

const CATEGORIES: { value: ScriptCategory | 'uncategorized'; label: string; color: string }[] = [
  { value: 'thanks', label: '感谢类', color: '#4CAF50' },
  { value: 'rebuttal', label: '回击类', color: '#F44336' },
  { value: 'interaction', label: '互动类', color: '#2196F3' },
  { value: 'ad', label: '带货类', color: '#FF9800' },
  { value: 'praise', label: '夸奖类', color: '#9C27B0' },
  { value: 'opening', label: '开播类', color: '#00BCD4' },
  { value: 'closing', label: '闭播类', color: '#795548' },
  { value: 'lottery', label: '抽奖类', color: '#E91E63' },
  { value: 'crisis', label: '危机类', color: '#607D8B' },
  { value: 'uncategorized', label: '未分类', color: '#9E9E9E' },
];

type ImportSource = 'json' | 'excel' | 'text';
type ExportFormat = 'json' | 'excel' | 'markdown' | 'text';
type TabType = 'import' | 'export';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function ImportExport() {
  const { scripts, addScript } = useScriptStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('import');

  // Import state
  const [importSource, setImportSource] = useState<ImportSource>('text');
  const [textInput, setTextInput] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedParsedIndices, setSelectedParsedIndices] = useState<Set<number>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const [useAI, setUseAI] = useState(false);

  // Export state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportCategory, setExportCategory] = useState<ScriptCategory | 'all'>('all');
  const [exportTags, setExportTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [exportSelected, setExportSelected] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // All tags from scripts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    scripts.forEach(s => s.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [scripts]);

  // Filtered scripts for export preview
  const exportPreviewScripts = useMemo(() => {
    let filtered = scripts;

    if (exportCategory !== 'all') {
      filtered = filtered.filter(s => s.category === exportCategory);
    }

    if (exportTags.length > 0) {
      filtered = filtered.filter(s => exportTags.some(t => s.tags.includes(t)));
    }

    if (dateRange.start) {
      filtered = filtered.filter(s => s.createdAt >= dateRange.start!.getTime());
    }

    if (dateRange.end) {
      filtered = filtered.filter(s => s.createdAt <= dateRange.end!.getTime());
    }

    return filtered;
  }, [scripts, exportCategory, exportTags, dateRange]);

  // Category statistics for export
  const categoryStats = useMemo(() => {
    const stats = new Map<ScriptCategory | 'uncategorized', number>();
    for (const script of exportPreviewScripts) {
      const count = stats.get(script.category) || 0;
      stats.set(script.category, count + 1);
    }
    return stats;
  }, [exportPreviewScripts]);

  // Handle text/markdown parsing
  const handleParse = useCallback(async () => {
    if (!textInput.trim()) return;

    setIsParsing(true);
    setParseProgress('正在解析...');

    try {
      let result: ParseResult;

      if (useAI) {
        result = await useAIConversion(textInput, {
          onProgress: (stage) => setParseProgress(stage),
        });
      } else {
        // Try markdown first, then text
        const markdownResult = parseMarkdown(textInput);
        if (markdownResult.statistics.parsedCount > 0) {
          result = markdownResult;
        } else {
          result = parseTextFormat(textInput);
        }
        setParseProgress('解析完成');
      }

      setParseResult(result);
      // Select all by default
      setSelectedParsedIndices(new Set(result.scripts.map((_, i) => i)));
    } catch (error) {
      console.error('Parse error:', error);
      setParseProgress('解析失败');
    } finally {
      setIsParsing(false);
    }
  }, [textInput, useAI]);

  // Handle JSON file import
  const handleJSONImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        const scriptsToAdd = Array.isArray(imported) ? imported : [imported];

        const parsedScripts: ParsedScript[] = scriptsToAdd.map((input: any) => ({
          category: (input.category || 'uncategorized') as ScriptCategory | 'uncategorized',
          content: input.content || '',
          tags: input.tags || [],
          confidence: 1.0,
        }));

        const result: ParseResult = {
          scripts: parsedScripts,
          unrecognizedLines: [],
          statistics: {
            totalLines: parsedScripts.length,
            parsedCount: parsedScripts.length,
            unrecognizedCount: 0,
          },
        };

        setParseResult(result);
        setSelectedParsedIndices(new Set(parsedScripts.map((_, i) => i)));
        setIsParsing(false);
        setParseProgress('');
      } catch (err) {
        console.error('Import failed:', err);
        alert('JSON 导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  // Handle Excel file import
  const handleExcelImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For Excel, we'll use a simple approach with the xlsx library if available
    // Otherwise show a message
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        // Try to parse as xlsx - this would require xlsx library
        // For now, we'll try to parse as binary and extract text

        // Simple fallback - show message that Excel import needs xlsx library
        alert('Excel 导入功能需要 xlsx 库支持，当前版本请使用 JSON 或文本格式导入');

        // In production, you would use:
        // const XLSX = require('xlsx');
        // const workbook = XLSX.read(arrayBuffer);
        // const sheetName = workbook.SheetNames[0];
        // const worksheet = workbook.Sheets[sheetName];
        // const data = XLSX.utils.sheet_to_json(worksheet);

      } catch (err) {
        console.error('Excel import failed:', err);
        alert('Excel 导入失败');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }, []);

  // Handle confirm import
  const handleConfirmImport = useCallback(async () => {
    if (!parseResult || selectedParsedIndices.size === 0) return;

    // Sync ID counter with database before import to avoid ID conflicts
    await syncIdFromDatabase();

    const selectedScripts = parseResult.scripts.filter((_, i) => selectedParsedIndices.has(i));
    const scriptsToAdd = convertToScripts(selectedScripts);

    for (const script of scriptsToAdd) {
      scriptService.createScript({
        id: script.id,
        category: script.category,
        content: script.content,
        color: script.color,
        priority: script.priority,
        triggers: script.triggers,
        tags: script.tags,
      });
      addScript(script);
    }

    // Reset state
    setTextInput('');
    setParseResult(null);
    setSelectedParsedIndices(new Set());
    alert(`成功导入 ${scriptsToAdd.length} 条话术`);
  }, [parseResult, selectedParsedIndices, addScript]);

  // Handle parsed script selection toggle
  const handleParsedToggle = useCallback((index: number) => {
    const newSelected = new Set(selectedParsedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedParsedIndices(newSelected);
  }, [selectedParsedIndices]);

  // Handle select all parsed
  const handleSelectAllParsed = useCallback(() => {
    if (!parseResult) return;
    if (selectedParsedIndices.size === parseResult.scripts.length) {
      setSelectedParsedIndices(new Set());
    } else {
      setSelectedParsedIndices(new Set(parseResult.scripts.map((_, i) => i)));
    }
  }, [parseResult, selectedParsedIndices]);

  // Handle export
  const handleExport = useCallback(() => {
    if (exportPreviewScripts.length === 0) {
      alert('没有可导出的话术');
      return;
    }

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (exportFormat) {
      case 'json':
        content = exportToJSON(exportPreviewScripts);
        filename = `scripts-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'markdown':
        content = exportToMarkdown(exportPreviewScripts, true);
        filename = `scripts-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
      case 'text':
        content = exportToText(exportPreviewScripts);
        filename = `scripts-${Date.now()}.txt`;
        mimeType = 'text/plain';
        break;
      case 'excel':
        // For Excel, we'd use xlsx library to create proper xlsx file
        // For now, create CSV as fallback
        const excelData = scriptsToExcelData(exportPreviewScripts);
        content = excelData.map(row => row.join(',')).join('\n');
        filename = `scripts-${Date.now()}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportPreviewScripts, exportFormat]);

  // Handle tag filter toggle for export
  const handleExportTagToggle = useCallback((tag: string) => {
    setExportTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  // Clear date range
  const handleClearDateRange = useCallback(() => {
    setDateRange({});
  }, []);

  return (
    <div className="import-export">
      {/* Header */}
      <div className="import-export__header">
        <h2>导入导出</h2>
        <div className="import-export__tabs">
          <button
            className={`tab ${activeTab === 'import' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            导入
          </button>
          <button
            className={`tab ${activeTab === 'export' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            导出
          </button>
        </div>
      </div>

      <div className="import-export__content">
        {activeTab === 'import' ? (
          /* Import Panel */
          <div className="import-panel">
            {/* Import Source Selection */}
            <div className="import-source">
              <h3>导入来源</h3>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="importSource"
                    value="json"
                    checked={importSource === 'json'}
                    onChange={() => setImportSource('json')}
                  />
                  JSON 文件
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="importSource"
                    value="excel"
                    checked={importSource === 'excel'}
                    onChange={() => setImportSource('excel')}
                  />
                  Excel 文件 (.xlsx)
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="importSource"
                    value="text"
                    checked={importSource === 'text'}
                    onChange={() => setImportSource('text')}
                  />
                  纯文本 / Markdown (自动格式转换)
                </label>
              </div>
            </div>

            {/* File Upload (for JSON/Excel) */}
            {importSource !== 'text' && (
              <div className="file-upload">
                <input
                  ref={importSource === 'json' ? fileInputRef : excelFileInputRef}
                  type="file"
                  accept={importSource === 'json' ? '.json' : '.xlsx'}
                  onChange={importSource === 'json' ? handleJSONImport : handleExcelImport}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => (importSource === 'json' ? fileInputRef : excelFileInputRef).current?.click()}
                  className="upload-btn"
                >
                  选择文件
                </button>
                <span className="file-hint">
                  {importSource === 'json'
                    ? '支持包含话术数组的 JSON 文件'
                    : '支持 .xlsx 格式的 Excel 文件'}
                </span>
              </div>
            )}

            {/* Text Input (for Text/Markdown) */}
            {importSource === 'text' && (
              <div className="text-input-section">
                <div className="text-input-header">
                  <h3>粘贴话术内容</h3>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={useAI}
                      onChange={(e) => setUseAI(e.target.checked)}
                    />
                    使用 AI 辅助识别分类
                  </label>
                </div>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`粘贴话术内容，例如：

# 感谢类
感谢大哥送来的火箭！
谢谢老板的礼物~

# 回击类
来啊，有本事当面说！

# 互动类
觉得主播好看的扣111`}
                  rows={12}
                  className="text-input"
                />
                <div className="text-input-actions">
                  <button
                    onClick={handleParse}
                    disabled={!textInput.trim() || isParsing}
                    className="parse-btn"
                  >
                    {isParsing ? '解析中...' : '解析预览'}
                  </button>
                  {isParsing && <span className="progress-text">{parseProgress}</span>}
                </div>
              </div>
            )}

            {/* Parse Result Preview */}
            {parseResult && (
              <div className="parse-result">
                <div className="parse-result__header">
                  <h3>解析预览</h3>
                  <div className="parse-result__stats">
                    <span>发现 {parseResult.scripts.length} 条话术</span>
                    {parseResult.statistics.unrecognizedCount > 0 && (
                      <span className="unrecognized">
                        ，{parseResult.statistics.unrecognizedCount} 条无法识别
                      </span>
                    )}
                  </div>
                </div>

                {/* Category Summary */}
                <div className="category-summary">
                  {Array.from(new Set(parseResult.scripts.map(s => s.category))).map(cat => {
                    const catInfo = CATEGORIES.find(c => c.value === cat);
                    const count = parseResult.scripts.filter(s => s.category === cat).length;
                    return (
                      <div
                        key={cat}
                        className="category-badge"
                        style={{ borderColor: catInfo?.color }}
                      >
                        <span
                          className="category-dot"
                          style={{ backgroundColor: catInfo?.color }}
                        />
                        {catInfo?.label || cat}: {count}条
                      </div>
                    );
                  })}
                </div>

                {/* Scripts List */}
                <div className="parsed-scripts">
                  <div className="parsed-scripts__header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedParsedIndices.size === parseResult.scripts.length && parseResult.scripts.length > 0}
                        onChange={handleSelectAllParsed}
                      />
                      全选
                    </label>
                    <span>已选择 {selectedParsedIndices.size} 条</span>
                  </div>

                  <div className="parsed-scripts__list">
                    {parseResult.scripts.map((script, index) => {
                      const catInfo = CATEGORIES.find(c => c.value === script.category);
                      return (
                        <div
                          key={index}
                          className={`parsed-script-item ${selectedParsedIndices.has(index) ? 'parsed-script-item--selected' : ''}`}
                          onClick={() => handleParsedToggle(index)}
                        >
                          <label
                            className="checkbox-label"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedParsedIndices.has(index)}
                              onChange={() => handleParsedToggle(index)}
                            />
                          </label>
                          <div className="parsed-script__content">
                            <div className="parsed-script__header">
                              <span
                                className="category-tag"
                                style={{ backgroundColor: catInfo?.color }}
                              >
                                {catInfo?.label || script.category}
                              </span>
                              <span className="confidence">
                                置信度: {Math.round(script.confidence * 100)}%
                              </span>
                            </div>
                            <p className="parsed-script__text">{script.content}</p>
                            {script.tags.length > 0 && (
                              <div className="parsed-script__tags">
                                {script.tags.map(tag => (
                                  <span key={tag} className="parsed-script__tag">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unrecognized Lines */}
                  {parseResult.unrecognizedLines.length > 0 && (
                    <div className="unrecognized-section">
                      <h4>无法识别的内容</h4>
                      <div className="unrecognized-list">
                        {parseResult.unrecognizedLines.map((line, i) => (
                          <div key={i} className="unrecognized-item">{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Import Actions */}
                <div className="import-actions">
                  <button
                    onClick={handleConfirmImport}
                    disabled={selectedParsedIndices.size === 0}
                    className="confirm-btn"
                  >
                    确认导入 ({selectedParsedIndices.size} 条)
                  </button>
                  <button
                    onClick={() => {
                      setParseResult(null);
                      setSelectedParsedIndices(new Set());
                    }}
                    className="cancel-btn"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Export Panel */
          <div className="export-panel">
            {/* Export Format Selection */}
            <div className="export-format">
              <h3>导出格式</h3>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="json"
                    checked={exportFormat === 'json'}
                    onChange={() => setExportFormat('json')}
                  />
                  JSON
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="excel"
                    checked={exportFormat === 'excel'}
                    onChange={() => setExportFormat('excel')}
                  />
                  Excel (.xlsx)
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="markdown"
                    checked={exportFormat === 'markdown'}
                    onChange={() => setExportFormat('markdown')}
                  />
                  Markdown
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="text"
                    checked={exportFormat === 'text'}
                    onChange={() => setExportFormat('text')}
                  />
                  纯文本
                </label>
              </div>
            </div>

            {/* Filter Options */}
            <div className="export-filters">
              <h3>筛选条件</h3>

              {/* Category Filter */}
              <div className="filter-section">
                <label>分类筛选</label>
                <select
                  value={exportCategory}
                  onChange={(e) => setExportCategory(e.target.value as ScriptCategory | 'all')}
                  className="category-select"
                >
                  <option value="all">全部分类</option>
                  {CATEGORIES.filter(c => c.value !== 'uncategorized').map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Tag Filter */}
              {allTags.length > 0 && (
                <div className="filter-section">
                  <label>标签筛选</label>
                  <div className="tag-filters">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        className={`tag-filter ${exportTags.includes(tag) ? 'tag-filter--active' : ''}`}
                        onClick={() => handleExportTagToggle(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range */}
              <div className="filter-section">
                <label>日期范围</label>
                <div className="date-range">
                  <input
                    type="date"
                    value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                    onChange={(e) => setDateRange(prev => ({
                      ...prev,
                      start: e.target.value ? new Date(e.target.value) : undefined,
                    }))}
                  />
                  <span>至</span>
                  <input
                    type="date"
                    value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                    onChange={(e) => setDateRange(prev => ({
                      ...prev,
                      end: e.target.value ? new Date(e.target.value) : undefined,
                    }))}
                  />
                  {(dateRange.start || dateRange.end) && (
                    <button onClick={handleClearDateRange} className="clear-dates">
                      清除日期
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Export Preview */}
            <div className="export-preview">
              <h3>导出预览</h3>
              <div className="export-stats">
                <span>共 {exportPreviewScripts.length} 条话术</span>
                <div className="category-summary">
                  {Array.from(categoryStats.entries()).map(([cat, count]) => {
                    const catInfo = CATEGORIES.find(c => c.value === cat);
                    return (
                      <span
                        key={cat}
                        className="category-badge-small"
                        style={{ color: catInfo?.color }}
                      >
                        {catInfo?.label || cat}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>

              {exportPreviewScripts.length > 0 ? (
                <div className="preview-list">
                  {exportPreviewScripts.slice(0, 10).map(script => {
                    const catInfo = CATEGORIES.find(c => c.value === script.category);
                    return (
                      <div key={script.id} className="preview-item">
                        <span
                          className="preview-category"
                          style={{ backgroundColor: catInfo?.color }}
                        >
                          {catInfo?.label || script.category}
                        </span>
                        <span className="preview-content">{script.content}</span>
                      </div>
                    );
                  })}
                  {exportPreviewScripts.length > 10 && (
                    <div className="preview-more">
                      还有 {exportPreviewScripts.length - 10} 条...
                    </div>
                  )}
                </div>
              ) : (
                <div className="preview-empty">没有符合条件的话术</div>
              )}
            </div>

            {/* Export Actions */}
            <div className="export-actions">
              <button
                onClick={handleExport}
                disabled={exportPreviewScripts.length === 0}
                className="export-btn"
              >
                导出 {exportFormat.toUpperCase()} ({exportPreviewScripts.length} 条)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
