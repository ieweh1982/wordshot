/**
 * IPC Handlers for HotkeyManager
 * Handles IPC messages from renderer process related to hotkeys
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS, HotkeyConfig } from './channels';
import HotkeyManager from '../services/HotkeyManager';

export function registerHotkeyHandlers(): void {
  const hotkeyManager = HotkeyManager.getInstance();

  // Get all hotkey configurations
  ipcMain.handle(IPC_CHANNELS.HOTKEY_GET_ALL, (): HotkeyConfig | null => {
    return hotkeyManager.getConfig();
  });

  // Update a specific hotkey binding
  ipcMain.handle(
    IPC_CHANNELS.HOTKEY_UPDATE_CONFIG,
    (_event, action: string, newAccelerator: string): boolean => {
      return hotkeyManager.updateHotkey(action, newAccelerator);
    }
  );

  // Check for hotkey conflicts
  ipcMain.handle(
    IPC_CHANNELS.HOTKEY_CHECK_CONFLICT,
    (_event, accelerator: string) => {
      return hotkeyManager.checkConflict(accelerator);
    }
  );

  // Layout handlers
  ipcMain.handle('layout:save', async (_event, layout) => {
    const fs = await import('fs');
    const path = await import('path');
    const configDir = path.join(process.cwd(), 'data', 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(path.join(configDir, 'layout.json'), JSON.stringify(layout, null, 2));
    return true;
  });

  ipcMain.handle('layout:load', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'data', 'config', 'layout.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    return null;
  });

  console.log('[IPC] Hotkey handlers registered');
}

export function unregisterHotkeyHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.HOTKEY_GET_ALL);
  ipcMain.removeHandler(IPC_CHANNELS.HOTKEY_UPDATE_CONFIG);
  ipcMain.removeHandler(IPC_CHANNELS.HOTKEY_CHECK_CONFLICT);
}
