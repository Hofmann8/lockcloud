/**
 * RequestCard Component
 * 
 * Displays a file edit request with details, file info, and action buttons.
 * Follows the Web frontend implementation (lockcloud-frontend/app/(dashboard)/requests/page.tsx).
 * 
 * Features:
 * - Request type badge (编辑/删除/目录编辑)
 * - Status badge (待处理/已批准/已拒绝)
 * - File/directory information
 * - Proposed changes display
 * - Message and response display
 * - Approve/Reject buttons for owners
 * 
 * Requirements: 8.5
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { FileRequest } from '@/types';

interface RequestCardProps {
  request: FileRequest;
  isReceived: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  isProcessing?: boolean;
}

/**
 * RequestCard - Displays a single file request
 * 
 * Requirements: 8.5
 */
export function RequestCard({
  request,
  isReceived,
  onApprove,
  onReject,
  isProcessing = false,
}: RequestCardProps) {
  const colorScheme = useColorScheme() ?? 'light';

  // Theme colors
  const cardBackground = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#2c2c2e' : '#e5e5e5';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const detailsBackground = colorScheme === 'dark' ? '#2c2c2e' : '#f9fafb';

  // Status colors and labels
  const statusConfig = {
    pending: { bg: '#fef3c7', text: '#d97706', label: '待处理' },
    approved: { bg: '#d1fae5', text: '#059669', label: '已批准' },
    rejected: { bg: '#fee2e2', text: '#dc2626', label: '已拒绝' },
  };

  // Type colors and labels
  const typeConfig = {
    edit: { bg: '#dbeafe', text: '#2563eb', label: '编辑请求' },
    delete: { bg: '#fee2e2', text: '#dc2626', label: '删除请求' },
    directory_edit: { bg: '#f3e8ff', text: '#9333ea', label: '目录编辑' },
  };

  const status = statusConfig[request.status];
  const type = typeConfig[request.request_type];

  // Format date
  const formatDate = useCallback((dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Get target name (file or directory)
  const getTargetName = useCallback((): React.ReactNode => {
    if (request.request_type === 'directory_edit' && request.directory_info) {
      return (
        <View style={styles.targetNameRow}>
          <Icon name="folder" size={14} color={colorScheme === 'dark' ? '#fff' : '#000'} />
          <ThemedText style={styles.targetNameText}>{request.directory_info.activity_name}</ThemedText>
        </View>
      );
    }
    return request.file?.filename || '文件已删除';
  }, [request, colorScheme]);

  // Handle approve with confirmation
  const handleApprove = useCallback(() => {
    if (!onApprove) return;
    
    Alert.alert(
      '确认批准',
      '确定要批准此请求吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '批准',
          onPress: () => onApprove(request.id),
        },
      ]
    );
  }, [onApprove, request.id]);

  // Handle reject with confirmation
  const handleReject = useCallback(() => {
    if (!onReject) return;
    
    Alert.alert(
      '确认拒绝',
      '确定要拒绝此请求吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '拒绝',
          style: 'destructive',
          onPress: () => onReject(request.id),
        },
      ]
    );
  }, [onReject, request.id]);

  return (
    <View style={[styles.card, { backgroundColor: cardBackground, borderColor }]}>
      {/* Header: Type and Status badges */}
      <View style={styles.header}>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: type.bg }]}>
            <ThemedText style={[styles.badgeText, { color: type.text }]}>
              {type.label}
            </ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <ThemedText style={[styles.badgeText, { color: status.text }]}>
              {status.label}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Target name */}
      <ThemedText style={styles.targetName} numberOfLines={2}>
        {getTargetName()}
      </ThemedText>

      {/* Directory info for directory_edit requests */}
      {request.request_type === 'directory_edit' && request.directory_info && (
        <ThemedText style={[styles.directoryInfo, { color: secondaryTextColor }]}>
          {request.directory_info.activity_date} · {request.directory_info.activity_type}
        </ThemedText>
      )}

      {/* Requester/Owner info */}
      <ThemedText style={[styles.metaInfo, { color: secondaryTextColor }]}>
        {isReceived 
          ? `来自: ${request.requester?.name || '未知用户'}` 
          : `发送给: ${request.owner?.name || '未知用户'}`}
        <ThemedText style={{ color: secondaryTextColor }}> · </ThemedText>
        {formatDate(request.created_at)}
      </ThemedText>

      {/* Proposed changes for edit requests */}
      {request.request_type === 'edit' && request.proposed_changes && (
        <View style={[styles.detailsBox, { backgroundColor: detailsBackground }]}>
          <ThemedText style={[styles.detailsLabel, { color: secondaryTextColor }]}>
            修改内容:
          </ThemedText>
          {request.proposed_changes.filename && (
            <ThemedText style={styles.detailsItem}>
              文件名: {request.proposed_changes.filename}
            </ThemedText>
          )}
          {request.proposed_changes.activity_date && (
            <ThemedText style={styles.detailsItem}>
              活动日期: {request.proposed_changes.activity_date}
            </ThemedText>
          )}
          {request.proposed_changes.activity_type && (
            <ThemedText style={styles.detailsItem}>
              活动类型: {request.proposed_changes.activity_type}
            </ThemedText>
          )}
          {request.proposed_changes.activity_name && (
            <ThemedText style={styles.detailsItem}>
              活动名称: {request.proposed_changes.activity_name}
            </ThemedText>
          )}
          {request.proposed_changes.instructor && (
            <ThemedText style={styles.detailsItem}>
              带训老师: {request.proposed_changes.instructor}
            </ThemedText>
          )}
          {request.proposed_changes.free_tags && request.proposed_changes.free_tags.length > 0 && (
            <ThemedText style={styles.detailsItem}>
              标签: {request.proposed_changes.free_tags.join(', ')}
            </ThemedText>
          )}
        </View>
      )}

      {/* Proposed changes for directory_edit requests */}
      {request.request_type === 'directory_edit' && request.proposed_changes && (
        <View style={[styles.detailsBox, { backgroundColor: detailsBackground }]}>
          <ThemedText style={[styles.detailsLabel, { color: secondaryTextColor }]}>
            修改内容:
          </ThemedText>
          {request.proposed_changes.new_activity_name && (
            <ThemedText style={styles.detailsItem}>
              新活动名称: {request.proposed_changes.new_activity_name}
            </ThemedText>
          )}
          {request.proposed_changes.new_activity_type && (
            <ThemedText style={styles.detailsItem}>
              新活动类型: {request.proposed_changes.new_activity_type}
            </ThemedText>
          )}
        </View>
      )}

      {/* Message */}
      {request.message && (
        <View style={[styles.detailsBox, { backgroundColor: detailsBackground }]}>
          <ThemedText style={[styles.detailsLabel, { color: secondaryTextColor }]}>
            留言:
          </ThemedText>
          <ThemedText style={styles.detailsItem}>{request.message}</ThemedText>
        </View>
      )}

      {/* Response message */}
      {request.response_message && (
        <View style={[styles.detailsBox, { backgroundColor: detailsBackground }]}>
          <ThemedText style={[styles.detailsLabel, { color: secondaryTextColor }]}>
            回复:
          </ThemedText>
          <ThemedText style={styles.detailsItem}>{request.response_message}</ThemedText>
        </View>
      )}

      {/* Actions for pending received requests */}
      {isReceived && request.status === 'pending' && onApprove && onReject && (
        <View style={[styles.actions, { borderTopColor: borderColor }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={handleApprove}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.actionButtonText}>批准</ThemedText>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.actionButtonText}>拒绝</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  targetName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  directoryInfo: {
    fontSize: 12,
    marginBottom: 4,
  },
  metaInfo: {
    fontSize: 12,
    marginBottom: 10,
  },
  detailsBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailsItem: {
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  targetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetNameText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
