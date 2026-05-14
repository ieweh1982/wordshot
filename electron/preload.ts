import { contextBridge, ipcRenderer } from 'electron'

// Hotkey configuration types
interface HotkeyConfig {
  version: number;
  hotkeys: Record<string, string>;
}

interface HotkeyConflictResult {
  hasConflict: boolean;
  conflictingKeys: string[];
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // 快捷键事件
  onTogglePause: (callback: () => void) => {
    ipcRenderer.on('shortcut:toggle-pause', callback)
  },
  onPrev: (callback: () => void) => {
    ipcRenderer.on('shortcut:prev', callback)
  },
  onNext: (callback: () => void) => {
    ipcRenderer.on('shortcut:next', callback)
  },

  // 移除监听
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // 热键配置
  getHotkeyConfig: (): Promise<HotkeyConfig | null> => {
    return ipcRenderer.invoke('hotkey:get-all')
  },
  updateHotkeyConfig: (action: string, newAccelerator: string): Promise<boolean> => {
    return ipcRenderer.invoke('hotkey:update-config', action, newAccelerator)
  },
  checkHotkeyConflict: (accelerator: string): Promise<HotkeyConflictResult> => {
    return ipcRenderer.invoke('hotkey:check-conflict', accelerator)
  },

  // 数据库操作
  getAllScripts: () => ipcRenderer.invoke('db:getAllScripts'),
  getScriptById: (id: string) => ipcRenderer.invoke('db:getScriptById', id),
  createScript: (script: any) => ipcRenderer.invoke('db:createScript', script),
  updateScript: (id: string, updates: any) => ipcRenderer.invoke('db:updateScript', id, updates),
  deleteScript: (id: string) => ipcRenderer.invoke('db:deleteScript', id),
  searchScripts: (query: string) => ipcRenderer.invoke('db:searchScripts', query),

  // 模板操作
  getAllTemplates: () => ipcRenderer.invoke('db:getAllTemplates'),
  getTemplateById: (id: string) => ipcRenderer.invoke('db:getTemplateById', id),
  createTemplate: (template: any) => ipcRenderer.invoke('db:createTemplate', template),
  updateTemplate: (id: string, updates: any) => ipcRenderer.invoke('db:updateTemplate', id, updates),
  deleteTemplate: (id: string) => ipcRenderer.invoke('db:deleteTemplate', id),

  // 片段操作
  getSegmentsByTemplate: (templateId: string) => ipcRenderer.invoke('db:getSegmentsByTemplate', templateId),
  createSegment: (segment: any) => ipcRenderer.invoke('db:createSegment', segment),
  updateSegment: (id: string, updates: any) => ipcRenderer.invoke('db:updateSegment', id, updates),
  deleteSegment: (id: string) => ipcRenderer.invoke('db:deleteSegment', id),

  // 弹幕抓取 - 窗口列表
  getDanmuWindows: () => ipcRenderer.invoke('danmu:get-windows'),

  // 弹幕抓取 - 选择窗口
  selectDanmuWindow: (windowId: string) => ipcRenderer.invoke('danmu:select-window', windowId),

  // 弹幕抓取 - 获取配置
  getDanmuConfig: () => ipcRenderer.invoke('danmu:get-config'),

  // 弹幕抓取 - 更新配置
  updateDanmuConfig: (config: any) => ipcRenderer.invoke('danmu:update-config', config),

  // 弹幕抓取 - 开始
  startDanmuCapture: () => ipcRenderer.invoke('danmu:capture-start'),

  // 弹幕抓取 - 停止
  stopDanmuCapture: () => ipcRenderer.invoke('danmu:capture-stop'),

  // 弹幕抓取 - 暂停
  pauseDanmuCapture: () => ipcRenderer.invoke('danmu:capture-pause'),

  // 弹幕抓取 - 恢复
  resumeDanmuCapture: () => ipcRenderer.invoke('danmu:capture-resume'),

  // 弹幕抓取 - 监听新弹幕
  onDanmuNew: (callback: (danmu: any) => void) => {
    ipcRenderer.on('danmu:new', (_event, danmu) => callback(danmu))
  },

  // 弹幕抓取 - 监听弹幕批量
  onDanmuBatch: (callback: (danmuList: any[]) => void) => {
    ipcRenderer.on('danmu:batch', (_event, danmuList) => callback(danmuList))
  },

  // 弹幕抓取 - 监听错误
  onDanmuError: (callback: (error: string) => void) => {
    ipcRenderer.on('danmu:error', (_event, error) => callback(error))
  },

  // 弹幕抓取 - 监听状态
  onDanmuStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('danmu:status', (_event, status) => callback(status))
  },

  // 布局管理
  saveLayout: (layout: LayoutItem[]) => {
    return ipcRenderer.invoke('layout:save', layout)
  },
  loadLayout: () => {
    return ipcRenderer.invoke('layout:load')
  },

  // AI连接测试（主进程网络请求，避免CORS）
  testAIConnection: (provider: { baseURL: string; apiKey?: string; model: string; timeout: number }) => {
    return ipcRenderer.invoke('ai:testConnection', provider)
  },

  // Clear all scripts from database
  clearAllScripts: () => {
    return ipcRenderer.invoke('db:clearAllScripts')
  },

  // AI Chat Completion（主进程网络请求，避免CORS）
  chatCompletion: (request: { provider: { baseURL: string; apiKey?: string; model: string; timeout: number }; messages: Array<{role: string; content: string}>; temperature?: number; max_tokens?: number }) => {
    return ipcRenderer.invoke('ai:chatCompletion', request)
  },
})
