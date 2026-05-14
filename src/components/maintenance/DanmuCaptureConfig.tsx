import React, { useState, useEffect, useCallback } from 'react';
import type { DanmuCaptureConfig as DanmuCaptureConfigType, DanmuCaptureWindow, Danmu } from '../../types';

interface Props {
  className?: string;
}

const CAPTURE_INTERVALS = [
  { value: 2000, label: '2秒' },
  { value: 5000, label: '5秒' },
];

const OCR_ENGINES = [
  { value: 'tesseract', label: 'Tesseract（本地）' },
  { value: 'cloud', label: '云端 OCR' },
];

const TESSERACT_LANGUAGES = [
  { value: 'eng+chi_sim', label: '中文简体 + 英文' },
  { value: 'eng+chi_tra', label: '中文繁体 + 英文' },
  { value: 'eng', label: '仅英文' },
  { value: 'eng+chi_sim+chi_tra', label: '中文简繁 + 英文' },
];

export const DanmuCaptureConfig: React.FC<Props> = ({ className }) => {
  const [windows, setWindows] = useState<DanmuCaptureWindow[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<DanmuCaptureWindow | null>(null);
  const [config, setConfig] = useState<DanmuCaptureConfigType | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Danmu[]>([]);
  const [captureStatus, setCaptureStatus] = useState<'stopped' | 'capturing' | 'paused'>('stopped');
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadConfig();
    loadWindows();

    // Subscribe to danmu events
    if (window.electronAPI) {
      window.electronAPI.onDanmuBatch((danmuList: Danmu[]) => {
        setTestResults(prev => [...prev.slice(-20), ...danmuList].slice(-50));
      });

      window.electronAPI.onDanmuError((err: string) => {
        setError(err);
        setTimeout(() => setError(null), 5000);
      });

      window.electronAPI.onDanmuStatus((status: { status: 'capturing' | 'paused' | 'stopped' }) => {
        setCaptureStatus(status.status);
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('danmu:batch');
        window.electronAPI.removeAllListeners('danmu:error');
        window.electronAPI.removeAllListeners('danmu:status');
      }
    };
  }, []);

  const loadConfig = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const cfg = await window.electronAPI.getDanmuConfig();
      setConfig(cfg);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }, []);

  const loadWindows = useCallback(async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const windowList = await window.electronAPI.getDanmuWindows();
      setWindows(windowList);
    } catch (err) {
      console.error('Failed to load windows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectWindow = useCallback(async (windowId: string) => {
    if (!window.electronAPI) return;
    try {
      const win = await window.electronAPI.selectDanmuWindow(windowId);
      setSelectedWindow(win);
      if (win) {
        setConfig(prev => prev ? { ...prev, windowTitle: win.title } : prev);
      }
    } catch (err) {
      console.error('Failed to select window:', err);
    }
  }, []);

  const handleIntervalChange = useCallback(async (intervalMs: number) => {
    if (!window.electronAPI || !config) return;
    try {
      const updated = await window.electronAPI.updateDanmuConfig({ captureIntervalMs: intervalMs });
      setConfig(updated);
    } catch (err) {
      console.error('Failed to update interval:', err);
    }
  }, [config]);

  const handleOCREnableChange = useCallback(async (enabled: boolean) => {
    if (!window.electronAPI || !config) return;
    try {
      const updated = await window.electronAPI.updateDanmuConfig({ useOCR: enabled });
      setConfig(updated);
    } catch (err) {
      console.error('Failed to update OCR setting:', err);
    }
  }, [config]);

  const handleOCREngineChange = useCallback(async (engine: 'tesseract' | 'cloud') => {
    if (!window.electronAPI || !config) return;
    try {
      const updated = await window.electronAPI.updateDanmuConfig({ ocrEngine: engine });
      setConfig(updated);
    } catch (err) {
      console.error('Failed to update OCR engine:', err);
    }
  }, [config]);

  const handleTesseractLanguageChange = useCallback((lang: string) => {
    // Tesseract language is configured via OCR init - this is a preview feature
    // Actual language pack selection would need OCR service restart
    console.log('Tesseract language changed to:', lang);
  }, []);

  const handleTestCapture = useCallback(async () => {
    if (!window.electronAPI) return;
    setTesting(true);
    setTestResults([]);
    setError(null);

    try {
      // Stop any existing capture
      await window.electronAPI.stopDanmuCapture();

      // Start capture
      const started = await window.electronAPI.startDanmuCapture();
      if (started) {
        setCaptureStatus('capturing');
        // Auto-stop after 10 seconds
        setTimeout(async () => {
          if (window.electronAPI) {
            await window.electronAPI.stopDanmuCapture();
            setCaptureStatus('stopped');
            setTesting(false);
          }
        }, 10000);
      }
    } catch (err) {
      console.error('Failed to test capture:', err);
      setError('测试启动失败');
      setTesting(false);
    }
  }, []);

  const handleStopTest = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.stopDanmuCapture();
      setCaptureStatus('stopped');
      setTesting(false);
    } catch (err) {
      console.error('Failed to stop capture:', err);
    }
  }, []);

  const handleSaveConfig = useCallback(async () => {
    if (!window.electronAPI || !config) return;
    try {
      await window.electronAPI.updateDanmuConfig(config);
      alert('配置已保存');
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('保存失败');
    }
  }, [config]);

  const getStatusText = () => {
    switch (captureStatus) {
      case 'capturing':
        return '采集中';
      case 'paused':
        return '已暂停';
      default:
        return '已停止';
    }
  };

  const getStatusColor = () => {
    switch (captureStatus) {
      case 'capturing':
        return '#4caf50';
      case 'paused':
        return '#ff9800';
      default:
        return '#999';
    }
  };

  return (
    <div className={`danmu-capture-config ${className || ''}`}>
      <div className="config-header">
        <h2>弹幕抓取配置</h2>
        <div className="status-indicator">
          <span
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>关闭</button>
        </div>
      )}

      <div className="config-content">
        {/* Window Selection Section */}
        <div className="config-section">
          <h3>窗口选择</h3>
          <div className="window-selector">
            <div className="window-list">
              {loading ? (
                <div className="loading-text">正在获取窗口列表...</div>
              ) : windows.length === 0 ? (
                <div className="empty-text">未找到可用的窗口</div>
              ) : (
                windows.map(win => (
                  <div
                    key={win.id}
                    className={`window-item ${selectedWindow?.id === win.id ? 'selected' : ''}`}
                    onClick={() => handleSelectWindow(win.id)}
                  >
                    <span className="window-title">{win.title}</span>
                    <span className="window-process">{win.processName}</span>
                  </div>
                ))
              )}
            </div>
            <button
              className="btn-secondary refresh-btn"
              onClick={loadWindows}
              disabled={loading}
            >
              刷新窗口
            </button>
          </div>
          {selectedWindow && (
            <div className="selected-window-info">
              已选择窗口: <strong>{selectedWindow.title}</strong>
            </div>
          )}
        </div>

        {/* Capture Frequency Section */}
        <div className="config-section">
          <h3>抓取频率</h3>
          <div className="radio-group">
            {CAPTURE_INTERVALS.map(opt => (
              <label key={opt.value} className="radio-label">
                <input
                  type="radio"
                  name="captureInterval"
                  value={opt.value}
                  checked={config?.captureIntervalMs === opt.value}
                  onChange={() => handleIntervalChange(opt.value)}
                />
                <span className="radio-custom" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* OCR Settings Section */}
        <div className="config-section">
          <h3>OCR 设置</h3>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config?.useOCR || false}
                onChange={e => handleOCREnableChange(e.target.checked)}
              />
              <span className="checkbox-custom" />
              启用 OCR 兜底（当 DOM 读取失败时使用）
            </label>
          </div>

          {config?.useOCR && (
            <>
              <div className="form-group">
                <label>OCR 引擎</label>
                <div className="radio-group">
                  {OCR_ENGINES.map(opt => (
                    <label key={opt.value} className="radio-label">
                      <input
                        type="radio"
                        name="ocrEngine"
                        value={opt.value}
                        checked={config?.ocrEngine === opt.value}
                        onChange={() => handleOCREngineChange(opt.value as 'tesseract' | 'cloud')}
                      />
                      <span className="radio-custom" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {config?.ocrEngine === 'tesseract' && (
                <div className="form-group">
                  <label>Tesseract 语言包</label>
                  <select
                    className="select-input"
                    defaultValue="eng+chi_sim"
                    onChange={e => handleTesseractLanguageChange(e.target.value)}
                  >
                    {TESSERACT_LANGUAGES.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="hint-text">
                    修改语言包后需要重启 OCR 服务
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Test Section */}
        <div className="config-section">
          <h3>测试功能</h3>
          <div className="test-controls">
            {!testing ? (
              <button
                className="btn-primary"
                onClick={handleTestCapture}
                disabled={!selectedWindow || captureStatus === 'capturing'}
              >
                测试弹幕抓取
              </button>
            ) : (
              <button
                className="btn-danger"
                onClick={handleStopTest}
              >
                停止测试
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={handleSaveConfig}
            >
              保存配置
            </button>
          </div>

          <div className="test-results">
            <h4>抓取结果预览</h4>
            <div className="danmu-list">
              {testResults.length === 0 ? (
                <div className="empty-text">
                  {testing ? '等待弹幕数据...' : '暂无抓取结果'}
                </div>
              ) : (
                testResults.map((danmu, idx) => (
                  <div key={`${danmu.id}-${idx}`} className={`danmu-item danmu-${danmu.type}`}>
                    <span className="danmu-username">{danmu.username}:</span>
                    <span className="danmu-content">{danmu.content}</span>
                    <span className={`danmu-importance importance-${danmu.importance}`}>
                      {danmu.importance === 'highlight' && '⭐'}
                      {danmu.importance === 'danger' && '⚠️'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .danmu-capture-config {
          padding: 20px;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }

        .config-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .config-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: #f5f5f5;
          border-radius: 20px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .status-text {
          font-size: 13px;
          color: #666;
        }

        .error-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #fff3f3;
          border: 1px solid #ffcdd2;
          border-radius: 6px;
          margin-bottom: 16px;
          color: #c62828;
          font-size: 13px;
        }

        .error-banner button {
          background: none;
          border: none;
          color: #c62828;
          cursor: pointer;
          padding: 4px 8px;
        }

        .config-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .config-section {
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 16px;
        }

        .config-section h3 {
          margin: 0 0 12px 0;
          font-size: 15px;
          color: #333;
        }

        /* Window Selector */
        .window-selector {
          display: flex;
          gap: 12px;
        }

        .window-list {
          flex: 1;
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
        }

        .window-item {
          padding: 10px 12px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.15s;
        }

        .window-item:last-child {
          border-bottom: none;
        }

        .window-item:hover {
          background: #f5f5f5;
        }

        .window-item.selected {
          background: #e3f2fd;
        }

        .window-title {
          font-size: 13px;
          color: #333;
        }

        .window-process {
          font-size: 11px;
          color: #999;
        }

        .refresh-btn {
          align-self: flex-start;
        }

        .selected-window-info {
          margin-top: 12px;
          font-size: 13px;
          color: #666;
        }

        .selected-window-info strong {
          color: #4a90d9;
        }

        .loading-text,
        .empty-text {
          padding: 20px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        /* Radio Group */
        .radio-group {
          display: flex;
          gap: 20px;
        }

        .radio-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #333;
        }

        .radio-label input {
          display: none;
        }

        .radio-custom {
          width: 18px;
          height: 18px;
          border: 2px solid #ddd;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .radio-label input:checked + .radio-custom {
          border-color: #4a90d9;
        }

        .radio-label input:checked + .radio-custom::after {
          content: '';
          width: 10px;
          height: 10px;
          background: #4a90d9;
          border-radius: 50%;
        }

        /* Form Elements */
        .form-group {
          margin-bottom: 12px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #333;
        }

        .checkbox-label input {
          display: none;
        }

        .checkbox-custom {
          width: 18px;
          height: 18px;
          border: 2px solid #ddd;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .checkbox-label input:checked + .checkbox-custom {
          background: #4a90d9;
          border-color: #4a90d9;
        }

        .checkbox-label input:checked + .checkbox-custom::after {
          content: '✓';
          color: white;
          font-size: 12px;
        }

        .select-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }

        .select-input:focus {
          outline: none;
          border-color: #4a90d9;
        }

        .hint-text {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #999;
        }

        /* Test Controls */
        .test-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }

        .test-results {
          border: 1px solid #eee;
          border-radius: 6px;
          background: white;
        }

        .test-results h4 {
          margin: 0;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 500;
          color: #666;
          border-bottom: 1px solid #eee;
        }

        .danmu-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .danmu-item {
          padding: 8px 12px;
          border-bottom: 1px solid #f5f5f5;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .danmu-item:last-child {
          border-bottom: none;
        }

        .danmu-username {
          font-weight: 500;
          color: #4a90d9;
        }

        .danmu-content {
          flex: 1;
          color: #333;
        }

        .danmu-importance {
          font-size: 12px;
        }

        .importance-highlight {
          color: #ffc107;
        }

        .importance-danger {
          color: #f44336;
        }

        .danmu-gift,
        .danmu-big_gift {
          background: #fff8e1;
        }

        .danmu-follower {
          background: #e8f5e9;
        }

        .danmu-hater,
        .danmu-provocative {
          background: #ffebee;
        }

        /* Buttons */
        .btn-primary {
          padding: 8px 16px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-primary:hover {
          background: #3a7fc4;
        }

        .btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 8px 16px;
          background: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-secondary:hover {
          background: #e8e8e8;
        }

        .btn-secondary:disabled {
          background: #f5f5f5;
          color: #ccc;
          cursor: not-allowed;
        }

        .btn-danger {
          padding: 8px 16px;
          background: #d9534f;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-danger:hover {
          background: #c9302c;
        }
      `}</style>
    </div>
  );
};

export default DanmuCaptureConfig;
