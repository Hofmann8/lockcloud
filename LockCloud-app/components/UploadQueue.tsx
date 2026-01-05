/**
 * Upload Queue Component
 * 
 * Displays the upload queue with progress, status, and retry/cancel options.
 * 
 * Requirements: 5.7, 5.8, 5.9
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Icon } from './ui/Icon';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useUploadQueueStore } from '@/stores/uploadQueueStore';
import { UploadQueueItem, UploadStatus } from '@/types';

/**
 * Format file size for display
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * Format time ago
 */
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
};

/**
 * Status badge colors and labels
 */
const STATUS_CONFIG: Record<UploadStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '等待中', color: '#6b7280', bgColor: '#f3f4f6' },
  uploading: { label: '上传中', color: '#3b82f6', bgColor: '#dbeafe' },
  success: { label: '已完成', color: '#10b981', bgColor: '#d1fae5' },
  error: { label: '失败', color: '#ef4444', bgColor: '#fee2e2' },
};

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: UploadStatus }) {
  const config = STATUS_CONFIG[status];
  
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
      <ThemedText style={[styles.statusText, { color: config.color }]}>
        {config.label}
      </ThemedText>
    </View>
  );
}

/**
 * Progress Bar Component
 */
function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, Math.max(0, progress))}%` },
          ]}
        />
      </View>
      <ThemedText style={styles.progressText}>{progress}%</ThemedText>
    </View>
  );
}

/**
 * Queue Item Component
 */
function QueueItem({ item }: { item: UploadQueueItem }) {
  const removeItem = useUploadQueueStore((state) => state.removeItem);
  const retryItem = useUploadQueueStore((state) => state.retryItem);

  const borderColor = useThemeColor({ light: '#e5e5e5', dark: '#333' }, 'background');

  return (
    <View style={[styles.queueItem, { borderColor }]}>
      {/* Header Row */}
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <ThemedText style={styles.itemFilename} numberOfLines={1}>
            {item.filename}
          </ThemedText>
          <ThemedText style={styles.itemMeta}>
            {formatFileSize(item.size)} · {formatTimeAgo(item.createdAt)}
          </ThemedText>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {/* Metadata Row */}
      <View style={styles.metadataRow}>
        <ThemedText style={styles.metadataText}>
          {item.metadata.activity_type}
          {item.metadata.activity_name && ` · ${item.metadata.activity_name}`}
        </ThemedText>
        <ThemedText style={styles.metadataDate}>
          {item.metadata.activity_date}
        </ThemedText>
      </View>

      {/* Progress Bar (when uploading) */}
      {item.status === 'uploading' && <ProgressBar progress={item.progress} />}

      {/* Error Message */}
      {item.status === 'error' && item.error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{item.error}</ThemedText>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {item.status === 'error' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={() => retryItem(item.id)}
          >
            <ThemedText style={styles.retryButtonText}>重试</ThemedText>
          </TouchableOpacity>
        )}
        
        {(item.status === 'error' || item.status === 'success' || item.status === 'pending') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => removeItem(item.id)}
          >
            <ThemedText style={styles.removeButtonText}>
              {item.status === 'success' ? '移除' : '取消'}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Upload Queue Component
 */
export function UploadQueue() {
  const items = useUploadQueueStore((state) => state.items);
  const isProcessing = useUploadQueueStore((state) => state.isProcessing);
  const clearCompleted = useUploadQueueStore((state) => state.clearCompleted);

  const borderColor = useThemeColor({ light: '#e5e5e5', dark: '#333' }, 'background');
  const accentColor = '#10b981';

  const hasItems = items.length > 0;
  const hasCompleted = items.some((item) => item.status === 'success');
  const uploadingCount = items.filter((item) => item.status === 'uploading').length;
  const pendingCount = items.filter((item) => item.status === 'pending').length;

  return (
    <ThemedView style={[styles.container, { borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.headerTitle}>上传队列</ThemedText>
          {hasItems && (
            <View style={[styles.countBadge, { backgroundColor: accentColor }]}>
              <ThemedText style={styles.countText}>{items.length}</ThemedText>
            </View>
          )}
          {isProcessing && (
            <ActivityIndicator size="small" color={accentColor} style={styles.spinner} />
          )}
        </View>

        {hasCompleted && (
          <TouchableOpacity onPress={clearCompleted}>
            <ThemedText style={styles.clearButton}>清除已完成</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Summary */}
      {hasItems && (uploadingCount > 0 || pendingCount > 0) && (
        <View style={styles.statusSummary}>
          {uploadingCount > 0 && (
            <ThemedText style={styles.statusSummaryText}>
              {uploadingCount} 个上传中
            </ThemedText>
          )}
          {uploadingCount > 0 && pendingCount > 0 && (
            <ThemedText style={styles.statusSummaryDivider}>·</ThemedText>
          )}
          {pendingCount > 0 && (
            <ThemedText style={styles.statusSummaryText}>
              {pendingCount} 个等待中
            </ThemedText>
          )}
        </View>
      )}

      {/* Queue List */}
      <ScrollView
        style={styles.queueList}
        contentContainerStyle={styles.queueListContent}
        showsVerticalScrollIndicator={false}
      >
        {!hasItems ? (
          <View style={styles.emptyState}>
            <Icon name="upload" size={48} color="#9ca3af" />
            <ThemedText style={styles.emptyText}>暂无上传任务</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              选择文件后将显示在这里
            </ThemedText>
          </View>
        ) : (
          items.map((item) => <QueueItem key={item.id} item={item} />)
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 8,
  },
  clearButton: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  statusSummaryText: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusSummaryDivider: {
    fontSize: 12,
    color: '#6b7280',
    marginHorizontal: 8,
  },
  queueList: {
    flex: 1,
  },
  queueListContent: {
    padding: 12,
    gap: 12,
  },
  queueItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemFilename: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataText: {
    fontSize: 12,
    color: '#6b7280',
  },
  metadataDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
    width: 40,
    textAlign: 'right',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: '#f3f4f6',
  },
  removeButtonText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});

export default UploadQueue;
