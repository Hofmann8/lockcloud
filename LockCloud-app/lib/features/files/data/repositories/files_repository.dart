import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/file_cache_storage.dart';
import '../models/file_model.dart';

part 'files_repository.g.dart';

/// 文件 Repository
///
/// 负责处理所有文件相关的 API 调用，包括：
/// - 获取文件列表（支持筛选和分页）
/// - 获取文件详情
/// - 获取目录树
/// - 获取签名 URL
/// - 获取标签列表
/// - 获取相邻文件
///
/// 支持本地缓存以实现离线浏览功能。
///
/// **Validates: Requirements 2.1, 2.3, 2.6, 10.3**
class FilesRepository {
  final ApiClient _apiClient;
  final FileCacheStorage? _cacheStorage;

  FilesRepository({
    required ApiClient apiClient,
    FileCacheStorage? cacheStorage,
  })  : _apiClient = apiClient,
        _cacheStorage = cacheStorage;

  /// 获取文件列表
  ///
  /// 支持多种筛选条件和分页
  /// 优先从网络获取，失败时尝试从缓存获取（离线模式）
  ///
  /// [filters] - 筛选条件
  /// [forceRefresh] - 是否强制刷新（忽略缓存）
  ///
  /// **Validates: Requirements 2.1, 2.3, 10.3**
  Future<FileListResponse> getFiles(
    FileFilters filters, {
    bool forceRefresh = false,
  }) async {
    // 尝试从网络获取
    try {
      final response = await _fetchFilesFromNetwork(filters);

      // 缓存第一页数据
      if (filters.page == 1 && _cacheStorage != null) {
        await _cacheStorage.cacheFiles(filters, response);
      }

      return response;
    } catch (e) {
      // 网络请求失败，尝试从缓存获取（仅第一页）
      if (!forceRefresh && filters.page == 1 && _cacheStorage != null) {
        final cachedResponse = await _cacheStorage.getCachedFiles(filters);
        if (cachedResponse != null) {
          return cachedResponse;
        }
      }
      rethrow;
    }
  }

  /// 从网络获取文件列表
  Future<FileListResponse> _fetchFilesFromNetwork(FileFilters filters) async {
    final queryParams = <String, dynamic>{};

    // 添加筛选参数
    if (filters.directory != null && filters.directory!.isNotEmpty) {
      queryParams['directory'] = filters.directory;
    }
    if (filters.activityType != null && filters.activityType!.isNotEmpty) {
      queryParams['activity_type'] = filters.activityType;
    }
    if (filters.activityName != null && filters.activityName!.isNotEmpty) {
      queryParams['activity_name'] = filters.activityName;
    }
    if (filters.activityDate != null && filters.activityDate!.isNotEmpty) {
      queryParams['activity_date'] = filters.activityDate;
    }
    if (filters.dateFrom != null && filters.dateFrom!.isNotEmpty) {
      queryParams['date_from'] = filters.dateFrom;
    }
    if (filters.dateTo != null && filters.dateTo!.isNotEmpty) {
      queryParams['date_to'] = filters.dateTo;
    }
    if (filters.uploaderId != null) {
      queryParams['uploader_id'] = filters.uploaderId;
    }
    if (filters.search != null && filters.search!.isNotEmpty) {
      queryParams['search'] = filters.search;
    }
    if (filters.mediaType != 'all') {
      queryParams['media_type'] = filters.mediaType;
    }
    if (filters.tags.isNotEmpty) {
      queryParams['tags'] = filters.tags.join(',');
    }
    if (filters.year != null) {
      queryParams['year'] = filters.year;
    }
    if (filters.month != null) {
      queryParams['month'] = filters.month;
    }

    // 分页参数
    queryParams['page'] = filters.page;
    queryParams['per_page'] = filters.perPage;

    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.files,
      queryParameters: queryParams,
    );

    return FileListResponse.fromJson(response.data!);
  }

  /// 获取文件详情
  ///
  /// [fileId] - 文件 ID
  Future<FileModel> getFileDetail(int fileId) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '${ApiConstants.files}/$fileId',
    );

    // API 返回 {"file": {...}, "success": true}
    final fileData = response.data!['file'] as Map<String, dynamic>;
    return FileModel.fromJson(fileData);
  }

  /// 获取目录树
  ///
  /// 返回按年/月/活动组织的目录结构
  /// 优先从网络获取，失败时尝试从缓存获取
  ///
  /// **Validates: Requirements 2.6, 10.3**
  Future<List<DirectoryNode>> getDirectoryTree({
    bool forceRefresh = false,
  }) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '${ApiConstants.files}/directories',
      );

      final directories = response.data!['directories'] as List<dynamic>;
      final result = directories
          .map((e) => DirectoryNode.fromJson(e as Map<String, dynamic>))
          .toList();

      // 缓存目录树
      if (_cacheStorage != null) {
        await _cacheStorage.cacheDirectoryTree(result);
      }

      return result;
    } catch (e) {
      // 网络请求失败，尝试从缓存获取
      if (!forceRefresh && _cacheStorage != null) {
        final cachedDirectories = await _cacheStorage.getCachedDirectoryTree();
        if (cachedDirectories != null) {
          return cachedDirectories;
        }
      }
      rethrow;
    }
  }

  /// 获取时间线数据
  ///
  /// 返回按年/月组织的文件数量统计
  Future<Map<String, Map<String, TimelineMonth>>> getTimeline() async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.filesTimeline,
    );

    final timeline = response.data!['timeline'] as Map<String, dynamic>;
    final result = <String, Map<String, TimelineMonth>>{};

    for (final yearEntry in timeline.entries) {
      final year = yearEntry.key;
      final months = yearEntry.value as Map<String, dynamic>;
      result[year] = {};

      for (final monthEntry in months.entries) {
        final month = monthEntry.key;
        final data = monthEntry.value as Map<String, dynamic>;
        result[year]![month] = TimelineMonth.fromJson(data);
      }
    }

    return result;
  }

  /// 获取签名 URL
  ///
  /// 获取文件的预签名访问 URL
  ///
  /// [fileId] - 文件 ID
  /// [type] - URL 类型 (thumbnail, original, hls)
  Future<String> getSignedUrl(int fileId, {String type = 'original'}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '${ApiConstants.files}/$fileId/signed-url',
      queryParameters: {'type': type},
    );

    return response.data!['url'] as String;
  }

  /// 获取标签列表
  ///
  /// 返回所有标签及其使用次数
  /// 优先从网络获取，失败时尝试从缓存获取
  ///
  /// **Validates: Requirements 2.7, 10.3**
  Future<List<TagWithCount>> getTags({bool forceRefresh = false}) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        ApiConstants.tags,
      );

      final tags = response.data!['tags'] as List<dynamic>;
      final result = tags
          .map((e) => TagWithCount.fromJson(e as Map<String, dynamic>))
          .toList();

      // 缓存标签列表
      if (_cacheStorage != null) {
        await _cacheStorage.cacheTags(result);
      }

      return result;
    } catch (e) {
      // 网络请求失败，尝试从缓存获取
      if (!forceRefresh && _cacheStorage != null) {
        final cachedTags = await _cacheStorage.getCachedTags();
        if (cachedTags != null) {
          return cachedTags;
        }
      }
      rethrow;
    }
  }

  /// 获取相邻文件
  ///
  /// 获取当前文件的前一个和后一个文件
  ///
  /// [fileId] - 当前文件 ID
  /// [filters] - 当前筛选条件（用于确定相邻文件）
  Future<AdjacentFiles> getAdjacentFiles(int fileId, FileFilters filters) async {
    final queryParams = <String, dynamic>{};

    if (filters.directory != null && filters.directory!.isNotEmpty) {
      queryParams['directory'] = filters.directory;
    }
    if (filters.mediaType != 'all') {
      queryParams['media_type'] = filters.mediaType;
    }
    if (filters.tags.isNotEmpty) {
      queryParams['tags'] = filters.tags.join(',');
    }

    final response = await _apiClient.get<Map<String, dynamic>>(
      '${ApiConstants.files}/$fileId/adjacent',
      queryParameters: queryParams,
    );

    return AdjacentFiles.fromJson(response.data!);
  }

  /// 更新文件信息
  ///
  /// [fileId] - 文件 ID
  /// [data] - 更新数据
  Future<FileModel> updateFile(int fileId, Map<String, dynamic> data) async {
    final response = await _apiClient.patch<Map<String, dynamic>>(
      '${ApiConstants.files}/$fileId',
      data: data,
    );

    return FileModel.fromJson(response.data!);
  }

  /// 删除文件
  ///
  /// [fileId] - 文件 ID
  Future<void> deleteFile(int fileId) async {
    await _apiClient.delete('${ApiConstants.files}/$fileId');
  }

  /// 获取标签预设
  ///
  /// 返回所有可用的标签预设
  Future<List<TagPreset>> getTagPresets() async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '${ApiConstants.files}/tag-presets',
    );

    final presets = response.data!['presets'] as List<dynamic>;
    return presets
        .map((e) => TagPreset.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 获取 HLS 视频清晰度列表
  ///
  /// 返回视频可用的 HLS 清晰度选项
  ///
  /// [fileId] - 文件 ID
  ///
  /// **Validates: Requirements 5.9**
  Future<List<HLSQuality>> getHLSQualities(int fileId) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.hlsQualities(fileId),
    );

    final qualities = response.data!['qualities'] as List<dynamic>? ?? [];
    return qualities
        .map((e) => HLSQuality.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 获取活动名称列表
  ///
  /// 根据日期获取该日期的所有活动名称
  ///
  /// [date] - 活动日期 (YYYY-MM-DD)
  Future<List<String>> getActivityNamesByDate(String date) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.filesActivityNames,
      queryParameters: {'date': date},
    );

    final names = response.data!['activity_names'] as List<dynamic>? ?? [];
    return names.map((e) => e as String).toList();
  }

  /// 批量获取签名 URL
  ///
  /// [fileIds] - 文件 ID 列表
  /// [style] - 样式预设
  Future<Map<int, String>> getSignedUrlsBatch(
    List<int> fileIds, {
    String style = 'thumbdesktop',
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '${ApiConstants.files}/signed-urls/batch',
      data: {
        'file_ids': fileIds,
        'style': style,
      },
    );

    final urls = response.data!['urls'] as Map<String, dynamic>? ?? {};
    return urls.map((key, value) => MapEntry(int.parse(key), value as String));
  }
}

/// 相邻文件模型
class AdjacentFiles {
  final FileModel? previous;
  final FileModel? next;

  AdjacentFiles({this.previous, this.next});

  factory AdjacentFiles.fromJson(Map<String, dynamic> json) {
    return AdjacentFiles(
      previous: json['previous'] != null
          ? FileModel.fromJson(json['previous'] as Map<String, dynamic>)
          : null,
      next: json['next'] != null
          ? FileModel.fromJson(json['next'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// FilesRepository Provider
///
/// 提供 FilesRepository 实例的 Riverpod Provider
/// 包含缓存存储以支持离线浏览
///
/// **Validates: Requirements 10.3**
@Riverpod(keepAlive: true)
FilesRepository filesRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  final cacheStorage = ref.watch(fileCacheStorageSyncProvider);
  return FilesRepository(
    apiClient: apiClient,
    cacheStorage: cacheStorage,
  );
}
