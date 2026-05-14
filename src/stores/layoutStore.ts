import { create } from 'zustand';
import type { Layout } from 'react-grid-layout';

export interface LayoutItem {
  i: string; // id: 'script', 'ammo', 'danmu'
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface LayoutState {
  layout: LayoutItem[];
  isLoaded: boolean;
}

interface LayoutActions {
  setLayout: (layout: LayoutItem[]) => void;
  saveLayout: (layout?: LayoutItem[]) => void;
  loadLayout: () => LayoutItem[];
  updateLayoutItem: (id: string, updates: Partial<LayoutItem>) => void;
  resetLayout: () => void;
}

type LayoutStore = LayoutState & LayoutActions;

const STORAGE_KEY = 'wordshot-layout';

// Default layout: script 70% left (7 cols), danmu 30% right (3 cols), ammo bottom
// react-grid-layout uses 12-column grid
const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'script', x: 0, y: 0, w: 7, h: 8, minW: 1, minH: 4 },
  { i: 'danmu', x: 7, y: 0, w: 3, h: 8, minW: 1, minH: 4 },
  { i: 'ammo', x: 0, y: 8, w: 10, h: 2, minW: 1, minH: 1 },
];

const initialState: LayoutState = {
  layout: DEFAULT_LAYOUT,
  isLoaded: false,
};

/**
 * Save layout to localStorage
 */
const saveToLocalStorage = (layout: LayoutItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to save layout to localStorage:', e);
  }
};

/**
 * Load layout from localStorage
 */
const loadFromLocalStorage = (): LayoutItem[] | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as LayoutItem[];
    }
  } catch (e) {
    console.error('Failed to load layout from localStorage:', e);
  }
  return null;
};

/**
 * Save layout to file via IPC to main process
 * This will trigger the main process to write layout.json
 */
const saveToFile = async (layout: LayoutItem[]): Promise<void> => {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const electronAPI = window.electronAPI;
      if (electronAPI?.saveLayout) {
        await electronAPI.saveLayout(layout);
        return;
      }
    }
    // Fallback: save to localStorage only if no IPC available
    saveToLocalStorage(layout);
  } catch (e) {
    console.error('Failed to save layout to file:', e);
    // Fallback to localStorage
    saveToLocalStorage(layout);
  }
};

/**
 * Load layout from file via IPC to main process
 */
const loadFromFile = async (): Promise<LayoutItem[] | null> => {
  try {
    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      const electronAPI = window.electronAPI;
      if (electronAPI?.loadLayout) {
        return await electronAPI.loadLayout();
      }
    }
  } catch (e) {
    console.error('Failed to load layout from file:', e);
  }
  return null;
};

export const layoutStore = create<LayoutStore>((set, get) => ({
  ...initialState,

  setLayout: (layout) => set({ layout }),

  saveLayout: async (layout?: LayoutItem[]) => {
    const layoutToSave = layout || get().layout;
    saveToLocalStorage(layoutToSave);
    await saveToFile(layoutToSave);
  },

  loadLayout: () => {
    // localStorage is the primary source - always try it first
    const localLayout = loadFromLocalStorage();
    if (localLayout) {
      set({ layout: localLayout, isLoaded: true });
      return localLayout;
    }

    // No localStorage - use default
    set({ layout: DEFAULT_LAYOUT, isLoaded: true });
    return DEFAULT_LAYOUT;
  },

  updateLayoutItem: (id, updates) =>
    set((state) => ({
      layout: state.layout.map((item) =>
        item.i === id ? { ...item, ...updates } : item
      ),
    })),

  resetLayout: () => {
    const layout = DEFAULT_LAYOUT;
    set({ layout });
    saveToLocalStorage(layout);
    saveToFile(layout);
  },
}));

export const useLayoutStore = layoutStore;
