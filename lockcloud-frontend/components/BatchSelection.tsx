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
 */
export function SelectableFileCard({ file, children }: SelectableFileCardProps) {
  const { isSelected, toggleFile } = useBatchSelectionStore();
  const selected = isSelected(file.id);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFile(file.id);
  }, [file.id, toggleFile]);

  return (
    <div className="relative group/selectable">
      {/* Selection Checkbox */}
      <div
        className={`
          absolute top-2 left-2 z-10
          transition-opacity duration-200
          ${selected ? 'opacity-100' : 'opacity-0 group-hover/selectable:opacity-100'}
        `}
      >
        <button
          onClick={handleCheckboxClick}
          className={`
            w-6 h-6 rounded-md border-2 flex items-center justify-center
            transition-all duration-200
            ${selected 
              ? 'bg-primary-black border-primary-black' 
              : 'bg-primary-white/80 border-accent-gray hover:border-primary-black'
            }
          `}
          aria-label={selected ? '取消选择' : '选择文件'}
        >
          {selected && (
            <svg className="w-4 h-4 text-primary-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Selection Highlight */}
      <div
        className={`
          absolute inset-0 rounded-xl pointer-events-none
          transition-all duration-200
          ${selected ? 'ring-2 ring-primary-black ring-offset-2' : ''}
        `}
      />

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
    <div className="flex items-center gap-4 py-2">
      <button
        onClick={handleSelectAll}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg
          transition-colors duration-200
          ${allSelected 
            ? 'bg-primary-black text-primary-white' 
            : 'bg-accent-gray/10 text-primary-black hover:bg-accent-gray/20'
          }
        `}
      >
        <div
          className={`
            w-4 h-4 rounded border-2 flex items-center justify-center
            ${allSelected 
              ? 'bg-primary-white border-primary-white' 
              : 'border-current'
            }
          `}
        >
          {allSelected && (
            <svg className="w-3 h-3 text-primary-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm font-medium">
          {allSelected ? '取消全选' : '全选'}
        </span>
      </button>

      {selectionCount > 0 && (
        <>
          <span className="text-sm text-accent-gray">
            已选择 {selectionCount} / {totalCount} 个文件
          </span>
          <button
            onClick={clearSelection}
            className="text-sm text-accent-gray hover:text-primary-black transition-colors"
          >
            清除选择
          </button>
        </>
      )}
    </div>
  );
}
