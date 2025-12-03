'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { Modal, ModalFooter } from './Modal';
import * as filesApi from '@/lib/api/files';
import * as tagsApi from '@/lib/api/tags';
import { TagWithCount } from '@/types';
import toast from 'react-hot-toast';

interface BatchActionToolbarProps {
  /** Callback when batch operation completes successfully */
  onOperationComplete?: () => void;
}

/**
 * BatchActionToolbar - Floating toolbar for batch operations
 * 
 * Requirements:
 * - 5.3: Display batch action toolbar showing selection count
 * - 5.4: Batch delete with confirmation
 * - 5.5: Batch add free tag
 * - 5.6: Batch remove free tag
 */
export function BatchActionToolbar({ onOperationComplete }: BatchActionToolbarProps) {
  const { clearSelection, getSelectedIds, getSelectionCount } = useBatchSelectionStore();
  const selectionCount = getSelectionCount();

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [isRemoveTagModalOpen, setIsRemoveTagModalOpen] = useState(false);
  
  // Loading states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isRemovingTag, setIsRemovingTag] = useState(false);

  // Tag input states
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<TagWithCount[]>([]);
  const [selectedTagToRemove, setSelectedTagToRemove] = useState<TagWithCount | null>(null);
  const [availableTags, setAvailableTags] = useState<TagWithCount[]>([]);
  
  // Debounce ref for tag search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle batch delete
  const handleBatchDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const fileIds = getSelectedIds();
      const result = await filesApi.batchDeleteFiles(fileIds);
      
      if (result.success) {
        toast.success(`成功删除 ${fileIds.length} 个文件`);
        clearSelection();
        onOperationComplete?.();
      } else if (result.results) {
        const successCount = result.results.succeeded.length;
        const failCount = result.results.failed.length;
        if (successCount > 0) {
          toast.success(`成功删除 ${successCount} 个文件`);
        }
        if (failCount > 0) {
          toast.error(`${failCount} 个文件删除失败`);
        }
        clearSelection();
        onOperationComplete?.();
      }
    } catch (error) {
      console.error('Batch delete error:', error);
      toast.error('批量删除失败');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  }, [getSelectedIds, clearSelection, onOperationComplete]);

  // Handle tag search for add tag modal (with debounce)
  const handleTagSearch = useCallback((query: string) => {
    setTagInput(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim().length > 0) {
      // Debounce: wait 300ms before searching
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await tagsApi.searchTags(query);
          setTagSuggestions(results);
        } catch (error) {
          console.error('Tag search error:', error);
          setTagSuggestions([]);
        }
      }, 300);
    } else {
      setTagSuggestions([]);
    }
  }, []);

  // Handle batch add tag
  const handleBatchAddTag = useCallback(async (tagName: string) => {
    if (!tagName.trim()) return;
    
    setIsAddingTag(true);
    try {
      const fileIds = getSelectedIds();
      const result = await filesApi.batchAddTag(fileIds, tagName.trim());
      
      if (result.success) {
        toast.success(`成功为 ${fileIds.length} 个文件添加标签 "${tagName}"`);
        clearSelection();
        onOperationComplete?.();
      } else if (result.results) {
        const successCount = result.results.succeeded.length;
        const failCount = result.results.failed.length;
        if (successCount > 0) {
          toast.success(`成功为 ${successCount} 个文件添加标签`);
        }
        if (failCount > 0) {
          toast.error(`${failCount} 个文件添加标签失败`);
        }
        onOperationComplete?.();
      }
    } catch (error) {
      console.error('Batch add tag error:', error);
      toast.error('批量添加标签失败');
    } finally {
      setIsAddingTag(false);
      setIsAddTagModalOpen(false);
      setTagInput('');
      setTagSuggestions([]);
    }
  }, [getSelectedIds, clearSelection, onOperationComplete]);

  // Load available tags for remove tag modal
  const loadAvailableTags = useCallback(async () => {
    try {
      const tags = await tagsApi.getTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Load tags error:', error);
      setAvailableTags([]);
    }
  }, []);

  // Handle batch remove tag
  const handleBatchRemoveTag = useCallback(async () => {
    if (!selectedTagToRemove) return;
    
    setIsRemovingTag(true);
    try {
      const fileIds = getSelectedIds();
      const result = await filesApi.batchRemoveTag(fileIds, selectedTagToRemove.id);
      
      if (result.success) {
        toast.success(`成功从 ${fileIds.length} 个文件移除标签 "${selectedTagToRemove.name}"`);
        clearSelection();
        onOperationComplete?.();
      } else if (result.results) {
        const successCount = result.results.succeeded.length;
        const failCount = result.results.failed.length;
        if (successCount > 0) {
          toast.success(`成功从 ${successCount} 个文件移除标签`);
        }
        if (failCount > 0) {
          toast.error(`${failCount} 个文件移除标签失败`);
        }
        onOperationComplete?.();
      }
    } catch (error) {
      console.error('Batch remove tag error:', error);
      toast.error('批量移除标签失败');
    } finally {
      setIsRemovingTag(false);
      setIsRemoveTagModalOpen(false);
      setSelectedTagToRemove(null);
    }
  }, [selectedTagToRemove, getSelectedIds, clearSelection, onOperationComplete]);

  // Open remove tag modal and load tags
  const openRemoveTagModal = useCallback(() => {
    loadAvailableTags();
    setIsRemoveTagModalOpen(true);
  }, [loadAvailableTags]);

  // Don't render if nothing is selected
  if (selectionCount === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-primary-black text-primary-white rounded-2xl shadow-xl px-6 py-3 flex items-center gap-4">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="font-medium">已选择 {selectionCount} 个文件</span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-primary-white/30" />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Add Tag Button */}
            <button
              onClick={() => setIsAddTagModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-white/10 hover:bg-primary-white/20 transition-colors"
              title="添加标签"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="text-sm">添加标签</span>
            </button>

            {/* Remove Tag Button */}
            <button
              onClick={openRemoveTagModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-white/10 hover:bg-primary-white/20 transition-colors"
              title="移除标签"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">移除标签</span>
            </button>

            {/* Delete Button */}
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 transition-colors"
              title="删除文件"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm">删除</span>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-primary-white/30" />

          {/* Clear Selection */}
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-lg hover:bg-primary-white/10 transition-colors"
            title="取消选择"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="确认批量删除"
        size="md"
        closeOnBackdrop={!isDeleting}
        footer={
          <ModalFooter
            onCancel={() => setIsDeleteModalOpen(false)}
            onConfirm={handleBatchDelete}
            cancelText="取消"
            confirmText="确认删除"
            confirmVariant="danger"
            isLoading={isDeleting}
          />
        }
      >
        <div className="space-y-4">
          <p className="text-accent-gray">
            确定要删除选中的 <span className="font-semibold text-primary-black">{selectionCount}</span> 个文件吗？
          </p>
          <p className="text-red-500 text-sm">
            ⚠️ 此操作不可撤销，删除后文件将无法恢复。
          </p>
        </div>
      </Modal>

      {/* Add Tag Modal */}
      <Modal
        isOpen={isAddTagModalOpen}
        onClose={() => {
          setIsAddTagModalOpen(false);
          setTagInput('');
          setTagSuggestions([]);
        }}
        title="批量添加标签"
        size="md"
        closeOnBackdrop={!isAddingTag}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsAddTagModalOpen(false);
              setTagInput('');
              setTagSuggestions([]);
            }}
            onConfirm={() => handleBatchAddTag(tagInput)}
            cancelText="取消"
            confirmText="添加标签"
            confirmVariant="primary"
            isLoading={isAddingTag}
          />
        }
      >
        <div className="space-y-4">
          <p className="text-accent-gray">
            为选中的 <span className="font-semibold text-primary-black">{selectionCount}</span> 个文件添加标签
          </p>
          
          {/* Tag Input */}
          <div className="relative">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => handleTagSearch(e.target.value)}
              placeholder="输入标签名称..."
              className="w-full px-4 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-black/20"
              disabled={isAddingTag}
            />
            
            {/* Suggestions Dropdown */}
            {tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-primary-white border border-accent-gray/30 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setTagInput(tag.name);
                      setTagSuggestions([]);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-accent-gray/10 flex items-center justify-between"
                  >
                    <span>{tag.name}</span>
                    <span className="text-xs text-accent-gray">{tag.count} 个文件</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <p className="text-sm text-accent-gray">
            输入已有标签名称或创建新标签
          </p>
        </div>
      </Modal>

      {/* Remove Tag Modal */}
      <Modal
        isOpen={isRemoveTagModalOpen}
        onClose={() => {
          setIsRemoveTagModalOpen(false);
          setSelectedTagToRemove(null);
        }}
        title="批量移除标签"
        size="md"
        closeOnBackdrop={!isRemovingTag}
        footer={
          <ModalFooter
            onCancel={() => {
              setIsRemoveTagModalOpen(false);
              setSelectedTagToRemove(null);
            }}
            onConfirm={handleBatchRemoveTag}
            cancelText="取消"
            confirmText="移除标签"
            confirmVariant="danger"
            isLoading={isRemovingTag}
          />
        }
      >
        <div className="space-y-4">
          <p className="text-accent-gray">
            从选中的 <span className="font-semibold text-primary-black">{selectionCount}</span> 个文件中移除标签
          </p>
          
          {/* Tag Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-black">选择要移除的标签</label>
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-accent-gray/20 rounded-lg">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTagToRemove(tag)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm transition-colors
                      ${selectedTagToRemove?.id === tag.id
                        ? 'bg-primary-black text-primary-white'
                        : 'bg-accent-gray/10 text-primary-black hover:bg-accent-gray/20'
                      }
                    `}
                  >
                    {tag.name}
                    <span className="ml-1 text-xs opacity-70">({tag.count})</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-accent-gray py-4 text-center">
                暂无可用标签
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
