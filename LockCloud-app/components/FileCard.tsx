/**
 * FileCard Component
 * 
 * Displays a file card with thumbnail, filename, date, and metadata.
 * Follows the Web frontend implementation (lockcloud-frontend/components/FileCardSimple.tsx).
 * 
 * Features:
 * - Thumbnail display with lazy loading
 * - File metadata (date, type, name)
 * - Free tags display
 * - Selection state support
 * - Press and long-press handlers
 * 
 * Requirements: 3.2, 3.7, 3.8
 */

import { memo, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, IconName } from '@/components/ui/Icon';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { File } from '@/types';

// S3 base URL for thumbnails
const S3_BASE_URL = process.env.EXPO_PUBLIC_S3_BASE_URL || 'https://funkandlove-cloud2.s3.bitiful.net';

// Calculate card width based on screen width (2 columns with padding)
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 24) / 2; // 8px padding on each side + 8px gap
const THUMBNAIL_HEIGHT = 140;

interface FileCardProps {
  file: File;
  onPress: () => void;
  onLongPress?: () => void;
  onFileUpdate?: () => void;
}

/**
 * FileCard - Displays a file card with thumbnail and metadata
 * 
 * Requirements:
 * - 3.2: Display files in responsive grid layout
 * - 3.7: Tap to navigate to file detail
 * - 3.8: Lazy loading thumbnails for performance
 */
function FileCardComponent({ file, onPress, onLongPress }: FileCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isSelected = useBatchSelectionStore((state) => state.isSelected(file.id));
  const isSelectionMode = useBatchSelectionStore((state) => state.isSelectionMode);

  const isImage = file.content_type.startsWith('image/');
  const isVideo = file.content_type.startsWith('video/');

  // Get thumbnail URL with image processing parameters
  const thumbnailUrl = useMemo(() => {
    if (!file.s3_key) return null;
    
    const width = 300; // Mobile optimized width
    
    // Video: Use video frame extraction
    if (isVideo) {
      return `${S3_BASE_URL}/${file.s3_key}?frame=100&w=${width}`;
    }
    
    // Image: Use resized version
    if (isImage) {
      return `${S3_BASE_URL}/${file.s3_key}?w=${width}`;
    }
    
    return null;
  }, [file.s3_key, isImage, isVideo]);

  // Format file size
  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  // Format activity date
  const formatActivityDate = useCallback((dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    return `${year}年${month}月${day}日`;
  }, []);

  // Get file icon for non-media files
  const getFileIcon = useCallback((): IconName => {
    if (isImage) return 'file-image';
    if (isVideo) return 'file-video';
    if (file.content_type.includes('pdf')) return 'file';
    if (file.content_type.includes('audio')) return 'file-audio';
    if (file.content_type.includes('zip') || file.content_type.includes('rar')) return 'file-archive';
    return 'folder';
  }, [isImage, isVideo, file.content_type]);

  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#2c2c2e' : '#e5e5e5';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor, borderColor },
        isSelected && styles.cardSelected,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      delayLongPress={300}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: borderColor }]}>
            <Icon name={getFileIcon()} size={48} color={secondaryTextColor} />
          </View>
        )}
        
        {/* Video play icon overlay */}
        {isVideo && (
          <View style={styles.playIconOverlay}>
            <View style={styles.playIconBackground}>
              <ThemedText style={styles.playIcon}>▶</ThemedText>
            </View>
          </View>
        )}

        {/* Selection checkbox */}
        {isSelectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Icon name="check" size={14} color="#fff" />}
          </View>
        )}
      </View>

      {/* File Info */}
      <View style={styles.infoContainer}>
        {/* Filename */}
        <ThemedText style={styles.filename} numberOfLines={1}>
          {file.filename}
        </ThemedText>

        {/* Activity Date */}
        <View style={styles.metaRow}>
          <Icon name="calendar" size={12} color={secondaryTextColor} style={styles.metaIcon} />
          <ThemedText style={[styles.metaText, { color: secondaryTextColor }]} numberOfLines={1}>
            {file.activity_date ? formatActivityDate(file.activity_date) : '-'}
          </ThemedText>
        </View>

        {/* Activity Type */}
        <View style={styles.metaRow}>
          <Icon name="tag" size={12} color={secondaryTextColor} style={styles.metaIcon} />
          <ThemedText style={[styles.metaText, { color: secondaryTextColor }]} numberOfLines={1}>
            {file.activity_type_display || '-'}
          </ThemedText>
        </View>

        {/* Free Tags */}
        <View style={styles.tagsContainer}>
          {file.free_tags && file.free_tags.length > 0 ? (
            <>
              {file.free_tags.slice(0, 2).map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <ThemedText style={styles.tagText}>{tag.name}</ThemedText>
                </View>
              ))}
              {file.free_tags.length > 2 && (
                <ThemedText style={[styles.moreTagsText, { color: secondaryTextColor }]}>
                  +{file.free_tags.length - 2}
                </ThemedText>
              )}
            </>
          ) : (
            <ThemedText style={[styles.noTagsText, { color: secondaryTextColor }]}>
              无标签
            </ThemedText>
          )}
        </View>

        {/* Bottom row: Size and uploader */}
        <View style={styles.bottomRow}>
          <ThemedText style={[styles.sizeText, { color: secondaryTextColor }]}>
            {formatSize(file.size)}
          </ThemedText>
          <ThemedText style={[styles.uploaderText, { color: secondaryTextColor }]} numberOfLines={1}>
            {file.uploader?.name || '-'}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Memoize to prevent unnecessary re-renders
export const FileCard = memo(FileCardComponent);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#f97316',
    borderWidth: 2,
  },
  thumbnailContainer: {
    width: '100%',
    height: THUMBNAIL_HEIGHT,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 4,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  infoContainer: {
    padding: 10,
  },
  filename: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 11,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
    minHeight: 20,
  },
  tag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 2,
  },
  tagText: {
    fontSize: 10,
    color: '#f97316',
  },
  moreTagsText: {
    fontSize: 10,
  },
  noTagsText: {
    fontSize: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  sizeText: {
    fontSize: 10,
  },
  uploaderText: {
    fontSize: 10,
    maxWidth: '50%',
  },
});

export default FileCard;
