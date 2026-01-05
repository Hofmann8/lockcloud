/**
 * Upload Tab Screen
 * 
 * Main upload page with file selection, upload form, and queue display.
 * References Web frontend upload flow and API calling patterns.
 * 
 * Requirements: 5.1, 5.5, 5.6, 5.7
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedView } from '@/components/themed-view';
import { FilePicker, SelectedFile } from '@/components/FilePicker';
import { UploadForm } from '@/components/UploadForm';
import { UploadQueue } from '@/components/UploadQueue';
import { useUploadQueueStore } from '@/stores/uploadQueueStore';
import { useThemeColor } from '@/hooks/use-theme-color';
import { UploadMetadata } from '@/types';

export default function UploadScreen() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const queryClient = useQueryClient();
  const addItem = useUploadQueueStore((state) => state.addItem);
  const setOnTaskComplete = useUploadQueueStore((state) => state.setOnTaskComplete);
  
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({ light: '#e5e5e5', dark: '#333' }, 'background');

  // Set up callback to refresh file list after successful uploads
  useEffect(() => {
    setOnTaskComplete(() => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['directories'] });
    });
  }, [queryClient, setOnTaskComplete]);

  // Handle files change from FilePicker
  const handleFilesChange = useCallback((files: SelectedFile[]) => {
    setSelectedFiles(files);
  }, []);

  // Handle form submission - add files to upload queue
  const handleSubmit = useCallback(async (metadata: UploadMetadata) => {
    if (selectedFiles.length === 0) {
      Alert.alert('请选择文件', '请至少选择一个文件');
      return;
    }

    setIsSubmitting(true);

    try {
      // Add each file to the upload queue
      for (const file of selectedFiles) {
        const customFilename = selectedFiles.length === 1 
          ? metadata.custom_filename 
          : file.customFilename || undefined;

        addItem(
          file.uri,
          file.filename,
          file.mimeType,
          file.size,
          {
            activity_date: metadata.activity_date,
            activity_type: metadata.activity_type,
            activity_name: metadata.activity_name,
            custom_filename: customFilename,
          }
        );
      }

      setSelectedFiles([]);
      
      Alert.alert(
        '已添加到队列',
        `${selectedFiles.length} 个文件已添加到上传队列`,
        [{ text: '确定' }]
      );
    } catch (error) {
      console.error('Error adding to queue:', error);
      Alert.alert('添加失败', '无法添加文件到队列，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFiles, addItem]);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.section, { borderColor }]}>
            <FilePicker
              selectedFiles={selectedFiles}
              onFilesChange={handleFilesChange}
              maxFiles={50}
            />
          </View>

          {selectedFiles.length > 0 && (
            <View style={[styles.section, { borderColor }]}>
              <UploadForm
                selectedFiles={selectedFiles}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </View>
          )}

          <View style={[styles.queueSection, { borderColor }]}>
            <UploadQueue />
            </View>
          </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  queueSection: {
    minHeight: 300,
  },
});
