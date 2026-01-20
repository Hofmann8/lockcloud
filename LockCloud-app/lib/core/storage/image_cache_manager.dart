import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'preferences_storage.dart';

part 'image_cache_manager.g.dart';

/// LockCloud 图片缓存管理器
///
/// 自定义的缓存管理器，用于管理缩略图和图片的本地缓存。
/// 支持：
/// - 自定义缓存大小限制
/// - 自定义缓存过期时间
/// - 缓存清理功能
/// - 缓存统计信息
///
/// **Validates: Requirements 10.4**
class LockCloudImageCacheManager extends CacheManager with ImageCacheManager {
  static const String _cacheKey = 'lockcloud_image_cache';

  /// 默认最大缓存数量
  static const int _defaultMaxNrOfCacheObjects = 500;

  /// 默认缓存过期时间（天）
  static const int _defaultStalePeriodDays = 7;

  /// 单例实例
  static LockCloudImageCacheManager? _instance;

  /// 获取单例实例
  static LockCloudImageCacheManager get instance {
    _instance ??= LockCloudImageCacheManager._();
    return _instance!;
  }

  /// 使用自定义配置创建实例
  static LockCloudImageCacheManager createWithConfig({
    int maxNrOfCacheObjects = _defaultMaxNrOfCacheObjects,
    int stalePeriodDays = _defaultStalePeriodDays,
  }) {
    return LockCloudImageCacheManager._(
      maxNrOfCacheObjects: maxNrOfCacheObjects,
      stalePeriodDays: stalePeriodDays,
    );
  }

  /// 私有构造函数
  LockCloudImageCacheManager._({
    int maxNrOfCacheObjects = _defaultMaxNrOfCacheObjects,
    int stalePeriodDays = _defaultStalePeriodDays,
  }) : super(
          Config(
            _cacheKey,
            stalePeriod: Duration(days: stalePeriodDays),
            maxNrOfCacheObjects: maxNrOfCacheObjects,
          ),
        );

  /// 重置单例实例（用于更新配置）
  static void resetInstance() {
    _instance = null;
  }
}

/// 图片缓存服务
///
/// 提供图片缓存的管理功能，包括：
/// - 获取缓存统计信息
/// - 清理缓存
/// - 预加载图片
///
/// **Validates: Requirements 10.4**
class ImageCacheService {
  final PreferencesStorage? _preferencesStorage;
  late final LockCloudImageCacheManager _cacheManager;

  ImageCacheService({PreferencesStorage? preferencesStorage})
      : _preferencesStorage = preferencesStorage {
    _initCacheManager();
  }

  /// 初始化缓存管理器
  void _initCacheManager() {
    final maxSizeMb = _preferencesStorage?.getCacheMaxSizeMb() ?? 500;
    final cacheDays = _preferencesStorage?.getCacheDurationDays() ?? 7;

    // 估算最大缓存对象数量（假设平均每张图片 1MB）
    final maxObjects = maxSizeMb;

    _cacheManager = LockCloudImageCacheManager.createWithConfig(
      maxNrOfCacheObjects: maxObjects,
      stalePeriodDays: cacheDays,
    );
  }

  /// 获取缓存管理器
  CacheManager get cacheManager => _cacheManager;

  /// 清除所有图片缓存
  ///
  /// **Validates: Requirements 10.5**
  Future<void> clearCache() async {
    await _cacheManager.emptyCache();

    // 同时清除 CachedNetworkImage 的内存缓存
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
  }

  /// 从缓存中移除指定 URL 的图片
  Future<void> removeFromCache(String url) async {
    await _cacheManager.removeFile(url);
  }

  /// 预加载图片到缓存
  ///
  /// [urls] - 要预加载的图片 URL 列表
  Future<void> preloadImages(List<String> urls) async {
    for (final url in urls) {
      try {
        await _cacheManager.downloadFile(url);
      } catch (e) {
        // 预加载失败不影响主要功能
        debugPrint('Failed to preload image: $url');
      }
    }
  }

  /// 预加载图片到缓存（使用稳定的缓存 key）
  ///
  /// [urlsByCacheKey] - 缓存 key 与 URL 的映射
  Future<void> preloadImagesWithCacheKeys(Map<String, String> urlsByCacheKey) async {
    for (final entry in urlsByCacheKey.entries) {
      try {
        await _cacheManager.downloadFile(entry.value, key: entry.key);
      } catch (e) {
        // 预加载失败不影响主要功能
        debugPrint('Failed to preload image: ${entry.value}');
      }
    }
  }

  /// 获取缓存大小（字节）
  Future<int> getCacheSize() async {
    try {
      final cacheDir = await _getCacheDirectory();
      if (cacheDir == null || !await cacheDir.exists()) {
        return 0;
      }

      int totalSize = 0;
      await for (final entity in cacheDir.list(recursive: true)) {
        if (entity is File) {
          totalSize += await entity.length();
        }
      }
      return totalSize;
    } catch (e) {
      return 0;
    }
  }

  /// 获取格式化的缓存大小
  Future<String> getFormattedCacheSize() async {
    final size = await getCacheSize();
    return _formatBytes(size);
  }

  /// 获取缓存文件数量
  Future<int> getCacheFileCount() async {
    try {
      final cacheDir = await _getCacheDirectory();
      if (cacheDir == null || !await cacheDir.exists()) {
        return 0;
      }

      int count = 0;
      await for (final entity in cacheDir.list(recursive: true)) {
        if (entity is File) {
          count++;
        }
      }
      return count;
    } catch (e) {
      return 0;
    }
  }

  /// 获取缓存目录
  Future<Directory?> _getCacheDirectory() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final cacheDir = Directory('${tempDir.path}/${LockCloudImageCacheManager._cacheKey}');
      return cacheDir;
    } catch (e) {
      return null;
    }
  }

  /// 格式化字节大小
  String _formatBytes(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(2)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    }
  }

  /// 检查是否有缓存数据
  Future<bool> hasCachedData() async {
    final count = await getCacheFileCount();
    return count > 0;
  }

  /// 获取缓存统计信息
  Future<ImageCacheStats> getCacheStats() async {
    final size = await getCacheSize();
    final fileCount = await getCacheFileCount();
    final maxSizeMb = _preferencesStorage?.getCacheMaxSizeMb() ?? 500;

    return ImageCacheStats(
      totalSize: size,
      formattedSize: _formatBytes(size),
      fileCount: fileCount,
      maxSizeBytes: maxSizeMb * 1024 * 1024,
      usagePercentage: size / (maxSizeMb * 1024 * 1024) * 100,
    );
  }
}

/// 图片缓存统计信息
class ImageCacheStats {
  /// 总缓存大小（字节）
  final int totalSize;

  /// 格式化的缓存大小
  final String formattedSize;

  /// 缓存文件数量
  final int fileCount;

  /// 最大缓存大小（字节）
  final int maxSizeBytes;

  /// 使用百分比
  final double usagePercentage;

  const ImageCacheStats({
    required this.totalSize,
    required this.formattedSize,
    required this.fileCount,
    required this.maxSizeBytes,
    required this.usagePercentage,
  });
}

/// ImageCacheService 的 Riverpod Provider
@Riverpod(keepAlive: true)
ImageCacheService imageCacheService(Ref ref) {
  final preferencesStorage = ref.watch(preferencesStorageSyncProvider);
  return ImageCacheService(preferencesStorage: preferencesStorage);
}

/// 图片缓存统计信息 Provider
@riverpod
Future<ImageCacheStats> imageCacheStats(Ref ref) async {
  final service = ref.watch(imageCacheServiceProvider);
  return service.getCacheStats();
}
