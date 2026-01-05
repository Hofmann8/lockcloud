/**
 * File Detail Page
 * 
 * Displays file details, metadata, and preview with navigation to adjacent files.
 * Follows the Web frontend implementation (lockcloud-frontend/app/(dashboard)/files/[fileId]/page.tsx).
 * 
 * Features:
 * - File metadata display (filename, size, date, type, tags)
 * - Image preview with zoom
 * - Video playback
 * - Edit/delete actions for owners
 * - Request edit action for non-owners
 * - Adjacent file navigation
 * 
 * Requirements: 4.1, 4.5, 4.6
 */

import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ImageViewer } from '@/components/ImageViewer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { CreateRequestModal } from '@/components/CreateRequestModal';
import { EditFileModal } from '@/components/EditFileModal';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { useAuthStore } from '@/stores/authStore';
import { Icon } from '@/components/ui/Icon';
import { useAdjacentFiles } from '@/hooks/useAdjacentFiles';
import { getFile } from '@/lib/api/files';
import { FreeTag } from '@/types';
import { Colors } from '@/constants/theme';

const S3_BASE_URL = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud2.s3.bitiful.net';

/**
 * FileDetailScreen - File detail page with preview and metadata
 * 
 * Requirements: 4.1, 4.5, 4.6
 */
export default function FileDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fileId = parseInt(id || '0', 10);
  
  const { user } = useAuthStore();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch file details
  const {
    data: file,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['file', fileId],
    queryFn: () => getFile(fileId),
    enabled: fileId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch adjacent files for navigation
  const {
    hasPrevious,
    hasNext,
    goToPrevious,
    goToNext,
  } = useAdjacentFiles({ fileId, enabled: !!file });

  // Check if current user is the file owner
  const isOwner = useMemo(() => {
    if (!file || !user) return false;
    return file.uploader_id === user.id;
  }, [file, user]);

  // Determine file type
  const isImage = file?.content_type?.startsWith('image/') ?? false;
  const isVideo = file?.content_type?.startsWith('video/') ?? false;

  // Format file size
  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  // Format date
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Format activity date
  const formatActivityDate = useCallback((dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    return `${year}年${month}月${day}日`;
  }, []);

  // Handle delete - opens delete confirmation modal
  const handleDelete = useCallback(() => {
    if (!file) return;
    setShowDeleteModal(true);
  }, [file]);

  // Handle delete success
  const handleDeleteSuccess = useCallback(() => {
    router.back();
  }, [router]);

  // Handle edit - opens edit modal
  const handleEdit = useCallback(() => {
    if (!file) return;
    setShowEditModal(true);
  }, [file]);

  // Handle edit success
  const handleEditSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle request edit (for non-owners) - opens modal
  const handleRequestEdit = useCallback(() => {
    if (!file) return;
    setShowRequestModal(true);
  }, [file]);

  // Get poster URL for video
  const videoPosterUrl = useMemo(() => {
    if (!file?.s3_key || !isVideo) return undefined;
    return `${S3_BASE_URL}/${file.s3_key}?frame=100&w=800`;
  }, [file?.s3_key, isVideo]);

  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const borderColor = colorScheme === 'dark' ? '#2c2c2e' : '#e5e5e5';
  const cardBackground = colorScheme === 'dark' ? '#1c1c1e' : '#fff';

  // Invalid file ID
  if (isNaN(fileId) || fileId <= 0) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: '文件详情' }} />
        <View style={styles.errorContainer}>
          <Icon name="warning" size={48} color="#f97316" />
          <ThemedText style={styles.errorTitle}>无效的文件ID</ThemedText>
          <ThemedText style={[styles.errorMessage, { color: secondaryTextColor }]}>
            请检查链接是否正确
          </ThemedText>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.backButtonText}>返回</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: '加载中...' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
            加载文件信息...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Error state
  if (isError || !file) {
    const errorMessage = error instanceof Error ? error.message : '加载失败';
    const isNotFound = errorMessage.includes('404') || errorMessage.includes('not found');
    
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: '错误' }} />
        <View style={styles.errorContainer}>
          <Icon name={isNotFound ? 'search' : 'warning'} size={48} color="#f97316" />
          <ThemedText style={styles.errorTitle}>
            {isNotFound ? '文件不存在' : '加载失败'}
          </ThemedText>
          <ThemedText style={[styles.errorMessage, { color: secondaryTextColor }]}>
            {isNotFound ? '该文件可能已被删除' : errorMessage}
          </ThemedText>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetch()}
            >
              <ThemedText style={styles.retryButtonText}>重试</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backButton, { marginLeft: 12 }]}
              onPress={() => router.back()}
            >
              <ThemedText style={styles.backButtonText}>返回</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: file.filename,
          headerBackTitle: '返回',
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors[colorScheme].tint}
          />
        }
      >
        {/* Preview Section */}
        <View style={styles.previewSection}>
          {isImage && (
            <ImageViewer
              s3Key={file.s3_key}
              alt={file.filename}
            />
          )}
          {isVideo && (
            <VideoPlayer
              url={file.public_url}
              filename={file.filename}
              posterUrl={videoPosterUrl}
            />
          )}
          {!isImage && !isVideo && (
            <View style={[styles.genericPreview, { backgroundColor: borderColor }]}>
              <Icon name="file" size={64} color={secondaryTextColor} />
              <ThemedText style={styles.genericText}>
                无法预览此文件类型
              </ThemedText>
            </View>
          )}
        </View>

        {/* Adjacent Files Navigation */}
        {(hasPrevious || hasNext) && (
          <View style={[styles.navBar, { backgroundColor: cardBackground, borderColor }]}>
            <TouchableOpacity
              style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
              onPress={goToPrevious}
              disabled={!hasPrevious}
            >
              <ThemedText style={[styles.navIcon, !hasPrevious && styles.navIconDisabled]}>
                ◀
              </ThemedText>
              <ThemedText style={[styles.navText, !hasPrevious && { color: secondaryTextColor }]}>
                上一个
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
              onPress={goToNext}
              disabled={!hasNext}
            >
              <ThemedText style={[styles.navText, !hasNext && { color: secondaryTextColor }]}>
                下一个
              </ThemedText>
              <ThemedText style={[styles.navIcon, !hasNext && styles.navIconDisabled]}>
                ▶
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Metadata Section */}
        <View style={[styles.metadataCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.sectionTitle}>文件信息</ThemedText>
          
          {/* Filename */}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
              文件名
            </ThemedText>
            <ThemedText style={styles.metaValue} numberOfLines={2}>
              {file.filename}
            </ThemedText>
          </View>

          {/* Size */}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
              大小
            </ThemedText>
            <ThemedText style={styles.metaValue}>
              {formatSize(file.size)}
            </ThemedText>
          </View>

          {/* Upload Date */}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
              上传时间
            </ThemedText>
            <ThemedText style={styles.metaValue}>
              {formatDate(file.uploaded_at)}
            </ThemedText>
          </View>

          {/* Activity Date */}
          {file.activity_date && (
            <View style={styles.metaRow}>
              <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
                活动日期
              </ThemedText>
              <ThemedText style={styles.metaValue}>
                {formatActivityDate(file.activity_date)}
              </ThemedText>
            </View>
          )}

          {/* Activity Type */}
          {file.activity_type_display && (
            <View style={styles.metaRow}>
              <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
                活动类型
              </ThemedText>
              <ThemedText style={styles.metaValue}>
                {file.activity_type_display}
              </ThemedText>
            </View>
          )}

          {/* Activity Name */}
          {file.activity_name && (
            <View style={styles.metaRow}>
              <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
                活动名称
              </ThemedText>
              <ThemedText style={styles.metaValue}>
                {file.activity_name}
              </ThemedText>
            </View>
          )}

          {/* Uploader */}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
              上传者
            </ThemedText>
            <ThemedText style={styles.metaValue}>
              {file.uploader?.name || '-'}
              {isOwner && ' (我)'}
            </ThemedText>
          </View>

          {/* Tags */}
          <View style={styles.tagsSection}>
            <ThemedText style={[styles.metaLabel, { color: secondaryTextColor }]}>
              标签
            </ThemedText>
            <View style={styles.tagsContainer}>
              {file.free_tags && file.free_tags.length > 0 ? (
                file.free_tags.map((tag: FreeTag) => (
                  <View key={tag.id} style={styles.tag}>
                    <ThemedText style={styles.tagText}>{tag.name}</ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText style={[styles.noTagsText, { color: secondaryTextColor }]}>
                  无标签
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        {/* Actions Section */}
        <View style={[styles.actionsCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText style={styles.sectionTitle}>操作</ThemedText>
          
          {isOwner ? (
            // Owner actions: Edit and Delete
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={handleEdit}
              >
                <View style={styles.actionButtonContent}>
                  <Icon name="edit" size={18} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>编辑</ThemedText>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <View style={styles.actionButtonContent}>
                  <Icon name="delete" size={18} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>删除</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            // Non-owner action: Request Edit
            <TouchableOpacity
              style={[styles.actionButton, styles.requestButton]}
              onPress={handleRequestEdit}
            >
              <View style={styles.actionButtonContent}>
                <Icon name="edit" size={18} color="#fff" />
                <ThemedText style={styles.actionButtonText}>请求编辑</ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Create Request Modal */}
      {file && (
        <CreateRequestModal
          visible={showRequestModal}
          file={file}
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['requests'] });
          }}
        />
      )}

      {/* Edit File Modal */}
      {file && (
        <EditFileModal
          visible={showEditModal}
          file={file}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirm Modal */}
      {file && (
        <DeleteConfirmModal
          visible={showDeleteModal}
          file={file}
          onClose={() => setShowDeleteModal(false)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6b7280',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  previewSection: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  genericPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genericText: {
    fontSize: 14,
    opacity: 0.6,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navIcon: {
    fontSize: 16,
    color: '#f97316',
  },
  navIconDisabled: {
    color: '#9ca3af',
  },
  navText: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  metadataCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  metaLabel: {
    fontSize: 14,
    flex: 1,
  },
  metaValue: {
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  tagsSection: {
    paddingTop: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 13,
    color: '#f97316',
  },
  noTagsText: {
    fontSize: 13,
  },
  actionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  requestButton: {
    backgroundColor: '#f97316',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
