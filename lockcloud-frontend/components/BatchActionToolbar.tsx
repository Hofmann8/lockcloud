'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { useAuthStore } from '@/stores/authStore';
import { Modal, ModalFooter } from './Modal';
import { BatchEditDialog } from './BatchEditDialog';
import * as filesApi from '@/lib/api/files';
import * as requestsApi from '@/lib/api/requests';
import * as tagsApi from '@/lib/api/tags';
import { TagWithCount, File } from '@/types';
import toast from 'react-hot-toast';

interface BatchActionToolbarProps {
  onOperationComplete?: () => void;
  files?: File[];
}

export function BatchActionToolbar({ onOperationComplete, files = [] }: BatchActionToolbarProps) {
  const queryClient = useQueryClient();
  const { clearSelection, selectedIds } = useBatchSelectionStore();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.is_admin || false;
  const selectionCount = selectedIds.size;
  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  // Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [isRemoveTagModalOpen, setIsRemoveTagModalOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  
  // Confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddTagConfirm, setShowAddTagConfirm] = useState(false);
  const [showRemoveTagConfirm, setShowRemoveTagConfirm] = useState(false);
  
  // Loading states
  const [isProcessing, setIsProcessing] = useState(false);

  // Tag input states
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<TagWithCount[]>([]);
  const [selectedTagToRemove, setSelectedTagToRemove] = useState<{ id: number; name: string; count: number } | null>(null);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // Get selected files and categorize by ownership
  const selectedFiles = useMemo(() => files.filter(f => selectedIdsArray.includes(f.id)), [files, selectedIdsArray]);
  
  const { ownFiles, otherFiles } = useMemo(() => {
    const own: File[] = [];
    const other: File[] = [];
    selectedFiles.forEach(file => {
      if (file.uploader_id === user?.id || isAdmin) {
        own.push(file);
      } else {
        other.push(file);
      }
    });
    return { ownFiles: own, otherFiles: other };
  }, [selectedFiles, user?.id, isAdmin]);

  // Tag search
  const handleTagSearch = useCallback((query: string) => {
    setTagInput(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length > 0) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await tagsApi.searchTags(query);
          setTagSuggestions(results);
        } catch { setTagSuggestions([]); }
      }, 300);
    } else {
      setTagSuggestions([]);
    }
  }, []);

  // Collect tags from selected files
  const selectedFilesTags = useMemo(() => {
    const tagMap = new Map<number, { id: number; name: string; count: number }>();
    selectedFiles.forEach(file => {
      file.free_tags?.forEach(tag => {
        const existing = tagMap.get(tag.id);
        if (existing) {
          existing.count += 1;
        } else {
          tagMap.set(tag.id, { id: tag.id, name: tag.name, count: 1 });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  }, [selectedFiles]);

  // Debug log
  useEffect(() => {
    if (selectionCount > 0) {
      console.log('BatchActionToolbar Debug:', {
        selectionCount,
        filesLength: files.length,
        selectedFilesLength: selectedFiles.length,
        ownFilesLength: ownFiles.length,
        otherFilesLength: otherFiles.length,
        userId: user?.id,
        isAdmin,
      });
    }
  }, [selectionCount, files.length, selectedFiles.length, ownFiles.length, otherFiles.length, user?.id, isAdmin]);

  // ========== DELETE ==========
  const handleDeletePreview = () => {
    setIsDeleteModalOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (ownFiles.length === 0 && otherFiles.length === 0) {
      toast.error('没有找到要操作的文件');
      setShowDeleteConfirm(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const promises: Promise<unknown>[] = [];
      
      // Direct delete for own files
      if (ownFiles.length > 0) {
        promises.push(filesApi.batchDeleteFiles(ownFiles.map(f => f.id)));
      }
      
      // Create delete requests for other's files
      if (otherFiles.length > 0) {
        for (const file of otherFiles) {
          promises.push(requestsApi.createRequest({
            file_id: file.id,
            request_type: 'delete',
          }));
        }
      }
      
      await Promise.all(promises);
      
      if (ownFiles.length > 0) toast.success(`成功删除 ${ownFiles.length} 个文件`);
      if (otherFiles.length > 0) {
        toast.success(`已发送 ${otherFiles.length} 个删除请求`);
        queryClient.invalidateQueries({ queryKey: ['requests'] });
      }
      
      clearSelection();
      onOperationComplete?.();
    } catch (error) {
      console.error('Batch delete error:', error);
      toast.error('操作失败');
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  // ========== ADD TAG ==========
  const handleAddTagPreview = () => {
    if (!tagInput.trim()) {
      toast.error('请输入标签名称');
      return;
    }
    setIsAddTagModalOpen(false);
    setShowAddTagConfirm(true);
  };

  const handleAddTagConfirm = async () => {
    if (ownFiles.length === 0 && otherFiles.length === 0) {
      toast.error('没有找到要操作的文件');
      setShowAddTagConfirm(false);
      return;
    }
    
    const tagName = tagInput.trim();
    setIsProcessing(true);
    try {
      const promises: Promise<unknown>[] = [];
      
      // Direct add for own files
      if (ownFiles.length > 0) {
        promises.push(filesApi.batchAddTag(ownFiles.map(f => f.id), tagName));
      }
      
      // Create edit requests for other's files
      if (otherFiles.length > 0) {
        promises.push(filesApi.batchCreateRequests(
          otherFiles.map(f => f.id),
          { free_tags: [tagName] }
        ));
      }
      
      await Promise.all(promises);
      
      if (ownFiles.length > 0) toast.success(`成功为 ${ownFiles.length} 个文件添加标签`);
      if (otherFiles.length > 0) {
        toast.success(`已发送 ${otherFiles.length} 个添加标签请求`);
        queryClient.invalidateQueries({ queryKey: ['requests'] });
      }
      
      clearSelection();
      onOperationComplete?.();
    } catch (error) {
      console.error('Batch add tag error:', error);
      toast.error('操作失败');
    } finally {
      setIsProcessing(false);
      setShowAddTagConfirm(false);
      setTagInput('');
      setTagSuggestions([]);
    }
  };

  // ========== REMOVE TAG ==========
  const handleRemoveTagPreview = () => {
    if (!selectedTagToRemove) {
      toast.error('请选择要移除的标签');
      return;
    }
    setIsRemoveTagModalOpen(false);
    setShowRemoveTagConfirm(true);
  };

  const handleRemoveTagConfirm = async () => {
    if (!selectedTagToRemove) return;
    
    if (ownFiles.length === 0 && otherFiles.length === 0) {
      toast.error('没有找到要操作的文件');
      setShowRemoveTagConfirm(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const promises: Promise<unknown>[] = [];
      
      // Direct remove for own files
      if (ownFiles.length > 0) {
        promises.push(filesApi.batchRemoveTag(ownFiles.map(f => f.id), selectedTagToRemove.id));
      }
      
      // For other's files, we need to send edit requests
      if (otherFiles.length > 0) {
        for (const file of otherFiles) {
          const currentTags = file.free_tags?.map(t => t.name) || [];
          const newTags = currentTags.filter(t => t !== selectedTagToRemove.name);
          promises.push(requestsApi.createRequest({
            file_id: file.id,
            request_type: 'edit',
            proposed_changes: { free_tags: newTags },
          }));
        }
      }
      
      await Promise.all(promises);
      
      if (ownFiles.length > 0) toast.success(`成功从 ${ownFiles.length} 个文件移除标签`);
      if (otherFiles.length > 0) {
        toast.success(`已发送 ${otherFiles.length} 个移除标签请求`);
        queryClient.invalidateQueries({ queryKey: ['requests'] });
      }
      
      clearSelection();
      onOperationComplete?.();
    } catch (error) {
      console.error('Batch remove tag error:', error);
      toast.error('操作失败');
    } finally {
      setIsProcessing(false);
      setShowRemoveTagConfirm(false);
      setSelectedTagToRemove(null);
    }
  };

  const openRemoveTagModal = useCallback(() => {
    setIsRemoveTagModalOpen(true);
  }, []);

  const handleBatchEditSuccess = useCallback(() => {
    clearSelection();
    onOperationComplete?.();
  }, [clearSelection, onOperationComplete]);

  if (selectionCount === 0) return null;

  // Confirmation Summary Component
  const ConfirmationContent = ({ action, detail }: { action: string; detail?: string }) => (
    <div className="space-y-4">
      <div className="p-3 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-700">{action}</p>
        {detail && <p className="text-sm text-gray-600 mt-1">{detail}</p>}
      </div>
      {ownFiles.length > 0 && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span className="text-sm font-medium text-green-700">直接执行 ({ownFiles.length} 个文件)</span>
          </div>
          <p className="text-xs text-green-600">您上传的文件，将立即生效</p>
        </div>
      )}
      {otherFiles.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            <span className="text-sm font-medium text-amber-700">发送请求 ({otherFiles.length} 个文件)</span>
          </div>
          <p className="text-xs text-amber-600">他人上传的文件，需要上传者审批</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Floating Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-primary-black text-primary-white rounded-2xl shadow-xl px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <span className="font-medium">已选择 {selectionCount} 个文件</span>
          </div>
          <div className="w-px h-6 bg-primary-white/30" />
          <div className="flex items-center gap-2">
            <button onClick={() => setIsBatchEditOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/80 hover:bg-orange-500 transition-colors" title="批量编辑">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <span className="text-sm">批量编辑</span>
            </button>
            <button onClick={() => setIsAddTagModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-white/10 hover:bg-primary-white/20 transition-colors" title="添加标签">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              <span className="text-sm">添加标签</span>
            </button>
            <button onClick={openRemoveTagModal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-white/10 hover:bg-primary-white/20 transition-colors" title="移除标签">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm">移除标签</span>
            </button>
            <button onClick={() => setIsDeleteModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 transition-colors" title="删除文件">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span className="text-sm">删除</span>
            </button>
          </div>
          <div className="w-px h-6 bg-primary-white/30" />
          <button onClick={clearSelection} className="p-1.5 rounded-lg hover:bg-primary-white/10 transition-colors" title="取消选择">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Delete Input Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="批量删除" size="md"
        footer={<ModalFooter onCancel={() => setIsDeleteModalOpen(false)} onConfirm={handleDeletePreview} cancelText="取消" confirmText="下一步" confirmVariant="danger" />}>
        <p className="text-accent-gray">确定要删除选中的 <span className="font-semibold text-primary-black">{selectionCount}</span> 个文件吗？</p>
        <p className="text-red-500 text-sm mt-2">⚠️ 删除操作不可撤销</p>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="确认删除" size="md" closeOnBackdrop={!isProcessing}
        footer={<ModalFooter onCancel={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteConfirm} cancelText="取消" confirmText="确认执行" confirmVariant="danger" isLoading={isProcessing} />}>
        <ConfirmationContent action="删除文件" />
      </Modal>

      {/* Add Tag Input Modal */}
      <Modal isOpen={isAddTagModalOpen} onClose={() => { setIsAddTagModalOpen(false); setTagInput(''); setTagSuggestions([]); }} title="批量添加标签" size="md"
        footer={<ModalFooter onCancel={() => { setIsAddTagModalOpen(false); setTagInput(''); setTagSuggestions([]); }} onConfirm={handleAddTagPreview} cancelText="取消" confirmText="下一步" confirmVariant="primary" />}>
        <div className="space-y-4">
          <p className="text-accent-gray">为选中的 <span className="font-semibold text-primary-black">{selectionCount}</span> 个文件添加标签</p>
          <div className="relative">
            <input type="text" value={tagInput} onChange={(e) => handleTagSearch(e.target.value)} placeholder="输入标签名称..." className="w-full px-4 py-2 border border-accent-gray/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-black/20" />
            {tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-primary-white border border-accent-gray/30 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {tagSuggestions.map((tag) => (
                  <button key={tag.id} onClick={() => { setTagInput(tag.name); setTagSuggestions([]); }} className="w-full px-4 py-2 text-left hover:bg-accent-gray/10 flex items-center justify-between">
                    <span>{tag.name}</span><span className="text-xs text-accent-gray">{tag.count} 个文件</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Add Tag Confirmation Modal */}
      <Modal isOpen={showAddTagConfirm} onClose={() => setShowAddTagConfirm(false)} title="确认添加标签" size="md" closeOnBackdrop={!isProcessing}
        footer={<ModalFooter onCancel={() => setShowAddTagConfirm(false)} onConfirm={handleAddTagConfirm} cancelText="取消" confirmText="确认执行" confirmVariant="primary" isLoading={isProcessing} />}>
        <ConfirmationContent action={`添加标签: "${tagInput}"`} />
      </Modal>

      {/* Remove Tag Input Modal */}
      <Modal isOpen={isRemoveTagModalOpen} onClose={() => { setIsRemoveTagModalOpen(false); setSelectedTagToRemove(null); }} title="批量移除标签" size="md"
        footer={<ModalFooter onCancel={() => { setIsRemoveTagModalOpen(false); setSelectedTagToRemove(null); }} onConfirm={handleRemoveTagPreview} cancelText="取消" confirmText="下一步" confirmVariant="danger" />}>
        <div className="space-y-4">
          <p className="text-accent-gray">从选中的 <span className="font-semibold text-primary-black">{selectionCount}</span> 个文件中移除标签</p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-black">选择要移除的标签</label>
            {selectedFilesTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border border-accent-gray/20 rounded-lg">
                {selectedFilesTags.map((tag) => (
                  <button key={tag.id} onClick={() => setSelectedTagToRemove(tag)} className={`px-3 py-1.5 rounded-full text-sm transition-colors ${selectedTagToRemove?.id === tag.id ? 'bg-primary-black text-primary-white' : 'bg-accent-gray/10 text-primary-black hover:bg-accent-gray/20'}`}>
                    {tag.name}<span className="ml-1 text-xs opacity-70">({tag.count}个文件)</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-accent-gray py-4 text-center">选中的文件没有标签</p>}
          </div>
        </div>
      </Modal>

      {/* Remove Tag Confirmation Modal */}
      <Modal isOpen={showRemoveTagConfirm} onClose={() => setShowRemoveTagConfirm(false)} title="确认移除标签" size="md" closeOnBackdrop={!isProcessing}
        footer={<ModalFooter onCancel={() => setShowRemoveTagConfirm(false)} onConfirm={handleRemoveTagConfirm} cancelText="取消" confirmText="确认执行" confirmVariant="danger" isLoading={isProcessing} />}>
        <ConfirmationContent action={`移除标签: "${selectedTagToRemove?.name}"`} />
      </Modal>

      {/* Batch Edit Dialog */}
      <BatchEditDialog files={selectedFiles} isOpen={isBatchEditOpen} onClose={() => setIsBatchEditOpen(false)} onSuccess={handleBatchEditSuccess} />
    </>
  );
}
