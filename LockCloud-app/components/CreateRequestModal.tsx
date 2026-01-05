/**
 * CreateRequestModal Component
 * 
 * Modal for creating file edit/delete requests.
 * Allows users to request changes to files they don't own.
 * 
 * Features:
 * - Request type selection (edit/delete)
 * - Proposed changes input for edit requests
 * - Message input
 * - Submit request
 * 
 * Requirements: 8.1
 */

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { createRequest } from '@/lib/api/requests';
import { File, CreateRequestData, ProposedChanges } from '@/types';

type RequestType = 'edit' | 'delete';

interface CreateRequestModalProps {
  visible: boolean;
  file: File;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * CreateRequestModal - Modal for creating file requests
 * 
 * Requirements: 8.1
 */
export function CreateRequestModal({
  visible,
  file,
  onClose,
  onSuccess,
}: CreateRequestModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const queryClient = useQueryClient();

  // Form state
  const [requestType, setRequestType] = useState<RequestType>('edit');
  const [message, setMessage] = useState('');
  
  // Proposed changes for edit requests
  const [proposedFilename, setProposedFilename] = useState('');
  const [proposedActivityDate, setProposedActivityDate] = useState('');
  const [proposedActivityType, setProposedActivityType] = useState('');
  const [proposedActivityName, setProposedActivityName] = useState('');
  const [proposedTags, setProposedTags] = useState('');

  // Theme colors
  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const overlayColor = 'rgba(0, 0, 0, 0.5)';
  const borderColor = colorScheme === 'dark' ? '#2c2c2e' : '#e5e5e5';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const inputBackground = colorScheme === 'dark' ? '#2c2c2e' : '#f9fafb';
  const placeholderColor = colorScheme === 'dark' ? '#636366' : '#9ca3af';

  // Create request mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRequestData) => createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      Alert.alert('成功', '请求已发送', [
        { text: '确定', onPress: handleClose },
      ]);
      onSuccess?.();
    },
    onError: (error: Error) => {
      Alert.alert('错误', error.message || '发送请求失败，请重试');
    },
  });

  // Reset form
  const resetForm = useCallback(() => {
    setRequestType('edit');
    setMessage('');
    setProposedFilename('');
    setProposedActivityDate('');
    setProposedActivityType('');
    setProposedActivityName('');
    setProposedTags('');
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    // Build proposed changes for edit requests
    let proposedChanges: ProposedChanges | undefined;
    
    if (requestType === 'edit') {
      proposedChanges = {};
      
      if (proposedFilename.trim()) {
        proposedChanges.filename = proposedFilename.trim();
      }
      if (proposedActivityDate.trim()) {
        proposedChanges.activity_date = proposedActivityDate.trim();
      }
      if (proposedActivityType.trim()) {
        proposedChanges.activity_type = proposedActivityType.trim();
      }
      if (proposedActivityName.trim()) {
        proposedChanges.activity_name = proposedActivityName.trim();
      }
      if (proposedTags.trim()) {
        proposedChanges.free_tags = proposedTags.split(',').map(t => t.trim()).filter(Boolean);
      }

      // Check if any changes were proposed
      if (Object.keys(proposedChanges).length === 0) {
        Alert.alert('提示', '请至少填写一项修改内容');
        return;
      }
    }

    const data: CreateRequestData = {
      file_id: file.id,
      request_type: requestType,
      proposed_changes: proposedChanges,
      message: message.trim() || undefined,
    };

    createMutation.mutate(data);
  }, [
    requestType,
    message,
    proposedFilename,
    proposedActivityDate,
    proposedActivityType,
    proposedActivityName,
    proposedTags,
    file.id,
    createMutation,
  ]);

  const isSubmitting = createMutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: overlayColor }]}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <View style={[styles.modal, { backgroundColor }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
              <ThemedText style={styles.cancelText}>取消</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.title}>创建请求</ThemedText>
            <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <ThemedText style={styles.submitText}>发送</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* File info */}
            <View style={[styles.fileInfo, { backgroundColor: inputBackground }]}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                目标文件
              </ThemedText>
              <ThemedText style={styles.filename} numberOfLines={2}>
                {file.filename}
              </ThemedText>
            </View>

            {/* Request type selection */}
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                请求类型
              </ThemedText>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    { borderColor },
                    requestType === 'edit' && styles.typeButtonActive,
                  ]}
                  onPress={() => setRequestType('edit')}
                >
                  <View style={styles.typeButtonContent}>
                    <Icon name="edit" size={16} color={requestType === 'edit' ? '#2563eb' : secondaryTextColor} />
                    <ThemedText
                      style={[
                        styles.typeButtonText,
                        requestType === 'edit' && styles.typeButtonTextActive,
                      ]}
                    >
                      编辑
                    </ThemedText>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    { borderColor },
                    requestType === 'delete' && styles.typeButtonActiveDelete,
                  ]}
                  onPress={() => setRequestType('delete')}
                >
                  <View style={styles.typeButtonContent}>
                    <Icon name="delete" size={16} color={requestType === 'delete' ? '#dc2626' : secondaryTextColor} />
                    <ThemedText
                      style={[
                        styles.typeButtonText,
                        requestType === 'delete' && styles.typeButtonTextActiveDelete,
                      ]}
                    >
                      删除
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Proposed changes for edit requests */}
            {requestType === 'edit' && (
              <View style={styles.section}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  修改内容 (至少填写一项)
                </ThemedText>
                
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
                  placeholder="新文件名"
                  placeholderTextColor={placeholderColor}
                  value={proposedFilename}
                  onChangeText={setProposedFilename}
                />
                
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
                  placeholder="活动日期 (YYYY-MM-DD)"
                  placeholderTextColor={placeholderColor}
                  value={proposedActivityDate}
                  onChangeText={setProposedActivityDate}
                />
                
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
                  placeholder="活动类型"
                  placeholderTextColor={placeholderColor}
                  value={proposedActivityType}
                  onChangeText={setProposedActivityType}
                />
                
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
                  placeholder="活动名称"
                  placeholderTextColor={placeholderColor}
                  value={proposedActivityName}
                  onChangeText={setProposedActivityName}
                />
                
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
                  placeholder="标签 (逗号分隔)"
                  placeholderTextColor={placeholderColor}
                  value={proposedTags}
                  onChangeText={setProposedTags}
                />
              </View>
            )}

            {/* Delete warning */}
            {requestType === 'delete' && (
              <View style={[styles.warningBox, { backgroundColor: '#fef2f2' }]}>
                <View style={styles.warningContent}>
                  <Icon name="warning" size={16} color="#dc2626" />
                  <ThemedText style={styles.warningText}>
                    删除请求将请求文件所有者删除此文件。此操作不可撤销。
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Message */}
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                留言 (可选)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: inputBackground, borderColor },
                ]}
                placeholder="请说明请求原因..."
                placeholderTextColor={placeholderColor}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cancelText: {
    fontSize: 16,
    color: '#6b7280',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  fileInfo: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  filename: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  typeButtonActiveDelete: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeButtonTextActive: {
    color: '#2563eb',
  },
  typeButtonTextActiveDelete: {
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  warningBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#dc2626',
    lineHeight: 18,
    flex: 1,
  },
});
