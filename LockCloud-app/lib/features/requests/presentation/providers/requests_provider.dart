import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/models/file_request_model.dart';
import '../../data/repositories/requests_repository.dart';

part 'requests_provider.freezed.dart';
part 'requests_provider.g.dart';

/// 请求 Tab 类型
enum RequestTab {
  received, // 收到的请求
  sent, // 发出的请求
}

/// 请求列表状态
///
/// 管理请求列表的所有状态，包括：
/// - 收到的请求列表
/// - 发出的请求列表
/// - 加载状态
/// - 筛选条件
/// - 待处理数量
///
/// **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
@freezed
sealed class RequestsState with _$RequestsState {
  const factory RequestsState({
    /// 收到的请求列表
    @Default([]) List<FileRequestModel> receivedRequests,

    /// 发出的请求列表
    @Default([]) List<FileRequestModel> sentRequests,

    /// 当前 Tab
    @Default(RequestTab.received) RequestTab currentTab,

    /// 状态筛选 (all, pending, approved, rejected)
    @Default('all') String statusFilter,

    /// 是否正在加载
    @Default(false) bool isLoading,

    /// 是否正在加载更多
    @Default(false) bool isLoadingMore,

    /// 收到的请求是否还有更多
    @Default(true) bool receivedHasMore,

    /// 发出的请求是否还有更多
    @Default(true) bool sentHasMore,

    /// 收到的请求当前页码
    @Default(1) int receivedPage,

    /// 发出的请求当前页码
    @Default(1) int sentPage,

    /// 待处理请求数量
    @Default(0) int pendingCount,

    /// 错误信息
    String? error,
  }) = _RequestsState;
}

/// 请求列表状态管理器
///
/// 使用 Riverpod 管理请求列表状态，提供以下功能：
/// - 加载收到的请求列表
/// - 加载发出的请求列表
/// - 切换 Tab
/// - 筛选状态
/// - 批准/拒绝请求
/// - 获取待处理数量
///
/// **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
@Riverpod(keepAlive: true)
class RequestsNotifier extends _$RequestsNotifier {
  @override
  RequestsState build() {
    return const RequestsState();
  }

  /// 获取 RequestsRepository 实例
  RequestsRepository get _repository => ref.read(requestsRepositoryProvider);

  /// 初始化数据
  ///
  /// 加载收到的请求列表和待处理数量
  Future<void> initialize() async {
    await Future.wait([
      loadReceivedRequests(refresh: true),
      loadPendingCount(),
    ]);
  }

  /// 加载收到的请求列表
  ///
  /// [refresh] - 是否刷新（重置分页）
  ///
  /// **Validates: Requirements 6.2**
  Future<void> loadReceivedRequests({bool refresh = false}) async {
    if (state.isLoading) return;

    final page = refresh ? 1 : state.receivedPage;

    state = state.copyWith(
      isLoading: true,
      error: null,
      receivedPage: page,
    );

    try {
      final response = await _repository.getReceivedRequests(
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        page: page,
      );

      state = state.copyWith(
        receivedRequests: response.requests,
        receivedHasMore: response.hasNext,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
    }
  }

  /// 加载发出的请求列表
  ///
  /// [refresh] - 是否刷新（重置分页）
  ///
  /// **Validates: Requirements 6.3**
  Future<void> loadSentRequests({bool refresh = false}) async {
    if (state.isLoading) return;

    final page = refresh ? 1 : state.sentPage;

    state = state.copyWith(
      isLoading: true,
      error: null,
      sentPage: page,
    );

    try {
      final response = await _repository.getSentRequests(
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        page: page,
      );

      state = state.copyWith(
        sentRequests: response.requests,
        sentHasMore: response.hasNext,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
    }
  }

  /// 加载更多收到的请求
  Future<void> loadMoreReceivedRequests() async {
    if (state.isLoading || state.isLoadingMore || !state.receivedHasMore) {
      return;
    }

    state = state.copyWith(isLoadingMore: true);

    final nextPage = state.receivedPage + 1;

    try {
      final response = await _repository.getReceivedRequests(
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        page: nextPage,
      );

      state = state.copyWith(
        receivedRequests: [...state.receivedRequests, ...response.requests],
        receivedPage: nextPage,
        receivedHasMore: response.hasNext,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: _getErrorMessage(e),
      );
    }
  }

  /// 加载更多发出的请求
  Future<void> loadMoreSentRequests() async {
    if (state.isLoading || state.isLoadingMore || !state.sentHasMore) {
      return;
    }

    state = state.copyWith(isLoadingMore: true);

    final nextPage = state.sentPage + 1;

    try {
      final response = await _repository.getSentRequests(
        status: state.statusFilter == 'all' ? null : state.statusFilter,
        page: nextPage,
      );

      state = state.copyWith(
        sentRequests: [...state.sentRequests, ...response.requests],
        sentPage: nextPage,
        sentHasMore: response.hasNext,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: _getErrorMessage(e),
      );
    }
  }

  /// 切换 Tab
  ///
  /// [tab] - 目标 Tab
  ///
  /// **Validates: Requirements 6.1**
  Future<void> switchTab(RequestTab tab) async {
    if (state.currentTab == tab) return;

    state = state.copyWith(currentTab: tab);

    // 加载对应 Tab 的数据
    if (tab == RequestTab.received) {
      if (state.receivedRequests.isEmpty) {
        await loadReceivedRequests(refresh: true);
      }
    } else {
      if (state.sentRequests.isEmpty) {
        await loadSentRequests(refresh: true);
      }
    }
  }

  /// 设置状态筛选
  ///
  /// [status] - 状态 (all, pending, approved, rejected)
  ///
  /// **Validates: Requirements 6.4**
  Future<void> setStatusFilter(String status) async {
    if (state.statusFilter == status) return;

    state = state.copyWith(statusFilter: status);

    // 重新加载当前 Tab 的数据
    if (state.currentTab == RequestTab.received) {
      await loadReceivedRequests(refresh: true);
    } else {
      await loadSentRequests(refresh: true);
    }
  }

  /// 加载待处理请求数量
  ///
  /// **Validates: Requirements 6.5**
  Future<void> loadPendingCount() async {
    try {
      final count = await _repository.getPendingCount();
      state = state.copyWith(pendingCount: count);
    } catch (e) {
      // 获取数量失败不影响主要功能
    }
  }

  /// 批准请求
  ///
  /// [requestId] - 请求 ID
  ///
  /// **Validates: Requirements 6.6, 6.7**
  Future<bool> approveRequest(int requestId) async {
    try {
      final updatedRequest = await _repository.approveRequest(requestId);

      // 更新列表中的请求
      _updateRequestInList(updatedRequest);

      // 更新待处理数量
      await loadPendingCount();

      return true;
    } catch (e) {
      state = state.copyWith(error: _getErrorMessage(e));
      return false;
    }
  }

  /// 拒绝请求
  ///
  /// [requestId] - 请求 ID
  /// [responseMessage] - 拒绝理由（可选）
  ///
  /// **Validates: Requirements 6.8**
  Future<bool> rejectRequest(int requestId, {String? responseMessage}) async {
    try {
      final updatedRequest = await _repository.rejectRequest(
        requestId,
        responseMessage: responseMessage,
      );

      // 更新列表中的请求
      _updateRequestInList(updatedRequest);

      // 更新待处理数量
      await loadPendingCount();

      return true;
    } catch (e) {
      state = state.copyWith(error: _getErrorMessage(e));
      return false;
    }
  }

  /// 创建请求
  ///
  /// [params] - 创建请求参数
  Future<FileRequestModel?> createRequest(CreateRequestParams params) async {
    try {
      final request = await _repository.createRequest(params);

      // 添加到发出的请求列表
      state = state.copyWith(
        sentRequests: [request, ...state.sentRequests],
      );

      return request;
    } catch (e) {
      state = state.copyWith(error: _getErrorMessage(e));
      return null;
    }
  }

  /// 取消请求
  ///
  /// [requestId] - 请求 ID
  Future<bool> cancelRequest(int requestId) async {
    try {
      await _repository.cancelRequest(requestId);

      // 从列表中移除
      state = state.copyWith(
        sentRequests:
            state.sentRequests.where((r) => r.id != requestId).toList(),
      );

      return true;
    } catch (e) {
      state = state.copyWith(error: _getErrorMessage(e));
      return false;
    }
  }

  /// 刷新当前 Tab 数据
  Future<void> refresh() async {
    if (state.currentTab == RequestTab.received) {
      await Future.wait([
        loadReceivedRequests(refresh: true),
        loadPendingCount(),
      ]);
    } else {
      await loadSentRequests(refresh: true);
    }
  }

  /// 清除错误
  void clearError() {
    state = state.copyWith(error: null);
  }

  /// 更新列表中的请求
  void _updateRequestInList(FileRequestModel updatedRequest) {
    // 更新收到的请求列表
    final receivedIndex =
        state.receivedRequests.indexWhere((r) => r.id == updatedRequest.id);
    if (receivedIndex != -1) {
      final newReceivedRequests = [...state.receivedRequests];
      newReceivedRequests[receivedIndex] = updatedRequest;
      state = state.copyWith(receivedRequests: newReceivedRequests);
    }

    // 更新发出的请求列表
    final sentIndex =
        state.sentRequests.indexWhere((r) => r.id == updatedRequest.id);
    if (sentIndex != -1) {
      final newSentRequests = [...state.sentRequests];
      newSentRequests[sentIndex] = updatedRequest;
      state = state.copyWith(sentRequests: newSentRequests);
    }
  }

  /// 获取错误消息
  String _getErrorMessage(dynamic e) {
    if (e is Exception) {
      return e.toString().replaceFirst('Exception: ', '');
    }
    return '操作失败，请稍后重试';
  }
}

/// 当前请求列表 Provider
///
/// 根据当前 Tab 返回对应的请求列表
@riverpod
List<FileRequestModel> currentRequests(Ref ref) {
  final requestsState = ref.watch(requestsNotifierProvider);
  return requestsState.currentTab == RequestTab.received
      ? requestsState.receivedRequests
      : requestsState.sentRequests;
}

/// 当前是否有更多数据 Provider
@riverpod
bool currentHasMore(Ref ref) {
  final requestsState = ref.watch(requestsNotifierProvider);
  return requestsState.currentTab == RequestTab.received
      ? requestsState.receivedHasMore
      : requestsState.sentHasMore;
}

/// 待处理请求数量 Provider
///
/// **Validates: Requirements 6.5**
@riverpod
int pendingRequestCount(Ref ref) {
  final requestsState = ref.watch(requestsNotifierProvider);
  return requestsState.pendingCount;
}

/// 是否有待处理请求 Provider
@riverpod
bool hasPendingRequests(Ref ref) {
  final count = ref.watch(pendingRequestCountProvider);
  return count > 0;
}
