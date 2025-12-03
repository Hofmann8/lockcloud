import { create } from 'zustand';

interface BatchSelectionState {
  /** Set of selected file IDs */
  selectedIds: Set<number>;
  /** Whether select all mode is active */
  isSelectAllMode: boolean;
  
  // Actions
  /** Select a single file */
  selectFile: (fileId: number) => void;
  /** Deselect a single file */
  deselectFile: (fileId: number) => void;
  /** Toggle selection of a single file */
  toggleFile: (fileId: number) => void;
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
 * - 5.1: Click file checkbox to add to selection set
 * - 5.2: Select all visible files in current view
 * - 5.3: Display batch action toolbar with selection count
 */
export const useBatchSelectionStore = create<BatchSelectionState>((set, get) => ({
  selectedIds: new Set(),
  isSelectAllMode: false,

  selectFile: (fileId: number) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.add(fileId);
      return { selectedIds: newSet };
    });
  },

  deselectFile: (fileId: number) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      newSet.delete(fileId);
      return { selectedIds: newSet, isSelectAllMode: false };
    });
  },

  toggleFile: (fileId: number) => {
    const { selectedIds } = get();
    if (selectedIds.has(fileId)) {
      get().deselectFile(fileId);
    } else {
      get().selectFile(fileId);
    }
  },

  selectFiles: (fileIds: number[]) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      fileIds.forEach((id) => newSet.add(id));
      return { selectedIds: newSet };
    });
  },

  selectAll: (fileIds: number[]) => {
    set({
      selectedIds: new Set(fileIds),
      isSelectAllMode: true,
    });
  },

  clearSelection: () => {
    set({
      selectedIds: new Set(),
      isSelectAllMode: false,
    });
  },

  isSelected: (fileId: number) => {
    return get().selectedIds.has(fileId);
  },

  getSelectionCount: () => {
    return get().selectedIds.size;
  },

  getSelectedIds: () => {
    return Array.from(get().selectedIds);
  },
}));
