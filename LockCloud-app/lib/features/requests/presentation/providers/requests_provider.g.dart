// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'requests_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$currentRequestsHash() => r'61fa50fe8069f53a8550e17df9f86257f48d3df9';

/// 当前请求列表 Provider
///
/// 根据当前 Tab 返回对应的请求列表
///
/// Copied from [currentRequests].
@ProviderFor(currentRequests)
final currentRequestsProvider =
    AutoDisposeProvider<List<FileRequestModel>>.internal(
      currentRequests,
      name: r'currentRequestsProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$currentRequestsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentRequestsRef = AutoDisposeProviderRef<List<FileRequestModel>>;
String _$currentHasMoreHash() => r'3cc9aaa95112bd8f50a32c4e9ef04d27044defc4';

/// 当前是否有更多数据 Provider
///
/// Copied from [currentHasMore].
@ProviderFor(currentHasMore)
final currentHasMoreProvider = AutoDisposeProvider<bool>.internal(
  currentHasMore,
  name: r'currentHasMoreProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentHasMoreHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentHasMoreRef = AutoDisposeProviderRef<bool>;
String _$pendingRequestCountHash() =>
    r'4cc7f9ad0730cce9c9d39b8caffad04ee91d0afd';

/// 待处理请求数量 Provider
///
/// **Validates: Requirements 6.5**
///
/// Copied from [pendingRequestCount].
@ProviderFor(pendingRequestCount)
final pendingRequestCountProvider = AutoDisposeProvider<int>.internal(
  pendingRequestCount,
  name: r'pendingRequestCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$pendingRequestCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef PendingRequestCountRef = AutoDisposeProviderRef<int>;
String _$hasPendingRequestsHash() =>
    r'bddd63ae9e0214e1e305ea6889c1be1134c5d169';

/// 是否有待处理请求 Provider
///
/// Copied from [hasPendingRequests].
@ProviderFor(hasPendingRequests)
final hasPendingRequestsProvider = AutoDisposeProvider<bool>.internal(
  hasPendingRequests,
  name: r'hasPendingRequestsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$hasPendingRequestsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef HasPendingRequestsRef = AutoDisposeProviderRef<bool>;
String _$requestsNotifierHash() => r'4da6b22255868938232ee0e7433eeddd301266c4';

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
///
/// Copied from [RequestsNotifier].
@ProviderFor(RequestsNotifier)
final requestsNotifierProvider =
    NotifierProvider<RequestsNotifier, RequestsState>.internal(
      RequestsNotifier.new,
      name: r'requestsNotifierProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$requestsNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$RequestsNotifier = Notifier<RequestsState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
