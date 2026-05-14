/**
 * HotkeyManager - Global hotkey management service
 *
 * Features:
 * - Register global shortcuts (work even when app is minimized or in background)
 * - Support custom hotkey bindings via config file
 * - Hotkey conflict detection
 * - IPC communication with renderer process
 */

import { globalShortcut, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS, HotkeyEvent, HotkeyEventType, HotkeyConfig, HotkeyConflictResult } from '../ipc/channels';

interface RegisteredHotkey {
  accelerator: string;
  callback: () => void;
}

export class HotkeyManager {
  private static instance: HotkeyManager | null = null;
  private registeredHotkeys: Map<string, RegisteredHotkey> = new Map();
  private config: HotkeyConfig | null = null;
  private configPath: string;
  private mainWindow: BrowserWindow | null = null;

  // Slot ID mapping for number keys 1-9
  private readonly SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  private constructor() {
    // Default config path
    this.configPath = path.join(
      process.env.APPDATA || process.env.HOME || '',
      'wordshot',
      'data',
      'config',
      'hotkeys.json'
    );
  }

  public static getInstance(): HotkeyManager {
    if (!HotkeyManager.instance) {
      HotkeyManager.instance = new HotkeyManager();
    }
    return HotkeyManager.instance;
  }

  /**
   * Initialize HotkeyManager with main window reference
   */
  public initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.loadConfig();
    this.registerAllHotkeys();
  }

  /**
   * Load hotkey configuration from file
   */
  public loadConfig(): void {
    try {
      // Try user config path first
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
      } else {
        // Fallback to default config
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      console.error('[HotkeyManager] Failed to load config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get default hotkey configuration
   */
  private getDefaultConfig(): HotkeyConfig {
    return {
      version: 1,
      hotkeys: {
        switch_script_1: '1',
        switch_script_2: '2',
        switch_script_3: '3',
        switch_script_4: '4',
        switch_script_5: '5',
        switch_script_6: '6',
        switch_script_7: '7',
        switch_script_8: '8',
        switch_script_9: '9',
        preview_up: 'Up',
        preview_down: 'Down',
        toggle_pause: 'Space',
        show_help: '?',
        hide_help: 'Escape',
      },
    };
  }

  /**
   * Save hotkey configuration to file
   */
  public saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('[HotkeyManager] Failed to save config:', error);
    }
  }

  /**
   * Register all hotkeys from configuration
   */
  public registerAllHotkeys(): void {
    if (!this.config) {
      this.loadConfig();
    }

    // Register number keys 1-9 for script switching
    for (let i = 1; i <= 9; i++) {
      const key = `switch_script_${i}`;
      const accelerator = this.config?.hotkeys[key] || String(i);
      this.registerHotkey(accelerator, () => this.handleSwitchScript(i));
    }

    // Register arrow keys for preview navigation
    const upKey = this.config?.hotkeys.preview_up || 'Up';
    const downKey = this.config?.hotkeys.preview_down || 'Down';
    this.registerHotkey(upKey, () => this.handlePreviewScript('up'));
    this.registerHotkey(downKey, () => this.handlePreviewScript('down'));

    // Register space for pause/resume
    const spaceKey = this.config?.hotkeys.toggle_pause || 'Space';
    this.registerHotkey(spaceKey, () => this.handleTogglePause());

    // Register ? for help
    const helpKey = this.config?.hotkeys.show_help || '?';
    this.registerHotkey(helpKey, () => this.handleShowHelp());

    // Register Escape to hide help
    const escKey = this.config?.hotkeys.hide_help || 'Escape';
    this.registerHotkey(escKey, () => this.handleHideHelp());

    console.log('[HotkeyManager] All hotkeys registered');
  }

  /**
   * Register a single hotkey
   */
  private registerHotkey(accelerator: string, callback: () => void): boolean {
    // Skip if already registered
    if (this.registeredHotkeys.has(accelerator)) {
      console.log(`[HotkeyManager] Hotkey ${accelerator} already registered, skipping`);
      return true;
    }

    try {
      const success = globalShortcut.register(accelerator, callback);
      if (success) {
        this.registeredHotkeys.set(accelerator, { accelerator, callback });
        console.log(`[HotkeyManager] Registered hotkey: ${accelerator}`);
      } else {
        console.warn(`[HotkeyManager] Failed to register hotkey: ${accelerator}`);
      }
      return success;
    } catch (error) {
      console.error(`[HotkeyManager] Error registering hotkey ${accelerator}:`, error);
      return false;
    }
  }

  /**
   * Unregister all hotkeys
   */
  public unregisterAllHotkeys(): void {
    for (const [accelerator] of this.registeredHotkeys) {
      this.unregisterHotkey(accelerator);
    }
    this.registeredHotkeys.clear();
    console.log('[HotkeyManager] All hotkeys unregistered');
  }

  /**
   * Unregister a single hotkey
   */
  public unregisterHotkey(accelerator: string): void {
    try {
      if (globalShortcut.isRegistered(accelerator)) {
        globalShortcut.unregister(accelerator);
      }
      this.registeredHotkeys.delete(accelerator);
    } catch (error) {
      console.error(`[HotkeyManager] Error unregistering hotkey ${accelerator}:`, error);
    }
  }

  /**
   * Send hotkey event to renderer process
   */
  private sendEvent(event: HotkeyEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.HOTKEY_EVENT, event);
    }
  }

  // Event handlers
  private handleSwitchScript(slotNumber: number): void {
    const slotId = `slot_${slotNumber}`;
    this.sendEvent({
      type: 'switch_script',
      slotId,
    });
  }

  private handlePreviewScript(direction: 'up' | 'down'): void {
    this.sendEvent({
      type: 'preview_script',
      direction,
    });
  }

  private handleTogglePause(): void {
    this.sendEvent({
      type: 'toggle_pause',
    });
  }

  private handleShowHelp(): void {
    this.sendEvent({
      type: 'show_help',
    });
  }

  private handleHideHelp(): void {
    this.sendEvent({
      type: 'hide_help',
    });
  }

  /**
   * Update hotkey configuration
   */
  public updateHotkey(action: string, newAccelerator: string): boolean {
    if (!this.config) return false;

    // Check for conflicts
    const conflict = this.checkConflict(newAccelerator);
    if (conflict.hasConflict) {
      console.warn(`[HotkeyManager] Hotkey ${newAccelerator} conflicts with: ${conflict.conflictingKeys.join(', ')}`);
      return false;
    }

    // Unregister old hotkey
    const oldAccelerator = this.config.hotkeys[action];
    if (oldAccelerator) {
      this.unregisterHotkey(oldAccelerator);
    }

    // Update config
    this.config.hotkeys[action] = newAccelerator;

    // Register new hotkey based on action type
    let callback: () => void;
    if (action.startsWith('switch_script_')) {
      const slotNum = parseInt(action.replace('switch_script_', ''), 10);
      callback = () => this.handleSwitchScript(slotNum);
    } else if (action === 'preview_up') {
      callback = () => this.handlePreviewScript('up');
    } else if (action === 'preview_down') {
      callback = () => this.handlePreviewScript('down');
    } else if (action === 'toggle_pause') {
      callback = () => this.handleTogglePause();
    } else if (action === 'show_help') {
      callback = () => this.handleShowHelp();
    } else if (action === 'hide_help') {
      callback = () => this.handleHideHelp();
    } else {
      console.warn(`[HotkeyManager] Unknown action: ${action}`);
      return false;
    }

    this.registerHotkey(newAccelerator, callback);
    this.saveConfig();
    return true;
  }

  /**
   * Check if a hotkey conflicts with existing registrations
   */
  public checkConflict(accelerator: string): HotkeyConflictResult {
    const conflictingKeys: string[] = [];

    // Check against system registered shortcuts
    if (globalShortcut.isRegistered(accelerator)) {
      conflictingKeys.push(accelerator);
    }

    // Check against our own registered hotkeys
    if (this.registeredHotkeys.has(accelerator)) {
      conflictingKeys.push(accelerator);
    }

    return {
      hasConflict: conflictingKeys.length > 0,
      conflictingKeys,
    };
  }

  /**
   * Get current hotkey configuration
   */
  public getConfig(): HotkeyConfig | null {
    return this.config;
  }

  /**
   * Get all registered hotkeys
   */
  public getRegisteredHotkeys(): Map<string, RegisteredHotkey> {
    return new Map(this.registeredHotkeys);
  }

  /**
   * Check if a specific accelerator is registered
   */
  public isRegistered(accelerator: string): boolean {
    return this.registeredHotkeys.has(accelerator);
  }

  /**
   * Cleanup on shutdown
   */
  public destroy(): void {
    this.unregisterAllHotkeys();
    HotkeyManager.instance = null;
  }
}

export default HotkeyManager;
