import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../providers/requests_provider.dart';
import '../widgets/request_card.dart';

/// 请求管理页面 - 与 Web 端 requests 页面风格一致
///
/// 显示收到/发出的请求列表，支持：
/// - 收到/发出 Tab 切换
/// - 状态筛选（全部/待处理/已批准/已拒绝）
/// - 下拉刷新
/// - 无限滚动加载更多
class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _scrollController.addListener(_onScroll);

    // 初始化加载数据
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(requestsNotifierProvider.notifier).initialize();
    });
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Tab 切换监听
  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;

    final tab =
        _tabController.index == 0 ? RequestTab.received : RequestTab.sent;
    ref.read(requestsNotifierProvider.notifier).switchTab(tab);
  }

  /// 滚动监听 - 无限滚动
  void _onScroll() {
    if (_isNearBottom) {
      final currentTab = ref.read(requestsNotifierProvider).currentTab;
      if (currentTab == RequestTab.received) {
        ref.read(requestsNotifierProvider.notifier).loadMoreReceivedRequests();
      } else {
        ref.read(requestsNotifierProvider.notifier).loadMoreSentRequests();
      }
    }
  }

  /// 判断是否接近底部
  bool get _isNearBottom {
    if (!_scrollController.hasClients) return false;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    return currentScroll >= (maxScroll - 200);
  }

  /// 下拉刷新
  Future<void> _onRefresh() async {
    await ref.read(requestsNotifierProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    final requestsState = ref.watch(requestsNotifierProvider);
    final pendingCount = ref.watch(pendingRequestCountProvider);

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: Text('请求管理', style: TextStyle(color: ThemeConfig.primaryBlack)),
        backgroundColor: ThemeConfig.surfaceColor,
        elevation: 0,
        centerTitle: true,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: ThemeConfig.primaryColor,
          indicatorWeight: 3,
          labelColor: ThemeConfig.primaryColor,
          unselectedLabelColor: ThemeConfig.accentGray,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600),
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('收到的'),
                  if (pendingCount > 0) ...[
                    const SizedBox(width: 6),
                    _buildBadge(pendingCount),
                  ],
                ],
              ),
            ),
            const Tab(text: '发出的'),
          ],
        ),
      ),
      body: Column(
        children: [
          // 状态筛选栏
          _buildStatusFilter(requestsState.statusFilter),

          // 请求列表
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // 收到的请求
                _buildRequestList(
                  requests: requestsState.receivedRequests,
                  isLoading: requestsState.isLoading,
                  isLoadingMore: requestsState.isLoadingMore,
                  hasMore: requestsState.receivedHasMore,
                  error: requestsState.error,
                  isReceived: true,
                ),
                // 发出的请求
                _buildRequestList(
                  requests: requestsState.sentRequests,
                  isLoading: requestsState.isLoading,
                  isLoadingMore: requestsState.isLoadingMore,
                  hasMore: requestsState.sentHasMore,
                  error: requestsState.error,
                  isReceived: false,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 构建待处理数量徽章
  Widget _buildBadge(int count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: ThemeConfig.errorColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        count > 99 ? '99+' : count.toString(),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  /// 构建状态筛选栏
  Widget _buildStatusFilter(String currentFilter) {
    final filters = [
      ('all', '全部'),
      ('pending', '待处理'),
      ('approved', '已批准'),
      ('rejected', '已拒绝'),
    ];

    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        border: Border(
          bottom: BorderSide(color: ThemeConfig.borderColor),
        ),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        itemBuilder: (context, index) {
          final (value, label) = filters[index];
          final isSelected = currentFilter == value;

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
            child: FilterChip(
              label: Text(label),
              selected: isSelected,
              onSelected: (_) {
                ref
                    .read(requestsNotifierProvider.notifier)
                    .setStatusFilter(value);
              },
              selectedColor: ThemeConfig.primaryColor.withValues(alpha: 0.15),
              checkmarkColor: ThemeConfig.primaryColor,
              labelStyle: TextStyle(
                color: isSelected
                    ? ThemeConfig.primaryColor
                    : ThemeConfig.onSurfaceVariantColor,
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
              backgroundColor: ThemeConfig.surfaceContainerColor,
              side: BorderSide(
                color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.borderColor,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          );
        },
      ),
    );
  }

  /// 构建请求列表
  Widget _buildRequestList({
    required List requests,
    required bool isLoading,
    required bool isLoadingMore,
    required bool hasMore,
    required String? error,
    required bool isReceived,
  }) {
    // 加载中状态
    if (isLoading && requests.isEmpty) {
      return Center(
        child: CircularProgressIndicator(
          color: ThemeConfig.primaryColor,
        ),
      );
    }

    // 错误状态
    if (error != null && requests.isEmpty) {
      return _buildErrorState(error);
    }

    // 空状态
    if (requests.isEmpty) {
      return _buildEmptyState(isReceived);
    }

    // 请求列表
    return RefreshIndicator(
      onRefresh: _onRefresh,
      color: ThemeConfig.primaryColor,
      backgroundColor: ThemeConfig.surfaceColor,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: requests.length + (isLoadingMore || !hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == requests.length) {
            // 加载更多指示器或没有更多提示
            if (isLoadingMore) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: CircularProgressIndicator(
                    color: ThemeConfig.primaryColor,
                    strokeWidth: 2,
                  ),
                ),
              );
            } else {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: Text(
                    '没有更多了',
                    style: TextStyle(
                      color: ThemeConfig.accentGray,
                      fontSize: 14,
                    ),
                  ),
                ),
              );
            }
          }

          final request = requests[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: RequestCard(
              request: request,
              isReceived: isReceived,
              onApprove: isReceived && request.isPending
                  ? () => _handleApprove(request.id)
                  : null,
              onReject: isReceived && request.isPending
                  ? () => _handleReject(request.id)
                  : null,
            ),
          );
        },
      ),
    );
  }

  /// 构建空状态
  Widget _buildEmptyState(bool isReceived) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inbox_outlined,
            size: 80,
            color: ThemeConfig.accentGray.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            isReceived ? '暂无收到的请求' : '暂无发出的请求',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建错误状态
  Widget _buildErrorState(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            size: 80,
            color: ThemeConfig.errorColor.withValues(alpha: 0.7),
          ),
          const SizedBox(height: 16),
          Text(
            error,
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _onRefresh,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }

  /// 处理批准请求
  Future<void> _handleApprove(int requestId) async {
    final success = await ref
        .read(requestsNotifierProvider.notifier)
        .approveRequest(requestId);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? '已批准请求' : '操作失败'),
          backgroundColor:
              success ? ThemeConfig.successColor : ThemeConfig.errorColor,
        ),
      );
    }
  }

  /// 处理拒绝请求
  Future<void> _handleReject(int requestId) async {
    // 显示拒绝理由输入对话框
    final responseMessage = await _showRejectDialog();
    if (responseMessage == null) return; // 用户取消

    final success = await ref
        .read(requestsNotifierProvider.notifier)
        .rejectRequest(requestId, responseMessage: responseMessage);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? '已拒绝请求' : '操作失败'),
          backgroundColor:
              success ? ThemeConfig.successColor : ThemeConfig.errorColor,
        ),
      );
    }
  }

  /// 显示拒绝理由对话框
  Future<String?> _showRejectDialog() async {
    final controller = TextEditingController();

    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('拒绝请求', style: TextStyle(color: ThemeConfig.primaryBlack)),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: '请输入拒绝理由（可选）',
            hintStyle: TextStyle(color: ThemeConfig.hintColor),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('取消', style: TextStyle(color: ThemeConfig.accentGray)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.errorColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('拒绝'),
          ),
        ],
      ),
    );
  }
}
