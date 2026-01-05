/**
 * EmptyState - Empty list/content placeholder component
 * 
 * Requirements: 12.4 - Display empty states with guidance
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Colors,
  BorderRadius,
  Spacing,
  FontSizes,
  FontWeights,
  TouchTargets,
} from '@/constants/theme';

interface EmptyStateProps {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Icon name from Ionicons */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Primary action button */
  action?: {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  /** Custom container style */
  style?: ViewStyle;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * EmptyState component for displaying empty content with guidance
 */
export function EmptyState({
  title,
  description,
  icon = 'folder-open-outline',
  action,
  secondaryAction,
  style,
  compact = false,
}: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        { backgroundColor: colors.background },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          compact && styles.iconContainerCompact,
          { backgroundColor: colors.backgroundSecondary },
        ]}
      >
        <Ionicons
          name={icon}
          size={compact ? 32 : 48}
          color={colors.textTertiary}
        />
      </View>

      {/* Text content */}
      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>

      {description && (
        <Text
          style={[
            styles.description,
            compact && styles.descriptionCompact,
            { color: colors.textSecondary },
          ]}
        >
          {description}
        </Text>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {action && (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              {action.icon && (
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={colors.primaryText}
                  style={styles.buttonIcon}
                />
              )}
              <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          )}
          {secondaryAction && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: colors.border },
              ]}
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {secondaryAction.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Empty files state
 */
export function EmptyFilesState({
  onUpload,
  style,
}: {
  onUpload?: () => void;
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="暂无文件"
      description="您还没有上传任何文件，点击下方按钮开始上传"
      icon="cloud-upload-outline"
      action={
        onUpload
          ? {
              label: '上传文件',
              onPress: onUpload,
              icon: 'add-outline',
            }
          : undefined
      }
      style={style}
    />
  );
}

/**
 * Empty search results state
 */
export function EmptySearchState({
  searchTerm,
  onClearSearch,
  style,
}: {
  searchTerm?: string;
  onClearSearch?: () => void;
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="未找到结果"
      description={
        searchTerm
          ? `没有找到与"${searchTerm}"相关的内容`
          : '没有找到符合条件的内容'
      }
      icon="search-outline"
      action={
        onClearSearch
          ? {
              label: '清除筛选',
              onPress: onClearSearch,
            }
          : undefined
      }
      style={style}
    />
  );
}

/**
 * Empty requests state
 */
export function EmptyRequestsState({
  type = 'received',
  style,
}: {
  type?: 'received' | 'sent';
  style?: ViewStyle;
}) {
  const isReceived = type === 'received';
  
  return (
    <EmptyState
      title={isReceived ? '暂无收到的请求' : '暂无发出的请求'}
      description={
        isReceived
          ? '当其他用户请求编辑您的文件时，会显示在这里'
          : '当您请求编辑其他用户的文件时，会显示在这里'
      }
      icon={isReceived ? 'mail-outline' : 'paper-plane-outline'}
      style={style}
    />
  );
}

/**
 * Empty tags state
 */
export function EmptyTagsState({
  onAddTag,
  style,
}: {
  onAddTag?: () => void;
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="暂无标签"
      description="添加标签可以帮助您更好地组织和查找文件"
      icon="pricetag-outline"
      action={
        onAddTag
          ? {
              label: '添加标签',
              onPress: onAddTag,
              icon: 'add-outline',
            }
          : undefined
      }
      compact
      style={style}
    />
  );
}

/**
 * Empty upload queue state
 */
export function EmptyUploadQueueState({
  onSelectFiles,
  style,
}: {
  onSelectFiles?: () => void;
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="上传队列为空"
      description="选择文件后，它们将显示在这里等待上传"
      icon="layers-outline"
      action={
        onSelectFiles
          ? {
              label: '选择文件',
              onPress: onSelectFiles,
              icon: 'images-outline',
            }
          : undefined
      }
      style={style}
    />
  );
}

/**
 * Empty selection state (for batch operations)
 */
export function EmptySelectionState({
  style,
}: {
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="未选择文件"
      description="长按文件卡片进入选择模式，然后点击选择要操作的文件"
      icon="checkbox-outline"
      compact
      style={style}
    />
  );
}

/**
 * Offline state
 */
export function OfflineState({
  onRetry,
  style,
}: {
  onRetry?: () => void;
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="您已离线"
      description="部分功能可能不可用，请检查网络连接"
      icon="cloud-offline-outline"
      action={
        onRetry
          ? {
              label: '重新连接',
              onPress: onRetry,
              icon: 'refresh-outline',
            }
          : undefined
      }
      style={style}
    />
  );
}

/**
 * Coming soon state (for features not yet implemented)
 */
export function ComingSoonState({
  featureName,
  style,
}: {
  featureName?: string;
  style?: ViewStyle;
}) {
  return (
    <EmptyState
      title="即将推出"
      description={
        featureName
          ? `${featureName}功能正在开发中，敬请期待`
          : '此功能正在开发中，敬请期待'
      }
      icon="construct-outline"
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  containerCompact: {
    flex: 0,
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainerCompact: {
    width: 64,
    height: 64,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  titleCompact: {
    fontSize: FontSizes.base,
  },
  description: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    textAlign: 'center',
    maxWidth: 280,
  },
  descriptionCompact: {
    fontSize: FontSizes.sm,
    maxWidth: 240,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  actionsCompact: {
    marginTop: Spacing.lg,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minHeight: TouchTargets.min,
    minWidth: 140,
  },
  buttonIcon: {
    marginRight: Spacing.xs,
  },
  primaryButtonText: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: TouchTargets.min,
    minWidth: 120,
  },
  secondaryButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});

export default EmptyState;
