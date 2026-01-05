/**
 * Upload Form Component
 * 
 * Form for entering upload metadata including activity date, type, and name.
 * References backend /api/files/upload-url interface requirements.
 * 
 * Requirements: 5.5, 5.6, 7.2
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Icon } from './ui/Icon';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getTagPresets } from '@/lib/api/tagPresets';
import { TagPreset, UploadMetadata } from '@/types';
import { SelectedFile } from './FilePicker';

interface UploadFormProps {
  selectedFiles: SelectedFile[];
  onSubmit: (metadata: UploadMetadata) => void;
  isSubmitting?: boolean;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function UploadForm({
  selectedFiles,
  onSubmit,
  isSubmitting = false,
}: UploadFormProps) {
  // Safe area insets for modal
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  
  // Form state
  const [activityDate, setActivityDate] = useState<Date>(new Date());
  const [activityDateText, setActivityDateText] = useState<string>(formatDateToISO(new Date()));
  const [activityType, setActivityType] = useState<string>('');
  const [activityName, setActivityName] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>('');
  
  // UI state
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activityTypes, setActivityTypes] = useState<TagPreset[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  
  // Validation state
  const [errors, setErrors] = useState<{
    activityDate?: string;
    activityType?: string;
    activityName?: string;
  }>({});

  // Theme colors
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#e5e5e5', dark: '#333' }, 'background');
  const accentColor = '#10b981';
  const errorColor = '#ef4444';

  /**
   * Load activity type presets from API
   */
  useEffect(() => {
    const loadActivityTypes = async () => {
      try {
        setIsLoadingTypes(true);
        const presets = await getTagPresets('activity_type');
        setActivityTypes(presets.filter((p) => p.is_active));
      } catch (error) {
        console.error('Failed to load activity types:', error);
        Alert.alert('加载失败', '无法加载活动类型，请重试');
      } finally {
        setIsLoadingTypes(false);
      }
    };

    loadActivityTypes();
  }, []);

  /**
   * Handle date text change - allow free editing
   */
  const handleDateChange = (text: string) => {
    setActivityDateText(text);
    // Try to parse the date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(text)) {
      const parsedDate = new Date(text + 'T00:00:00');
      if (!isNaN(parsedDate.getTime())) {
        setActivityDate(parsedDate);
        if (errors.activityDate) {
          setErrors((prev) => ({ ...prev, activityDate: undefined }));
        }
      }
    }
  };

  /**
   * Handle date picker change
   */
  const handleDatePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setActivityDate(selectedDate);
      setActivityDateText(formatDateToISO(selectedDate));
      if (errors.activityDate) {
        setErrors((prev) => ({ ...prev, activityDate: undefined }));
      }
    }
  };

  /**
   * Validate form before submission
   */
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Validate date format and value
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!activityDateText || !dateRegex.test(activityDateText)) {
      newErrors.activityDate = '请输入正确的日期格式 (YYYY-MM-DD)';
    } else {
      const parsedDate = new Date(activityDateText + 'T00:00:00');
      if (isNaN(parsedDate.getTime())) {
        newErrors.activityDate = '请输入有效的日期';
      }
    }

    if (!activityType) {
      newErrors.activityType = '请选择活动类型';
    }

    // Activity name is optional but has max length
    if (activityName && activityName.length > 200) {
      newErrors.activityName = '活动名称最多200字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    if (!validateForm()) {
      Alert.alert('表单错误', '请填写所有必填字段');
      return;
    }

    if (selectedFiles.length === 0) {
      Alert.alert('请选择文件', '请至少选择一个文件');
      return;
    }

    const metadata: UploadMetadata = {
      activity_date: activityDateText,
      activity_type: activityType,
      activity_name: activityName.trim() || undefined,
      custom_filename: customFilename.trim() || undefined,
    };

    onSubmit(metadata);
  };

  if (selectedFiles.length === 0) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>上传信息</ThemedText>

      {/* Activity Date */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <ThemedText style={styles.label}>活动日期</ThemedText>
          <ThemedText style={styles.required}>*</ThemedText>
        </View>
        
        <TouchableOpacity
          style={[
            styles.pickerButton,
            { borderColor: errors.activityDate ? errorColor : borderColor },
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <ThemedText style={[styles.pickerButtonText, { color: textColor }]}>
            {activityDateText}
          </ThemedText>
          <Icon name="calendar" size={18} color="#999" />
        </TouchableOpacity>

        {errors.activityDate && (
          <ThemedText style={[styles.errorText, { color: errorColor }]}>
            {errors.activityDate}
          </ThemedText>
        )}

        {/* Date Picker Modal for iOS / inline for Android */}
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            >
              <View style={[styles.datePickerModal, { paddingBottom: insets.bottom }]}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <ThemedText style={{ color: '#999', fontSize: 16 }}>取消</ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={styles.modalTitle}>选择日期</ThemedText>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <ThemedText style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>确定</ThemedText>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={activityDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDatePickerChange}
                  locale="zh-CN"
                  themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                  style={{ height: 200 }}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        )}
        
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={activityDate}
            mode="date"
            display="default"
            onChange={handleDatePickerChange}
          />
        )}
      </View>

      {/* Activity Type */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <ThemedText style={styles.label}>活动类型</ThemedText>
          <ThemedText style={styles.required}>*</ThemedText>
        </View>

        <TouchableOpacity
          style={[
            styles.pickerButton,
            { borderColor: errors.activityType ? errorColor : borderColor },
          ]}
          onPress={() => setShowTypePicker(true)}
          disabled={isLoadingTypes}
        >
          <ThemedText style={[styles.pickerButtonText, { color: activityType ? textColor : '#999' }]}>
            {isLoadingTypes 
              ? '加载中...' 
              : activityType 
                ? activityTypes.find(t => t.value === activityType)?.display_name || activityType
                : '请选择活动类型'}
          </ThemedText>
          <ThemedText style={styles.pickerIcon}>▼</ThemedText>
        </TouchableOpacity>

        {errors.activityType && (
          <ThemedText style={[styles.errorText, { color: errorColor }]}>
            {errors.activityType}
          </ThemedText>
        )}

        {/* Activity Type Picker Modal */}
        <Modal
          visible={showTypePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTypePicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowTypePicker(false)}
          >
            <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>选择活动类型</ThemedText>
                <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                  <ThemedText style={styles.modalClose}>完成</ThemedText>
                </TouchableOpacity>
              </View>
              <FlatList
                data={activityTypes}
                keyExtractor={(item) => item.id.toString()}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      activityType === item.value && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setActivityType(item.value);
                      if (errors.activityType) {
                        setErrors((prev) => ({ ...prev, activityType: undefined }));
                      }
                      setShowTypePicker(false);
                    }}
                  >
                    <ThemedText style={[
                      styles.modalItemText,
                      activityType === item.value && styles.modalItemTextSelected,
                    ]}>
                      {item.display_name}
                    </ThemedText>
                    {activityType === item.value && (
                      <Icon name="check" size={16} color="#10b981" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>

      {/* Activity Name (Optional) */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <ThemedText style={styles.label}>活动名称</ThemedText>
          <ThemedText style={styles.optional}>(可选)</ThemedText>
        </View>

        <TextInput
          style={[
            styles.input,
            {
              borderColor: errors.activityName ? errorColor : borderColor,
              color: textColor,
            },
          ]}
          value={activityName}
          onChangeText={(text) => {
            setActivityName(text);
            if (errors.activityName && text.length <= 200) {
              setErrors((prev) => ({ ...prev, activityName: undefined }));
            }
          }}
          placeholder="如：周末团建、新年晚会"
          placeholderTextColor="#999"
          maxLength={200}
        />

        <ThemedText style={styles.charCount}>
          {activityName.length}/200
        </ThemedText>

        {errors.activityName && (
          <ThemedText style={[styles.errorText, { color: errorColor }]}>
            {errors.activityName}
          </ThemedText>
        )}
      </View>

      {/* Custom Filename (Optional) - Only show for single file */}
      {selectedFiles.length === 1 && (
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <ThemedText style={styles.label}>自定义文件名</ThemedText>
            <ThemedText style={styles.optional}>(可选)</ThemedText>
          </View>

          <TextInput
            style={[
              styles.input,
              { borderColor, color: textColor },
            ]}
            value={customFilename}
            onChangeText={setCustomFilename}
            placeholder="留空则使用原文件名"
            placeholderTextColor="#999"
            maxLength={200}
          />

          <ThemedText style={styles.hint}>
            原文件名: {selectedFiles[0].filename}
          </ThemedText>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: accentColor },
          isSubmitting && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <ThemedText style={styles.submitButtonText}>
          {isSubmitting ? '添加中...' : `添加到上传队列 (${selectedFiles.length})`}
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  required: {
    color: '#ef4444',
    marginLeft: 4,
  },
  optional: {
    fontSize: 12,
    opacity: 0.6,
    marginLeft: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  pickerButtonText: {
    fontSize: 16,
  },
  pickerIcon: {
    fontSize: 12,
    opacity: 0.5,
  },
  charCount: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'right',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  datePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalList: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '500',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  modalItemText: {
    fontSize: 16,
  },
  modalItemTextSelected: {
    color: '#10b981',
    fontWeight: '500',
  },
});

export default UploadForm;
