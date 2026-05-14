import { create } from 'zustand';
import type { DisplayProfile, AmmoSlotConfig } from '../types';

interface DisplayState {
  profiles: DisplayProfile[];
  activeProfileId: string | null;
}

interface DisplayActions {
  // CRUD
  addProfile: (profile: DisplayProfile) => void;
  updateProfile: (id: string, updates: Partial<DisplayProfile>) => void;
  deleteProfile: (id: string) => void;

  // Active profile
  setActiveProfile: (id: string) => void;
  getActiveProfile: () => DisplayProfile | undefined;

  // Slot management within profiles
  updateSlotInProfile: (profileId: string, slotId: string, updates: Partial<AmmoSlotConfig>) => void;
  addSlotToProfile: (profileId: string, slot: AmmoSlotConfig) => void;
  removeSlotFromProfile: (profileId: string, slotId: string) => void;
}

type DisplayStore = DisplayState & DisplayActions;

const DEFAULT_PROFILE: DisplayProfile = {
  id: 'default',
  name: '默认配置',
  slots: [
    { slotId: 'slot-1', hotkey: '1', displayName: '感谢', sourceCategory: 'thanks', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-2', hotkey: '2', displayName: '回击', sourceCategory: 'rebuttal', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-3', hotkey: '3', displayName: '互动', sourceCategory: 'interaction', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-4', hotkey: '4', displayName: '带货', sourceCategory: 'ad', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-5', hotkey: '5', displayName: '夸奖', sourceCategory: 'praise', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-6', hotkey: '6', displayName: '开播', sourceCategory: 'opening', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-7', hotkey: '7', displayName: '闭播', sourceCategory: 'closing', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-8', hotkey: '8', displayName: '抽奖', sourceCategory: 'lottery', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
    { slotId: 'slot-9', hotkey: '9', displayName: '危机', sourceCategory: 'crisis', displayCount: 3, enabled: true, autoRotateEnabled: false, autoRotateIntervalMs: 5000 },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const initialState: DisplayState = {
  profiles: [DEFAULT_PROFILE],
  activeProfileId: 'default',
};

export const displayStore = create<DisplayStore>((set, get) => ({
  ...initialState,

  // CRUD
  addProfile: (profile) =>
    set((state) => ({ profiles: [...state.profiles, profile] })),

  updateProfile: (id, updates) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
    })),

  deleteProfile: (id) =>
    set((state) => {
      const newProfiles = state.profiles.filter((p) => p.id !== id);
      const newActiveId =
        state.activeProfileId === id
          ? newProfiles[0]?.id ?? null
          : state.activeProfileId;
      return { profiles: newProfiles, activeProfileId: newActiveId };
    }),

  // Active profile
  setActiveProfile: (id) => set({ activeProfileId: id }),

  getActiveProfile: () => {
    const { profiles, activeProfileId } = get();
    return profiles.find((p) => p.id === activeProfileId);
  },

  // Slot management within profiles
  updateSlotInProfile: (profileId, slotId, updates) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              slots: p.slots.map((s) =>
                s.slotId === slotId ? { ...s, ...updates } : s
              ),
              updatedAt: Date.now(),
            }
          : p
      ),
    })),

  addSlotToProfile: (profileId, slot) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === profileId
          ? { ...p, slots: [...p.slots, slot], updatedAt: Date.now() }
          : p
      ),
    })),

  removeSlotFromProfile: (profileId, slotId) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              slots: p.slots.filter((s) => s.slotId !== slotId),
              updatedAt: Date.now(),
            }
          : p
      ),
    })),
}));

export const useDisplayStore = displayStore;