"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 快捷键事件
  onTogglePause: (callback) => {
    electron.ipcRenderer.on("shortcut:toggle-pause", callback);
  },
  onPrev: (callback) => {
    electron.ipcRenderer.on("shortcut:prev", callback);
  },
  onNext: (callback) => {
    electron.ipcRenderer.on("shortcut:next", callback);
  },
  // 移除监听
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  },
  // 热键配置
  getHotkeyConfig: () => {
    return electron.ipcRenderer.invoke("hotkey:get-all");
  },
  updateHotkeyConfig: (action, newAccelerator) => {
    return electron.ipcRenderer.invoke("hotkey:update-config", action, newAccelerator);
  },
  checkHotkeyConflict: (accelerator) => {
    return electron.ipcRenderer.invoke("hotkey:check-conflict", accelerator);
  },
  // 数据库操作
  getAllScripts: () => electron.ipcRenderer.invoke("db:getAllScripts"),
  getScriptById: (id) => electron.ipcRenderer.invoke("db:getScriptById", id),
  createScript: (script) => electron.ipcRenderer.invoke("db:createScript", script),
  updateScript: (id, updates) => electron.ipcRenderer.invoke("db:updateScript", id, updates),
  deleteScript: (id) => electron.ipcRenderer.invoke("db:deleteScript", id),
  searchScripts: (query) => electron.ipcRenderer.invoke("db:searchScripts", query),
  // 模板操作
  getAllTemplates: () => electron.ipcRenderer.invoke("db:getAllTemplates"),
  getTemplateById: (id) => electron.ipcRenderer.invoke("db:getTemplateById", id),
  createTemplate: (template) => electron.ipcRenderer.invoke("db:createTemplate", template),
  updateTemplate: (id, updates) => electron.ipcRenderer.invoke("db:updateTemplate", id, updates),
  deleteTemplate: (id) => electron.ipcRenderer.invoke("db:deleteTemplate", id),
  // 片段操作
  getSegmentsByTemplate: (templateId) => electron.ipcRenderer.invoke("db:getSegmentsByTemplate", templateId),
  createSegment: (segment) => electron.ipcRenderer.invoke("db:createSegment", segment),
  updateSegment: (id, updates) => electron.ipcRenderer.invoke("db:updateSegment", id, updates),
  deleteSegment: (id) => electron.ipcRenderer.invoke("db:deleteSegment", id),
  // 弹幕抓取 - 窗口列表
  getDanmuWindows: () => electron.ipcRenderer.invoke("danmu:get-windows"),
  // 弹幕抓取 - 选择窗口
  selectDanmuWindow: (windowId) => electron.ipcRenderer.invoke("danmu:select-window", windowId),
  // 弹幕抓取 - 获取配置
  getDanmuConfig: () => electron.ipcRenderer.invoke("danmu:get-config"),
  // 弹幕抓取 - 更新配置
  updateDanmuConfig: (config) => electron.ipcRenderer.invoke("danmu:update-config", config),
  // 弹幕抓取 - 开始
  startDanmuCapture: () => electron.ipcRenderer.invoke("danmu:capture-start"),
  // 弹幕抓取 - 停止
  stopDanmuCapture: () => electron.ipcRenderer.invoke("danmu:capture-stop"),
  // 弹幕抓取 - 暂停
  pauseDanmuCapture: () => electron.ipcRenderer.invoke("danmu:capture-pause"),
  // 弹幕抓取 - 恢复
  resumeDanmuCapture: () => electron.ipcRenderer.invoke("danmu:capture-resume"),
  // 弹幕抓取 - 监听新弹幕
  onDanmuNew: (callback) => {
    electron.ipcRenderer.on("danmu:new", (_event, danmu) => callback(danmu));
  },
  // 弹幕抓取 - 监听弹幕批量
  onDanmuBatch: (callback) => {
    electron.ipcRenderer.on("danmu:batch", (_event, danmuList) => callback(danmuList));
  },
  // 弹幕抓取 - 监听错误
  onDanmuError: (callback) => {
    electron.ipcRenderer.on("danmu:error", (_event, error) => callback(error));
  },
  // 弹幕抓取 - 监听状态
  onDanmuStatus: (callback) => {
    electron.ipcRenderer.on("danmu:status", (_event, status) => callback(status));
  },
  // 布局管理
  saveLayout: (layout) => {
    return electron.ipcRenderer.invoke("layout:save", layout);
  },
  loadLayout: () => {
    return electron.ipcRenderer.invoke("layout:load");
  },
  // AI连接测试（主进程网络请求，避免CORS）
  testAIConnection: (provider) => {
    return electron.ipcRenderer.invoke("ai:testConnection", provider);
  },
  // Clear all scripts from database
  clearAllScripts: () => {
    return electron.ipcRenderer.invoke("db:clearAllScripts");
  },
  // AI Chat Completion（主进程网络请求，避免CORS）
  chatCompletion: (request) => {
    return electron.ipcRenderer.invoke("ai:chatCompletion", request);
  }
});
