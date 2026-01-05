/**
 * DeleteConfirmModal Component
 * 
 * Modal for confirming file deletion.
 * For file owners: directly deletes the file
 * For non-owners: sends a delete request to the owner
 * 
 * Follows the Web frontend implementation (lockcloud-frontend/components/DeleteConfirmModal.tsx)
 * 
 * Requirements: 4.5
 */

import { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { deleteFile } from '@/lib/api/files';
import { createRequest } from '@/lib/api/requests';
import { File } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface DeleteConfirmModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** File to delete */
  file: File | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when delete is successful */
  onSuccess?: () => void;
}

/**
 * DeleteConfirmModal - Modal for confirming file deletion
 * 
 * Requirements: 4.5
 */
export function DeleteConfirmModal({
  visible,
  file,
  onClose,
  onSuccess,
}: DeleteConfirmModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // Check ownership
  const isOwner = file && user ? file.uploader_id === user.id : false;
  const isAdmin = user?.is_admin || false;
  const canDirectDelete = isOwner || isAdmin;

  // Delete mutation (for owners)
  const deleteMutation = useMutation({
    mutationFn: () => deleteFile(file!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['directories'] });
      onSuccess?.();
      onClose();
    },
  });

  // Request mutation (for non-owners)
  const requestMutation = useMutation({
    mutationFn: () =>
      createRequest({
        file_id: file!.id,
        request_type: 'delete',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    },
  });

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (!file) return;
    
    if (canDirectDelete) {
      deleteMutation.mutate();
    } else {
      requestMutation.mutate();
    }
  }, [file, canDirectDelete, deleteMutation, requestMutation]);

  // Format file size
  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} 字节`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  // Format date
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }, []);

  const isPending = deleteMutation.isPending || requestMutation.isPending;
  const error = deleteMutation.error || requestMutation.error;

  // Theme colors
  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const overlayColor = 'rgba(0, 0, 0, 0.5)';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const infoBackground = colorScheme === 'dark' ? '#2c2c2e' : '#f5f5f5';

  if (!file) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={[styles.container, { backgroundColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Icon name="warning" size={48} color="#f59e0b" />
            <ThemedText style={styles.title}>
              {canDirectDelete ? '确认删除此文件？' : '请求删除此文件？'}
            </ThemedText>
          </View>

          {/* Description */}
          <ThemedText style={[styles.description, { color: secondaryTextColor }]}>
            {canDirectDelete 
              ? '删除后将无法恢复，请确认是否继续。'
              : '您不是此文件的上传者，删除请求将发送给上传者审批。'
            }
          </ThemedText>

          {/* File Info */}
          <View style={[styles.fileInfo, { backgroundColor: infoBackground }]}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                文件名：
              </ThemedText>
              <ThemedText style={styles.infoValue} numberOfLines={2}>
                {file.filename}
              </ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                大小：
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {formatSize(file.size)}
              </ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                上传者：
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {file.uploader?.name || '未知'}
              </ThemedText>
            </View>
            
            <View style={[styles.infoRow, styles.lastInfoRow]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                上传日期：
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {formatDate(file.uploaded_at)}
              </ThemedText>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>
                {error instanceof Error ? error.message : '操作失败，请重试'}
              </ThemedText>
            </View>
          )}

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor }]}
              onPress={onClose}
              disabled={isPending}
            >
              <ThemedText style={[styles.buttonText, styles.cancelButtonText]}>
                取消
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={[styles.buttonText, styles.confirmButtonText]}>
                  {canDirectDelete ? '确认删除' : '发送请求'}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    lineHeight: 20,
  },
  fileInfo: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  lastInfoRow: {
    paddingBottom: 0,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 70,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderRightWidth: 1,
  },
  confirmButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#6b7280',
  },
  confirmButtonText: {
    color: '#fff',
  },
});

export default DeleteConfirmModal;
