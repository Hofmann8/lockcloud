/**
 * Batch Selection State Management
 * 
 * Uses Zustand for managing file selection state for batch operations.
 * Follows the Web frontend implementation (lockcloud-frontend/stores/batchSelectionStore.ts).
 * 
 * Requirements: 9.1, 9.2
 */

import { create } from 'zustand';

interface BatchSelectionState {
  /** Set of selected file IDs */
  selectedIds: Set<number>;
  /** Whether select all mode is active */
  isSelectAllMode: boolean;
  /** Whether selection mode is active (for mobile long-press activation) */
  isSelectionMode: boolean;
  
  // Actions
  /** Enter selection mode (mobile-specific) */
  enterSelectionMode: () => void;
  /** Exit selection mode and clear selections */
  exitSelectionMode: () => void;
  /** Select a single file */
  selectFile: (fileId: number) => void;
  /** Deselect a single file */
  deselectFile: (fileId: number) => void;
  /** Toggle selection of a single file */
  toggleSelection: (fileId: number) => void;
  /** Select multiple files */
  selectFiles: (fileIds: number[]) => void;
  /** Select all files in the current view */
  selectAll: (fileIds: number[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if a file is selected */
  isSelected: (fileId: number) => boolean;
  /** Get count of selected files */
  getSelectionCount: () => number;
  /** Get array of selected file IDs */
  getSelectedIds: () => number[];
}

/**
 * BatchSelection Store - Manages file selection state for batch operations
 * 
 * Requirements:
 * - 9.1: Support multi-select mode for files (long-press to enter on mobile)
 * - 9.2: Display batch action toolbar with selection count
 */
export const useBatchSelectionStore = create<BatchSelectionState>((set, get) => ({
  selectedIds: new Set(),
  isSelectAllMode: false,
  isSelectionMode: false,

  /**
   * Enter selection mode (triggered by long-press on mobile)
   * 
   * Requirements: 9.1
   */
  enterSelectionMode: () => {
    set({ isSelectionMode: true });
  },

  /**
   * Exit selection mode and clear all selections
   */
  exitSelectionMode: () => {
    set({
      isSelectionMode: false,
      selectedIds: new Set(),
      isSelectAllMode: false,
    });
  },

  /**
   * Select a single file
   * 
   * @param fileId - File ID to select
   */
  selectFile: (fileId: number) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.add(fileId);
      return { selectedIds: newSet };
    });
  },

  /**
   * Deselect a single file
   * 
   * @param fileId - File ID to deselect
   */
  deselectFile: (fileId: number) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.delete(fileId);
      return { selectedIds: newSet, isSelectAllMode: false };
    });
  },

  /**
   * Toggle selection of a single file
   * 
   * @param fileId - File ID to toggle
   * 
   * Requirements: 9.1
   */
  toggleSelection: (fileId: number) => {
    const { selectedIds } = get();
    if (selectedIds.has(fileId)) {
      get().deselectFile(fileId);
    } else {
      get().selectFile(fileId);
    }
  },

  /**
   * Select multiple files
   * 
   * @param fileIds - Array of file IDs to select
   */
  selectFiles: (fileIds: number[]) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      fileIds.forEach((id) => newSet.add(id));
      return { selectedIds: newSet };
    });
  },

  /**
   * Select all files in the current view
   * 
   * @param fileIds - Array of all file IDs in current view
   * 
   * Requirements: 9.1
   */
  selectAll: (fileIds: number[]) => {
    set({
      selectedIds: new Set(fileIds),
      isSelectAllMode: true,
    });
  },

  /**
   * Clear all selections
   * 
   * Requirements: 9.1
   */
  clearSelection: () => {
    set({
      selectedIds: new Set(),
      isSelectAllMode: false,
    });
  },

  /**
   * Check if a file is selected
   * 
   * @param fileId - File ID to check
   * @returns True if file is selected
   */
  isSelected: (fileId: number): boolean => {
    return get().selectedIds.has(fileId);
  },

  /**
   * Get count of selected files
   * 
   * @returns Number of selected files
   * 
   * Requirements: 9.2
   */
  getSelectionCount: (): number => {
    return get().selectedIds.size;
  },

  /**
   * Get array of selected file IDs
   * 
   * @returns Array of selected file IDs
   */
  getSelectedIds: (): number[] => {
    return Array.from(get().selectedIds);
  },
}));

export default useBatchSelectionStore;
