import { create } from 'zustand';
import type { Script, AmmoSlotConfig, ScriptCategory } from '../types';

interface AmmoState {
  slots: AmmoSlotConfig[];
  cardWidths: Record<string, number>;
  currentScripts: Record<string, Script>;
  previewIndex: Record<string, number>;
  playingSlotId: string | null; // Which slot is currently playing (synced with ScriptView)
}

interface AmmoActions {
  // Slot management
  setSlots: (slots: AmmoSlotConfig[]) => void;
  updateSlot: (slotId: string, updates: Partial<AmmoSlotConfig>) => void;
  setCardWidth: (slotId: string, width: number) => void;

  // Script operations
  setCurrentScript: (slotId: string, script: Script) => void;
  switchScript: (slotId: string, scripts: Script[]) => Script | null;
  previewScript: (
    slotId: string,
    direction: 'prev' | 'next',
    scripts: Script[]
  ) => Script | null;

  // Auto rotate
  startAutoRotate: (slotId: string) => void;
  stopAutoRotate: (slotId: string) => void;

  // Playing state sync with ScriptView
  setPlayingSlotId: (slotId: string | null) => void;

  // Getters
  getCurrentScript: (slotId: string) => Script | undefined;
  getPreviewScript: (slotId: string) => Script | undefined;
  getScriptsForSlot: (slotId: string, allScripts: Script[]) => Script[];
}

type AmmoStore = AmmoState & AmmoActions;

const STORAGE_KEY = 'wordshot_slot_config';
const CARD_WIDTHS_KEY = 'wordshot_card_widths';

const DEFAULT_SLOTS: AmmoSlotConfig[] = [
  { slotId: 'slot-1', hotkey: '1', displayName: '感谢', sourceCategory: 'thanks', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-2', hotkey: '2', displayName: '回击', sourceCategory: 'rebuttal', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-3', hotkey: '3', displayName: '互动', sourceCategory: 'interaction', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-4', hotkey: '4', displayName: '带货', sourceCategory: 'ad', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-5', hotkey: '5', displayName: '夸奖', sourceCategory: 'praise', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-6', hotkey: '6', displayName: '开播', sourceCategory: 'opening', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-7', hotkey: '7', displayName: '闭播', sourceCategory: 'closing', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-8', hotkey: '8', displayName: '抽奖', sourceCategory: 'lottery', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  { slotId: 'slot-9', hotkey: '9', displayName: '危机', sourceCategory: 'crisis', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
];

function loadSlotsFromStorage(): AmmoSlotConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading slot config:', error);
  }
  return [...DEFAULT_SLOTS];
}

function loadCardWidthsFromStorage(): Record<string, number> {
  try {
    const saved = localStorage.getItem(CARD_WIDTHS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading card widths:', error);
  }
  return {};
}

function saveCardWidthsToStorage(widths: Record<string, number>): void {
  try {
    localStorage.setItem(CARD_WIDTHS_KEY, JSON.stringify(widths));
  } catch (error) {
    console.error('Error saving card widths:', error);
  }
}

const initialState: AmmoState = {
  slots: loadSlotsFromStorage(),
  cardWidths: loadCardWidthsFromStorage(),
  currentScripts: {},
  previewIndex: {},
  playingSlotId: null,
};

export const ammoStore = create<AmmoStore>((set, get) => ({
  ...initialState,

  // Slot management
  setSlots: (slots) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    } catch (error) {
      console.error('Error saving slot config:', error);
    }
    set({ slots });
  },

  updateSlot: (slotId, updates) => {
    const { slots } = get();
    const newSlots = slots.map((s) => (s.slotId === slotId ? { ...s, ...updates } : s));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlots));
    } catch (error) {
      console.error('Error saving slot config:', error);
    }
    set({ slots: newSlots });
  },

  setCardWidth: (slotId: string, width: number) => {
    const newWidths = { ...get().cardWidths, [slotId]: width };
    saveCardWidthsToStorage(newWidths);
    set({ cardWidths: newWidths });
  },

  // Script operations
  setCurrentScript: (slotId, script) =>
    set((state) => ({
      currentScripts: { ...state.currentScripts, [slotId]: script },
    })),

  switchScript: (slotId, scripts) => {
    const { slots, currentScripts, previewIndex } = get();
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return null;

    const slotScripts = scripts.filter((s) => s.category === slot.sourceCategory);
    if (slotScripts.length === 0) return null;

    const currentIndex = previewIndex[slotId] ?? 0;
    const nextIndex = (currentIndex + 1) % slotScripts.length;
    const nextScript = slotScripts[nextIndex];

    set((state) => ({
      currentScripts: { ...state.currentScripts, [slotId]: nextScript },
      previewIndex: { ...state.previewIndex, [slotId]: nextIndex },
    }));

    return nextScript;
  },

  previewScript: (slotId, direction, scripts) => {
    const { slots, previewIndex } = get();
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return null;

    const slotScripts = scripts.filter((s) => s.category === slot.sourceCategory);
    if (slotScripts.length === 0) return null;

    const currentIndex = previewIndex[slotId] ?? 0;
    const delta = direction === 'next' ? 1 : -1;
    const newIndex = (currentIndex + delta + slotScripts.length) % slotScripts.length;

    set((state) => ({
      previewIndex: { ...state.previewIndex, [slotId]: newIndex },
    }));

    return slotScripts[newIndex];
  },

  // Auto rotate (timer management would be handled externally)
  startAutoRotate: (slotId) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slotId === slotId ? { ...s, autoRotateEnabled: true } : s
      ),
    })),

  stopAutoRotate: (slotId) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slotId === slotId ? { ...s, autoRotateEnabled: false } : s
      ),
    })),

  setPlayingSlotId: (slotId) => set({ playingSlotId: slotId }),

  // Getters
  getCurrentScript: (slotId) => {
    const { currentScripts } = get();
    return currentScripts[slotId];
  },

  getPreviewScript: (slotId) => {
    const { slots, previewIndex, currentScripts } = get();
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return currentScripts[slotId];
    return currentScripts[slotId]; // Preview is managed via previewIndex
  },

  getScriptsForSlot: (slotId, allScripts) => {
    const { slots } = get();
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot) return [];
    return allScripts.filter((s) => s.category === slot.sourceCategory).slice(0, slot.displayCount);
  },
}));

export const useAmmoStore = ammoStore;