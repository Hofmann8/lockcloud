/**
 * Requests Tab Screen
 * 
 * Displays file edit requests with tab switching between received and sent requests.
 * Follows the Web frontend implementation (lockcloud-frontend/app/(dashboard)/requests/page.tsx).
 * 
 * Features:
 * - Tab switching: 收到的/发出的
 * - Request list display
 * - Pending count badge
 * - Status filter (全部/待处理/已批准/已拒绝)
 * - Approve/Reject actions for received requests
 * 
 * Requirements: 8.2, 8.3, 8.4
 */

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/components/ui/Icon';
import { RequestCard } from '@/components/RequestCard';
import {
  getReceivedRequests,
  getSentRequests,
  getPendingCount,
  approveRequest,
  rejectRequest,
} from '@/lib/api/requests';
import { Colors } from '@/constants/theme';
import { FileRequest } from '@/types';

type TabType = 'received' | 'sent';
type StatusFilter = '' | 'pending' | 'approved' | 'rejected';

/**
 * RequestsScreen - File edit requests management
 * 
 * Requirements: 8.2, 8.3, 8.4
 */
export default function RequestsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  // Fetch pending count for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['requests', 'pending-count'],
    queryFn: getPendingCount,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch received requests
  const {
    data: receivedRequests,
    isLoading: loadingReceived,
    refetch: refetchReceived,
    isRefetching: isRefetchingReceived,
  } = useQuery({
    queryKey: ['requests', 'received', statusFilter],
    queryFn: () => getReceivedRequests(statusFilter || undefined),
    enabled: activeTab === 'received',
  });

  // Fetch sent requests
  const {
    data: sentRequests,
    isLoading: loadingSent,
    refetch: refetchSent,
    isRefetching: isRefetchingSent,
  } = useQuery({
    queryKey: ['requests', 'sent', statusFilter],
    queryFn: () => getSentRequests(statusFilter || undefined),
    enabled: activeTab === 'sent',
  });

  // Invalidate all related queries after mutation
  const invalidateAllRelatedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['directories'] });
  }, [queryClient]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: number) => approveRequest(requestId),
    onSuccess: () => {
      invalidateAllRelatedQueries();
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (requestId: number) => rejectRequest(requestId),
    onSuccess: () => {
      invalidateAllRelatedQueries();
    },
  });

  // Handle approve
  const handleApprove = useCallback((requestId: number) => {
    approveMutation.mutate(requestId);
  }, [approveMutation]);

  // Handle reject
  const handleReject = useCallback((requestId: number) => {
    rejectMutation.mutate(requestId);
  }, [rejectMutation]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (activeTab === 'received') {
      refetchReceived();
    } else {
      refetchSent();
    }
    queryClient.invalidateQueries({ queryKey: ['requests', 'pending-count'] });
  }, [activeTab, refetchReceived, refetchSent, queryClient]);

  const isLoading = activeTab === 'received' ? loadingReceived : loadingSent;
  const isRefetching = activeTab === 'received' ? isRefetchingReceived : isRefetchingSent;
  const requests: FileRequest[] = activeTab === 'received' 
    ? (receivedRequests || []) 
    : (sentRequests || []);
  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  // Theme colors
  const secondaryTextColor = colorScheme === 'dark' ? '#8e8e93' : '#6b7280';
  const borderColor = colorScheme === 'dark' ? '#2c2c2e' : '#e5e5e5';
  const cardBackground = colorScheme === 'dark' ? '#1c1c1e' : '#fff';
  const activeTabColor = '#f97316';
  const filterActiveBackground = colorScheme === 'dark' ? '#2c2c2e' : '#fff';
  const filterBackground = colorScheme === 'dark' ? '#1c1c1e' : '#f3f4f6';

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: '', label: '全部' },
    { value: 'pending', label: '待处理' },
    { value: 'approved', label: '已批准' },
    { value: 'rejected', label: '已拒绝' },
  ];

  return (
    <ThemedView style={styles.container}>
      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'received' && [styles.activeTab, { borderBottomColor: activeTabColor }],
          ]}
          onPress={() => setActiveTab('received')}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === 'received' && { color: activeTabColor },
            ]}
          >
            收到的请求
          </ThemedText>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>
                {pendingCount > 99 ? '99+' : pendingCount}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'sent' && [styles.activeTab, { borderBottomColor: activeTabColor }],
          ]}
          onPress={() => setActiveTab('sent')}
        >
          <ThemedText
            style={[
              styles.tabText,
              activeTab === 'sent' && { color: activeTabColor },
            ]}
          >
            发出的请求
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <ThemedText style={[styles.filterLabel, { color: secondaryTextColor }]}>
          状态:
        </ThemedText>
        <View style={[styles.filterButtons, { backgroundColor: filterBackground }]}>
          {statusFilters.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.filterButton,
                statusFilter === value && [
                  styles.filterButtonActive,
                  { backgroundColor: filterActiveBackground },
                ],
              ]}
              onPress={() => setStatusFilter(value)}
            >
              <ThemedText
                style={[
                  styles.filterButtonText,
                  { color: secondaryTextColor },
                  statusFilter === value && styles.filterButtonTextActive,
                ]}
              >
                {label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors[colorScheme].tint}
          />
        }
      >
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
              加载中...
            </ThemedText>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && requests.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: cardBackground, borderColor }]}>
            <Icon name="folder" size={48} color="#9ca3af" />
            <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
              暂无请求
            </ThemedText>
          </View>
        )}

        {/* Request List */}
        {!isLoading && requests.length > 0 && (
          <View style={styles.requestList}>
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                isReceived={activeTab === 'received'}
                onApprove={activeTab === 'received' ? handleApprove : undefined}
                onReject={activeTab === 'received' ? handleReject : undefined}
                isProcessing={isProcessing}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 13,
    marginRight: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  filterButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  requestList: {
    gap: 12,
  },
});
