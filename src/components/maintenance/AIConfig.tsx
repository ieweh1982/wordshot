import React, { useState, useEffect, useCallback } from 'react';
import { AIProviderConfig } from '../../types';
import { getAIProviders, saveAIProviders, AIProvidersConfig } from '../../services/configStorage';
import { getAIManager } from '../../services/AIManager';

interface Props {
  className?: string;
}

const defaultProvider: Omit<AIProviderConfig, 'id'> = {
  name: '',
  baseURL: '',
  apiKey: '',
  model: '',
  enabled: true,
  priority: 100,
  timeout: 30000,
};

export const AIConfig: React.FC<Props> = ({ className }) => {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [testResult, setTestResult] = useState<{ providerId: string; success: boolean; message: string } | null>(null);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = useCallback(() => {
    const config = getAIProviders();
    setProviders(config.providers);
    // Set first enabled provider with lowest priority as default
    const enabledSorted = [...config.providers].filter(p => p.enabled).sort((a, b) => a.priority - b.priority);
    if (enabledSorted.length > 0) {
      setDefaultProviderId(enabledSorted[0].id);
    }
  }, []);

  const handleSave = useCallback((config?: AIProvidersConfig) => {
    saveAIProviders(config || { providers });
    // Reload AIManager
    getAIManager().loadProviders();
  }, [providers]);

  const handleAddNew = useCallback(() => {
    const newId = `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setEditingProvider({
      ...defaultProvider,
      id: newId,
      priority: providers.length > 0 ? Math.max(...providers.map(p => p.priority)) + 1 : 1,
    });
    setIsAddingNew(true);
  }, [providers]);

  const handleEdit = useCallback((provider: AIProviderConfig) => {
    setEditingProvider({ ...provider });
    setIsAddingNew(false);
  }, []);

  const handleDelete = useCallback((providerId: string) => {
    if (window.confirm('确定要删除这个 AI Provider 吗？')) {
      const newProviders = providers.filter(p => p.id !== providerId);
      setProviders(newProviders);
      const config: AIProvidersConfig = { providers: newProviders };
      saveAIProviders(config);
      if (editingProvider?.id === providerId) {
        setEditingProvider(null);
        setIsAddingNew(false);
      }
    }
  }, [providers, editingProvider]);

  const handleToggleEnabled = useCallback((providerId: string) => {
    const newProviders = providers.map(p =>
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    );
    setProviders(newProviders);
    handleSave();
  }, [providers, handleSave]);

  const handleSaveEditing = useCallback(() => {
    if (!editingProvider) return;

    if (!editingProvider.name || !editingProvider.baseURL || !editingProvider.model) {
      alert('请填写名称、API地址和模型名称');
      return;
    }

    let newProviders: AIProviderConfig[];
    if (isAddingNew) {
      newProviders = [...providers, editingProvider];
    } else {
      newProviders = providers.map(p => p.id === editingProvider.id ? editingProvider : p);
    }

    setProviders(newProviders);
    handleSave();
    setEditingProvider(null);
    setIsAddingNew(false);
  }, [editingProvider, isAddingNew, providers, handleSave]);

  const handleCancelEdit = useCallback(() => {
    setEditingProvider(null);
    setIsAddingNew(false);
  }, []);

  const handleTestConnection = useCallback(async (provider: AIProviderConfig) => {
    setTestingProviderId(provider.id);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

      const response = await fetch(`${provider.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setTestResult({ providerId: provider.id, success: true, message: '连接成功' });
      } else {
        setTestResult({ providerId: provider.id, success: false, message: `HTTP ${response.status}: ${response.statusText}` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTestResult({ providerId: provider.id, success: false, message });
    } finally {
      setTestingProviderId(null);
    }
  }, []);

  const handleFieldChange = useCallback((field: keyof AIProviderConfig, value: string | number | boolean) => {
    if (!editingProvider) return;
    setEditingProvider({ ...editingProvider, [field]: value });
  }, [editingProvider]);

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);

  return (
    <div className={`ai-config ${className || ''}`}>
      <div className="ai-config-header">
        <h2>AI Provider 配置</h2>
        <button className="btn-primary" onClick={handleAddNew}>+ 添加 Provider</button>
      </div>

      <div className="ai-config-content">
        <div className="provider-list">
          <div className="provider-list-header">
            <span className="col-name">名称</span>
            <span className="col-baseurl">API 地址</span>
            <span className="col-model">模型</span>
            <span className="col-priority">优先级</span>
            <span className="col-status">状态</span>
            <span className="col-actions">操作</span>
          </div>

          {sortedProviders.length === 0 ? (
            <div className="provider-list-empty">
              暂无配置的 AI Provider，点击"添加 Provider"开始配置
            </div>
          ) : (
            sortedProviders.map(provider => (
              <div
                key={provider.id}
                className={`provider-item ${provider.id === defaultProviderId ? 'is-default' : ''} ${!provider.enabled ? 'is-disabled' : ''}`}
              >
                <span className="col-name">
                  {provider.name}
                  {provider.id === defaultProviderId && <span className="default-badge">默认</span>}
                </span>
                <span className="col-baseurl" title={provider.baseURL}>{provider.baseURL}</span>
                <span className="col-model">{provider.model}</span>
                <span className="col-priority">{provider.priority}</span>
                <span className="col-status">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={() => handleToggleEnabled(provider.id)}
                    />
                    <span className="slider"></span>
                  </label>
                </span>
                <span className="col-actions">
                  <button
                    className="btn-text"
                    onClick={() => handleEdit(provider)}
                    title="编辑"
                  >
                    编辑
                  </button>
                  <button
                    className="btn-text"
                    onClick={() => handleTestConnection(provider)}
                    disabled={testingProviderId === provider.id}
                    title="测试连接"
                  >
                    {testingProviderId === provider.id ? '测试中...' : '测试'}
                  </button>
                  <button
                    className="btn-text btn-danger"
                    onClick={() => handleDelete(provider.id)}
                    title="删除"
                  >
                    删除
                  </button>
                </span>
                {testResult?.providerId === provider.id && (
                  <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {editingProvider && (
          <div className="provider-editor">
            <h3>{isAddingNew ? '添加新 Provider' : '编辑 Provider'}</h3>

            <div className="form-group">
              <label>名称</label>
              <input
                type="text"
                value={editingProvider.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                placeholder="例如: OpenAI, Azure OpenAI"
              />
            </div>

            <div className="form-group">
              <label>API 地址 (baseURL)</label>
              <input
                type="text"
                value={editingProvider.baseURL}
                onChange={e => handleFieldChange('baseURL', e.target.value)}
                placeholder="例如: https://api.openai.com/v1"
              />
            </div>

            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={editingProvider.apiKey || ''}
                onChange={e => handleFieldChange('apiKey', e.target.value)}
                placeholder="输入 API Key（可选）"
              />
            </div>

            <div className="form-group">
              <label>模型名称</label>
              <input
                type="text"
                value={editingProvider.model}
                onChange={e => handleFieldChange('model', e.target.value)}
                placeholder="例如: gpt-4o, gpt-3.5-turbo"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>超时时间 (毫秒)</label>
                <input
                  type="number"
                  value={editingProvider.timeout}
                  onChange={e => handleFieldChange('timeout', parseInt(e.target.value) || 30000)}
                  min={1000}
                  max={300000}
                />
              </div>

              <div className="form-group">
                <label>优先级 (数字越小优先级越高)</label>
                <input
                  type="number"
                  value={editingProvider.priority}
                  onChange={e => handleFieldChange('priority', parseInt(e.target.value) || 100)}
                  min={1}
                  max={999}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editingProvider.enabled}
                  onChange={e => handleFieldChange('enabled', e.target.checked)}
                />
                启用此 Provider
              </label>
            </div>

            <div className="form-actions">
              <button className="btn-primary" onClick={handleSaveEditing}>保存</button>
              <button className="btn-secondary" onClick={handleCancelEdit}>取消</button>
            </div>
          </div>
        )}
      </div>

      <div className="ai-config-footer">
        <div className="info-text">
          <h4>关于自动 Failover</h4>
          <p>系统会按照优先级顺序尝试可用的 AI Provider。当高优先级 Provider 请求失败时，会自动切换到下一个可用的 Provider。</p>
          <p>只有启用状态的 Provider 才会参与请求分发。</p>
        </div>
      </div>

      <style>{`
        .ai-config {
          padding: 20px;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .ai-config-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .ai-config-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .ai-config-content {
          flex: 1;
          display: flex;
          gap: 20px;
          overflow: hidden;
        }

        .provider-list {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }

        .provider-list-header {
          display: grid;
          grid-template-columns: 120px 1fr 120px 60px 60px 140px;
          gap: 10px;
          padding: 12px 16px;
          background: #f5f5f5;
          font-weight: 600;
          font-size: 13px;
          border-bottom: 1px solid #ddd;
        }

        .provider-list-empty {
          padding: 40px 20px;
          text-align: center;
          color: #999;
        }

        .provider-item {
          display: grid;
          grid-template-columns: 120px 1fr 120px 60px 60px 140px;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          align-items: center;
          font-size: 13px;
          position: relative;
        }

        .provider-item.is-disabled {
          opacity: 0.5;
        }

        .provider-item.is-default {
          background: #f0f7ff;
        }

        .col-name {
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .col-baseurl {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .col-model {
          color: #666;
        }

        .col-priority {
          text-align: center;
        }

        .col-status {
          display: flex;
          justify-content: center;
        }

        .col-actions {
          display: flex;
          gap: 8px;
        }

        .default-badge {
          background: #4a90d9;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        }

        .test-result {
          position: absolute;
          bottom: -20px;
          left: 16px;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          z-index: 1;
        }

        .test-result.success {
          background: #d4edda;
          color: #155724;
        }

        .test-result.error {
          background: #f8d7da;
          color: #721c24;
        }

        /* Switch toggle */
        .switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 20px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: #4a90d9;
        }

        input:checked + .slider:before {
          transform: translateX(16px);
        }

        /* Provider Editor */
        .provider-editor {
          width: 350px;
          flex-shrink: 0;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          background: #fafafa;
          overflow-y: auto;
        }

        .provider-editor h3 {
          margin: 0 0 20px 0;
          font-size: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .form-group input[type="text"],
        .form-group input[type="password"],
        .form-group input[type="number"] {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #4a90d9;
        }

        .form-row {
          display: flex;
          gap: 12px;
        }

        .form-row .form-group {
          flex: 1;
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
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

        .btn-text {
          padding: 4px 8px;
          background: none;
          color: #4a90d9;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-text:hover {
          background: #f0f7ff;
        }

        .btn-text:disabled {
          color: #ccc;
          cursor: not-allowed;
        }

        .btn-danger {
          color: #d9534f;
        }

        .btn-danger:hover {
          background: #fdf2f2;
        }

        /* Footer */
        .ai-config-footer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .info-text {
          font-size: 12px;
          color: #666;
        }

        .info-text h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #333;
        }

        .info-text p {
          margin: 0 0 6px 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default AIConfig;
