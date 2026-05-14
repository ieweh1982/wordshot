import { create } from 'zustand';
import type { Danmu, DanmuType } from '../types';

interface DanmuState {
  danmuList: Danmu[];
  highlightedDanmu: Danmu | null;
  filteredDanmu: Danmu[];
}

interface DanmuActions {
  // CRUD
  addDanmu: (danmu: Danmu) => void;
  addDanmuBatch: (danmuList: Danmu[]) => void;
  removeDanmu: (id: string) => void;
  clearDanmu: () => void;

  // Highlighting
  setHighlightedDanmu: (danmu: Danmu | null) => void;

  // Filtering
  setFilteredDanmu: (danmu: Danmu[]) => void;
  filterHighQuality: (minSentiment?: number) => void;
  filterByType: (types: DanmuType[]) => void;
  clearFilter: () => void;

  // Selection
  toggleSelectedForReply: (id: string) => void;

  // Getters
  getDanmuById: (id: string) => Danmu | undefined;
  getDanmuByUserId: (userId: string) => Danmu[];
}

type DanmuStore = DanmuState & DanmuActions;

const initialState: DanmuState = {
  danmuList: [],
  highlightedDanmu: null,
  filteredDanmu: [],
};

export const danmuStore = create<DanmuStore>((set, get) => ({
  ...initialState,

  // CRUD
  addDanmu: (danmu) =>
    set((state) => ({
      danmuList: [...state.danmuList, danmu],
    })),

  addDanmuBatch: (danmuList) =>
    set((state) => ({
      danmuList: [...state.danmuList, ...danmuList],
    })),

  removeDanmu: (id) =>
    set((state) => ({
      danmuList: state.danmuList.filter((d) => d.id !== id),
      highlightedDanmu: state.highlightedDanmu?.id === id ? null : state.highlightedDanmu,
    })),

  clearDanmu: () =>
    set({ danmuList: [], highlightedDanmu: null, filteredDanmu: [] }),

  // Highlighting
  setHighlightedDanmu: (danmu) => set({ highlightedDanmu: danmu }),

  // Filtering
  setFilteredDanmu: (danmu) => set({ filteredDanmu: danmu }),

  filterHighQuality: (minSentiment = 0) =>
    set((state) => ({
      filteredDanmu: state.danmuList.filter(
        (d) => d.sentiment >= minSentiment && d.importance !== 'danger'
      ),
    })),

  filterByType: (types) =>
    set((state) => ({
      filteredDanmu: state.danmuList.filter((d) => types.includes(d.type)),
    })),

  clearFilter: () => set({ filteredDanmu: [] }),

  // Selection
  toggleSelectedForReply: (id) =>
    set((state) => ({
      danmuList: state.danmuList.map((d) =>
        d.id === id ? { ...d, selectedForReply: !d.selectedForReply } : d
      ),
    })),

  // Getters
  getDanmuById: (id) => {
    const { danmuList } = get();
    return danmuList.find((d) => d.id === id);
  },

  getDanmuByUserId: (userId) => {
    const { danmuList } = get();
    return danmuList.filter((d) => d.userId === userId);
  },
}));

export const useDanmuStore = danmuStore;