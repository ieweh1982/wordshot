/**
 * Script Service - Renderer side
 * Uses IPC to communicate with main process for database operations
 */

import { Script, ScriptCategory, TriggerType } from '../types';
import { generateNumericId } from './IdGenerator';

export const hasElectronAPI = () => typeof window !== 'undefined' && !!window.electronAPI;

export interface CreateScriptInput {
  id: string;
  category: ScriptCategory;
  content: string;
  color?: string;
  priority?: number;
  triggers?: TriggerType[];
  tags?: string[];
}

export interface UpdateScriptInput {
  category?: ScriptCategory;
  content?: string;
  color?: string;
  priority?: number;
  triggers?: TriggerType[];
  tags?: string[];
}

// In-memory cache for scripts in renderer
let scriptsCache: Script[] = [];
let pendingScripts: Script[] = [];

// LocalStorage keys
const SCRIPTS_STORAGE_KEY = 'wordshot_scripts';

// Load scripts from localStorage (browser fallback)
function loadFromStorage(): Script[] {
  try {
    const stored = localStorage.getItem(SCRIPTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save scripts to localStorage (browser fallback)
function saveToStorage(scripts: Script[]): void {
  try {
    localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Initialize cache
export async function initScripts(): Promise<void> {
  if (hasElectronAPI()) {
    scriptsCache = await window.electronAPI!.getAllScripts();
  } else {
    scriptsCache = loadFromStorage();
  }
}

// Get all scripts
export async function getAllScripts(): Promise<Script[]> {
  let loadedFromStorage = false;

  if (hasElectronAPI()) {
    try {
      const electronScripts = await window.electronAPI!.getAllScripts();
      if (electronScripts && electronScripts.length > 0) {
        scriptsCache = electronScripts;
      } else {
        // Electron returned empty, try localStorage
        loadedFromStorage = true;
      }
    } catch (e) {
      console.error('[scriptService] Failed to load from electron, falling back to storage:', e);
      loadedFromStorage = true;
    }
  } else {
    loadedFromStorage = true;
  }

  // Fallback to localStorage if needed
  if (loadedFromStorage || scriptsCache.length === 0) {
    const fromStorage = loadFromStorage();
    if (fromStorage.length > 0) {
      scriptsCache = fromStorage;
    }
  }

  // Deduplicate by ID - keep first occurrence
  const seenIds = new Set<string>();
  scriptsCache = scriptsCache.filter(script => {
    if (seenIds.has(script.id)) {
      console.warn('[scriptService] Duplicate script ID found, skipping:', script.id);
      return false;
    }
    seenIds.add(script.id);
    return true;
  });

  return scriptsCache;
}

// Get script by ID
export async function getScriptById(id: string): Promise<Script | undefined> {
  if (hasElectronAPI()) {
    return window.electronAPI!.getScriptById(id);
  }
  return scriptsCache.find(s => s.id === id);
}

// Create a new script
export async function createScript(input: CreateScriptInput): Promise<Script> {
  const now = Date.now();
  const script: Script = {
    id: input.id,
    category: input.category,
    content: input.content,
    color: input.color || '#ffffff',
    priority: input.priority || 5,
    triggers: input.triggers || [],
    tags: input.tags || [],
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (hasElectronAPI()) {
    const created = await window.electronAPI!.createScript(script);
    scriptsCache.push(created);
    return created;
  } else {
    scriptsCache.push(script);
    saveToStorage(scriptsCache);
    return script;
  }
}

// Update an existing script
export async function updateScript(id: string, updates: UpdateScriptInput): Promise<Script | undefined> {
  if (hasElectronAPI()) {
    const updated = await window.electronAPI!.updateScript(id, updates);
    if (updated) {
      const index = scriptsCache.findIndex(s => s.id === id);
      if (index !== -1) {
        scriptsCache[index] = updated;
      }
    }
    return updated;
  } else {
    const index = scriptsCache.findIndex(s => s.id === id);
    if (index !== -1) {
      scriptsCache[index] = { ...scriptsCache[index], ...updates, updatedAt: Date.now() };
      saveToStorage(scriptsCache);
      return scriptsCache[index];
    }
    return undefined;
  }
}

// Delete a script
export async function deleteScript(id: string): Promise<boolean> {
  if (hasElectronAPI()) {
    const result = await window.electronAPI!.deleteScript(id);
    if (result) {
      scriptsCache = scriptsCache.filter(s => s.id !== id);
    }
    return result;
  } else {
    scriptsCache = scriptsCache.filter(s => s.id !== id);
    saveToStorage(scriptsCache);
    return true;
  }
}

// Search scripts using full-text search
export async function searchScripts(query: string): Promise<Script[]> {
  if (hasElectronAPI()) {
    return window.electronAPI!.searchScripts(query);
  }
  const lowerQuery = query.toLowerCase();
  return scriptsCache.filter(s => s.content.toLowerCase().includes(lowerQuery));
}

// Get scripts by category
export function getScriptsByCategory(category: ScriptCategory): Script[] {
  return scriptsCache.filter(s => s.category === category);
}

// Get scripts by tag
export function getScriptsByTag(tag: string): Script[] {
  return scriptsCache.filter(s => s.tags.includes(tag));
}

// Record script usage
export async function useScript(scriptId: string, sessionId?: string): Promise<void> {
  const script = scriptsCache.find(s => s.id === scriptId);
  if (script) {
    script.usageCount++;
    script.lastUsedAt = Date.now();
  }
}

// Reorder scripts (placeholder)
export function reorderScripts(scriptIds: string[]): void {
  // Placeholder for reordering functionality
}

// Get most used scripts
export function getMostUsedScripts(limit: number = 10): Script[] {
  return [...scriptsCache]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

// Get recently used scripts
export function getRecentlyUsedScripts(limit: number = 10): Script[] {
  return scriptsCache
    .filter(s => s.lastUsedAt !== undefined)
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
    .slice(0, limit);
}

// Get pending scripts
export function getPendingScripts(): Script[] {
  return pendingScripts;
}

// Add to pending scripts
export function addPendingScript(script: Script): void {
  pendingScripts.push(script);
}

// Approve pending script (move to main scripts)
export async function approvePendingScript(id: string): Promise<Script | undefined> {
  const pending = pendingScripts.find(s => s.id === id);
  if (pending) {
    pendingScripts = pendingScripts.filter(s => s.id !== id);
    return await createScript({
      id: pending.id,
      category: pending.category,
      content: pending.content,
      color: pending.color,
      priority: pending.priority,
      triggers: pending.triggers,
      tags: pending.tags,
    });
  }
  return undefined;
}

// Reject pending script
export function rejectPendingScript(id: string): void {
  pendingScripts = pendingScripts.filter(s => s.id !== id);
}

// Bulk create scripts
export async function bulkCreateScripts(inputs: CreateScriptInput[]): Promise<Script[]> {
  const results: Script[] = [];
  for (const input of inputs) {
    const script = await createScript(input);
    results.push(script);
  }
  return results;
}

// Bulk delete scripts
export async function bulkDeleteScripts(ids: string[]): Promise<number> {
  let deletedCount = 0;
  for (const id of ids) {
    if (await deleteScript(id)) {
      deletedCount++;
    }
  }
  return deletedCount;
}

// Clear all scripts from database (for data cleanup)
export async function clearAllScripts(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  if (hasElectronAPI()) {
    const result = await window.electronAPI!.clearAllScripts();
    if (result.success) {
      scriptsCache = [];
    }
    return result;
  } else {
    // Browser fallback - clear from localStorage
    localStorage.removeItem(SCRIPTS_STORAGE_KEY);
    scriptsCache = [];
    return { success: true, deletedCount: 0 };
  }
}
