import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/files/data/models/file_model.dart';
import 'preferences_storage.dart';

part 'file_cache_storage.g.dart';

/// 文件列表缓存存储服务
///
/// 负责缓存文件列表数据到本地，支持离线浏览。
/// 使用 SharedPreferences 存储 JSON 序列化的文件数据。
///
/// 功能：
/// - 缓存文件列表数据
/// - 缓存目录树数据
/// - 缓存标签列表数据
/// - 支持按筛选条件缓存
/// - 自动过期清理
///
/// **Validates: Requirements 10.3**
class FileCacheStorage {
  // ==================== 存储键常量 ====================

  /// 文件列表缓存键前缀
  static const String _keyFilesPrefix = 'cache_files_';

  /// 目录树缓存键
  static const String _keyDirectoryTree = 'cache_directory_tree';

  /// 标签列表缓存键
  static const String _keyTags = 'cache_tags';

  /// 缓存时间戳键前缀
  static const String _keyTimestampPrefix = 'cache_timestamp_';

  /// 默认缓存过期时间（毫秒）- 7天
  static const int _defaultCacheDuration = 7 * 24 * 60 * 60 * 1000;

  final SharedPreferences _prefs;
  final PreferencesStorage? _preferencesStorage;

  /// 私有构造函数
  FileCacheStorage._(this._prefs, this._preferencesStorage);

  /// 异步初始化 FileCacheStorage
  static Future<FileCacheStorage> init({
    PreferencesStorage? preferencesStorage,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return FileCacheStorage._(prefs, preferencesStorage);
  }

  /// 使用已有的 SharedPreferences 实例创建（用于测试）
  factory FileCacheStorage.withPrefs(
    SharedPreferences prefs, {
    PreferencesStorage? preferencesStorage,
  }) {
    return FileCacheStorage._(prefs, preferencesStorage);
  }

  // ==================== 缓存配置 ====================

  /// 获取缓存过期时间（毫秒）
  int get _cacheDuration {
    if (_preferencesStorage != null) {
      final days = _preferencesStorage.getCacheDurationDays();
      return days * 24 * 60 * 60 * 1000;
    }
    return _defaultCacheDuration;
  }

  /// 检查缓存是否启用
  bool get _isCacheEnabled {
    return _preferencesStorage?.isCacheEnabled() ?? true;
  }

  // ==================== 文件列表缓存 ====================

  /// 生成文件列表缓存键
  ///
  /// 根据筛选条件生成唯一的缓存键
  String _generateFilesKey(FileFilters filters) {
    final parts = <String>[];

    if (filters.directory != null && filters.directory!.isNotEmpty) {
      parts.add('dir:${filters.directory}');
    }
    if (filters.mediaType != 'all') {
      parts.add('media:${filters.mediaType}');
    }
    if (filters.tags.isNotEmpty) {
      parts.add('tags:${filters.tags.join(',')}');
    }
    if (filters.activityType != null && filters.activityType!.isNotEmpty) {
      parts.add('type:${filters.activityType}');
    }
    if (filters.search != null && filters.search!.isNotEmpty) {
      parts.add('search:${filters.search}');
    }
    if (filters.year != null) {
      parts.add('year:${filters.year}');
    }
    if (filters.month != null) {
      parts.add('month:${filters.month}');
    }

    final key = parts.isEmpty ? 'default' : parts.join('_');
    return '$_keyFilesPrefix$key';
  }

  /// 缓存文件列表
  ///
  /// [filters] - 筛选条件
  /// [response] - 文件列表响应
  Future<bool> cacheFiles(
    FileFilters filters,
    FileListResponse response,
  ) async {
    if (!_isCacheEnabled) return false;

    try {
      final key = _generateFilesKey(filters);
      final timestampKey = '$_keyTimestampPrefix$key';

      // 序列化数据
      final data = {
        'files': response.files.map((f) => f.toJson()).toList(),
        'pagination': response.pagination.toJson(),
        if (response.timeline != null)
          'timeline': _serializeTimeline(response.timeline!),
      };

      final jsonString = jsonEncode(data);

      // 存储数据和时间戳
      await _prefs.setString(key, jsonString);
      await _prefs.setInt(timestampKey, DateTime.now().millisecondsSinceEpoch);

      return true;
    } catch (e) {
      // 缓存失败不影响主要功能
      return false;
    }
  }

  /// 获取缓存的文件列表
  ///
  /// [filters] - 筛选条件
  /// 返回缓存的文件列表响应，如果缓存不存在或已过期则返回 null
  Future<FileListResponse?> getCachedFiles(FileFilters filters) async {
    if (!_isCacheEnabled) return null;

    try {
      final key = _generateFilesKey(filters);
      final timestampKey = '$_keyTimestampPrefix$key';

      // 检查缓存是否存在
      final jsonString = _prefs.getString(key);
      if (jsonString == null) return null;

      // 检查缓存是否过期
      final timestamp = _prefs.getInt(timestampKey);
      if (timestamp == null) return null;

      final cacheTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
      final now = DateTime.now();
      if (now.difference(cacheTime).inMilliseconds > _cacheDuration) {
        // 缓存已过期，删除
        await _prefs.remove(key);
        await _prefs.remove(timestampKey);
        return null;
      }

      // 反序列化数据
      final data = jsonDecode(jsonString) as Map<String, dynamic>;

      final files = (data['files'] as List<dynamic>)
          .map((e) => FileModel.fromJson(e as Map<String, dynamic>))
          .toList();

      final pagination = PaginationInfo.fromJson(
        data['pagination'] as Map<String, dynamic>,
      );

      Map<String, Map<String, TimelineMonth>>? timeline;
      if (data['timeline'] != null) {
        timeline = _deserializeTimeline(
          data['timeline'] as Map<String, dynamic>,
        );
      }

      return FileListResponse(
        files: files,
        pagination: pagination,
        timeline: timeline,
      );
    } catch (e) {
      // 反序列化失败，返回 null
      return null;
    }
  }

  /// 序列化时间线数据
  Map<String, dynamic> _serializeTimeline(
    Map<String, Map<String, TimelineMonth>> timeline,
  ) {
    final result = <String, dynamic>{};
    for (final yearEntry in timeline.entries) {
      final monthMap = <String, dynamic>{};
      for (final monthEntry in yearEntry.value.entries) {
        monthMap[monthEntry.key] = {'count': monthEntry.value.count};
      }
      result[yearEntry.key] = monthMap;
    }
    return result;
  }

  /// 反序列化时间线数据
  Map<String, Map<String, TimelineMonth>> _deserializeTimeline(
    Map<String, dynamic> data,
  ) {
    final result = <String, Map<String, TimelineMonth>>{};
    for (final yearEntry in data.entries) {
      final monthMap = <String, TimelineMonth>{};
      final months = yearEntry.value as Map<String, dynamic>;
      for (final monthEntry in months.entries) {
        monthMap[monthEntry.key] = TimelineMonth.fromJson(
          monthEntry.value as Map<String, dynamic>,
        );
      }
      result[yearEntry.key] = monthMap;
    }
    return result;
  }

  // ==================== 目录树缓存 ====================

  /// 缓存目录树
  ///
  /// [directories] - 目录树数据
  Future<bool> cacheDirectoryTree(List<DirectoryNode> directories) async {
    if (!_isCacheEnabled) return false;

    try {
      final data = directories.map((d) => d.toJson()).toList();
      final jsonString = jsonEncode(data);

      await _prefs.setString(_keyDirectoryTree, jsonString);
      await _prefs.setInt(
        '$_keyTimestampPrefix$_keyDirectoryTree',
        DateTime.now().millisecondsSinceEpoch,
      );

      return true;
    } catch (e) {
      return false;
    }
  }

  /// 获取缓存的目录树
  ///
  /// 返回缓存的目录树，如果缓存不存在或已过期则返回 null
  Future<List<DirectoryNode>?> getCachedDirectoryTree() async {
    if (!_isCacheEnabled) return null;

    try {
      final jsonString = _prefs.getString(_keyDirectoryTree);
      if (jsonString == null) return null;

      // 检查缓存是否过期
      final timestamp = _prefs.getInt('$_keyTimestampPrefix$_keyDirectoryTree');
      if (timestamp == null) return null;

      final cacheTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
      final now = DateTime.now();
      if (now.difference(cacheTime).inMilliseconds > _cacheDuration) {
        await _prefs.remove(_keyDirectoryTree);
        await _prefs.remove('$_keyTimestampPrefix$_keyDirectoryTree');
        return null;
      }

      final data = jsonDecode(jsonString) as List<dynamic>;
      return data
          .map((e) => DirectoryNode.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return null;
    }
  }

  // ==================== 标签缓存 ====================

  /// 缓存标签列表
  ///
  /// [tags] - 标签列表
  Future<bool> cacheTags(List<TagWithCount> tags) async {
    if (!_isCacheEnabled) return false;

    try {
      final data = tags.map((t) => t.toJson()).toList();
      final jsonString = jsonEncode(data);

      await _prefs.setString(_keyTags, jsonString);
      await _prefs.setInt(
        '$_keyTimestampPrefix$_keyTags',
        DateTime.now().millisecondsSinceEpoch,
      );

      return true;
    } catch (e) {
      return false;
    }
  }

  /// 获取缓存的标签列表
  ///
  /// 返回缓存的标签列表，如果缓存不存在或已过期则返回 null
  Future<List<TagWithCount>?> getCachedTags() async {
    if (!_isCacheEnabled) return null;

    try {
      final jsonString = _prefs.getString(_keyTags);
      if (jsonString == null) return null;

      // 检查缓存是否过期
      final timestamp = _prefs.getInt('$_keyTimestampPrefix$_keyTags');
      if (timestamp == null) return null;

      final cacheTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
      final now = DateTime.now();
      if (now.difference(cacheTime).inMilliseconds > _cacheDuration) {
        await _prefs.remove(_keyTags);
        await _prefs.remove('$_keyTimestampPrefix$_keyTags');
        return null;
      }

      final data = jsonDecode(jsonString) as List<dynamic>;
      return data
          .map((e) => TagWithCount.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return null;
    }
  }

  // ==================== 缓存管理 ====================

  /// 清除所有文件相关缓存
  Future<void> clearAllCache() async {
    final keys = _prefs.getKeys();
    final cacheKeys = keys.where((key) =>
        key.startsWith(_keyFilesPrefix) ||
        key.startsWith(_keyTimestampPrefix) ||
        key == _keyDirectoryTree ||
        key == _keyTags);

    for (final key in cacheKeys) {
      await _prefs.remove(key);
    }
  }

  /// 清除过期缓存
  Future<void> clearExpiredCache() async {
    final keys = _prefs.getKeys();
    final now = DateTime.now().millisecondsSinceEpoch;

    for (final key in keys) {
      if (key.startsWith(_keyTimestampPrefix)) {
        final timestamp = _prefs.getInt(key);
        if (timestamp != null && now - timestamp > _cacheDuration) {
          // 删除过期的时间戳和对应的数据
          final dataKey = key.replaceFirst(_keyTimestampPrefix, '');
          await _prefs.remove(key);
          await _prefs.remove(dataKey);
        }
      }
    }
  }

  /// 获取缓存大小（字节）
  ///
  /// 返回所有文件缓存占用的大致大小
  int getCacheSize() {
    int size = 0;
    final keys = _prefs.getKeys();

    for (final key in keys) {
      if (key.startsWith(_keyFilesPrefix) ||
          key == _keyDirectoryTree ||
          key == _keyTags) {
        final value = _prefs.getString(key);
        if (value != null) {
          size += value.length * 2; // UTF-16 编码，每个字符约 2 字节
        }
      }
    }

    return size;
  }

  /// 检查是否有缓存数据
  bool hasCachedData() {
    final keys = _prefs.getKeys();
    return keys.any((key) =>
        key.startsWith(_keyFilesPrefix) ||
        key == _keyDirectoryTree ||
        key == _keyTags);
  }

  /// 获取缓存的筛选条件列表
  ///
  /// 返回所有已缓存的筛选条件键
  List<String> getCachedFilterKeys() {
    final keys = _prefs.getKeys();
    return keys
        .where((key) => key.startsWith(_keyFilesPrefix))
        .map((key) => key.replaceFirst(_keyFilesPrefix, ''))
        .toList();
  }
}

/// FileCacheStorage 的 Riverpod Provider
@Riverpod(keepAlive: true)
Future<FileCacheStorage> fileCacheStorage(Ref ref) async {
  final preferencesStorage = await ref.watch(preferencesStorageProvider.future);
  final storage = await FileCacheStorage.init(
    preferencesStorage: preferencesStorage,
  );
  return storage;
}

/// 同步访问 FileCacheStorage 的 Provider
@riverpod
FileCacheStorage? fileCacheStorageSync(Ref ref) {
  final asyncValue = ref.watch(fileCacheStorageProvider);
  return asyncValue.valueOrNull;
}
