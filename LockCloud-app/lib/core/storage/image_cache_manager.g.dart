// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'image_cache_manager.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$imageCacheServiceHash() => r'e887c2782060a8974cd97640be4f0767cc8b2d87';

/// ImageCacheService 的 Riverpod Provider
///
/// Copied from [imageCacheService].
@ProviderFor(imageCacheService)
final imageCacheServiceProvider = Provider<ImageCacheService>.internal(
  imageCacheService,
  name: r'imageCacheServiceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$imageCacheServiceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ImageCacheServiceRef = ProviderRef<ImageCacheService>;
String _$imageCacheStatsHash() => r'ca9c4a029005a1c0073fc74865a55cba2ce8966f';

/// 图片缓存统计信息 Provider
///
/// Copied from [imageCacheStats].
@ProviderFor(imageCacheStats)
final imageCacheStatsProvider =
    AutoDisposeFutureProvider<ImageCacheStats>.internal(
      imageCacheStats,
      name: r'imageCacheStatsProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$imageCacheStatsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ImageCacheStatsRef = AutoDisposeFutureProviderRef<ImageCacheStats>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
