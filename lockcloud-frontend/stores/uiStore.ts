import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GridDensity = 'sm' | 'md' | 'lg';

interface UiState {
  sidebarCollapsed: boolean;
  density: GridDensity;
  /** 文件页右边的信息栏 */
  infoOpen: boolean;
  /** 播放速度、音量这些跟着人走 */
  volume: number;
  muted: boolean;
  /** 分析过的视频播放时显示节拍器 */
  metronome: boolean;
  recentSearches: string[];
  paletteOpen: boolean;

  toggleSidebar: () => void;
  setDensity: (d: GridDensity) => void;
  setInfoOpen: (open: boolean) => void;
  setVolume: (v: number, muted?: boolean) => void;
  setMetronome: (on: boolean) => void;
  pushSearch: (q: string) => void;
  clearSearches: () => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: 'md',
      infoOpen: true,
      volume: 1,
      muted: false,
      metronome: true,
      recentSearches: [],
      paletteOpen: false,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDensity: (density) => set({ density }),
      setInfoOpen: (infoOpen) => set({ infoOpen }),
      setVolume: (volume, muted) => set((s) => ({ volume, muted: muted ?? s.muted })),
      setMetronome: (metronome) => set({ metronome }),
      pushSearch: (q) =>
        set((s) => ({ recentSearches: [q, ...s.recentSearches.filter((x) => x !== q)].slice(0, 8) })),
      clearSearches: () => set({ recentSearches: [] }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: 'lockcloud-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        density: s.density,
        infoOpen: s.infoOpen,
        volume: s.volume,
        muted: s.muted,
        metronome: s.metronome,
        recentSearches: s.recentSearches,
      }),
    },
  ),
);

