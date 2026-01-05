/**
 * useNetworkStatus - Hook for monitoring network connectivity
 * 
 * Provides real-time network status detection and offline indicator support.
 * Uses @react-native-community/netinfo for cross-platform network monitoring.
 * 
 * Requirements: 11.3 - WHEN offline, THE Mobile_App SHALL display cached content with an offline indicator
 */

import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

/**
 * Network status information
 */
export interface NetworkStatus {
  /** Whether the device is connected to the internet */
  isConnected: boolean;
  /** Whether the connection is reachable (can actually reach the internet) */
  isInternetReachable: boolean | null;
  /** The type of connection (wifi, cellular, etc.) */
  connectionType: NetInfoStateType;
  /** Whether the network status is still being determined */
  isLoading: boolean;
}

/**
 * Hook for monitoring network connectivity status
 * 
 * @returns NetworkStatus object with connection information
 * 
 * @example
 * ```tsx
 * const { isConnected, isInternetReachable, connectionType } = useNetworkStatus();
 * 
 * if (!isConnected) {
 *   return <OfflineIndicator />;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true, // Assume connected initially
    isInternetReachable: null,
    connectionType: NetInfoStateType.unknown,
    isLoading: true,
  });

  useEffect(() => {
    // Fetch initial network state
    const fetchInitialState = async () => {
      try {
        const state = await NetInfo.fetch();
        setStatus({
          isConnected: state.isConnected ?? false,
          isInternetReachable: state.isInternetReachable,
          connectionType: state.type,
          isLoading: false,
        });
      } catch (error) {
        console.warn('Failed to fetch initial network state:', error);
        setStatus(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchInitialState();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        isLoading: false,
      });
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}

/**
 * Hook that returns a simple boolean for offline status
 * Useful for quick checks without full network details
 * 
 * @returns true if offline, false if online
 */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable, isLoading } = useNetworkStatus();
  
  // If still loading, assume online
  if (isLoading) return false;
  
  // Check both connection and internet reachability
  // isInternetReachable can be null if not yet determined
  if (!isConnected) return true;
  if (isInternetReachable === false) return true;
  
  return false;
}

/**
 * Hook that provides a refresh function to manually check network status
 * 
 * @returns Object with network status and refresh function
 */
export function useNetworkStatusWithRefresh() {
  const status = useNetworkStatus();
  
  const refresh = useCallback(async (): Promise<NetworkStatus> => {
    try {
      const state = await NetInfo.fetch();
      return {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        isLoading: false,
      };
    } catch (error) {
      console.warn('Failed to refresh network state:', error);
      return status;
    }
  }, [status]);

  return {
    ...status,
    refresh,
  };
}

/**
 * Get connection type display name in Chinese
 * 
 * @param type - NetInfo connection type
 * @returns Chinese display name for the connection type
 */
export function getConnectionTypeName(type: NetInfoStateType): string {
  switch (type) {
    case NetInfoStateType.wifi:
      return 'Wi-Fi';
    case NetInfoStateType.cellular:
      return '蜂窝数据';
    case NetInfoStateType.bluetooth:
      return '蓝牙';
    case NetInfoStateType.ethernet:
      return '以太网';
    case NetInfoStateType.vpn:
      return 'VPN';
    case NetInfoStateType.other:
      return '其他';
    case NetInfoStateType.none:
      return '无连接';
    case NetInfoStateType.unknown:
    default:
      return '未知';
  }
}

export default useNetworkStatus;
