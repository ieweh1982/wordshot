import { create } from 'zustand'

interface AppState {
  isPlaying: boolean
  currentScriptIndex: number
  togglePlay: () => void
  nextScript: () => void
  prevScript: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isPlaying: false,
  currentScriptIndex: 0,
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  nextScript: () => set((state) => ({ currentScriptIndex: state.currentScriptIndex + 1 })),
  prevScript: () => set((state) => ({ currentScriptIndex: Math.max(0, state.currentScriptIndex - 1) }))
}))
