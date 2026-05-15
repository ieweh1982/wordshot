import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import HotkeyManager from './services/HotkeyManager'
import { registerHotkeyHandlers } from './ipc/handlers'
import { registerDatabaseHandlers } from './ipc/databaseHandlers'
import { initDatabase } from './services/DatabaseService'
import DanmuCaptureService from '../src/services/DanmuCaptureService'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // Initialize database first
  initDatabase();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Set background color to transparent
  mainWindow.setBackgroundColor('#00000000')

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Initialize HotkeyManager with window reference
  const hotkeyManager = HotkeyManager.getInstance()
  hotkeyManager.initialize(mainWindow)

  // Initialize DanmuCaptureService with window reference
  const danmuCaptureService = DanmuCaptureService.getInstance()
  danmuCaptureService.initialize(mainWindow)

  // Register IPC handlers
  console.log('[Main] About to register handlers...')
  registerHotkeyHandlers()
  registerDatabaseHandlers()
  console.log('[Main] All handlers registered')

  return mainWindow
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Cleanup HotkeyManager
  const hotkeyManager = HotkeyManager.getInstance()
  hotkeyManager.destroy()

  // Cleanup DanmuCaptureService
  const danmuCaptureService = DanmuCaptureService.getInstance()
  danmuCaptureService.destroy()

  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
