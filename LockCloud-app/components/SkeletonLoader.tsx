/**
 * SkeletonLoader - Modern loading placeholder components
 * Uses shimmer animation for a polished loading experience
 * 
 * Requirements: 12.3 - Display loading states with skeleton loaders
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Base Skeleton component with shimmer animation
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = BorderRadius.md,
  style,
}: SkeletonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: typeof width === 'number' ? width : width,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
      accessibilityRole="none"
      accessibilityLabel="加载中"
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: colors.skeletonHighlight,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

/**
 * File card skeleton for grid view
 */
export function FileCardSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.fileCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      {/* Thumbnail skeleton */}
      <Skeleton
        width="100%"
        height={160}
        borderRadius={BorderRadius.lg}
        style={styles.thumbnail}
      />

      {/* File name skeleton */}
      <Skeleton
        width="75%"
        height={16}
        style={styles.fileName}
      />

      {/* Metadata skeleton */}
      <View style={styles.metadata}>
        <Skeleton width="50%" height={12} />
        <Skeleton width="65%" height={12} style={styles.metadataItem} />
      </View>

      {/* Tags skeleton */}
      <View style={styles.tags}>
        <Skeleton width={60} height={24} borderRadius={BorderRadius.full} />
        <Skeleton width={80} height={24} borderRadius={BorderRadius.full} />
      </View>
    </View>
  );
}

/**
 * File grid skeleton for loading multiple cards
 */
export function FileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.gridItem}>
          <FileCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/**
 * File list skeleton for list view
 */
export function FileListSkeleton({ count = 5 }: { count?: number }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.listItem,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          {/* Icon/Thumbnail skeleton */}
          <Skeleton
            width={48}
            height={48}
            borderRadius={BorderRadius.lg}
          />

          {/* Content skeleton */}
          <View style={styles.listContent}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} style={styles.listSubtext} />
          </View>

          {/* Action skeleton */}
          <Skeleton
            width={32}
            height={32}
            borderRadius={BorderRadius.full}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Request card skeleton
 */
export function RequestCardSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.requestCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.requestHeader}>
        <Skeleton width={40} height={40} borderRadius={BorderRadius.full} />
        <View style={styles.requestHeaderContent}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={12} style={styles.requestSubtext} />
        </View>
        <Skeleton width={60} height={24} borderRadius={BorderRadius.full} />
      </View>

      {/* Content */}
      <Skeleton width="100%" height={60} style={styles.requestContent} />

      {/* Actions */}
      <View style={styles.requestActions}>
        <Skeleton width={80} height={36} borderRadius={BorderRadius.md} />
        <Skeleton width={80} height={36} borderRadius={BorderRadius.md} />
      </View>
    </View>
  );
}

/**
 * Request list skeleton
 */
export function RequestListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <RequestCardSkeleton key={index} />
      ))}
    </View>
  );
}

/**
 * Upload form skeleton
 */
export function UploadFormSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.form,
        { backgroundColor: colors.cardBackground },
      ]}
    >
      {/* Form fields */}
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.formField}>
          <Skeleton width={80} height={14} style={styles.formLabel} />
          <Skeleton width="100%" height={44} borderRadius={BorderRadius.md} />
        </View>
      ))}

      {/* Submit button */}
      <Skeleton
        width="100%"
        height={48}
        borderRadius={BorderRadius.md}
        style={styles.submitButton}
      />
    </View>
  );
}

/**
 * Profile skeleton
 */
export function ProfileSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.profile}>
      {/* Avatar */}
      <Skeleton
        width={80}
        height={80}
        borderRadius={BorderRadius.full}
        style={styles.avatar}
      />

      {/* Name */}
      <Skeleton width={120} height={20} style={styles.profileName} />

      {/* Email */}
      <Skeleton width={180} height={14} style={styles.profileEmail} />

      {/* Stats */}
      <View style={styles.profileStats}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.statCard,
              { backgroundColor: colors.backgroundSecondary },
            ]}
          >
            <Skeleton width={40} height={24} />
            <Skeleton width={60} height={12} style={styles.statLabel} />
          </View>
        ))}
      </View>

      {/* Menu items */}
      <View style={styles.menuItems}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.menuItem,
              { borderBottomColor: colors.border },
            ]}
          >
            <Skeleton width={24} height={24} borderRadius={BorderRadius.sm} />
            <Skeleton width="60%" height={16} style={styles.menuText} />
            <Skeleton width={20} height={20} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Timeline navigation skeleton
 */
export function TimelineSkeleton() {
  return (
    <View style={styles.timeline}>
      {Array.from({ length: 4 }).map((_, yearIndex) => (
        <View key={yearIndex} style={styles.timelineYear}>
          <Skeleton width={60} height={20} />
          <View style={styles.timelineMonths}>
            {Array.from({ length: 3 }).map((_, monthIndex) => (
              <Skeleton
                key={monthIndex}
                width={80}
                height={16}
                style={styles.timelineMonth}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * File detail skeleton
 */
export function FileDetailSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.fileDetail}>
      {/* Media preview */}
      <Skeleton
        width="100%"
        height={300}
        borderRadius={0}
      />

      {/* Metadata section */}
      <View
        style={[
          styles.detailSection,
          { backgroundColor: colors.cardBackground },
        ]}
      >
        <Skeleton width="70%" height={20} style={styles.detailTitle} />
        
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles.detailRow}>
            <Skeleton width={80} height={14} />
            <Skeleton width="50%" height={14} />
          </View>
        ))}
      </View>

      {/* Tags section */}
      <View
        style={[
          styles.detailSection,
          { backgroundColor: colors.cardBackground },
        ]}
      >
        <Skeleton width={60} height={16} style={styles.sectionTitle} />
        <View style={styles.tags}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              width={70}
              height={28}
              borderRadius={BorderRadius.full}
            />
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.detailActions}>
        <Skeleton width="48%" height={44} borderRadius={BorderRadius.md} />
        <Skeleton width="48%" height={44} borderRadius={BorderRadius.md} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    opacity: 0.5,
  },
  
  // File card styles
  fileCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  thumbnail: {
    marginBottom: Spacing.sm,
  },
  fileName: {
    marginBottom: Spacing.sm,
  },
  metadata: {
    marginBottom: Spacing.sm,
  },
  metadataItem: {
    marginTop: Spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  
  // Grid styles
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: Spacing.xs,
  },
  
  // List styles
  list: {
    gap: Spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  listContent: {
    flex: 1,
  },
  listSubtext: {
    marginTop: Spacing.xs,
  },
  
  // Request card styles
  requestCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  requestHeaderContent: {
    flex: 1,
  },
  requestSubtext: {
    marginTop: Spacing.xs,
  },
  requestContent: {
    marginVertical: Spacing.md,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  
  // Form styles
  form: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  formField: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    marginBottom: Spacing.xs,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  
  // Profile styles
  profile: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  avatar: {
    marginBottom: Spacing.md,
  },
  profileName: {
    marginBottom: Spacing.xs,
  },
  profileEmail: {
    marginBottom: Spacing.lg,
  },
  profileStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 80,
  },
  statLabel: {
    marginTop: Spacing.xs,
  },
  menuItems: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  menuText: {
    flex: 1,
  },
  
  // Timeline styles
  timeline: {
    padding: Spacing.md,
  },
  timelineYear: {
    marginBottom: Spacing.lg,
  },
  timelineMonths: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.md,
  },
  timelineMonth: {
    marginBottom: Spacing.xs,
  },
  
  // File detail styles
  fileDetail: {
    flex: 1,
  },
  detailSection: {
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  detailTitle: {
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
});

export default Skeleton;
