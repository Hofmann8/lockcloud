/**
 * OfflineIndicator - Component to display offline status
 * 
 * Shows a banner or indicator when the device is offline.
 * Can be used as a banner at the top of screens or as a standalone component.
 * 
 * Requirements: 11.3 - WHEN offline, THE Mobile_App SHALL display cached content with an offline indicator
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsOffline, useNetworkStatusWithRefresh, getConnectionTypeName } from '@/hooks/useNetworkStatus';
import { t } from '@/locales';
import { useThemeColor } from '@/hooks/use-theme-color';

interface OfflineIndicatorProps {
  /** Style variant: 'banner' shows at top, 'inline' shows in content area */
  variant?: 'banner' | 'inline';
  /** Whether to show a reconnect button */
  showReconnectButton?: boolean;
  /** Custom message to display */
  message?: string;
  /** Callback when reconnect button is pressed */
  onReconnect?: () => void;
}

/**
 * Offline indicator component
 * 
 * @example
 * ```tsx
 * // As a banner at the top of a screen
 * <OfflineIndicator variant="banner" />
 * 
 * // As an inline indicator with reconnect button
 * <OfflineIndicator 
 *   variant="inline" 
 *   showReconnectButton 
 *   onReconnect={() => refetch()} 
 * />
 * ```
 */
export function OfflineIndicator({
  variant = 'banner',
  showReconnectButton = false,
  message,
  onReconnect,
}: OfflineIndicatorProps) {
  const isOffline = useIsOffline();
  const { refresh, connectionType } = useNetworkStatusWithRefresh();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  // Don't render if online
  if (!isOffline) {
    return null;
  }

  const handleReconnect = async () => {
    await refresh();
    onReconnect?.();
  };

  const displayMessage = message || t('empty.offline');
  const connectionTypeName = getConnectionTypeName(connectionType);

  if (variant === 'banner') {
    return (
      <View style={styles.banner}>
        <Ionicons name="cloud-offline" size={16} color="#fff" />
        <Text style={styles.bannerText}>{displayMessage}</Text>
        {showReconnectButton && (
          <TouchableOpacity onPress={handleReconnect} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>{t('errors.reconnect')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Inline variant
  return (
    <View style={[styles.inline, { backgroundColor }]}>
      <View style={styles.inlineIconContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
      </View>
      <Text style={[styles.inlineTitle, { color: textColor }]}>
        {displayMessage}
      </Text>
      <Text style={[styles.inlineHint, { color: '#9CA3AF' }]}>
        {t('empty.offlineHint')}
      </Text>
      <Text style={[styles.connectionType, { color: '#9CA3AF' }]}>
        连接类型: {connectionTypeName}
      </Text>
      {showReconnectButton && (
        <TouchableOpacity 
          onPress={handleReconnect} 
          style={styles.inlineButton}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.inlineButtonText}>{t('empty.reconnect')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Hook-based offline banner that can be conditionally rendered
 * Returns null when online, renders banner when offline
 */
export function OfflineBanner() {
  return <OfflineIndicator variant="banner" />;
}

/**
 * Wrapper component that shows offline indicator when offline
 * and renders children when online
 */
interface OfflineAwareProps {
  children: React.ReactNode;
  /** Whether to show children even when offline (with indicator) */
  showChildrenWhenOffline?: boolean;
  /** Fallback component to show when offline */
  fallback?: React.ReactNode;
}

export function OfflineAware({
  children,
  showChildrenWhenOffline = true,
  fallback,
}: OfflineAwareProps) {
  const isOffline = useIsOffline();

  if (isOffline) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showChildrenWhenOffline) {
      return (
        <>
          <OfflineIndicator variant="banner" />
          {children}
        </>
      );
    }
    
    return <OfflineIndicator variant="inline" showReconnectButton />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  // Banner styles
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444', // Red background
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  bannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Inline styles
  inline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  inlineIconContainer: {
    marginBottom: 16,
  },
  inlineTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  inlineHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  connectionType: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6', // Blue
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  inlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OfflineIndicator;
