/**
 * File Picker Component
 * 
 * Allows users to select files from gallery or camera.
 * Uses expo-image-picker for file selection.
 * 
 * Requirements: 5.1
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Icon } from './ui/Icon';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface SelectedFile {
  id: string;
  uri: string;
  filename: string;
  mimeType: string;
  size: number;
  customFilename: string;
}

interface FilePickerProps {
  selectedFiles: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  maxFiles?: number;
}

// Allowed file extensions (matching backend)
const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv',
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg',
];

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

/**
 * Generate unique ID for file items
 */
const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

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
 * Validate file extension
 */
const validateFileExtension = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? ALLOWED_EXTENSIONS.includes(extension) : false;
};

export function FilePicker({
  selectedFiles,
  onFilesChange,
  maxFiles = 50,
}: FilePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#e5e5e5', dark: '#333' }, 'background');
  const accentColor = '#10b981'; // Green accent

  /**
   * Request media library permissions
   */
  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '权限不足',
        '需要访问相册权限才能选择文件',
        [{ text: '确定' }]
      );
      return false;
    }
    return true;
  };

  /**
   * Pick files from gallery
   */
  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: maxFiles - selectedFiles.length,
      });

      if (!result.canceled && result.assets) {
        const newFiles: SelectedFile[] = [];
        
        for (const asset of result.assets) {
          const filename = asset.fileName || asset.uri.split('/').pop() || 'unknown';
          
          // Validate extension
          if (!validateFileExtension(filename)) {
            Alert.alert('不支持的文件类型', `文件 "${filename}" 类型不支持`);
            continue;
          }

          // Validate size
          const fileSize = asset.fileSize || 0;
          if (fileSize > MAX_FILE_SIZE) {
            Alert.alert('文件过大', `文件 "${filename}" 超过 2GB 限制`);
            continue;
          }

          newFiles.push({
            id: generateId(),
            uri: asset.uri,
            filename,
            mimeType: asset.mimeType || 'application/octet-stream',
            size: fileSize,
            customFilename: '',
          });
        }

        if (newFiles.length > 0) {
          onFilesChange([...selectedFiles, ...newFiles]);
        }
      }
    } catch (error) {
      console.error('Error picking files:', error);
      Alert.alert('选择失败', '无法选择文件，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Take photo with camera - Currently disabled
   */
  const takePhoto = async () => {
    Alert.alert(
      '功能暂未开放',
      '目前还未添加拍照上传功能，因为软件向手机索取相机权限是一个很危险的事情，Hofmann把移动端开发学的更深入之后再考虑要不要添加',
      [{ text: '确定' }]
    );
  };

  /**
   * Remove a file from selection
   */
  const removeFile = (id: string) => {
    onFilesChange(selectedFiles.filter((f) => f.id !== id));
  };

  /**
   * Clear all selected files
   */
  const clearAll = () => {
    onFilesChange([]);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Selection Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.selectButton, { borderColor: accentColor }]}
          onPress={pickFromGallery}
          disabled={isLoading || selectedFiles.length >= maxFiles}
        >
          <View style={styles.buttonContent}>
            <Icon name="gallery" size={24} color={accentColor} />
            <ThemedText style={[styles.buttonText, { color: accentColor }]}>
              从相册选择
            </ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectButton, { borderColor: accentColor }]}
          onPress={takePhoto}
          disabled={isLoading || selectedFiles.length >= maxFiles}
        >
          <View style={styles.buttonContent}>
            <Icon name="camera" size={24} color={accentColor} />
            <ThemedText style={[styles.buttonText, { color: accentColor }]}>
              拍照
            </ThemedText>
          </View>
        </TouchableOpacity>
      </View>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <View style={styles.previewSection}>
          <View style={styles.previewHeader}>
            <ThemedText style={styles.previewTitle}>
              已选择 {selectedFiles.length} 个文件
            </ThemedText>
            <TouchableOpacity onPress={clearAll}>
              <ThemedText style={styles.clearButton}>清空</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
          >
            {selectedFiles.map((file) => (
              <View key={file.id} style={[styles.previewItem, { borderColor }]}>
                {file.mimeType.startsWith('image/') ? (
                  <Image source={{ uri: file.uri }} style={styles.previewImage} />
                ) : (
                  <View style={[styles.previewPlaceholder, { backgroundColor: borderColor }]}>
                    <Icon 
                      name={file.mimeType.startsWith('video/') ? 'file-video' : 'file'} 
                      size={32} 
                      color="#6b7280" 
                    />
                  </View>
                )}
                <View style={styles.previewInfo}>
                  <ThemedText style={styles.previewFilename} numberOfLines={1}>
                    {file.filename}
                  </ThemedText>
                  <ThemedText style={styles.previewSize}>
                    {formatFileSize(file.size)}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFile(file.id)}
                >
                  <Icon name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Empty State */}
      {selectedFiles.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="upload" size={48} color="#9ca3af" />
          <ThemedText style={styles.emptyText}>
            点击上方按钮选择要上传的文件
          </ThemedText>
          <ThemedText style={styles.emptySubtext}>
            支持图片和视频，单个文件最大 2GB
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonContent: {
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewSection: {
    marginTop: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    fontSize: 14,
    color: '#ef4444',
  },
  previewScroll: {
    marginHorizontal: -16,
  },
  previewContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  previewItem: {
    width: 120,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 80,
    resizeMode: 'cover',
  },
  previewPlaceholder: {
    width: '100%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    padding: 8,
  },
  previewFilename: {
    fontSize: 12,
    fontWeight: '500',
  },
  previewSize: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 2,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default FilePicker;
