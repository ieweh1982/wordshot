/**
 * DanmuCaptureService - Window-based danmu capture service
 *
 * Captures danmu (live stream comments) from selected windows using:
 * 1. DOM injection for direct text reading (preferred)
 * 2. OCR fallback using Tesseract.js
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
    // Get available windows
    ipcMain.handle(DANMU_CHANNELS.GET_WINDOWS, async () => {
      return this.getAvailableWindows();
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

    console.log('[DanmuCapture] IPC handlers registered');
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
   * Select a window for capture
   */
  public async selectWindow(windowId: string): Promise<DanmuCaptureWindow | null> {
    const windows = await this.getAvailableWindows();
    const window = windows.find((w) => w.id === windowId);

    if (window) {
      this.selectedWindow = window;
      this.config.windowTitle = window.title;
      this.saveConfig();
      console.log(`[DanmuCapture] Window selected: ${window.title}`);
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
      this.sendError(`Capture failed: ${error}`);
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
      // Get window thumbnail using desktopCapturer
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
      const result = await recognizeText(thumbnail);
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
      this.sendError(`OCR capture failed: ${error}`);
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
