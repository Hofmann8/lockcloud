/**
 * EditFileModal Component
 * 
 * Modal for editing file metadata including activity date, type, name, and tags.
 * For file owners: directly updates the file
 * For non-owners: sends an edit request to the owner
 * 
 * Follows the Web frontend implementation (lockcloud-frontend/components/EditFileDialog.tsx)
 * 
 * Requirements: 4.5, 6.3
 */

import { useState, useCallback, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { TagEditor } from '@/components/TagEditor';
import { updateFile } from '@/lib/api/files';
import { createRequest } from '@/lib/api/requests';
import { getTagPresets } from '@/lib/api/tagPresets';
import { File, UpdateFileData, TagPreset } from '@/types';
import { useAuthStore } from '@/stores/authStore';

interface EditFileModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** File to edit */
  file: File | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when edit is successful */
  onSuccess?: () => void;
}

/**
 * EditFileModal - Modal for editing file metadata
 * 
 * Requirements: 4.5, 6.3
 */
export function EditFileModal({
  visible,
  file,
  onClose,
  onSuccess,
}: EditFileModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // Check ownership
  const isOwner = file && user ? file.uploader_id === user.id : false;
  const isAdmin = user?.is_admin || false;
  const canDirectEdit = isOwner || isAdmin;

  // Form state
  const [activityDate, setActivityDate] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityName, setActivityName] = useState('');
  const [freeTags, setFreeTags] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Reset form when file changes
  useEffect(() => {
    if (file && visible) {
      setActivityDate(file.activity_date || '');
      setActivityType(file.activity_type || '');
      setActivityName(file.activity_name || '');
      setFreeTags(file.free_tags?.map(t => t.name) || []);
    }
  }, [file, visible]);

  // Fetch activity type presets
  const { data: activityTypePresets = [] } = useQuery({
    queryKey: ['tagPresets', 'activity_type'],
    queryFn: () => getTagPresets('activity_type'),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Update mutation (for owners)
  const updateMutation = useMutation({
    mutationFn: (data: UpdateFileData) => updateFile(file!.id, data),
    onSuccess: () => {
      Alert.alert('成功', '文件信息已更新');
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['file', file?.id] });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      Alert.alert('错误', error.message || '更新失败，请重试');
    },
  });

  // Request mutation (for non-owners)
  const requestMutation = useMutation({
    mutationFn: (data: UpdateFileData) =>
      createRequest({
        file_id: file!.id,
        request_type: 'edit',
        proposed_changes: data,
      }),
    onSuccess: () => {
      Alert.alert('成功', '修改请求已发送给文件上传者');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    },
    onError: (error: Error) => {
      Alert.alert('错误', error.message || '发送请求失败，请重试');
    },
  });

  // Handle date change
  const handleDateChange = useCallback((_event: unknown, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setActivityDate(`${year}-${month}-${day}`);
    }
  }, []);

  // Handle activity type selection
  const handleTypeSelect = useCallback((preset: TagPreset) => {
    setActivityType(preset.value);
    setShowTypePicker(false);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!file) return;

    const updates: UpdateFileData = {};
    
    if (activityDate && activityDate !== file.activity_date) {
      updates.activity_date = activityDate;
    }
    if (activityType && activityType !== file.activity_type) {
      updates.activity_type = activityType;
    }
    if (activityName !== (file.activity_name || '')) {
      updates.activity_name = activityName || undefined;
    }
    
    // Check if tags changed
    const originalTags = file.free_tags?.map(t => t.name) || [];
    const tagsChanged = freeTags.length !== originalTags.length || 
      freeTags.some(t => !originalTags.includes(t)) ||
      originalTags.some(t => !freeTags.includes(t));
    if (tagsChanged) {
      updates.free_tags = freeTags;
    }

    // No changes
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    if (canDirectEdit) {
      updateMutation.mutate(updates);
    } else {
      requestMutation.mutate(updates);
    }
  }, [file, activityDate, activityType, activityName, freeTags, canDirectEdit, updateMutation, requestMutation, onClose]);

  // Format date for display
  const formatDisplayDate = useCallback((dateStr: string): string => {
    if (!dateStr) return '请选择日期';
    const [year, month, day] = dateStr.split('-');
    return `${year}年${month}月${day}日`;
  }, []);

  // Get display name for activity type
  const getActivityTypeDisplay = useCallback((value: string): string => {
    const preset = activityTypePresets.find(p => p.value === value);
    return preset?.display_name || value || '请选择类型';
  }, [activityTypePresets]);

  const isPending = updateMutation.isPending || requestMutation.isPending;

  // Theme colors
  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const inputBackground = colorScheme === 'dark' ? '#2c2c2e' : '#f5f5f5';

  if (!file) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            disabled={isPending}
          >
            <ThemedText style={[styles.headerButtonText, { color: secondaryTextColor }]}>
              取消
            </ThemedText>
          </TouchableOpacity>
          
          <ThemedText style={styles.headerTitle}>
            {canDirectEdit ? '编辑文件' : '请求修改'}
          </ThemedText>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                {canDirectEdit ? '保存' : '发送'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* File Info Banner */}
          <View style={[styles.fileBanner, { backgroundColor: inputBackground }]}>
            <View style={styles.fileIcon}>
              <Icon name="file" size={24} color="#f97316" />
            </View>
            <View style={styles.fileInfo}>
              <ThemedText style={styles.fileName} numberOfLines={1}>
                {file.filename}
              </ThemedText>
              <ThemedText style={[styles.fileUploader, { color: secondaryTextColor }]}>
                上传者: {file.uploader?.name || '未知'}
              </ThemedText>
            </View>
          </View>

          {/* Non-owner warning */}
          {!canDirectEdit && (
            <View style={styles.warningBanner}>
              <Icon name="warning" size={16} color="#92400e" />
              <ThemedText style={styles.warningText}>
                您不是此文件的上传者，修改将发送给上传者审批
              </ThemedText>
            </View>
          )}

          {/* Activity Date */}
          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              活动日期
            </ThemedText>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText style={[styles.inputText, { color: activityDate ? textColor : secondaryTextColor }]}>
                {formatDisplayDate(activityDate)}
              </ThemedText>
              <Icon name="calendar" size={16} color={secondaryTextColor} />
            </TouchableOpacity>
          </View>

          {/* Activity Type */}
          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              活动类型
            </ThemedText>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
              onPress={() => setShowTypePicker(true)}
            >
              <ThemedText style={[styles.inputText, { color: activityType ? textColor : secondaryTextColor }]}>
                {getActivityTypeDisplay(activityType)}
              </ThemedText>
              <ThemedText style={styles.inputIcon}>▼</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Activity Name */}
          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              活动名称
            </ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: inputBackground, borderColor, color: textColor }]}
              value={activityName}
              onChangeText={setActivityName}
              placeholder="例如：周末团建、新年晚会"
              placeholderTextColor={secondaryTextColor}
              maxLength={200}
            />
          </View>

          {/* Tags */}
          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              自由标签
            </ThemedText>
            <TagEditor
              tags={freeTags}
              onTagsChange={setFreeTags}
            />
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={activityDate ? new Date(activityDate) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Activity Type Picker Modal */}
        <Modal
          visible={showTypePicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowTypePicker(false)}
        >
          <SafeAreaView style={[styles.pickerContainer, { backgroundColor }]} edges={['top']}>
            <View style={[styles.pickerHeader, { borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                <ThemedText style={[styles.headerButtonText, { color: secondaryTextColor }]}>
                  取消
                </ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.headerTitle}>选择活动类型</ThemedText>
              <View style={styles.headerButton} />
            </View>
            <ScrollView style={styles.pickerList}>
              {activityTypePresets.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: borderColor },
                    activityType === preset.value && styles.pickerItemSelected,
                  ]}
                  onPress={() => handleTypeSelect(preset)}
                >
                  <ThemedText style={[
                    styles.pickerItemText,
                    activityType === preset.value && styles.pickerItemTextSelected,
                  ]}>
                    {preset.display_name}
                  </ThemedText>
                  {activityType === preset.value && (
                    <Icon name="check" size={18} color="#f97316" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  fileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
  },
  fileUploader: {
    fontSize: 13,
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputText: {
    fontSize: 16,
    flex: 1,
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerList: {
    flex: 1,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemSelected: {
    backgroundColor: '#fff7ed',
  },
  pickerItemText: {
    fontSize: 16,
  },
  pickerItemTextSelected: {
    color: '#f97316',
    fontWeight: '500',
  },
});

export default EditFileModal;
