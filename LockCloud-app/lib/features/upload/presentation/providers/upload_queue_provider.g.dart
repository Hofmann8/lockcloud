// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'upload_queue_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$pendingUploadCountHash() =>
    r'fdcf75a475c28727b8367b1589e4dd067c6d9ad4';

/// 待上传数量 Provider
///
/// Copied from [pendingUploadCount].
@ProviderFor(pendingUploadCount)
final pendingUploadCountProvider = AutoDisposeProvider<int>.internal(
  pendingUploadCount,
  name: r'pendingUploadCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$pendingUploadCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef PendingUploadCountRef = AutoDisposeProviderRef<int>;
String _$uploadingCountHash() => r'63b4601e764d27e5e9550b256e70f496c81c306d';

/// 上传中数量 Provider
///
/// Copied from [uploadingCount].
@ProviderFor(uploadingCount)
final uploadingCountProvider = AutoDisposeProvider<int>.internal(
  uploadingCount,
  name: r'uploadingCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$uploadingCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UploadingCountRef = AutoDisposeProviderRef<int>;
String _$completedUploadCountHash() =>
    r'94d7b81579dc15769ebb3b5d16f08a91d00405ed';

/// 已完成数量 Provider
///
/// Copied from [completedUploadCount].
@ProviderFor(completedUploadCount)
final completedUploadCountProvider = AutoDisposeProvider<int>.internal(
  completedUploadCount,
  name: r'completedUploadCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$completedUploadCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CompletedUploadCountRef = AutoDisposeProviderRef<int>;
String _$failedUploadCountHash() => r'e80e063770237ef553eaaf655170ddaf39270f85';

/// 失败数量 Provider
///
/// Copied from [failedUploadCount].
@ProviderFor(failedUploadCount)
final failedUploadCountProvider = AutoDisposeProvider<int>.internal(
  failedUploadCount,
  name: r'failedUploadCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$failedUploadCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef FailedUploadCountRef = AutoDisposeProviderRef<int>;
String _$hasUploadTasksHash() => r'e671080aa9afad5dd993ef530d34f5dab5b7d326';

/// 是否有上传任务 Provider
///
/// Copied from [hasUploadTasks].
@ProviderFor(hasUploadTasks)
final hasUploadTasksProvider = AutoDisposeProvider<bool>.internal(
  hasUploadTasks,
  name: r'hasUploadTasksProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$hasUploadTasksHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef HasUploadTasksRef = AutoDisposeProviderRef<bool>;
String _$totalUploadProgressHash() =>
    r'e428b9d2730c848e8d2bd2f48d453f3c79a92e59';

/// 总上传进度 Provider
///
/// Copied from [totalUploadProgress].
@ProviderFor(totalUploadProgress)
final totalUploadProgressProvider = AutoDisposeProvider<double>.internal(
  totalUploadProgress,
  name: r'totalUploadProgressProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$totalUploadProgressHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef TotalUploadProgressRef = AutoDisposeProviderRef<double>;
String _$uploadQueueNotifierHash() =>
    r'741638595063286dd738304a665b7b54efbdcec0';

/// 上传队列状态管理器
///
/// 使用 Riverpod 管理上传队列状态，提供以下功能：
/// - 添加上传项
/// - 移除上传项
/// - 重试失败的上传
/// - 清除已完成的上传
/// - 处理上传队列
///
/// **Validates: Requirements 3.5, 3.7, 3.8, 3.9**
///
/// Copied from [UploadQueueNotifier].
@ProviderFor(UploadQueueNotifier)
final uploadQueueNotifierProvider =
    NotifierProvider<UploadQueueNotifier, UploadQueueState>.internal(
      UploadQueueNotifier.new,
      name: r'uploadQueueNotifierProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$uploadQueueNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$UploadQueueNotifier = Notifier<UploadQueueState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
