/**
 * TagEditor Component
 * 
 * A component for editing tags on files.
 * Displays current tags with remove buttons and allows adding new tags.
 * 
 * Features:
 * - Display current tags as chips
 * - Add new tags with autocomplete
 * - Remove existing tags
 * 
 * Requirements: 6.3
 */

import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  useColorScheme,
  Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { searchTags } from '@/lib/api/tags';
import { TagWithCount } from '@/types';

interface TagEditorProps {
  /** Current tags */
  tags: string[];
  /** Callback when tags change */
  onTagsChange: (tags: string[]) => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
}

/**
 * TagEditor - Component for editing file tags
 * 
 * Requirements: 6.3
 */
export function TagEditor({
  tags,
  onTagsChange,
  disabled = false,
  placeholder = '输入标签后按回车添加',
  maxSuggestions = 5,
}: TagEditorProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Search tags when input changes
  const { data: searchResults = [] } = useQuery({
    queryKey: ['tags', 'search', inputValue],
    queryFn: () => searchTags(inputValue, maxSuggestions + tags.length),
    enabled: inputValue.trim().length > 0,
    staleTime: 10000,
  });

  // Filter out already selected tags
  const suggestions = searchResults
    .filter((tag: TagWithCount) => !tags.includes(tag.name))
    .slice(0, maxSuggestions);

  // Show/hide suggestions with animation
  const showSuggestions = isFocused && inputValue.trim().length > 0 && suggestions.length > 0;
  
  Animated.timing(fadeAnim, {
    toValue: showSuggestions ? 1 : 0,
    duration: 150,
    useNativeDriver: true,
  }).start();

  // Add a tag
  const handleAddTag = useCallback((tagName: string) => {
    const trimmed = tagName.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue('');
    Keyboard.dismiss();
  }, [tags, onTagsChange]);

  // Remove a tag
  const handleRemoveTag = useCallback((tagName: string) => {
    onTagsChange(tags.filter(t => t !== tagName));
  }, [tags, onTagsChange]);

  // Handle submit (Enter key)
  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      handleAddTag(trimmed);
    }
  }, [inputValue, tags, handleAddTag]);

  // Theme colors
  const backgroundColor = colorScheme === 'dark' ? '#2c2c2e' : '#f5f5f5';
  const inputBackground = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Current Tags */}
      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <ThemedText style={styles.tagText}>{tag}</ThemedText>
              {!disabled && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveTag(tag)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ThemedText style={styles.removeIcon}>×</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Input */}
      {!disabled && (
        <View style={styles.inputWrapper}>
          <View style={[styles.inputContainer, { backgroundColor: inputBackground, borderColor }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: textColor }]}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={tags.length === 0 ? placeholder : '添加更多标签...'}
              placeholderTextColor={secondaryTextColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              onSubmitEditing={handleSubmit}
            />
            {inputValue.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setInputValue('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ThemedText style={[styles.clearIcon, { color: secondaryTextColor }]}>×</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Suggestions Dropdown */}
          {showSuggestions && (
            <Animated.View
              style={[
                styles.suggestionsContainer,
                { backgroundColor: inputBackground, borderColor, opacity: fadeAnim },
              ]}
            >
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.suggestionItem, { borderBottomColor: borderColor }]}
                    onPress={() => handleAddTag(item.name)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={styles.suggestionText}>{item.name}</ThemedText>
                    <ThemedText style={[styles.suggestionCount, { color: secondaryTextColor }]}>
                      {item.count}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={suggestions.length > 4}
                style={styles.suggestionsList}
              />
            </Animated.View>
          )}

          {/* Create new tag option when no suggestions */}
          {isFocused && inputValue.trim().length > 0 && suggestions.length === 0 && (
            <View style={[styles.suggestionsContainer, { backgroundColor: inputBackground, borderColor }]}>
              <View style={styles.noResultsContainer}>
                <ThemedText style={[styles.noResultsText, { color: secondaryTextColor }]}>
                  没有匹配的标签
                </ThemedText>
                <TouchableOpacity
                  style={styles.createTagButton}
                  onPress={handleSubmit}
                >
                  <ThemedText style={styles.createTagText}>
                    创建「{inputValue.trim()}」
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Empty state */}
      {tags.length === 0 && disabled && (
        <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
          暂无标签
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tagText: {
    fontSize: 14,
    color: '#374151',
  },
  removeButton: {
    marginLeft: 4,
    padding: 2,
  },
  removeIcon: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '500',
  },
  inputWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 18,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 15,
    flex: 1,
  },
  suggestionCount: {
    fontSize: 13,
    marginLeft: 8,
  },
  noResultsContainer: {
    padding: 12,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    marginBottom: 8,
  },
  createTagButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f97316',
    borderRadius: 6,
  },
  createTagText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default TagEditor;
