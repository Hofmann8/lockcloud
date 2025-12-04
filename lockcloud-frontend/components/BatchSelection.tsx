'use client';

import { useCallback } from 'react';
import { File } from '@/types';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';

interface SelectableFileCardProps {
  file: File;
  children: React.ReactNode;
}

/**
 * SelectableFileCard - Wraps a file card with selection checkbox
 * 
 * Requirements:
 * - 5.1: Click file checkbox to add to selection set
 * - 9.2: Mobile optimized selection with clear visual feedback
 */
export function SelectableFileCard({ file, children }: SelectableFileCardProps) {
  const { isSelected, toggleFile } = useBatchSelectionStore();
  const selected = isSelected(file.id);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFile(file.id);
  }, [file.id, toggleFile]);

  return (
    <div className="relative group/selectable" data-testid="selectable-file-card">
      {/* Selection Checkbox - Mobile: always visible when selected, larger touch target */}
      <div
        className={`
          absolute top-2 left-2 z-10
          transition-opacity duration-200
          ${selected ? 'opacity-100' : 'opacity-0 group-hover/selectable:opacity-100 md:opacity-0'}
        `}
      >
        {/* Touch target wrapper - 44x44 minimum for mobile */}
        <button
          onClick={handleCheckboxClick}
          className={`
            w-8 h-8 sm:w-9 sm:h-9 md:w-7 md:h-7 
            rounded-lg md:rounded-md 
            border-2 
            flex items-center justify-center
            transition-all duration-200
            touch-manipulation
            min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0
            -ml-2 -mt-2 md:ml-0 md:mt-0
            ${selected 
              ? 'bg-primary-black border-primary-black shadow-lg' 
              : 'bg-primary-white/90 border-accent-gray/60 hover:border-primary-black active:bg-primary-black/10'
            }
          `}
          aria-label={selected ? '取消选择' : '选择文件'}
          aria-pressed={selected}
        >
          {selected && (
            <svg className="w-5 h-5 sm:w-5 sm:h-5 md:w-4 md:h-4 text-primary-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Selection Highlight - Enhanced visual feedback for mobile */}
      <div
        className={`
          absolute inset-0 rounded-xl pointer-events-none
          transition-all duration-200
          ${selected 
            ? 'ring-2 sm:ring-3 ring-primary-black ring-offset-2 bg-primary-black/5' 
            : ''
          }
        `}
      />

      {/* Selected overlay indicator for mobile - subtle background tint */}
      {selected && (
        <div className="absolute inset-0 rounded-xl bg-primary-black/3 pointer-events-none md:hidden" />
      )}

      {/* File Card Content */}
      {children}
    </div>
  );
}

interface BatchSelectionHeaderProps {
  files: File[];
}

/**
 * BatchSelectionHeader - Header with select all / clear selection controls
 * 
 * Requirements:
 * - 5.2: Select all visible files in current view
 * - 9.2: Mobile optimized selection controls
 */
export function BatchSelectionHeader({ files }: BatchSelectionHeaderProps) {
  const { selectedIds, selectAll, clearSelection } = useBatchSelectionStore();
  const selectionCount = selectedIds.size;
  const totalCount = files.length;
  const allSelected = selectionCount === totalCount && totalCount > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(files.map((f) => f.id));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4 py-2">
      {/* Select all button - 44px minimum touch target on mobile */}
      <button
        onClick={handleSelectAll}
        className={`
          flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 md:py-1.5 rounded-lg
          transition-colors duration-200
          min-h-[44px] md:min-h-0
          touch-manipulation
          ${allSelected 
            ? 'bg-primary-black text-primary-white' 
            : 'bg-accent-gray/10 text-primary-black hover:bg-accent-gray/20 active:bg-accent-gray/30'
          }
        `}
      >
        <div
          className={`
            w-5 h-5 sm:w-5 sm:h-5 md:w-4 md:h-4 rounded border-2 flex items-center justify-center shrink-0
            ${allSelected 
              ? 'bg-primary-white border-primary-white' 
              : 'border-current'
            }
          `}
        >
          {allSelected && (
            <svg className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-3 md:h-3 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm font-medium whitespace-nowrap">
          {allSelected ? '取消全选' : '全选'}
        </span>
      </button>

      {selectionCount > 0 && (
        <>
          {/* Selection count - responsive text */}
          <span className="text-xs sm:text-sm text-accent-gray whitespace-nowrap">
            已选 {selectionCount}/{totalCount}
          </span>
          {/* Clear selection button - 44px minimum touch target on mobile */}
          <button
            onClick={clearSelection}
            className="text-xs sm:text-sm text-accent-gray hover:text-primary-black active:text-primary-black/70 transition-colors min-h-[44px] md:min-h-0 px-2 py-2 md:py-0 touch-manipulation"
          >
            清除选择
          </button>
        </>
      )}
    </div>
  );
}
