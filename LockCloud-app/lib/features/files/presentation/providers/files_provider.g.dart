// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'files_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$fileCountHash() => r'c115965addb7216572459485141bdc193bfbd7e2';

/// 文件总数 Provider
///
/// 便捷 Provider，用于获取当前筛选条件下的文件总数
///
/// **Validates: Requirements 2.11**
///
/// Copied from [fileCount].
@ProviderFor(fileCount)
final fileCountProvider = AutoDisposeProvider<int>.internal(
  fileCount,
  name: r'fileCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$fileCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef FileCountRef = AutoDisposeProviderRef<int>;
String _$currentMediaTypeHash() => r'b51897f9965bfa2700adcfa917bdd052d3b124ec';

/// 当前媒体类型 Provider
///
/// 便捷 Provider，用于获取当前媒体类型筛选
///
/// Copied from [currentMediaType].
@ProviderFor(currentMediaType)
final currentMediaTypeProvider = AutoDisposeProvider<String>.internal(
  currentMediaType,
  name: r'currentMediaTypeProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentMediaTypeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentMediaTypeRef = AutoDisposeProviderRef<String>;
String _$currentDirectoryHash() => r'e01871a1e945faa715247bb1c61bf5e78f053379';

/// 当前目录 Provider
///
/// 便捷 Provider，用于获取当前目录筛选
///
/// Copied from [currentDirectory].
@ProviderFor(currentDirectory)
final currentDirectoryProvider = AutoDisposeProvider<String?>.internal(
  currentDirectory,
  name: r'currentDirectoryProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentDirectoryHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentDirectoryRef = AutoDisposeProviderRef<String?>;
String _$currentTagsHash() => r'3bc2058662d94edfd353451f6755cfcdc7b8520b';

/// 当前标签 Provider
///
/// 便捷 Provider，用于获取当前标签筛选
///
/// Copied from [currentTags].
@ProviderFor(currentTags)
final currentTagsProvider = AutoDisposeProvider<List<String>>.internal(
  currentTags,
  name: r'currentTagsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentTagsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentTagsRef = AutoDisposeProviderRef<List<String>>;
String _$hasFiltersHash() => r'155339211212f37c208a4e3e99e967e310cc9712';

/// 是否有筛选条件 Provider
///
/// 便捷 Provider，用于判断是否有任何筛选条件
///
/// Copied from [hasFilters].
@ProviderFor(hasFilters)
final hasFiltersProvider = AutoDisposeProvider<bool>.internal(
  hasFilters,
  name: r'hasFiltersProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$hasFiltersHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef HasFiltersRef = AutoDisposeProviderRef<bool>;
String _$filesNotifierHash() => r'd92280673bdbafa8fcf99c8031cdbbedca59f84a';

/// 文件列表状态管理器
///
/// 使用 Riverpod 管理文件列表状态，提供以下功能：
/// - 加载文件列表
/// - 加载更多（无限滚动）
/// - 刷新列表
/// - 更新筛选条件
/// - 加载目录树
/// - 加载标签列表
///
/// **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.7**
///
/// Copied from [FilesNotifier].
@ProviderFor(FilesNotifier)
final filesNotifierProvider =
    NotifierProvider<FilesNotifier, FilesState>.internal(
      FilesNotifier.new,
      name: r'filesNotifierProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$filesNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$FilesNotifier = Notifier<FilesState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
