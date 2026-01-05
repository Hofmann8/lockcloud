/**
 * FilterBar Component
 * 
 * Provides filtering controls for the file list including:
 * - Directory tree button
 * - Media type toggle (全部/图片/视频)
 * - Tag filtering with search
 * - Current tags display with remove option
 * 
 * Follows the Web frontend implementation (lockcloud-frontend/app/(dashboard)/files/page.tsx).
 * 
 * Requirements: 3.4, 3.6
 */

import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  useColorScheme,
  Keyboard,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { DirectoryTree } from '@/components/DirectoryTree';
import { searchTags } from '@/lib/api/tags';
import { MediaType, TagWithCount } from '@/types';

interface DirectoryFilters {
  year?: number;
  month?: number;
  activity_date?: string;
  activity_name?: string;
  activity_type?: string;
}

interface FilterBarProps {
  mediaType: MediaType;
  selectedTags: string[];
  onMediaTypeChange: (type: MediaType) => void;
  onTagAdd: (tag: string) => void;
  onTagRemove: (tag: string) => void;
  totalCount?: number;
  directoryFilters?: DirectoryFilters;
  onDirectoryFilterChange?: (filters: DirectoryFilters) => void;
}

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

/**
 * FilterBar - Provides filtering controls for file list
 * 
 * Requirements:
 * - 3.4: Support filtering by media type
 * - 3.6: Support filtering by free tags with autocomplete
 */
export function FilterBar({
  mediaType,
  selectedTags,
  onMediaTypeChange,
  onTagAdd,
  onTagRemove,
  totalCount,
  directoryFilters,
  onDirectoryFilterChange,
}: FilterBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [tagInput, setTagInput] = useState('');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isDirectoryTreeOpen, setIsDirectoryTreeOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Search tags when input changes
  const { data: searchResults = [] } = useQuery({
    queryKey: ['tags', 'search', tagInput],
    queryFn: () => searchTags(tagInput, 10),
    enabled: tagInput.trim().length > 0,
    staleTime: 10000,
  });

  // Filter out already selected tags and zero-count tags
  const suggestedTags = searchResults.filter(
    (tag: TagWithCount) => tag.count > 0 && !selectedTags.includes(tag.name)
  );

  // Handle tag selection
  const handleTagSelect = useCallback((tagName: string) => {
    onTagAdd(tagName);
    setTagInput('');
    setIsTagModalOpen(false);
    Keyboard.dismiss();
  }, [onTagAdd]);

  // Handle manual tag input
  const handleTagSubmit = useCallback(() => {
    const trimmedInput = tagInput.trim();
    if (trimmedInput && !selectedTags.includes(trimmedInput)) {
      onTagAdd(trimmedInput);
      setTagInput('');
    }
  }, [tagInput, selectedTags, onTagAdd]);

  // Open tag modal
  const openTagModal = useCallback(() => {
    setIsTagModalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Close tag modal
  const closeTagModal = useCallback(() => {
    setIsTagModalOpen(false);
    setTagInput('');
    Keyboard.dismiss();
  }, []);

  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#f5f5f5';
  const cardBackground = colorScheme === 'dark' ? '#2c2c2e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';

  // Check if directory filter is active
  const hasDirectoryFilter = directoryFilters && (
    directoryFilters.year || directoryFilters.activity_date
  );

  // Format directory filter label
  const getDirectoryFilterLabel = () => {
    if (!directoryFilters) return '目录';
    if (directoryFilters.activity_name) {
      return directoryFilters.activity_name;
    }
    if (directoryFilters.month) {
      return `${directoryFilters.year}年${directoryFilters.month}月`;
    }
    if (directoryFilters.year) {
      return `${directoryFilters.year}年`;
    }
    return '目录';
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Top Row: Directory Button + Media Type Toggle + Total Count */}
      <View style={styles.topRow}>
        {/* Directory Tree Button */}
        <TouchableOpacity
          style={[
            styles.directoryButton,
            { backgroundColor: cardBackground },
            hasDirectoryFilter && styles.directoryButtonActive,
          ]}
          onPress={() => setIsDirectoryTreeOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="folder-open"
            size={16}
            color={hasDirectoryFilter ? '#fff' : '#f97316'}
          />
          <ThemedText
            style={[
              styles.directoryButtonText,
              { color: hasDirectoryFilter ? '#fff' : textColor },
            ]}
            numberOfLines={1}
          >
            {getDirectoryFilterLabel()}
          </ThemedText>
          <Ionicons
            name="chevron-down"
            size={14}
            color={hasDirectoryFilter ? '#fff' : secondaryTextColor}
          />
        </TouchableOpacity>

        {/* Media Type Pills - simple style like requests page */}
        <View style={[styles.mediaTypeContainer, { backgroundColor: cardBackground }]}>
          {MEDIA_TYPES.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.mediaTypePill,
                mediaType === value && styles.mediaTypePillActive,
              ]}
              onPress={() => onMediaTypeChange(value)}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[
                  styles.mediaTypePillText,
                  { color: secondaryTextColor },
                  mediaType === value && styles.mediaTypePillTextActive,
                ]}
              >
                {label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Count */}
        {totalCount !== undefined && (
          <ThemedText style={[styles.totalCount, { color: secondaryTextColor }]}>
            共 {totalCount} 个
          </ThemedText>
        )}
      </View>

      {/* Bottom Row: Tags */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagsScrollView}
        contentContainerStyle={styles.tagsContainer}
      >
        {/* Selected Tags */}
        {selectedTags.map((tag) => (
          <View key={tag} style={styles.selectedTag}>
            <ThemedText style={styles.selectedTagText}>{tag}</ThemedText>
            <TouchableOpacity
              style={styles.removeTagButton}
              onPress={() => onTagRemove(tag)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ThemedText style={styles.removeTagIcon}>×</ThemedText>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Tag Button */}
        <TouchableOpacity
          style={[styles.addTagButton, { borderColor }]}
          onPress={openTagModal}
          activeOpacity={0.7}
        >
          <ThemedText style={[styles.addTagButtonText, { color: secondaryTextColor }]}>
            + 标签
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Tag Search Modal */}
      <Modal
        visible={isTagModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeTagModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: cardBackground }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={closeTagModal}>
              <ThemedText style={styles.modalCancelText}>取消</ThemedText>
            </TouchableOpacity>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>添加标签</ThemedText>
            <TouchableOpacity onPress={handleTagSubmit} disabled={!tagInput.trim()}>
              <ThemedText
                style={[
                  styles.modalDoneText,
                  !tagInput.trim() && styles.modalDoneTextDisabled,
                ]}
              >
                添加
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={[styles.searchInputContainer, { backgroundColor, borderColor }]}>
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: textColor }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="搜索或输入标签..."
              placeholderTextColor={secondaryTextColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleTagSubmit}
            />
            {tagInput.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setTagInput('')}
              >
                <ThemedText style={[styles.clearButtonText, { color: secondaryTextColor }]}>
                  ×
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Tag Suggestions */}
          <FlatList
            data={suggestedTags}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { borderBottomColor: borderColor }]}
                onPress={() => handleTagSelect(item.name)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.suggestionText, { color: textColor }]}>
                  {item.name}
                </ThemedText>
                <ThemedText style={[styles.suggestionCount, { color: secondaryTextColor }]}>
                  {item.count}
                </ThemedText>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              tagInput.trim().length > 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                    没有匹配的标签
                  </ThemedText>
                  <ThemedText style={[styles.emptySubtext, { color: secondaryTextColor }]}>
                    点击「添加」创建新标签
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                    输入标签名称搜索
                  </ThemedText>
                </View>
              )
            }
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>

      {/* Directory Tree Modal */}
      {onDirectoryFilterChange && (
        <DirectoryTree
          visible={isDirectoryTreeOpen}
          onClose={() => setIsDirectoryTreeOpen(false)}
          currentFilters={directoryFilters}
          onFilterChange={onDirectoryFilterChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  directoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    flexShrink: 1,
    minWidth: 60,
    maxWidth: 100,
  },
  directoryButtonActive: {
    backgroundColor: '#f97316',
  },
  directoryButtonText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  mediaTypeContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    flexShrink: 0,
  },
  mediaTypePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mediaTypePillActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mediaTypePillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  mediaTypePillTextActive: {
    color: '#000',
  },
  mediaTypePillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  totalCount: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  tagsScrollView: {
    flexGrow: 0,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  selectedTagText: {
    fontSize: 13,
    color: '#f97316',
    marginRight: 4,
  },
  removeTagButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeTagIcon: {
    fontSize: 14,
    color: '#f97316',
    lineHeight: 16,
  },
  addTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addTagButtonText: {
    fontSize: 13,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#f97316',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#f97316',
    fontWeight: '600',
  },
  modalDoneTextDisabled: {
    opacity: 0.4,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 20,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 16,
  },
  suggestionCount: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
  },
});

export default FilterBar;
