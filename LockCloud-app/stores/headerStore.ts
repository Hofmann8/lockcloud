/**
 * Header State Store
 * 
 * Manages shared header state across tabs.
 */

import { create } from 'zustand';

interface HeaderState {
  // Current scroll position
  scrollY: number;
  setScrollY: (y: number) => void;
  
  // Current active tab
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  scrollY: 0,
  setScrollY: (y) => set({ scrollY: y }),
  
  activeTab: 'index',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

// Tab titles mapping
export const TAB_TITLES: Record<string, string> = {
  index: '我的文件',
  upload: '上传文件',
  requests: '编辑请求',
  profile: '我的',
};
