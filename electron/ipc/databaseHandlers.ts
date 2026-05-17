/**
 * IPC Handlers for Database Operations
 * Routes database calls from renderer to main process
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as db from '../services/DatabaseService';

export function registerDatabaseHandlers(): void {
  console.log('[IPC] registerDatabaseHandlers called')
  // Scripts
  ipcMain.handle('db:getAllScripts', () => db.getAllScripts());
  ipcMain.handle('db:getScriptById', (_, id: string) => db.getScriptById(id));
  ipcMain.handle('db:createScript', (_, script) => db.createScript(script));
  ipcMain.handle('db:updateScript', (_, id: string, updates) => db.updateScript(id, updates));
  ipcMain.handle('db:deleteScript', (_, id: string) => db.deleteScript(id));
  ipcMain.handle('db:searchScripts', (_, query: string) => db.searchScripts(query));

  // Templates
  ipcMain.handle('db:getAllTemplates', () => db.getAllTemplates());
  ipcMain.handle('db:getTemplateById', (_, id: string) => db.getTemplateById(id));
  ipcMain.handle('db:createTemplate', (_, template) => db.createTemplate(template));
  ipcMain.handle('db:updateTemplate', (_, id: string, updates) => db.updateTemplate(id, updates));
  ipcMain.handle('db:deleteTemplate', (_, id: string) => {
    console.log('[IPC] db:deleteTemplate called with id:', id);
    return db.deleteTemplate(id);
  });

  // Segments
  ipcMain.handle('db:getSegmentsByTemplate', (_, templateId: string) => db.getSegmentsByTemplate(templateId));
  ipcMain.handle('db:createSegment', (_, segment) => db.createSegment(segment));
  ipcMain.handle('db:updateSegment', (_, id: string, updates) => db.updateSegment(id, updates));
  ipcMain.handle('db:deleteSegment', (_, id: string) => db.deleteSegment(id));

  // AI Provider Testing (main process has full network access)
  ipcMain.handle('ai:testConnection', async (_, provider: { baseURL: string; apiKey?: string; model: string; timeout: number }) => {
    console.log('[IPC] ai:testConnection called with provider:', provider.baseURL);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

    try {
      // Try models endpoint first
      const response = await fetch(`${provider.baseURL}/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: '连接成功' };
      }

      // If models fails with auth error, try chat completions
      if (response.status === 401 || response.status === 403) {
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
          return { success: true, message: '连接成功' };
        } else {
          const errorText = await chatResponse.text();
          return { success: false, message: `连接失败: ${chatResponse.status} ${chatResponse.statusText} - ${errorText.slice(0, 100)}` };
        }
      }

      return { success: false, message: `连接失败: ${response.status} ${response.statusText}` };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('aborted')) {
        return { success: false, message: `连接超时 (${provider.timeout / 1000}s)` };
      }
      return { success: false, message: `连接失败: ${errorMsg}` };
    }
  });

  // Clear all scripts (for data cleanup)
  ipcMain.handle('db:clearAllScripts', () => {
    console.log('[IPC] Clearing all scripts from database');
    return db.clearAllScripts();
  });

  console.log('[IPC] ai:testConnection handler registered');

  // AI Chat Completion (main process network to avoid CORS)
  ipcMain.handle('ai:chatCompletion', async (_, request: { provider: { baseURL: string; apiKey?: string; model: string; timeout: number }; messages: Array<{role: string; content: string}>; temperature?: number; max_tokens?: number }) => {
    console.log('[IPC] ai:chatCompletion called');
    console.log('[IPC] Provider:', JSON.stringify({...request.provider, apiKey: request.provider.apiKey ? '***' + request.provider.apiKey.slice(-4) : undefined}));
    const { provider, messages, temperature = 0.7, max_tokens = 128000 } = request;

    const effectiveTimeout = Math.max(provider.timeout, 600000); // 10 minutes

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const url = `${provider.baseURL}/chat/completions`;
      console.log('[IPC] Fetching from:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature,
          max_tokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('[IPC] Response error:', response.status, errorText.slice(0, 300));
        return { success: false, error: `HTTP ${response.status}: ${response.statusText} - ${errorText.slice(0, 200)}` };
      }

      const data = await response.json() as any;
      console.log('[IPC] Chat response data:', JSON.stringify(data).slice(0, 500));

      if (data.choices && data.choices[0]) {
        return { success: true, content: data.choices[0].message?.content || '', usage: data.usage };
      }

      if (data.text || data.result) {
        return { success: true, content: data.text || data.result, usage: data.usage };
      }

      if (typeof data === 'string') {
        return { success: true, content: data, usage: undefined };
      }

      return { success: false, error: 'Invalid response format from AI provider' };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('[IPC] Chat completion error:', errorMsg, errorStack);
      if (errorMsg.includes('aborted')) {
        return { success: false, error: `连接超时 (${effectiveTimeout / 1000}s)` };
      }
      return { success: false, error: `连接失败: ${errorMsg}` };
    }
  });

  // Get AI providers (reads from file in main process to avoid localStorage issues)
  ipcMain.handle('ai:getProviders', async () => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const configPath = path.join(process.cwd(), 'data', 'config', 'ai_providers.json');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[IPC] Error reading AI providers:', error);
    }
    return { providers: [] };
  });

  // Get enabled AI provider for OCR (returns first enabled provider)
  ipcMain.handle('ai:getOcrProvider', async () => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const configPath = path.join(process.cwd(), 'data', 'config', 'ai_providers.json');
      console.log('[IPC] Looking for AI config at:', configPath);

      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        console.log('[IPC] AI config from file:', JSON.stringify(config).slice(0, 200));
        const enabledProvider = config.providers?.find((p: any) => p.enabled);
        if (enabledProvider) {
          return {
            baseURL: enabledProvider.baseURL,
            apiKey: enabledProvider.apiKey || undefined,
            model: enabledProvider.model,
            timeout: enabledProvider.timeout || 120000,
          };
        }
      } else {
        console.log('[IPC] AI config file not found, trying localStorage via renderer...');
        // Try to get from localStorage via renderer
        const webContents = BrowserWindow.getAllWindows()[0]?.webContents;
        if (webContents) {
          const result = await webContents.executeJavaScript(`
            new Promise((resolve) => {
              const item = localStorage.getItem('wordshot_config_ai_providers.json');
              if (item) {
                try {
                  const config = JSON.parse(item);
                  const enabled = config.providers?.find(p => p.enabled);
                  if (enabled) {
                    resolve({
                      baseURL: enabled.baseURL,
                      apiKey: enabled.apiKey || undefined,
                      model: enabled.model,
                      timeout: enabled.timeout || 120000,
                    });
                  } else {
                    resolve(null);
                  }
                } catch (e) {
                  console.error('Parse error:', e);
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            })
          `);
          if (result) {
            console.log('[IPC] AI config from localStorage:', JSON.stringify(result).slice(0, 200));
            return result;
          }
        }
      }
    } catch (error) {
      console.error('[IPC] Error getting OCR provider:', error);
    }
    return null;
  });

  console.log('[IPC] Database handlers registered');
}

export function unregisterDatabaseHandlers(): void {
  // Scripts
  ipcMain.removeHandler('db:getAllScripts');
  ipcMain.removeHandler('db:getScriptById');
  ipcMain.removeHandler('db:createScript');
  ipcMain.removeHandler('db:updateScript');
  ipcMain.removeHandler('db:deleteScript');
  ipcMain.removeHandler('db:searchScripts');

  // Templates
  ipcMain.removeHandler('db:getAllTemplates');
  ipcMain.removeHandler('db:getTemplateById');
  ipcMain.removeHandler('db:createTemplate');
  ipcMain.removeHandler('db:updateTemplate');
  ipcMain.removeHandler('db:deleteTemplate');

  // Segments
  ipcMain.removeHandler('db:getSegmentsByTemplate');
  ipcMain.removeHandler('db:createSegment');
  ipcMain.removeHandler('db:updateSegment');
  ipcMain.removeHandler('db:deleteSegment');
}
