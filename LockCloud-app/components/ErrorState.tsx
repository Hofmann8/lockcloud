/**
 * ErrorState - Error display component with retry functionality
 * 
 * Requirements: 12.4 - Display error states with retry options
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

type ErrorVariant = 'error' | 'warning' | 'info';

interface ErrorStateProps {
  /** Error title (optional) */
  title?: string;
  /** Error message to display */
  message: string;
  /** Variant determines the color scheme */
  variant?: ErrorVariant;
  /** Retry action configuration */
  onRetry?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Additional action button */
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Custom icon name from Ionicons */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Whether to show in full screen mode */
  fullScreen?: boolean;
  /** Custom container style */
  style?: ViewStyle;
}

/**
 * Get icon name based on variant
 */
const getDefaultIcon = (variant: ErrorVariant): keyof typeof Ionicons.glyphMap => {
  switch (variant) {
    case 'error':
      return 'alert-circle-outline';
    case 'warning':
      return 'warning-outline';
    case 'info':
      return 'information-circle-outline';
    default:
      return 'alert-circle-outline';
  }
};

/**
 * ErrorState component for displaying errors with optional retry
 */
export function ErrorState({
  title,
  message,
  variant = 'error',
  onRetry,
  retryText = '重试',
  action,
  icon,
  fullScreen = false,
  style,
}: ErrorStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  // Get variant-specific colors
  const variantColors = {
    error: {
      background: `${colors.error}15`,
      border: `${colors.error}30`,
      icon: colors.error,
      text: colors.error,
    },
    warning: {
      background: `${colors.warning}15`,
      border: `${colors.warning}30`,
      icon: colors.warning,
      text: colors.warning,
    },
    info: {
      background: `${colors.info}15`,
      border: `${colors.info}30`,
      icon: colors.info,
      text: colors.info,
    },
  };

  const variantStyle = variantColors[variant];
  const iconName = icon || getDefaultIcon(variant);

  return (
    <View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        {
          backgroundColor: variantStyle.background,
          borderColor: variantStyle.border,
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons
            name={iconName}
            size={fullScreen ? 48 : 24}
            color={variantStyle.icon}
          />
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          {title && (
            <Text
              style={[
                styles.title,
                fullScreen && styles.titleFullScreen,
                { color: variantStyle.text },
              ]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          )}
          <Text
            style={[
              styles.message,
              fullScreen && styles.messageFullScreen,
              { color: colors.text },
            ]}
          >
            {message}
          </Text>
        </View>

        {/* Actions */}
        {(onRetry || action) && (
          <View style={[styles.actions, fullScreen && styles.actionsFullScreen]}>
            {onRetry && (
              <TouchableOpacity
                style={[
                  styles.retryButton,
                  { backgroundColor: variantStyle.icon },
                ]}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel={retryText}
                accessibilityHint="点击重新加载"
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={colors.textInverse}
                  style={styles.retryIcon}
                />
                <Text style={[styles.retryText, { color: colors.textInverse }]}>
                  {retryText}
                </Text>
              </TouchableOpacity>
            )}
            {action && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    borderColor: variantStyle.icon,
                  },
                ]}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Text style={[styles.actionText, { color: variantStyle.text }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Inline error card for smaller error displays
 */
export function ErrorCard({
  title,
  message,
  variant = 'error',
  onRetry,
  retryText = '重试',
  style,
}: Omit<ErrorStateProps, 'fullScreen' | 'action' | 'icon'>) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const variantColors = {
    error: {
      background: `${colors.error}10`,
      border: `${colors.error}25`,
      icon: colors.error,
      text: colors.error,
    },
    warning: {
      background: `${colors.warning}10`,
      border: `${colors.warning}25`,
      icon: colors.warning,
      text: colors.warning,
    },
    info: {
      background: `${colors.info}10`,
      border: `${colors.info}25`,
      icon: colors.info,
      text: colors.info,
    },
  };

  const variantStyle = variantColors[variant];
  const iconName = getDefaultIcon(variant);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variantStyle.background,
          borderColor: variantStyle.border,
        },
        style,
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.cardContent}>
        <Ionicons
          name={iconName}
          size={20}
          color={variantStyle.icon}
          style={styles.cardIcon}
        />
        <View style={styles.cardTextContainer}>
          {title && (
            <Text style={[styles.cardTitle, { color: variantStyle.text }]}>
              {title}
            </Text>
          )}
          <Text style={[styles.cardMessage, { color: colors.text }]}>
            {message}
          </Text>
        </View>
      </View>
      {onRetry && (
        <TouchableOpacity
          style={styles.cardRetry}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryText}
        >
          <Text style={[styles.cardRetryText, { color: variantStyle.text }]}>
            {retryText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Network error state with offline indicator
 */
export function NetworkErrorState({
  onRetry,
  style,
}: {
  onRetry?: () => void;
  style?: ViewStyle;
}) {
  return (
    <ErrorState
      title="网络连接失败"
      message="请检查您的网络设置，然后重试"
      variant="error"
      icon="cloud-offline-outline"
      onRetry={onRetry}
      retryText="重新连接"
      fullScreen
      style={style}
    />
  );
}

/**
 * Server error state
 */
export function ServerErrorState({
  onRetry,
  style,
}: {
  onRetry?: () => void;
  style?: ViewStyle;
}) {
  return (
    <ErrorState
      title="服务器错误"
      message="服务器暂时无法响应，请稍后再试"
      variant="error"
      icon="server-outline"
      onRetry={onRetry}
      fullScreen
      style={style}
    />
  );
}

/**
 * Permission denied error state
 */
export function PermissionDeniedState({
  message = '您没有权限访问此内容',
  onGoBack,
  style,
}: {
  message?: string;
  onGoBack?: () => void;
  style?: ViewStyle;
}) {
  return (
    <ErrorState
      title="访问被拒绝"
      message={message}
      variant="warning"
      icon="lock-closed-outline"
      action={
        onGoBack
          ? {
              label: '返回',
              onPress: onGoBack,
            }
          : undefined
      }
      fullScreen
      style={style}
    />
  );
}

/**
 * Not found error state
 */
export function NotFoundState({
  message = '您访问的内容不存在或已被删除',
  onGoBack,
  style,
}: {
  message?: string;
  onGoBack?: () => void;
  style?: ViewStyle;
}) {
  return (
    <ErrorState
      title="内容不存在"
      message={message}
      variant="info"
      icon="search-outline"
      action={
        onGoBack
          ? {
              label: '返回',
              onPress: onGoBack,
            }
          : undefined
      }
      fullScreen
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
    borderWidth: 0,
    padding: Spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.md,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  titleFullScreen: {
    fontSize: FontSizes.xl,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.5,
    textAlign: 'center',
  },
  messageFullScreen: {
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.6,
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  actionsFullScreen: {
    marginTop: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minHeight: TouchTargets.min,
    minWidth: 100,
  },
  retryIcon: {
    marginRight: Spacing.xs,
  },
  retryText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: TouchTargets.min,
    minWidth: 80,
  },
  actionText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },

  // Card styles
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.xs,
  },
  cardMessage: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.5,
  },
  cardRetry: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  cardRetryText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});

export default ErrorState;
