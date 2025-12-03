'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addTagToFile, removeTagFromFile } from '@/lib/api/tags';
import { FreeTag } from '@/types';
import { TagInput } from './TagInput';
import { showToast } from '@/lib/utils/toast';

interface FileTagEditorProps {
  /** File ID to manage tags for */
  fileId: number;
  /** Current tags on the file */
  tags: FreeTag[];
  /** Callback when tags are updated */
  onTagsChange?: (tags: FreeTag[]) => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether to show the label */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
  /** Compact mode - smaller chips and input */
  compact?: boolean;
}

/**
 * FileTagEditor component - Display and edit file tags inline
 * Shows current tags as chips with remove buttons, and TagInput for adding new tags
 * Requirements: 3.1, 3.3, 3.4
 */
export function FileTagEditor({
  fileId,
  tags,
  onTagsChange,
  disabled = false,
  showLabel = true,
  label = '自由标签',
  compact = false,
}: FileTagEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: (tagName: string) => addTagToFile(fileId, tagName),
    onSuccess: (newTag) => {
      // Update local state
      const updatedTags = [...tags, newTag];
      onTagsChange?.(updatedTags);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      
      showToast.success(`已添加标签 "${newTag.name}"`);
    },
    onError: (error: Error) => {
      console.error('Failed to add tag:', error);
      showToast.error('添加标签失败，请重试');
    },
  });

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: (tagId: number) => removeTagFromFile(fileId, tagId),
    onSuccess: (_, tagId) => {
      // Update local state
      const updatedTags = tags.filter((t) => t.id !== tagId);
      onTagsChange?.(updatedTags);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      
      showToast.success('已移除标签');
    },
    onError: (error: Error) => {
      console.error('Failed to remove tag:', error);
      showToast.error('移除标签失败，请重试');
    },
  });

  const handleAddTag = useCallback((tagName: string) => {
    // Check if tag already exists on file
    if (tags.some((t) => t.name.toLowerCase() === tagName.toLowerCase())) {
      showToast.warning('该标签已存在');
      return;
    }
    addTagMutation.mutate(tagName);
  }, [tags, addTagMutation]);

  const handleRemoveTag = useCallback((tagId: number) => {
    removeTagMutation.mutate(tagId);
  }, [removeTagMutation]);

  const isLoading = addTagMutation.isPending || removeTagMutation.isPending;
  const currentTagNames = tags.map((t) => t.name);

  return (
    <div className="w-full">
      {showLabel && (
        <label className="block text-sm font-medium text-primary-black mb-2">
          {label}
        </label>
      )}

      {/* Current Tags */}
      <div className={`flex flex-wrap gap-2 ${tags.length > 0 ? 'mb-3' : ''}`}>
        {tags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            onRemove={handleRemoveTag}
            disabled={disabled || isLoading}
            compact={compact}
          />
        ))}
        
        {tags.length === 0 && !isAdding && (
          <span className="text-sm text-accent-gray italic">暂无标签</span>
        )}
      </div>

      {/* Add Tag Section */}
      {isAdding ? (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <TagInput
              onTagSelect={handleAddTag}
              excludeTags={currentTagNames}
              disabled={disabled || isLoading}
              autoFocus
              placeholder="输入标签名称..."
            />
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            disabled={isLoading}
            className="px-3 py-2 text-sm text-accent-gray hover:text-primary-black transition-colors disabled:opacity-50"
            aria-label="取消添加标签"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          disabled={disabled || isLoading}
          className={`inline-flex items-center gap-1.5 text-accent-blue hover:text-accent-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          <svg 
            className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加标签
        </button>
      )}
    </div>
  );
}

interface TagChipProps {
  tag: FreeTag;
  onRemove: (tagId: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

function TagChip({ tag, onRemove, disabled = false, compact = false }: TagChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-accent-blue/10 text-accent-blue rounded-full ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      {tag.name}
      <button
        type="button"
        onClick={() => onRemove(tag.id)}
        disabled={disabled}
        className="hover:text-semantic-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`移除标签 ${tag.name}`}
      >
        <svg 
          className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
