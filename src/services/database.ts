/**
 * Database Service - Main Process Only
 * This file is kept for type compatibility but should not be imported in renderer code.
 * All database operations should go through IPC via window.electronAPI.
 */

// This file is intentionally left mostly empty.
// Database operations happen in the main process via IPC.
// See electron/services/DatabaseService.ts for actual implementation.

export interface Script {
  id: string;
  category: string;
  content: string;
  color: string;
  priority: number;
  triggers: string[];
  tags: string[];
  usageCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Dummy implementations - should not be called in renderer
export function initDatabase(): null {
  console.warn('[Database] Renderer should not call initDatabase directly');
  return null;
}

export function getDatabase(): null {
  console.warn('[Database] Renderer should not call getDatabase directly');
  return null;
}

export function getAllScripts(): Script[] {
  console.warn('[Database] Renderer should not call getAllScripts directly');
  return [];
}

export function getScriptById(): Script | undefined {
  console.warn('[Database] Renderer should not call getScriptById directly');
  return undefined;
}

export function createScript(): Script {
  console.warn('[Database] Renderer should not call createScript directly');
  return {} as Script;
}

export function updateScript(): Script | undefined {
  console.warn('[Database] Renderer should not call updateScript directly');
  return undefined;
}

export function deleteScript(): boolean {
  console.warn('[Database] Renderer should not call deleteScript directly');
  return false;
}

export function searchScripts(): Script[] {
  console.warn('[Database] Renderer should not call searchScripts directly');
  return [];
}
