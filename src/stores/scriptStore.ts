import { create } from 'zustand';
import type { Script, ScriptCategory, TriggerType } from '../types';

interface ScriptState {
  scripts: Script[];
  pendingScripts: Script[];
  filters: {
    category?: ScriptCategory;
    tags: string[];
    searchQuery: string;
  };
}

interface ScriptActions {
  // CRUD
  addScript: (script: Script) => void;
  updateScript: (id: string, updates: Partial<Script>) => void;
  deleteScript: (id: string) => void;

  // Pending scripts
  approveScript: (id: string) => void;
  rejectScript: (id: string) => void;

  // Filters
  setCategoryFilter: (category?: ScriptCategory) => void;
  setTagFilter: (tags: string[]) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;

  // Data loading
  loadScripts: () => Promise<void>;

  // Getters
  getFilteredScripts: () => Script[];
  getScriptsByCategory: (category: ScriptCategory) => Script[];
  getScriptsByCategories: (categories: ScriptCategory[]) => Script[];
  getScriptById: (id: string) => Script | undefined;
}

type ScriptStore = ScriptState & ScriptActions;

const initialState: ScriptState = {
  scripts: [],
  pendingScripts: [],
  filters: {
    category: undefined,
    tags: [],
    searchQuery: '',
  },
};

export const scriptStore = create<ScriptStore>((set, get) => ({
  ...initialState,

  // CRUD
  addScript: (script) =>
    set((state) => ({ scripts: [...state.scripts, script] })),

  updateScript: (id, updates) =>
    set((state) => ({
      scripts: state.scripts.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    })),

  deleteScript: (id) =>
    set((state) => ({
      scripts: state.scripts.filter((s) => s.id !== id),
    })),

  // Pending scripts
  approveScript: (id) =>
    set((state) => {
      const pending = state.pendingScripts.find((s) => s.id === id);
      if (!pending) return state;
      return {
        pendingScripts: state.pendingScripts.filter((s) => s.id !== id),
        scripts: [...state.scripts, { ...pending, updatedAt: Date.now() }],
      };
    }),

  rejectScript: (id) =>
    set((state) => ({
      pendingScripts: state.pendingScripts.filter((s) => s.id !== id),
    })),

  // Filters
  setCategoryFilter: (category) =>
    set((state) => ({ filters: { ...state.filters, category } })),

  setTagFilter: (tags) =>
    set((state) => ({ filters: { ...state.filters, tags } })),

  setSearchQuery: (searchQuery) =>
    set((state) => ({ filters: { ...state.filters, searchQuery } })),

  clearFilters: () =>
    set((state) => ({ filters: { category: undefined, tags: [], searchQuery: '' } })),

  // Data loading
  loadScripts: async () => {
    const { getAllScripts } = await import('../services/scriptService');
    const scripts = await getAllScripts();
    set({ scripts });
  },

  // Getters
  getFilteredScripts: () => {
    const { scripts, filters } = get();
    return scripts.filter((script) => {
      if (filters.category && script.category !== filters.category) return false;
      if (filters.tags.length > 0 && !filters.tags.every((t) => script.tags.includes(t))) return false;
      if (
        filters.searchQuery &&
        !script.content.toLowerCase().includes(filters.searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  },

  getScriptsByCategory: (category) => {
    const { scripts } = get();
    return scripts.filter((s) => s.category === category);
  },

  getScriptsByCategories: (categories) => {
    const { scripts } = get();
    return scripts.filter((s) => categories.includes(s.category));
  },

  getScriptById: (id) => {
    const { scripts, pendingScripts } = get();
    return scripts.find((s) => s.id === id) || pendingScripts.find((s) => s.id === id);
  },
}));

export const useScriptStore = scriptStore;