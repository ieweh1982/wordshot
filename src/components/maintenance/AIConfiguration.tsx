import React, { useState, useEffect, useCallback } from 'react';
import { AIProviderConfig } from '../../types';
import { getAIProviders, saveAIProviders } from '../../services/configStorage';
import './AIConfiguration.css';

// Default providers
const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai-compatible',
    name: 'OpenAI兼容',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4',
    enabled: true,
    priority: 1,
    timeout: 30000,
  },
  {
    id: 'claude',
    name: 'Claude',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
    model: 'claude-3-sonnet',
    enabled: false,
    priority: 2,
    timeout: 30000,
  },
];

interface Props {
  className?: string;
}

// Form state interface
interface ProviderFormData {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  timeout: number;
}

const DEFAULT_FORM_DATA: ProviderFormData = {
  name: '',
  baseURL: '',
  apiKey: '',
  model: '',
  enabled: true,
  timeout: 30000,
};

export const AIConfiguration: React.FC<Props> = ({ className }) => {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ProviderFormData>(DEFAULT_FORM_DATA);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ providerId: string; success: boolean; message: string } | null>(null);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = useCallback(() => {
    const config = getAIProviders();
    if (config.providers.length === 0) {
      // Initialize with default providers
      saveAIProviders({ providers: DEFAULT_PROVIDERS });
      setProviders(DEFAULT_PROVIDERS);
    } else {
      setProviders(config.providers);
    }
  }, []);

  const saveProviders = useCallback((newProviders: AIProviderConfig[]) => {
    setProviders(newProviders);
    saveAIProviders({ providers: newProviders });
  }, []);

  // Handle toggle enabled
  const handleToggleEnabled = useCallback((providerId: string) => {
    const newProviders = providers.map(p =>
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    );
    saveProviders(newProviders);
  }, [providers, saveProviders]);

  // Handle delete provider
  const handleDeleteProvider = useCallback((providerId: string) => {
    if (window.confirm('确定要删除该AI服务商吗？')) {
      const newProviders = providers.filter(p => p.id !== providerId);
      saveProviders(newProviders);
    }
  }, [providers, saveProviders]);

  // Open add dialog
  const handleAddProvider = useCallback(() => {
    setEditingProvider(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleEditProvider = useCallback((provider: AIProviderConfig) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      baseURL: provider.baseURL,
      apiKey: provider.apiKey || '',
      model: provider.model,
      enabled: provider.enabled,
      timeout: provider.timeout,
    });
    setIsDialogOpen(true);
  }, []);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingProvider(null);
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  // Handle form change
  const handleFormChange = useCallback((field: keyof ProviderFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Save provider
  const handleSaveProvider = useCallback(() => {
    if (!formData.name.trim() || !formData.baseURL.trim() || !formData.model.trim()) {
      window.alert('请填写必填项：名称、API地址、模型');
      return;
    }

    const newProviders = [...providers];
    const maxPriority = Math.max(...providers.map(p => p.priority), 0);

    if (editingProvider) {
      // Update existing
      const index = newProviders.findIndex(p => p.id === editingProvider.id);
      if (index >= 0) {
        newProviders[index] = {
          ...newProviders[index],
          name: formData.name.trim(),
          baseURL: formData.baseURL.trim(),
          apiKey: formData.apiKey.trim(),
          model: formData.model.trim(),
          enabled: formData.enabled,
          timeout: formData.timeout,
        };
      }
    } else {
      // Add new
      const newProvider: AIProviderConfig = {
        id: `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name.trim(),
        baseURL: formData.baseURL.trim(),
        apiKey: formData.apiKey.trim(),
        model: formData.model.trim(),
        enabled: formData.enabled,
        priority: maxPriority + 1,
        timeout: formData.timeout,
      };
      newProviders.push(newProvider);
    }

    saveProviders(newProviders);
    handleCloseDialog();
  }, [providers, editingProvider, formData, saveProviders, handleCloseDialog]);

  // Move provider up
  const handleMoveUp = useCallback((providerId: string) => {
    const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);
    const index = sortedProviders.findIndex(p => p.id === providerId);
    if (index > 0) {
      // Swap priorities with the previous provider
      const prevProvider = sortedProviders[index - 1];
      const currentProvider = sortedProviders[index];
      const newProviders = providers.map(p => {
        if (p.id === currentProvider.id) return { ...p, priority: prevProvider.priority };
        if (p.id === prevProvider.id) return { ...p, priority: currentProvider.priority };
        return p;
      });
      saveProviders(newProviders);
    }
  }, [providers, saveProviders]);

  // Move provider down
  const handleMoveDown = useCallback((providerId: string) => {
    const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);
    const index = sortedProviders.findIndex(p => p.id === providerId);
    if (index < sortedProviders.length - 1) {
      // Swap priorities with the next provider
      const nextProvider = sortedProviders[index + 1];
      const currentProvider = sortedProviders[index];
      const newProviders = providers.map(p => {
        if (p.id === currentProvider.id) return { ...p, priority: nextProvider.priority };
        if (p.id === nextProvider.id) return { ...p, priority: currentProvider.priority };
        return p;
      });
      saveProviders(newProviders);
    }
  }, [providers, saveProviders]);

  // Test connection
  const handleTestConnection = useCallback(async (provider: AIProviderConfig) => {
    setTestingProviderId(provider.id);
    setTestResult(null);

    try {
      // Check if we're in Electron (has electronAPI with testAIConnection)
      const api = window.electronAPI;
      console.log('[AIConfig] electronAPI:', api);
      console.log('[AIConfig] testAIConnection:', api?.testAIConnection);
      console.log('[AIConfig] typeof testAIConnection:', typeof api?.testAIConnection);
      if (api && typeof api.testAIConnection === 'function') {
        const result = await api.testAIConnection({
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          model: provider.model,
          timeout: provider.timeout,
        });
        setTestResult({ providerId: provider.id, success: result.success, message: result.message });
        setTestingProviderId(null);
        return;
      }

      // Browser fallback - direct fetch (will likely fail due to CORS)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

      // Use a simple models list request to test connection
      const response = await fetch(`${provider.baseURL}/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setTestResult({ providerId: provider.id, success: true, message: '连接成功' });
      } else if (response.status === 401 || response.status === 403) {
        // For API keys that require auth, models endpoint might fail but chat completions might work
        // Try a simple chat completion test
        const chatResponse = await fetch(`${provider.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (chatResponse.ok) {
          setTestResult({ providerId: provider.id, success: true, message: '连接成功' });
        } else {
          const errorText = await chatResponse.text();
          setTestResult({ providerId: provider.id, success: false, message: `连接失败: ${chatResponse.status} ${chatResponse.statusText}` });
        }
      } else {
        setTestResult({ providerId: provider.id, success: false, message: `连接失败: ${response.status} ${response.statusText}` });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('aborted')) {
        setTestResult({ providerId: provider.id, success: false, message: `连接超时 (${provider.timeout / 1000}s)` });
      } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('Network request failed')) {
        setTestResult({ providerId: provider.id, success: false, message: '连接失败: 浏览器无法直接访问外部API，请在Electron应用中测试' });
      } else {
        setTestResult({ providerId: provider.id, success: false, message: `连接失败: ${errorMsg}` });
      }
    } finally {
      setTestingProviderId(null);
    }
  }, []);

  // Get sorted providers
  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);

  // Get highest priority enabled provider
  const activeProvider = providers
    .filter(p => p.enabled)
    .sort((a, b) => a.priority - b.priority)[0];

  return (
    <div className={`ai-config ${className || ''}`}>
      <div className="ai-config__header">
        <div className="ai-config__header-left">
          <h2 className="ai-config__title">AI配置</h2>
          {activeProvider && (
            <div className="ai-config__active">
              <span className="ai-config__active-label">当前使用:</span>
              <span className="ai-config__active-name">{activeProvider.name}</span>
              <span className="ai-config__active-model">({activeProvider.model})</span>
            </div>
          )}
        </div>
        <button className="ai-config__btn ai-config__btn--primary" onClick={handleAddProvider}>
          + 添加服务商
        </button>
      </div>

      <div className="ai-config__list">
        {sortedProviders.map((provider, index) => {
          const isActive = provider.enabled;
          const isFirst = index === 0;
          const isLast = index === sortedProviders.length - 1;
          const isTesting = testingProviderId === provider.id;
          const result = testResult?.providerId === provider.id ? testResult : null;

          return (
            <div key={provider.id} className={`ai-config__item ${isActive ? 'is-active' : ''}`}>
              <div className="ai-config__item-header">
                <div className="ai-config__item-info">
                  <span className="ai-config__item-name">{provider.name}</span>
                  <span className="ai-config__item-model">{provider.model}</span>
                  <span className="ai-config__item-priority">优先级: {provider.priority}</span>
                </div>
                <div className="ai-config__item-toggle">
                  <label className="ai-config__toggle">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={() => handleToggleEnabled(provider.id)}
                    />
                    <span className="ai-config__toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="ai-config__item-details">
                <div className="ai-config__item-url">
                  <span className="ai-config__item-url-label">API地址:</span>
                  <span className="ai-config__item-url-value">{provider.baseURL}</span>
                </div>
                {provider.apiKey && (
                  <div className="ai-config__item-key">
                    <span className="ai-config__item-key-label">API密钥:</span>
                    <span className="ai-config__item-key-value">{'*'.repeat(8)}{provider.apiKey.slice(-4)}</span>
                  </div>
                )}
                <div className="ai-config__item-timeout">
                  <span className="ai-config__item-timeout-label">超时时间:</span>
                  <span className="ai-config__item-timeout-value">{provider.timeout / 1000}s</span>
                </div>
              </div>

              {result && (
                <div className={`ai-config__test-result ${result.success ? 'is-success' : 'is-error'}`}>
                  {result.message}
                </div>
              )}

              <div className="ai-config__item-actions">
                <button
                  className="ai-config__action-btn"
                  onClick={() => handleMoveUp(provider.id)}
                  disabled={isFirst}
                  title="上移"
                >
                  ↑
                </button>
                <button
                  className="ai-config__action-btn"
                  onClick={() => handleMoveDown(provider.id)}
                  disabled={isLast}
                  title="下移"
                >
                  ↓
                </button>
                <button
                  className="ai-config__action-btn ai-config__action-btn--test"
                  onClick={() => handleTestConnection(provider)}
                  disabled={isTesting}
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button
                  className="ai-config__action-btn ai-config__action-btn--edit"
                  onClick={() => handleEditProvider(provider)}
                >
                  编辑
                </button>
                <button
                  className="ai-config__action-btn ai-config__action-btn--delete"
                  onClick={() => handleDeleteProvider(provider.id)}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {providers.length === 0 && (
        <div className="ai-config__empty">
          <p>暂无AI服务商配置</p>
          <p>点击"添加服务商"按钮添加第一个AI服务商</p>
        </div>
      )}

      {/* Dialog */}
      {isDialogOpen && (
        <div className="ai-config__dialog-overlay" onClick={handleCloseDialog}>
          <div className="ai-config__dialog" onClick={e => e.stopPropagation()}>
            <div className="ai-config__dialog-header">
              <h3>{editingProvider ? '编辑服务商' : '添加服务商'}</h3>
              <button className="ai-config__dialog-close" onClick={handleCloseDialog}>×</button>
            </div>
            <div className="ai-config__dialog-body">
              <div className="ai-config__form-group">
                <label className="ai-config__label">
                  名称 <span className="ai-config__required">*</span>
                </label>
                <input
                  type="text"
                  className="ai-config__input"
                  value={formData.name}
                  onChange={e => handleFormChange('name', e.target.value)}
                  placeholder="例如: OpenAI兼容"
                />
              </div>

              <div className="ai-config__form-group">
                <label className="ai-config__label">
                  API地址 <span className="ai-config__required">*</span>
                </label>
                <input
                  type="text"
                  className="ai-config__input"
                  value={formData.baseURL}
                  onChange={e => handleFormChange('baseURL', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="ai-config__form-group">
                <label className="ai-config__label">API密钥</label>
                <input
                  type="password"
                  className="ai-config__input"
                  value={formData.apiKey}
                  onChange={e => handleFormChange('apiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </div>

              <div className="ai-config__form-group">
                <label className="ai-config__label">
                  模型 <span className="ai-config__required">*</span>
                </label>
                <input
                  type="text"
                  className="ai-config__input"
                  value={formData.model}
                  onChange={e => handleFormChange('model', e.target.value)}
                  placeholder="gpt-4"
                />
              </div>

              <div className="ai-config__form-group">
                <label className="ai-config__label">
                  超时时间 (ms)
                </label>
                <input
                  type="number"
                  className="ai-config__input ai-config__input--small"
                  value={formData.timeout}
                  onChange={e => handleFormChange('timeout', parseInt(e.target.value) || 30000)}
                  min={1000}
                  max={120000}
                  step={1000}
                />
              </div>

              <div className="ai-config__form-group">
                <label className="ai-config__checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => handleFormChange('enabled', e.target.checked)}
                  />
                  启用该服务商
                </label>
              </div>
            </div>
            <div className="ai-config__dialog-footer">
              <button className="ai-config__btn" onClick={handleCloseDialog}>取消</button>
              <button className="ai-config__btn ai-config__btn--primary" onClick={handleSaveProvider}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIConfiguration;