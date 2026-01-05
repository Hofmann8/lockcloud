/**
 * Files Tab Screen (文件)
 * 
 * Main file browsing screen with infinite scroll, pull-to-refresh, and filtering.
 * Filter bar is fixed at top, only list content scrolls.
 * 
 * Requirements: 3.1, 3.3, 9.1, 12.5
 */

import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FileCard } from '@/components/FileCard';
import { BatchActionBar } from '@/components/BatchActionBar';
import { DirectoryTree } from '@/components/DirectoryTree';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { useHeaderContext } from '@/contexts/HeaderContext';
import { useAuthStore } from '@/stores/authStore';
import { useBatchSelectionStore } from '@/stores/batchSelectionStore';
import { listFiles } from '@/lib/api/files';
import { searchTags } from '@/lib/api/tags';
import { File, FileFilters, MediaType, TagWithCount } from '@/types';
import { Colors } from '@/constants/theme';

const PAGE_SIZE = 24;

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

interface DirectoryFilters {
  year?: number;
  month?: number;
  activity_date?: string;
  activity_name?: string;
  activity_type?: string;
}

export default function FilesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tagInputRef = useRef<TextInput>(null);
  
  // Filter state
  const [mediaType, setMediaType] = useState<MediaType>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [directoryFilters, setDirectoryFilters] = useState<DirectoryFilters>({});
  
  // UI state
  const [isDirectoryTreeOpen, setIsDirectoryTreeOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  
  // Scroll animation - directly update shared value (UI thread only, no JS)
  const { scrollY } = useHeaderContext();
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  
  // Animated FlatList
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<File>);
  // Batch selection
  const {
    isSelectionMode,
    enterSelectionMode,
    exitSelectionMode,
    clearSelection,
    selectAll,
    isSelectAllMode,
    getSelectionCount,
  } = useBatchSelectionStore();

  // Build filters
  const filters: FileFilters = useMemo(() => ({
    per_page: PAGE_SIZE,
    ...(mediaType !== 'all' && { media_type: mediaType }),
    ...(selectedTags.length > 0 && { tags: selectedTags }),
    ...(directoryFilters.year && { year: directoryFilters.year }),
    ...(directoryFilters.month && { month: directoryFilters.month }),
    ...(directoryFilters.activity_date && { activity_date: directoryFilters.activity_date }),
    ...(directoryFilters.activity_name && { activity_name: directoryFilters.activity_name }),
    ...(directoryFilters.activity_type && { activity_type: directoryFilters.activity_type }),
  }), [mediaType, selectedTags, directoryFilters]);

  // File list query - keepPreviousData prevents flash on filter change
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['files', filters],
    queryFn: async ({ pageParam = 1 }) => listFiles({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData, // Keep old data while fetching new
    staleTime: 30 * 1000, // 30s cache
  });

  // Tag search query
  const { data: searchResults = [] } = useQuery({
    queryKey: ['tags', 'search', tagInput],
    queryFn: () => searchTags(tagInput, 10),
    enabled: tagInput.trim().length > 0,
    staleTime: 10000,
  });

  const files = useMemo(() => data?.pages?.flatMap((page) => page.files) ?? [], [data?.pages]);
  const totalCount = data?.pages[0]?.pagination.total ?? 0;

  // Handlers
  const handleRefresh = useCallback(async () => {
    clearSelection();
    await refetch();
  }, [refetch, clearSelection]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleFilePress = useCallback((file: File) => {
    if (isSelectionMode) {
      useBatchSelectionStore.getState().toggleSelection(file.id);
    } else {
      router.push(`/files/${file.id}`);
    }
  }, [isSelectionMode, router]);

  const handleFileLongPress = useCallback((file: File) => {
    if (!isSelectionMode) enterSelectionMode();
    useBatchSelectionStore.getState().toggleSelection(file.id);
  }, [isSelectionMode, enterSelectionMode]);

  const handleFileUpdate = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['directories'] });
  }, [refetch, queryClient]);

  const handleTagAdd = useCallback((tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
      clearSelection();
    }
    setIsTagModalOpen(false);
    setTagInput('');
  }, [selectedTags, clearSelection]);

  const handleTagRemove = useCallback((tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
    clearSelection();
  }, [clearSelection]);

  // Redirect to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const timer = setTimeout(() => router.replace('/auth/login'), 0);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, router]);

  // Theme
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const borderColor = colorScheme === 'dark' ? '#2c2c2e' : '#e5e5e5';
  const filterBg = colorScheme === 'dark' ? '#1c1c1e' : '#f3f4f6';
  const filterActiveBg = colorScheme === 'dark' ? '#2c2c2e' : '#fff';
  const cardBg = colorScheme === 'dark' ? '#1c1c1e' : '#fff';

  // Directory filter helpers
  const hasDirectoryFilter = !!(directoryFilters.year || directoryFilters.activity_date);
  const directoryLabel = directoryFilters.activity_name 
    || (directoryFilters.month ? `${directoryFilters.year}年${directoryFilters.month}月` : null)
    || (directoryFilters.year ? `${directoryFilters.year}年` : '目录');

  const suggestedTags = searchResults.filter(
    (tag: TagWithCount) => tag.count > 0 && !selectedTags.includes(tag.name)
  );

  // Render helpers
  const renderFileCard = useCallback(({ item }: { item: File }) => (
    <FileCard
      file={item}
      onPress={() => handleFilePress(item)}
      onLongPress={() => handleFileLongPress(item)}
      onFileUpdate={handleFileUpdate}
    />
  ), [handleFilePress, handleFileLongPress, handleFileUpdate]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
      </View>
    );
  }, [isFetchingNextPage, colorScheme]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.emptyText}>暂无文件</ThemedText>
        <ThemedText style={[styles.emptySubtext, { color: secondaryTextColor }]}>
          {selectedTags.length > 0 || mediaType !== 'all' ? '尝试调整筛选条件' : '上传一些文件开始使用'}
        </ThemedText>
      </View>
    );
  }, [isLoading, selectedTags.length, mediaType, secondaryTextColor]);

  // Auth loading / redirect
  if (!authLoading && !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      </ThemedView>
    );
  }

  // Initial loading (only first time, not on filter change)
  if (authLoading || (isLoading && !data)) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <LoadingAnimation text="加载文件中..." />
        </View>
      </ThemedView>
    );
  }

  // Error
  if (isError) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>加载失败</ThemedText>
          <ThemedText style={[styles.errorSubtext, { color: secondaryTextColor }]}>
            {(error as Error)?.message || '请检查网络连接'}
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <ThemedText style={styles.retryButtonText}>重试</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Fixed Filter Bar */}
      <View style={[styles.filterBar, { borderBottomColor: borderColor }]}>
        <View style={styles.filterRow}>
          {/* Directory */}
          <TouchableOpacity
            style={[styles.directoryBtn, hasDirectoryFilter && styles.directoryBtnActive]}
            onPress={() => setIsDirectoryTreeOpen(true)}
          >
            <Ionicons name="folder-open" size={14} color={hasDirectoryFilter ? '#fff' : '#f97316'} />
            <ThemedText 
              style={[styles.directoryBtnText, hasDirectoryFilter && { color: '#fff' }]} 
              numberOfLines={1}
            >
              {directoryLabel}
            </ThemedText>
          </TouchableOpacity>

          {/* Media Type */}
          <View style={[styles.filterButtons, { backgroundColor: filterBg }]}>
            {MEDIA_TYPES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.filterButton,
                  mediaType === value && [styles.filterButtonActive, { backgroundColor: filterActiveBg }],
                ]}
                onPress={() => { setMediaType(value); clearSelection(); }}
              >
                <ThemedText
                  style={[
                    styles.filterButtonText,
                    { color: secondaryTextColor },
                    mediaType === value && styles.filterButtonTextActive,
                  ]}
                >
                  {label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.countRow}>
            {isFetching && !isFetchingNextPage && (
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} style={{ marginRight: 6 }} />
            )}
            <ThemedText style={[styles.totalCount, { color: secondaryTextColor }]}>{totalCount}个</ThemedText>
          </View>
        </View>

        {/* Tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {selectedTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <ThemedText style={styles.tagText}>{tag}</ThemedText>
              <TouchableOpacity onPress={() => handleTagRemove(tag)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                <ThemedText style={styles.tagRemove}>×</ThemedText>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.addTagBtn, { borderColor }]} onPress={() => setIsTagModalOpen(true)}>
            <ThemedText style={[styles.addTagText, { color: secondaryTextColor }]}>+ 标签</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Selection Header */}
      {isSelectionMode && (
        <View style={[styles.selectionBar, { backgroundColor: Colors[colorScheme].tint }]}>
          <ThemedText style={styles.selectionText}>已选 {getSelectionCount()} 项</ThemedText>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={() => isSelectAllMode ? clearSelection() : selectAll(files.map(f => f.id))}>
              <ThemedText style={styles.selectionBtn}>{isSelectAllMode ? '取消全选' : '全选'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={exitSelectionMode}>
              <ThemedText style={styles.selectionBtn}>取消</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* File List */}
      <AnimatedFlatList
        data={files}
        renderItem={renderFileCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, isSelectionMode && { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={handleRefresh}
            tintColor={Colors[colorScheme].tint}
          />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Batch Actions */}
      {isSelectionMode && <BatchActionBar files={files} onOperationComplete={handleFileUpdate} />}

      {/* Directory Modal */}
      <DirectoryTree
        visible={isDirectoryTreeOpen}
        onClose={() => setIsDirectoryTreeOpen(false)}
        currentFilters={directoryFilters}
        onFilterChange={(f) => { setDirectoryFilters(f); clearSelection(); }}
      />

      {/* Tag Modal */}
      <Modal visible={isTagModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsTagModalOpen(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: cardBg }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={() => { setIsTagModalOpen(false); setTagInput(''); }}>
              <ThemedText style={{ color: '#f97316', fontSize: 16 }}>取消</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>添加标签</ThemedText>
            <TouchableOpacity onPress={() => handleTagAdd(tagInput.trim())} disabled={!tagInput.trim()}>
              <ThemedText style={[{ color: '#f97316', fontSize: 16, fontWeight: '600' }, !tagInput.trim() && { opacity: 0.4 }]}>添加</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={[styles.searchBox, { backgroundColor: filterBg, borderColor }]}>
            <Ionicons name="search" size={18} color={secondaryTextColor} />
            <TextInput
              ref={tagInputRef}
              style={[styles.searchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="搜索或输入标签..."
              placeholderTextColor={secondaryTextColor}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => handleTagAdd(tagInput.trim())}
            />
            {tagInput.length > 0 && (
              <TouchableOpacity onPress={() => setTagInput('')}>
                <Ionicons name="close-circle" size={18} color={secondaryTextColor} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={suggestedTags}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.suggestionItem, { borderBottomColor: borderColor }]} onPress={() => handleTagAdd(item.name)}>
                <ThemedText style={styles.suggestionText}>{item.name}</ThemedText>
                <ThemedText style={[styles.suggestionCount, { color: secondaryTextColor }]}>{item.count}</ThemedText>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              tagInput.trim() ? (
                <View style={styles.emptyHint}>
                  <ThemedText style={{ color: secondaryTextColor }}>没有匹配的标签，点击「添加」创建</ThemedText>
                </View>
              ) : (
                <View style={styles.emptyHint}>
                  <ThemedText style={{ color: secondaryTextColor }}>输入标签名称搜索</ThemedText>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  errorSubtext: { textAlign: 'center', marginBottom: 16 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#f97316', borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },

  // Filter Bar
  filterBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  directoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fff7ed' },
  directoryBtnActive: { backgroundColor: '#f97316' },
  directoryBtnText: { fontSize: 12, fontWeight: '500', color: '#f97316', maxWidth: 60 },
  filterButtons: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  filterButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  filterButtonActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  filterButtonText: { fontSize: 13, fontWeight: '500' },
  filterButtonTextActive: { color: '#000' },
  totalCount: { fontSize: 12 },
  countRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },

  // Tags
  tagsRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff7ed', paddingLeft: 10, paddingRight: 6, paddingVertical: 5, borderRadius: 14, marginRight: 8 },
  tagText: { fontSize: 12, color: '#f97316' },
  tagRemove: { fontSize: 16, color: '#f97316', marginLeft: 4 },
  addTagBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  addTagText: { fontSize: 12 },

  // Selection
  selectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  selectionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  selectionActions: { flexDirection: 'row', gap: 16 },
  selectionBtn: { color: '#fff', fontWeight: '500', fontSize: 14 },

  // List
  listContent: { padding: 8, flexGrow: 1 },
  row: { justifyContent: 'space-between' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  emptySubtext: { textAlign: 'center' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { fontSize: 16 },
  suggestionCount: { fontSize: 14 },
  emptyHint: { padding: 32, alignItems: 'center' },
});
