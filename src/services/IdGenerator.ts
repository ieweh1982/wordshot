/**
 * ID Generator - Numeric auto-incrementing IDs
 * Uses localStorage to persist the last used ID
 */

const LAST_ID_KEY = 'wordshot_last_id';

// Get the last used ID from storage
function getLastId(): number {
  try {
    const stored = localStorage.getItem(LAST_ID_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

// Set the last used ID in storage
function setLastId(id: number): void {
  try {
    localStorage.setItem(LAST_ID_KEY, id.toString());
  } catch (e) {
    console.error('[IdGenerator] Failed to save last ID:', e);
  }
}

// Generate a unique numeric ID as string (for compatibility with Script.id type)
export function generateNumericId(): string {
  const lastId = getLastId();
  const newId = lastId + 1;
  setLastId(newId);
  return String(newId);
}

// Reset ID counter (for testing or data migration)
export function resetIdCounter(startFrom: number = 1): void {
  setLastId(startFrom - 1);
}

// Get current ID without incrementing
export function getCurrentId(): number {
  return getLastId();
}

// Get initial ID from Electron database if available
export async function syncIdFromDatabase(): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI) {
    try {
      const scripts = await window.electronAPI.getAllScripts();
      if (scripts.length > 0) {
        // Find max numeric ID
        let maxId = 0;
        for (const s of scripts) {
          const numId = parseInt(s.id, 10);
          if (!isNaN(numId) && numId > maxId) {
            maxId = numId;
          }
        }
        if (maxId > getLastId()) {
          setLastId(maxId);
          console.log('[IdGenerator] Synced from database, max ID:', maxId);
        }
      }
    } catch (e) {
      console.warn('[IdGenerator] Failed to sync from database:', e);
    }
  }
}