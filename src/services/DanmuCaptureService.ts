/**
 * DanmuCaptureService - Window-based danmu capture service
 *
 * Captures danmu (live stream comments) from selected windows using:
 * 1. Screen region capture + OCR
 * 2. Cloud OCR via AI providers with vision capabilities
 *
 * Features:
 * - Window selection by title matching
 * - Configurable capture interval (2s/5s)
 * - Time-window and content-similarity deduplication
 * - IPC transmission to renderer process
 */

import { ipcMain, BrowserWindow, desktopCapturer, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import {
  Danmu,
  DanmuType,
  DanmuCaptureConfig,
  DanmuCaptureWindow,
} from '../types';
import {
  initOCR,
  recognizeText,
  parseOCRDanmu,
  classifyDanmuType,
  isValidDanmuText,
} from './ocrService';
import WindowsWindowEnumerator from '../../electron/services/WindowsWindowEnumerator';

// IPC Channel names for danmu capture
export const DANMU_CHANNELS = {
  // Renderer -> Main: capture control
  CAPTURE_START: 'danmu:capture-start',
  CAPTURE_STOP: 'danmu:capture-stop',
  CAPTURE_PAUSE: 'danmu:capture-pause',
  CAPTURE_RESUME: 'danmu:capture-resume',

  // Renderer -> Main: window management
  GET_WINDOWS: 'danmu:get-windows',
  SELECT_WINDOW: 'danmu:select-window',
  UPDATE_CONFIG: 'danmu:update-config',
  GET_CONFIG: 'danmu:get-config',

  // Main -> Renderer: danmu events
  DANMU_NEW: 'danmu:new',
  DANMU_BATCH: 'danmu:batch',
  CAPTURE_ERROR: 'danmu:error',
  CAPTURE_STATUS: 'danmu:status',
} as const;

// Config file path
const CONFIG_DIR = path.join(process.cwd(), 'data', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'danmu_capture.json');

// AI Config file path (stored as file, not localStorage)
const AI_PROVIDERS_FILE = path.join(CONFIG_DIR, 'ai_providers.json');

// Ensure config directory exists
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Default configuration
const DEFAULT_CONFIG: DanmuCaptureConfig = {
  enabled: false,
  windowTitle: '',
  captureIntervalMs: 2000,
  useOCR: false,
  ocrEngine: 'tesseract',
};

// Deduplication state
interface DeduplicationState {
  seenDanmu: Map<string, { timestamp: number; content: string }>;
  recentContents: string[];
}

class DanmuCaptureService {
  private static instance: DanmuCaptureService | null = null;

  private config: DanmuCaptureConfig;
  private selectedWindow: DanmuCaptureWindow | null = null;
  private captureTimer: NodeJS.Timeout | null = null;
  private isCapturing: boolean = false;
  private isPaused: boolean = false;
  private ocrInitialized: boolean = false;

  // Deduplication: time window in ms (default 30 minutes)
  private dedupTimeWindowMs: number = 30 * 60 * 1000;
  // Deduplication: content similarity threshold (0-1)
  private dedupSimilarityThreshold: number = 0.85;

  private dedupState: DeduplicationState = {
    seenDanmu: new Map(),
    recentContents: [],
  };

  private mainWindow: BrowserWindow | null = null;

  private constructor() {
    this.config = this.loadConfig();
    ensureConfigDir();
  }

  public static getInstance(): DanmuCaptureService {
    if (!DanmuCaptureService.instance) {
      DanmuCaptureService.instance = new DanmuCaptureService();
    }
    return DanmuCaptureService.instance;
  }

  /**
   * Initialize the service with the main window reference
   */
  public initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.registerIpcHandlers();
    console.log('[DanmuCapture] Service initialized');
  }

  /**
   * Register IPC handlers for communication with renderer
   */
  private registerIpcHandlers(): void {
    // Get available windows (desktopCapturer)
    ipcMain.handle(DANMU_CHANNELS.GET_WINDOWS, async () => {
      return this.getAvailableWindows();
    });

    // Get all windows including child windows (Windows API)
    ipcMain.handle('danmu:get-all-windows', async () => {
      return this.getAllWindowsIncludingChildren();
    });

    // Find windows by process name
    ipcMain.handle('danmu:find-windows-by-process', async (_event, processName: string) => {
      return this.findWindowsByProcess(processName);
    });

    // Find windows by title
    ipcMain.handle('danmu:find-windows-by-title', async (_event, titlePattern: string) => {
      return this.findWindowsByTitle(titlePattern);
    });

    // Find 互动消息区 window
    ipcMain.handle('danmu:find-hudong-window', async () => {
      return this.findHudongWindow();
    });

    // Select a window for capture
    ipcMain.handle(DANMU_CHANNELS.SELECT_WINDOW, async (_event, windowId: string) => {
      return this.selectWindow(windowId);
    });

    // Update configuration
    ipcMain.handle(DANMU_CHANNELS.UPDATE_CONFIG, async (_event, config: Partial<DanmuCaptureConfig>) => {
      return this.updateConfig(config);
    });

    // Get current configuration
    ipcMain.handle(DANMU_CHANNELS.GET_CONFIG, async () => {
      return this.config;
    });

    // Start capture
    ipcMain.handle(DANMU_CHANNELS.CAPTURE_START, async () => {
      return this.startCapture();
    });

    // Stop capture
    ipcMain.handle(DANMU_CHANNELS.CAPTURE_STOP, async () => {
      return this.stopCapture();
    });

    // Pause capture
    ipcMain.handle(DANMU_CHANNELS.CAPTURE_PAUSE, async () => {
      return this.pauseCapture();
    });

    // Resume capture
    ipcMain.handle(DANMU_CHANNELS.CAPTURE_RESUME, async () => {
      return this.resumeCapture();
    });

    // Get capture status
    ipcMain.handle('danmu:get-capture-status', async () => {
      return {
        isCapturing: this.isCapturing,
        isPaused: this.isPaused,
        status: this.isCapturing ? (this.isPaused ? 'paused' : 'capturing') : 'stopped'
      };
    });

    // Capture screen region
    ipcMain.handle('danmu:capture-region', async (_event, region: { x: number; y: number; width: number; height: number }) => {
      return this.captureRegion(region);
    });

    // Set capture region
    ipcMain.handle('danmu:set-capture-region', async (_event, region: { x: number; y: number; width: number; height: number }) => {
      this.setCaptureRegion(region);
      return true;
    });

    // Get capture region
    ipcMain.handle('danmu:get-capture-region', async () => {
      return this.getCaptureRegion();
    });

    // Get AI provider for OCR - reads from localStorage via renderer
    ipcMain.handle('danmu:get-ocr-provider', async () => {
      try {
        // Query localStorage in renderer via executeJavaScript
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            (function() {
              const item = localStorage.getItem('wordshot_config_ai_providers.json');
              if (item) {
                try {
                  const config = JSON.parse(item);
                  const enabled = config.providers && config.providers.find(function(p) { return p.enabled; });
                  if (enabled) {
                    return {
                      baseURL: enabled.baseURL,
                      apiKey: enabled.apiKey || undefined,
                      model: enabled.model,
                      timeout: enabled.timeout || 120000
                    };
                  }
                } catch (e) {}
              }
              return null;
            })()
          `);
          if (result) {
            console.log('[DanmuCapture] AI provider from localStorage:', result.baseURL);
            return result;
          }
        }
      } catch (error) {
        console.error('[DanmuCapture] Error getting OCR provider via IPC:', error);
      }
      return null;
    });

    console.log('[DanmuCapture] IPC handlers registered');
  }

  /**
   * Get enabled AI provider from config file
   * First checks localStorage (where UI saves AI config), then falls back to file system
   */
  private getOcrProvider(): { baseURL: string; apiKey?: string; model: string; timeout: number } | null {
    try {
      // First try localStorage (where UI saves AI config)
      // Note: executeJavaScript is async, but we need a sync result here
      // The renderer needs to have saved the config to localStorage first

      // Fall back to file system
      if (fs.existsSync(AI_PROVIDERS_FILE)) {
        const content = fs.readFileSync(AI_PROVIDERS_FILE, 'utf-8');
        const config = JSON.parse(content);
        const enabledProvider = config.providers?.find((p: any) => p.enabled);
        if (enabledProvider) {
          console.log('[DanmuCapture] AI provider from file system:', enabledProvider.baseURL);
          return {
            baseURL: enabledProvider.baseURL,
            apiKey: enabledProvider.apiKey || undefined,
            model: enabledProvider.model,
            timeout: enabledProvider.timeout || 120000,
          };
        }
      }
    } catch (error) {
      console.error('[DanmuCapture] Error reading AI providers:', error);
    }
    return null;
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): DanmuCaptureConfig {
    ensureConfigDir();
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const data = JSON.parse(content);
        return { ...DEFAULT_CONFIG, ...data.config };
      }
    } catch (error) {
      console.error('[DanmuCapture] Error loading config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    ensureConfigDir();
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ config: this.config }, null, 2), 'utf-8');
      console.log('[DanmuCapture] Config saved');
    } catch (error) {
      console.error('[DanmuCapture] Error saving config:', error);
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<DanmuCaptureConfig>): DanmuCaptureConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();

    // If interval changed while capturing, restart
    if (this.isCapturing && updates.captureIntervalMs) {
      this.stopCapture();
      this.startCapture();
    }

    return this.config;
  }

  /**
   * Get list of available windows using desktopCapturer
   */
  public async getAvailableWindows(): Promise<DanmuCaptureWindow[]> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 150, height: 150 },
      });

      const windows: DanmuCaptureWindow[] = sources.map((source) => ({
        id: source.id,
        title: source.name,
        processName: source.name,
        selected: this.selectedWindow?.id === source.id,
      }));

      return windows;
    } catch (error) {
      console.error('[DanmuCapture] Error getting windows:', error);
      return [];
    }
  }

  /**
   * Get all windows including child windows using Windows API
   */
  public async getAllWindowsIncludingChildren(): Promise<DanmuCaptureWindow[]> {
    try {
      const enumerator = WindowsWindowEnumerator.getInstance();
      const allWindows = await enumerator.getAllWindows();

      // Filter to only include windows with titles (visible windows)
      const visibleWindows = allWindows.filter((w) => w.title && w.title.length > 0);

      const windows: DanmuCaptureWindow[] = visibleWindows.map((w) => ({
        id: w.hwnd,
        title: w.title,
        processName: w.processName,
        position: w.rect,
        selected: this.selectedWindow?.id === w.hwnd,
        isChildWindow: w.level > 0,
        parentHwnd: w.parentHwnd,
      }));

      return windows;
    } catch (error) {
      console.error('[DanmuCapture] Error getting all windows:', error);
      return [];
    }
  }

  /**
   * Find windows by process name
   */
  public async findWindowsByProcess(processName: string): Promise<DanmuCaptureWindow[]> {
    try {
      const enumerator = WindowsWindowEnumerator.getInstance();
      const windows = await enumerator.findWindowsByProcess(processName);

      return windows.map((w) => ({
        id: w.hwnd,
        title: w.title,
        processName: w.processName,
        position: w.rect,
        selected: this.selectedWindow?.id === w.hwnd,
        isChildWindow: w.level > 0,
        parentHwnd: w.parentHwnd,
      }));
    } catch (error) {
      console.error('[DanmuCapture] Error finding windows by process:', error);
      return [];
    }
  }

  /**
   * Find windows by title
   */
  public async findWindowsByTitle(titlePattern: string): Promise<DanmuCaptureWindow[]> {
    try {
      const enumerator = WindowsWindowEnumerator.getInstance();
      const windows = await enumerator.findWindowsByTitle(titlePattern);

      return windows.map((w) => ({
        id: w.hwnd,
        title: w.title,
        processName: w.processName,
        position: w.rect,
        selected: this.selectedWindow?.id === w.hwnd,
        isChildWindow: w.level > 0,
        parentHwnd: w.parentHwnd,
      }));
    } catch (error) {
      console.error('[DanmuCapture] Error finding windows by title:', error);
      return [];
    }
  }

  /**
   * Find 互动消息区 window specifically
   */
  public async findHudongWindow(): Promise<DanmuCaptureWindow | null> {
    try {
      const enumerator = WindowsWindowEnumerator.getInstance();
      const window = await enumerator.findHudongWindow();

      if (!window) return null;

      return {
        id: window.hwnd,
        title: window.title,
        processName: window.processName,
        position: window.rect,
        selected: this.selectedWindow?.id === window.hwnd,
        isChildWindow: window.level > 0,
        parentHwnd: window.parentHwnd,
      };
    } catch (error) {
      console.error('[DanmuCapture] Error finding hudong window:', error);
      return null;
    }
  }

  /**
   * Capture a screen region using OCR
   */
  public async captureRegion(region: { x: number; y: number; width: number; height: number }): Promise<Danmu[]> {
    const totalStartTime = Date.now();
    try {
      console.log(`[DanmuCapture] Capture started at ${new Date().toLocaleTimeString()}`);
      const enumerator = WindowsWindowEnumerator.getInstance();
      const captureStart = Date.now();
      const screenshotBuffer = await enumerator.captureRegion(region);
      const captureElapsed = Date.now() - captureStart;
      console.log(`[DanmuCapture] Screenshot captured in ${captureElapsed}ms, size: ${screenshotBuffer?.length || 0}`);

      if (!screenshotBuffer) {
        console.log('[DanmuCapture] Failed to capture region');
        return [];
      }

      // Save screenshot to debug directory for verification
      const debugDir = path.join(os.homedir(), 'Documents', 'wordshot_debug');
      const timestamp = Date.now();
      const debugPath = path.join(debugDir, `capture_${timestamp}.png`);
      try {
        const fs = require('fs');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        fs.writeFileSync(debugPath, screenshotBuffer);
        console.log('[DanmuCapture] Screenshot saved to:', debugPath);
      } catch (e) {
        console.log('[DanmuCapture] Failed to save screenshot:', e);
      }

      // Prepare cloud provider if using cloud OCR
      let cloudProvider: { baseURL: string; apiKey?: string; model: string; timeout: number } | undefined;
      if (this.config.ocrEngine === 'cloud') {
        // Get provider via IPC (which queries localStorage in renderer)
        const ipcResult = await this.mainWindow?.webContents.executeJavaScript(`
          (function() {
            const item = localStorage.getItem('wordshot_config_ai_providers.json');
            if (item) {
              try {
                const config = JSON.parse(item);
                const enabled = config.providers && config.providers.find(function(p) { return p.enabled; });
                if (enabled) {
                  return {
                    baseURL: enabled.baseURL,
                    apiKey: enabled.apiKey || undefined,
                    model: enabled.model,
                    timeout: enabled.timeout || 120000
                  };
                }
              } catch (e) {}
            }
            return null;
          })()
        `);
        cloudProvider = ipcResult ?? undefined;
        if (cloudProvider) {
          console.log('[DanmuCapture] Using cloud OCR with provider:', cloudProvider.baseURL);
        } else {
          console.log('[DanmuCapture] Cloud OCR selected but no AI provider configured');
        }
      }

      // Try OCR on the captured screenshot
      let result;
      const ocrStartTime = Date.now();
      try {
        result = await recognizeText(screenshotBuffer, cloudProvider);
        const ocrElapsed = Date.now() - ocrStartTime;
        console.log(`[DanmuCapture] OCR completed in ${ocrElapsed}ms`);
        console.log(`[DanmuCapture] OCR result: ${JSON.stringify(result.text)}`);
      } catch (ocrError) {
        const ocrElapsed = Date.now() - ocrStartTime;
        console.log(`[DanmuCapture] OCR failed after ${ocrElapsed}ms:`, ocrError);
        return [];
      }

      // Parse danmu from OCR text
      const rawDanmu = parseOCRDanmu(result.text);

      const danmuList: Danmu[] = [];
      for (const raw of rawDanmu) {
        console.log(`[DanmuCapture] Raw danmu: username="${raw.username}" content="${raw.content}"`);
        if (!isValidDanmuText(raw.content)) {
          console.log(`[DanmuCapture] Filtered out by isValidDanmuText: "${raw.content}"`);
          continue;
        }

        const type = classifyDanmuType(raw.content, raw.username);
        const danmu = this.createDanmu(raw.username, raw.content, type);
        danmuList.push(danmu);
      }

      if (danmuList.length > 0) {
        const deduplicated = this.deduplicateDanmu(danmuList);
        const totalElapsed = Date.now() - totalStartTime;
        console.log(`[DanmuCapture] Total capture cycle completed in ${totalElapsed}ms, danmu count: ${deduplicated.length}`);
        return deduplicated;
      }

      console.log('[DanmuCapture] No valid danmu found');
      return [];
    } catch (error) {
      const totalElapsed = Date.now() - totalStartTime;
      console.error(`[DanmuCapture] Region capture error after ${totalElapsed}ms:`, error);
      return [];
    }
  }

  /**
   * Store the selected capture region
   */
  private captureRegionRect: { x: number; y: number; width: number; height: number } | null = null;

  /**
   * Set the capture region
   */
  public setCaptureRegion(region: { x: number; y: number; width: number; height: number }): void {
    this.captureRegionRect = region;
    console.log('[DanmuCapture] Capture region set:', region);
  }

  /**
   * Get the current capture region
   */
  public getCaptureRegion(): { x: number; y: number; width: number; height: number } | null {
    return this.captureRegionRect;
  }

  /**
   * Select a window for capture
   */
  public async selectWindow(windowId: string): Promise<DanmuCaptureWindow | null> {
    // Try desktopCapturer windows first
    let windows = await this.getAvailableWindows();
    let window = windows.find((w) => w.id === windowId);

    // If not found, try all windows from Windows API
    if (!window) {
      windows = await this.getAllWindowsIncludingChildren();
      window = windows.find((w) => w.id === windowId);
    }

    if (window) {
      this.selectedWindow = window;
      this.config.windowTitle = window.title;
      this.saveConfig();
      console.log(`[DanmuCapture] Window selected: ${window.title} (isChild: ${window.isChildWindow})`);
    }

    return window || null;
  }

  /**
   * Start danmu capture
   */
  public startCapture(): boolean {
    if (this.isCapturing) {
      console.log('[DanmuCapture] Already capturing');
      return true;
    }

    if (!this.selectedWindow && !this.config.windowTitle) {
      this.sendError('No window selected');
      return false;
    }

    // Initialize OCR if needed
    if (this.config.useOCR && !this.ocrInitialized) {
      this.initOcrService();
    }

    this.isCapturing = true;
    this.isPaused = false;

    // Start capture loop
    this.captureLoop();

    console.log(`[DanmuCapture] Capture started with interval ${this.config.captureIntervalMs}ms`);
    this.sendStatus('capturing');

    return true;
  }

  /**
   * Stop danmu capture
   */
  public stopCapture(): boolean {
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }

    this.isCapturing = false;
    this.isPaused = false;

    console.log('[DanmuCapture] Capture stopped');
    this.sendStatus('stopped');

    return true;
  }

  /**
   * Pause danmu capture
   */
  public pauseCapture(): boolean {
    if (!this.isCapturing) return false;

    this.isPaused = true;
    console.log('[DanmuCapture] Capture paused');
    this.sendStatus('paused');

    return true;
  }

  /**
   * Resume danmu capture
   */
  public resumeCapture(): boolean {
    if (!this.isCapturing) return false;

    this.isPaused = false;
    console.log('[DanmuCapture] Capture resumed');
    this.sendStatus('capturing');

    return true;
  }

  /**
   * Initialize OCR service
   */
  private async initOcrService(): Promise<void> {
    try {
      await initOCR();
      this.ocrInitialized = true;
      console.log('[DanmuCapture] OCR service initialized');
    } catch (error) {
      console.error('[DanmuCapture] Failed to initialize OCR:', error);
    }
  }

  /**
   * Main capture loop
   */
  private captureLoop(): void {
    if (!this.isCapturing) return;

    if (!this.isPaused) {
      this.performCapture();
    }

    this.captureTimer = setTimeout(() => {
      this.captureLoop();
    }, this.config.captureIntervalMs);
  }

  /**
   * Perform a single capture operation
   */
  private async performCapture(): Promise<void> {
    try {
      // Check if we have a capture region set
      if (this.captureRegionRect) {
        await this.captureRegion(this.captureRegionRect).then((danmuList) => {
          if (danmuList.length > 0) {
            this.sendDanmuBatch(danmuList);
          }
        });
        return;
      }

      if (this.config.useOCR) {
        // OCR-based capture
        await this.captureWithOCR();
      } else {
        // DOM injection capture (simulated - actual implementation would use
        // different approach based on the target window type)
        await this.captureWithDOM();
      }
    } catch (error) {
      console.error('[DanmuCapture] Capture error:', error);
      // Don't send error to UI - just log it and continue
    }
  }

  /**
   * Capture danmu using DOM injection
   * This is a placeholder - actual implementation would require:
   * 1. For Electron windows: use webContents.executeJavaScript
   * 2. For other apps: would need platform-specific solutions
   */
  private async captureWithDOM(): Promise<void> {
    // In a real implementation, this would:
    // 1. Get the target window's webContents (if it's an Electron window)
    // 2. Execute JavaScript to extract danmu elements from the DOM
    // 3. Parse and deduplicate the extracted danmu

    // For demonstration, we simulate some danmu
    // Real implementation would vary based on the streaming platform

    const simulatedDanmu = this.generateSimulatedDanmu();
    if (simulatedDanmu.length > 0) {
      const deduplicated = this.deduplicateDanmu(simulatedDanmu);
      if (deduplicated.length > 0) {
        this.sendDanmuBatch(deduplicated);
      }
    }
  }

  /**
   * Capture danmu using OCR on window screenshots
   */
  private async captureWithOCR(): Promise<void> {
    try {
      // Check if selected window is a child window from Windows API
      const isChildWindow = this.selectedWindow?.isChildWindow;
      const selectedHwnd = this.selectedWindow?.id;

      // Get cloud provider if using cloud OCR
      let cloudProvider: { baseURL: string; apiKey?: string; model: string; timeout: number } | undefined;
      if (this.config.ocrEngine === 'cloud') {
        // Get provider via IPC (which queries localStorage in renderer)
        const ipcResult = await this.mainWindow?.webContents.executeJavaScript(`
          (function() {
            const item = localStorage.getItem('wordshot_config_ai_providers.json');
            if (item) {
              try {
                const config = JSON.parse(item);
                const enabled = config.providers && config.providers.find(function(p) { return p.enabled; });
                if (enabled) {
                  return {
                    baseURL: enabled.baseURL,
                    apiKey: enabled.apiKey || undefined,
                    model: enabled.model,
                    timeout: enabled.timeout || 120000
                  };
                }
              } catch (e) {}
            }
            return null;
          })()
        `);
        cloudProvider = ipcResult ?? undefined;
      }

      if (isChildWindow && selectedHwnd) {
        // Use Windows API to capture child window directly
        await this.captureChildWindowWithOCR(selectedHwnd, cloudProvider);
        return;
      }

      // Fallback to desktopCapturer for top-level windows
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      // Find the selected window by title
      const targetSource = sources.find(
        (source) => source.name === this.selectedWindow?.title ||
                  source.name.includes(this.config.windowTitle)
      );

      if (!targetSource) {
        console.log('[DanmuCapture] Target window not found for OCR');
        return;
      }

      // Get thumbnail as base64
      const thumbnail = targetSource.thumbnail.toPNG();

      // Perform OCR
      const result = await recognizeText(thumbnail, cloudProvider);
      console.log(`[DanmuCapture] OCR result: ${result.text.slice(0, 100)}...`);

      // Parse danmu from OCR text
      const rawDanmu = parseOCRDanmu(result.text);

      const danmuList: Danmu[] = [];
      for (const raw of rawDanmu) {
        if (!isValidDanmuText(raw.content)) continue;

        const type = classifyDanmuType(raw.content, raw.username);
        const danmu = this.createDanmu(raw.username, raw.content, type);
        danmuList.push(danmu);
      }

      if (danmuList.length > 0) {
        const deduplicated = this.deduplicateDanmu(danmuList);
        if (deduplicated.length > 0) {
          this.sendDanmuBatch(deduplicated);
        }
      }
    } catch (error) {
      console.error('[DanmuCapture] OCR capture error:', error);
      // Don't send error to UI as this is expected if OCR fails
    }
  }

  /**
   * Capture a child window using Windows API and perform OCR
   */
  private async captureChildWindowWithOCR(hwnd: string, cloudProvider?: { baseURL: string; apiKey?: string; model: string; timeout: number }): Promise<void> {
    try {
      const enumerator = WindowsWindowEnumerator.getInstance();
      const screenshotBuffer = await enumerator.captureWindow(hwnd);

      if (!screenshotBuffer) {
        console.log('[DanmuCapture] Failed to capture child window');
        return;
      }

      // Perform OCR on the captured screenshot
      const result = await recognizeText(screenshotBuffer, cloudProvider);
      console.log(`[DanmuCapture] OCR result from child window: ${result.text.slice(0, 100)}...`);

      // Parse danmu from OCR text
      const rawDanmu = parseOCRDanmu(result.text);

      const danmuList: Danmu[] = [];
      for (const raw of rawDanmu) {
        if (!isValidDanmuText(raw.content)) continue;

        const type = classifyDanmuType(raw.content, raw.username);
        const danmu = this.createDanmu(raw.username, raw.content, type);
        danmuList.push(danmu);
      }

      if (danmuList.length > 0) {
        const deduplicated = this.deduplicateDanmu(danmuList);
        if (deduplicated.length > 0) {
          this.sendDanmuBatch(deduplicated);
        }
      }
    } catch (error) {
      console.error('[DanmuCapture] Child window OCR capture error:', error);
      // Don't send error to UI as this is expected if OCR fails
    }
  }

  /**
   * Generate simulated danmu for testing
   */
  private generateSimulatedDanmu(): Danmu[] {
    const sampleDanmu = [
      { username: '用户A', content: '主播真好看', type: 'praise' as DanmuType },
      { username: '用户B', content: '支持下', type: 'normal' as DanmuType },
      { username: '用户C', content: '关注了', type: 'follower' as DanmuType },
    ];

    // Randomly select 0-2 danmu
    const count = Math.floor(Math.random() * 3);
    const selected = sampleDanmu.slice(0, count);

    return selected.map((d) =>
      this.createDanmu(d.username, d.content, d.type)
    );
  }

  /**
   * Create a Danmu object
   */
  private createDanmu(username: string, content: string, type: DanmuType): Danmu {
    return {
      id: randomUUID(),
      userId: this.generateUserId(username),
      username,
      content,
      type,
      timestamp: Date.now(),
      importance: this.calculateImportance(type, content),
      sentiment: this.calculateSentiment(type, content),
      selectedForReply: false,
    };
  }

  /**
   * Generate a simple user ID from username
   */
  private generateUserId(username: string): string {
    // Simple hash function for username
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      const char = username.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Calculate importance based on danmu type and content
   */
  private calculateImportance(type: DanmuType, content: string): 'normal' | 'highlight' | 'danger' {
    if (type === 'big_gift' || type === 'vip') {
      return 'highlight';
    }
    if (type === 'hater' || type === 'provocative') {
      return 'danger';
    }
    return 'normal';
  }

  /**
   * Calculate sentiment score (-1 to 1)
   */
  private calculateSentiment(type: DanmuType, content: string): number {
    switch (type) {
      case 'praise':
      case 'gift':
      case 'big_gift':
      case 'follower':
        return 0.7;
      case 'hater':
      case 'provocative':
        return -0.7;
      case 'question':
        return 0.3;
      default:
        return 0;
    }
  }

  /**
   * Deduplicate danmu using time window and content similarity
   */
  private deduplicateDanmu(danmuList: Danmu[]): Danmu[] {
    const now = Date.now();
    const result: Danmu[] = [];

    for (const danmu of danmuList) {
      // Check time window deduplication
      const seenKey = `${danmu.userId}:${danmu.content}`;
      const seen = this.dedupState.seenDanmu.get(seenKey);

      if (seen) {
        // Check if within time window
        if (now - seen.timestamp < this.dedupTimeWindowMs) {
          continue; // Skip duplicate
        }
      }

      // Check content similarity deduplication
      const isSimilar = this.dedupState.recentContents.some((recent) =>
        this.calculateSimilarity(danmu.content, recent) > this.dedupSimilarityThreshold
      );

      if (isSimilar) {
        continue; // Skip similar content
      }

      // Add to deduplication state
      this.dedupState.seenDanmu.set(seenKey, { timestamp: now, content: danmu.content });
      this.dedupState.recentContents.push(danmu.content);

      // Keep recent contents limited (last 100)
      if (this.dedupState.recentContents.length > 100) {
        this.dedupState.recentContents.shift();
      }

      result.push(danmu);
    }

    // Cleanup old entries from seenDanmu
    const cutoff = now - this.dedupTimeWindowMs;
    for (const [key, value] of this.dedupState.seenDanmu.entries()) {
      if (value.timestamp < cutoff) {
        this.dedupState.seenDanmu.delete(key);
      }
    }

    return result;
  }

  /**
   * Calculate string similarity using simple algorithm
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Simple character-based similarity
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);

    let intersection = 0;
    for (const char of chars1) {
      if (chars2.has(char)) {
        intersection++;
      }
    }

    const union = chars1.size + chars2.size - intersection;
    return intersection / union;
  }

  /**
   * Send danmu batch to renderer via IPC
   */
  private sendDanmuBatch(danmuList: Danmu[]): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    this.mainWindow.webContents.send(DANMU_CHANNELS.DANMU_BATCH, danmuList);
  }

  /**
   * Send single danmu to renderer via IPC
   */
  private sendDanmu(danmu: Danmu): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    this.mainWindow.webContents.send(DANMU_CHANNELS.DANMU_NEW, danmu);
  }

  /**
   * Send error to renderer
   */
  private sendError(message: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    this.mainWindow.webContents.send(DANMU_CHANNELS.CAPTURE_ERROR, message);
  }

  /**
   * Send status update to renderer
   */
  private sendStatus(status: 'capturing' | 'paused' | 'stopped'): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    this.mainWindow.webContents.send(DANMU_CHANNELS.CAPTURE_STATUS, {
      status,
      config: this.config,
      selectedWindow: this.selectedWindow,
    });
  }

  /**
   * Get current capture status
   */
  public getStatus(): { isCapturing: boolean; isPaused: boolean; config: DanmuCaptureConfig } {
    return {
      isCapturing: this.isCapturing,
      isPaused: this.isPaused,
      config: this.config,
    };
  }

  /**
   * Cleanup and destroy the service
   */
  public destroy(): void {
    this.stopCapture();
    this.dedupState = {
      seenDanmu: new Map(),
      recentContents: [],
    };
    console.log('[DanmuCapture] Service destroyed');
  }
}

export default DanmuCaptureService;