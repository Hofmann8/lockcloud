import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';

part 'tags_repository.g.dart';

/// 标签模型
class TagModel {
  final int id;
  final String name;
  final int count;

  TagModel({
    required this.id,
    required this.name,
    required this.count,
  });

  factory TagModel.fromJson(Map<String, dynamic> json) {
    return TagModel(
      id: json['id'] as int,
      name: json['name'] as String,
      count: json['count'] as int? ?? 0,
    );
  }
}

/// 标签预设模型
class TagPresetModel {
  final int id;
  final String category;
  final String value;
  final String displayName;
  final bool isActive;
  final int sortOrder;

  TagPresetModel({
    required this.id,
    required this.category,
    required this.value,
    required this.displayName,
    required this.isActive,
    required this.sortOrder,
  });

  factory TagPresetModel.fromJson(Map<String, dynamic> json) {
    return TagPresetModel(
      id: json['id'] as int,
      category: json['category'] as String,
      value: json['value'] as String,
      displayName: json['display_name'] as String,
      isActive: json['is_active'] as bool? ?? true,
      sortOrder: json['sort_order'] as int? ?? 0,
    );
  }
}

/// 文件标签模型
class FreeTagModel {
  final int id;
  final String name;
  final String? createdAt;

  FreeTagModel({
    required this.id,
    required this.name,
    this.createdAt,
  });

  factory FreeTagModel.fromJson(Map<String, dynamic> json) {
    return FreeTagModel(
      id: json['id'] as int,
      name: json['name'] as String,
      createdAt: json['created_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'created_at': createdAt,
    };
  }
}

/// 标签 Repository
///
/// 负责处理所有标签相关的 API 调用，包括：
/// - 获取所有标签列表
/// - 搜索标签
/// - 获取标签预设
/// - 添加/删除文件标签
class TagsRepository {
  final ApiClient _apiClient;

  TagsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  /// 获取所有标签列表（带使用次数）
  Future<List<TagModel>> getAllTags() async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.tags,
    );

    final tagsList = response.data!['tags'] as List<dynamic>? ?? [];
    return tagsList
        .map((e) => TagModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 搜索标签
  ///
  /// [prefix] - 搜索前缀
  /// [limit] - 最大返回数量
  Future<List<TagModel>> searchTags(String prefix, {int limit = 10}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.tagsSearch,
      queryParameters: {
        'q': prefix,
        'limit': limit,
      },
    );

    final tagsList = response.data!['tags'] as List<dynamic>? ?? [];
    return tagsList
        .map((e) => TagModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 获取标签预设
  ///
  /// [category] - 预设类别 (activity_type, instructor)
  Future<List<TagPresetModel>> getTagPresets(String category) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.tagPresets,
      queryParameters: {'category': category},
    );

    final presetsList = response.data!['presets'] as List<dynamic>? ?? [];
    return presetsList
        .map((e) => TagPresetModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 获取活动类型预设
  Future<List<TagPresetModel>> getActivityTypePresets() async {
    return getTagPresets('activity_type');
  }

  /// 获取讲师预设
  Future<List<TagPresetModel>> getInstructorPresets() async {
    return getTagPresets('instructor');
  }

  /// 获取文件的所有标签
  Future<List<FreeTagModel>> getFileTags(int fileId) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.fileTags(fileId),
    );

    final tagsList = response.data!['tags'] as List<dynamic>? ?? [];
    return tagsList
        .map((e) => FreeTagModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 添加标签到文件
  ///
  /// [fileId] - 文件 ID
  /// [tagName] - 标签名称
  Future<FreeTagModel> addTagToFile(int fileId, String tagName) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.fileTags(fileId),
      data: {'tag_name': tagName},
    );

    return FreeTagModel.fromJson(response.data!['tag'] as Map<String, dynamic>);
  }

  /// 从文件移除标签
  ///
  /// [fileId] - 文件 ID
  /// [tagId] - 标签 ID
  Future<void> removeTagFromFile(int fileId, int tagId) async {
    await _apiClient.delete<Map<String, dynamic>>(
      ApiConstants.fileTagDelete(fileId, tagId),
    );
  }
}

/// 标签 Repository Provider
@riverpod
TagsRepository tagsRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  return TagsRepository(apiClient: apiClient);
}
