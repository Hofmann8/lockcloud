/**
 * TagSearch Component
 * 
 * A standalone tag search component with autocomplete functionality.
 * Can be used in various contexts (filtering, editing, etc.)
 * 
 * Features:
 * - Input with autocomplete suggestions
 * - Search results with tag counts
 * - Click to add tag
 * 
 * Requirements: 6.2, 6.4
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
import { Icon } from '@/components/ui/Icon';
import { searchTags } from '@/lib/api/tags';
import { TagWithCount } from '@/types';

interface TagSearchProps {
  /** Callback when a tag is selected */
  onTagSelect: (tagName: string) => void;
  /** Tags to exclude from suggestions (already selected) */
  excludeTags?: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
}

/**
 * TagSearch - Tag search input with autocomplete
 * 
 * Requirements:
 * - 6.2: Support tag search with prefix matching
 * - 6.4: Display tag suggestions based on search input
 */
export function TagSearch({
  onTagSelect,
  excludeTags = [],
  placeholder = '搜索标签...',
  autoFocus = false,
  maxSuggestions = 10,
}: TagSearchProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Search tags when query changes
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['tags', 'search', query],
    queryFn: () => searchTags(query, maxSuggestions + excludeTags.length),
    enabled: query.trim().length > 0,
    staleTime: 10000,
  });

  // Filter out excluded tags and zero-count tags
  const suggestions = searchResults
    .filter((tag: TagWithCount) => tag.count > 0 && !excludeTags.includes(tag.name))
    .slice(0, maxSuggestions);

  // Show/hide suggestions with animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isFocused && suggestions.length > 0 ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isFocused, suggestions.length, fadeAnim]);

  // Handle tag selection
  const handleTagSelect = useCallback((tagName: string) => {
    onTagSelect(tagName);
    setQuery('');
    Keyboard.dismiss();
  }, [onTagSelect]);

  // Handle manual submission
  const handleSubmit = useCallback(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery && !excludeTags.includes(trimmedQuery)) {
      onTagSelect(trimmedQuery);
      setQuery('');
    }
  }, [query, excludeTags, onTagSelect]);

  // Highlight matching text in suggestion
  const highlightMatch = useCallback((text: string, searchQuery: string) => {
    if (!searchQuery) return <ThemedText style={styles.suggestionText}>{text}</ThemedText>;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);
    
    if (matchIndex === -1) {
      return <ThemedText style={styles.suggestionText}>{text}</ThemedText>;
    }

    return (
      <ThemedText style={styles.suggestionText}>
        {text.slice(0, matchIndex)}
        <ThemedText style={styles.highlightedText}>
          {text.slice(matchIndex, matchIndex + searchQuery.length)}
        </ThemedText>
        {text.slice(matchIndex + searchQuery.length)}
      </ThemedText>
    );
  }, []);

  const inputBackground = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={[styles.inputContainer, { backgroundColor: inputBackground, borderColor }]}>
        <Icon name="search" size={16} color={secondaryTextColor} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: textColor }]}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={secondaryTextColor}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onSubmitEditing={handleSubmit}
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ThemedText style={[styles.clearIcon, { color: secondaryTextColor }]}>×</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions Dropdown */}
      {isFocused && query.trim().length > 0 && (
        <Animated.View
          style={[
            styles.suggestionsContainer,
            { backgroundColor: inputBackground, borderColor, opacity: fadeAnim },
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
                搜索中...
              </ThemedText>
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.suggestionItem, { borderBottomColor: borderColor }]}
                  onPress={() => handleTagSelect(item.name)}
                  activeOpacity={0.7}
                >
                  {highlightMatch(item.name, query)}
                  <ThemedText style={[styles.suggestionCount, { color: secondaryTextColor }]}>
                    {item.count}
                  </ThemedText>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={suggestions.length > 5}
              style={styles.suggestionsList}
            />
          ) : (
            <View style={styles.noResultsContainer}>
              <ThemedText style={[styles.noResultsText, { color: secondaryTextColor }]}>
                没有匹配的标签
              </ThemedText>
              <TouchableOpacity
                style={styles.createTagButton}
                onPress={handleSubmit}
              >
                <ThemedText style={styles.createTagText}>
                  创建「{query.trim()}」
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 20,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsList: {
    maxHeight: 250,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 15,
    flex: 1,
  },
  highlightedText: {
    backgroundColor: '#fff7ed',
    color: '#f97316',
  },
  suggestionCount: {
    fontSize: 13,
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  noResultsContainer: {
    padding: 16,
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
});

export default TagSearch;
