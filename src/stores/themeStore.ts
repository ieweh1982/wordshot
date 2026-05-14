import { create } from 'zustand';
import type { Theme, ScriptCategory } from '../types';

interface ThemeState {
  themes: Theme[];
  activeThemeId: string | null;
}

interface ThemeActions {
  // CRUD
  addTheme: (theme: Theme) => void;
  updateTheme: (id: string, updates: Partial<Theme>) => void;
  deleteTheme: (id: string) => void;

  // Active theme
  setTheme: (themeId: string) => void;
  getActiveTheme: () => Theme | undefined;

  // Reset
  resetToDefault: () => void;
}

type ThemeStore = ThemeState & ThemeActions;

const DEFAULT_CARD_COLORS: Record<ScriptCategory, string> = {
  thanks: '#4CAF50',
  rebuttal: '#F44336',
  interaction: '#2196F3',
  ad: '#FF9800',
  praise: '#E91E63',
  opening: '#9C27B0',
  closing: '#673AB7',
  lottery: '#FFEB3B',
  crisis: '#795548',
};

const DEFAULT_THEMES: Theme[] = [
  {
    id: 'default-dark',
    name: 'Default Dark',
    background: '#0a0a0a',
    textColor: '#ffffff',
    accentColor: '#4a9eff',
    highlightColor: '#1a1a2e',
    cardColors: DEFAULT_CARD_COLORS,
    isDark: true,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    background: '#0d0d1a',
    textColor: '#ffffff',
    accentColor: '#ff00ff',
    highlightColor: '#00ffff',
    cardColors: DEFAULT_CARD_COLORS,
    isDark: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    background: '#1a1a1a',
    textColor: '#ffffff',
    accentColor: '#ffffff',
    highlightColor: '#888888',
    cardColors: DEFAULT_CARD_COLORS,
    isDark: true,
  },
];

const initialState: ThemeState = {
  themes: DEFAULT_THEMES,
  activeThemeId: 'default-dark',
};

export const themeStore = create<ThemeStore>((set, get) => ({
  ...initialState,

  // CRUD
  addTheme: (theme) =>
    set((state) => ({ themes: [...state.themes, theme] })),

  updateTheme: (id, updates) =>
    set((state) => ({
      themes: state.themes.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  deleteTheme: (id) =>
    set((state) => {
      if (state.themes.length <= 1) return state; // Keep at least one theme
      const newThemes = state.themes.filter((t) => t.id !== id);
      const newActiveId =
        state.activeThemeId === id ? newThemes[0]?.id ?? null : state.activeThemeId;
      return { themes: newThemes, activeThemeId: newActiveId };
    }),

  // Active theme
  setTheme: (themeId) => set({ activeThemeId: themeId }),

  getActiveTheme: () => {
    const { themes, activeThemeId } = get();
    return themes.find((t) => t.id === activeThemeId);
  },

  // Reset
  resetToDefault: () =>
    set({ themes: DEFAULT_THEMES, activeThemeId: 'default-dark' }),
}));

export const useThemeStore = themeStore;