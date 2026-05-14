/**
 * IPC Channel definitions for HotkeyManager
 * All IPC channel names used in the application
 */

export const IPC_CHANNELS = {
  // Hotkey event channel - main process sends hotkey events to renderer
  HOTKEY_EVENT: 'hotkey:event',

  // Renderer requests to register/unregister hotkeys
  HOTKEY_REGISTER: 'hotkey:register',
  HOTKEY_UNREGISTER: 'hotkey:unregister',
  HOTKEY_GET_ALL: 'hotkey:get-all',

  // Hotkey configuration
  HOTKEY_UPDATE_CONFIG: 'hotkey:update-config',
  HOTKEY_CHECK_CONFLICT: 'hotkey:check-conflict',
} as const;

export type HotkeyEventType =
  | 'switch_script'
  | 'preview_script'
  | 'toggle_pause'
  | 'show_help'
  | 'hide_help';

export interface HotkeyEvent {
  type: HotkeyEventType;
  slotId?: string;      // switch_script 时使用
  direction?: 'up' | 'down';  // preview_script 时使用
}

export interface HotkeyConfig {
  version: number;
  hotkeys: Record<string, string>;
}

export interface HotkeyConflictResult {
  hasConflict: boolean;
  conflictingKeys: string[];
}
