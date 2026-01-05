/**
 * DirectoryTree Component
 * 
 * Mobile-friendly directory tree navigation as a bottom sheet.
 * Follows the Web frontend Sidebar implementation.
 * 
 * Features:
 * - Year/Month/Activity hierarchy
 * - Expandable tree structure
 * - Activity type icons
 * - File count display
 * - Filter by selection
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { getDirectories } from '@/lib/api/files';
import { DirectoryNode } from '@/types';

// Activity type configuration with icons and colors
const ACTIVITY_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  regular_training: { icon: 'time', color: '#3b82f6', label: '例训' },
  competition: { icon: 'trophy', color: '#eab308', label: '比赛' },
  internal_training: { icon: 'business', color: '#a855f7', label: '内训' },
  master_class: { icon: 'star', color: '#f59e0b', label: '大师课' },
  special_event: { icon: 'sparkles', color: '#ec4899', label: '特殊活动' },
  team_building: { icon: 'people', color: '#22c55e', label: '团建' },
};

const DEFAULT_ACTIVITY_CONFIG = { icon: 'pricetag', color: '#6b7280', label: '活动' };

interface DirectoryFilters {
  year?: number;
  month?: number;
  activity_date?: string;
  activity_name?: string;
  activity_type?: string;
}

interface DirectoryTreeProps {
  visible: boolean;
  onClose: () => void;
  currentFilters?: DirectoryFilters;
  onFilterChange: (filters: DirectoryFilters) => void;
}

/**
 * Format activity display name: "日-活动名"
 */
function formatActivityDisplayName(node: DirectoryNode): string {
  if (node.activity_date && node.activity_name) {
    const day = node.activity_date.split('-')[2];
    return `${day}日-${node.activity_name}`;
  }
  return node.name;
}

/**
 * Get activity type config
 */
function getActivityTypeConfig(activityType?: string) {
  if (!activityType) return DEFAULT_ACTIVITY_CONFIG;
  return ACTIVITY_TYPE_CONFIG[activityType] || DEFAULT_ACTIVITY_CONFIG;
}

interface DirectoryItemProps {
  node: DirectoryNode;
  level: number;
  currentFilters?: DirectoryFilters;
  onSelect: (filters: DirectoryFilters) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}

function DirectoryItem({
  node,
  level,
  currentFilters,
  onSelect,
  expandedPaths,
  onToggleExpand,
}: DirectoryItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const hasChildren = node.subdirectories && node.subdirectories.length > 0;
  const isExpanded = expandedPaths.has(node.path);
  const fileCount = node.file_count || 0;

  // Determine if this node is active
  const isActive = useMemo(() => {
    if (!currentFilters) return false;
    
    const parts = node.path.split('/');
    if (level === 0) {
      // Year level
      return currentFilters.year === parseInt(parts[0]) && 
             !currentFilters.month && 
             !currentFilters.activity_date;
    } else if (level === 1) {
      // Month level
      return currentFilters.year === parseInt(parts[0]) &&
             currentFilters.month === parseInt(parts[1]) &&
             !currentFilters.activity_date;
    } else if (level === 2) {
      // Activity level
      return currentFilters.activity_date === node.activity_date &&
             currentFilters.activity_name === node.activity_name &&
             currentFilters.activity_type === node.activity_type;
    }
    return false;
  }, [currentFilters, node, level]);

  // Build filters for this node
  const buildFilters = useCallback((): DirectoryFilters => {
    const parts = node.path.split('/');
    if (level === 0) {
      return { year: parseInt(parts[0]) };
    } else if (level === 1) {
      return { year: parseInt(parts[0]), month: parseInt(parts[1]) };
    } else if (level === 2) {
      return {
        year: parseInt(parts[0]),
        month: parseInt(parts[1]),
        activity_date: node.activity_date,
        activity_name: node.activity_name,
        activity_type: node.activity_type,
      };
    }
    return {};
  }, [node, level]);

  // Handle item press
  const handlePress = useCallback(() => {
    onSelect(buildFilters());
  }, [onSelect, buildFilters]);

  // Handle expand toggle
  const handleToggle = useCallback(() => {
    onToggleExpand(node.path);
  }, [onToggleExpand, node.path]);

  // Get display name and icon based on level
  const isActivityLevel = level === 2;
  const displayName = isActivityLevel ? formatActivityDisplayName(node) : node.name;
  const activityConfig = isActivityLevel ? getActivityTypeConfig(node.activity_type) : null;

  // Format display text based on level
  const getDisplayText = () => {
    if (level === 0) {
      // Year level - remove any existing "年" suffix first, then add it
      const cleanName = displayName.replace(/年+$/g, '');
      return `${cleanName}年`;
    } else if (level === 1) {
      // Month level - remove any existing "月" suffix first, then add it
      const cleanName = displayName.replace(/月+$/g, '');
      return `${cleanName}月`;
    }
    return displayName;
  };

  const textColor = colorScheme === 'dark' ? '#fff' : '#000';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const activeBackground = colorScheme === 'dark' ? 'rgba(249, 115, 22, 0.2)' : '#fff7ed';

  return (
    <View>
      <View style={[styles.itemRow, { paddingLeft: 16 + level * 20 }]}>
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <TouchableOpacity style={styles.expandButton} onPress={handleToggle}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={secondaryTextColor}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.expandPlaceholder} />
        )}

        {/* Item Content */}
        <TouchableOpacity
          style={[
            styles.itemContent,
            isActive && { backgroundColor: activeBackground },
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          {/* Icon */}
          {level === 0 ? (
            <Ionicons name="calendar" size={18} color="#f97316" style={styles.itemIcon} />
          ) : level === 1 ? (
            <Ionicons name="folder" size={18} color={secondaryTextColor} style={styles.itemIcon} />
          ) : activityConfig ? (
            <Ionicons
              name={activityConfig.icon as any}
              size={18}
              color={activityConfig.color}
              style={styles.itemIcon}
            />
          ) : null}

          {/* Name */}
          <ThemedText
            style={[
              styles.itemName,
              { color: isActive ? '#f97316' : textColor },
            ]}
            numberOfLines={1}
          >
            {getDisplayText()}
          </ThemedText>

          {/* File Count */}
          {fileCount > 0 && (
            <ThemedText style={[styles.itemCount, { color: secondaryTextColor }]}>
              {fileCount}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Children */}
      {hasChildren && isExpanded && (
        <View>
          {node.subdirectories!.map((child) => (
            <DirectoryItem
              key={child.path}
              node={child}
              level={level + 1}
              currentFilters={currentFilters}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * DirectoryTree - Bottom sheet directory navigation
 */
export function DirectoryTree({
  visible,
  onClose,
  currentFilters,
  onFilterChange,
}: DirectoryTreeProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const queryClient = useQueryClient();
  
  // Track expanded paths
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Fetch directories
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['directories'],
    queryFn: getDirectories,
    staleTime: 5 * 60 * 1000,
  });

  const directories = data?.directories || [];

  // Auto-expand current filter path
  useEffect(() => {
    if (currentFilters?.year) {
      setExpandedPaths((prev) => {
        const newExpanded = new Set(prev);
        newExpanded.add(String(currentFilters.year));
        if (currentFilters.month) {
          newExpanded.add(`${currentFilters.year}/${String(currentFilters.month).padStart(2, '0')}`);
        }
        return newExpanded;
      });
    }
  }, [currentFilters?.year, currentFilters?.month]);

  // Handle expand toggle
  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle selection
  const handleSelect = useCallback((filters: DirectoryFilters) => {
    onFilterChange(filters);
    onClose();
  }, [onFilterChange, onClose]);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    onFilterChange({});
    onClose();
  }, [onFilterChange, onClose]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['files'] });
  }, [refetch, queryClient]);

  const backgroundColor = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const borderColor = colorScheme === 'dark' ? '#3c3c3e' : '#e5e5e5';
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';

  // Check if any filter is active
  const hasActiveFilter = currentFilters && (
    currentFilters.year || 
    currentFilters.activity_date
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor }]}>
        {/* Drag Handle */}
        <View style={styles.dragHandle}>
          <View style={styles.dragIndicator} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <ThemedText style={styles.closeText}>关闭</ThemedText>
          </TouchableOpacity>
          
          <ThemedText style={styles.title}>目录</ThemedText>
          
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={isFetching}
            style={styles.headerButton}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={isFetching ? secondaryTextColor : '#f97316'}
              style={isFetching ? styles.spinning : undefined}
            />
          </TouchableOpacity>
        </View>

        {/* Current Filter Banner */}
        {hasActiveFilter && (
          <View style={[styles.filterBanner, { backgroundColor: '#fff7ed' }]}>
            <ThemedText style={styles.filterBannerText}>
              当前筛选: {currentFilters?.year}年
              {currentFilters?.month ? `${currentFilters.month}月` : ''}
              {currentFilters?.activity_name ? ` - ${currentFilters.activity_name}` : ''}
            </ThemedText>
            <TouchableOpacity onPress={handleClearFilters}>
              <ThemedText style={styles.clearFilterText}>清除</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* All Files Link */}
        <TouchableOpacity
          style={[styles.allFilesButton, { borderBottomColor: borderColor }]}
          onPress={handleClearFilters}
          activeOpacity={0.7}
        >
          <Ionicons name="folder" size={20} color="#f97316" style={styles.allFilesIcon} />
          <ThemedText style={styles.allFilesText}>全部文件</ThemedText>
        </TouchableOpacity>

        {/* Directory List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f97316" />
              <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
                加载目录...
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="warning" size={32} color="#ef4444" />
              <ThemedText style={styles.errorText}>加载失败</ThemedText>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <ThemedText style={styles.retryButtonText}>重试</ThemedText>
              </TouchableOpacity>
            </View>
          ) : directories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="folder" size={48} color={secondaryTextColor} />
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                暂无文件
              </ThemedText>
            </View>
          ) : (
            directories.map((node) => (
              <DirectoryItem
                key={node.path}
                node={node}
                level={0}
                currentFilters={currentFilters}
                onSelect={handleSelect}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
              />
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    minWidth: 50,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#f97316',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  spinning: {
    opacity: 0.5,
  },
  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterBannerText: {
    fontSize: 13,
    color: '#f97316',
    flex: 1,
  },
  clearFilterText: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '600',
  },
  allFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allFilesIcon: {
    marginRight: 10,
  },
  allFilesText: {
    fontSize: 15,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 48,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f97316',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  // Directory Item styles
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingVertical: 2,
  },
  expandButton: {
    width: 28,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandPlaceholder: {
    width: 28,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
  },
  itemIcon: {
    marginRight: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
  },
  itemCount: {
    fontSize: 13,
    marginLeft: 8,
  },
});

export default DirectoryTree;
