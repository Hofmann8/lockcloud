import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';

part 'batch_repository.g.dart';

/// 批量操作结果
///
/// 包含成功和失败的文件 ID 列表
class BatchOperationResult {
  final bool success;
  final String message;
  final List<int> succeeded;
  final List<BatchFailedItem> failed;

  BatchOperationResult({
    required this.success,
    required this.message,
    required this.succeeded,
    required this.failed,
  });

  factory BatchOperationResult.fromJson(Map<String, dynamic> json) {
    final results = json['results'] as Map<String, dynamic>?;
    final succeededList = results?['succeeded'] as List<dynamic>? ?? [];
    final failedList = results?['failed'] as List<dynamic>? ?? [];

    return BatchOperationResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? '',
      succeeded: succeededList.map((e) => e as int).toList(),
      failed: failedList
          .map((e) => BatchFailedItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  /// 是否部分成功
  bool get isPartialSuccess => succeeded.isNotEmpty && failed.isNotEmpty;

  /// 是否全部成功
  bool get isAllSuccess => succeeded.isNotEmpty && failed.isEmpty;

  /// 是否全部失败
  bool get isAllFailed => succeeded.isEmpty && failed.isNotEmpty;
}

/// 批量操作失败项
class BatchFailedItem {
  final int fileId;
  final String error;

  BatchFailedItem({
    required this.fileId,
    required this.error,
  });

  factory BatchFailedItem.fromJson(Map<String, dynamic> json) {
    return BatchFailedItem(
      fileId: json['file_id'] as int,
      error: json['error'] as String? ?? '未知错误',
    );
  }
}

/// 批量添加标签结果
class BatchAddTagResult extends BatchOperationResult {
  final int? tagId;
  final String? tagName;

  BatchAddTagResult({
    required super.success,
    required super.message,
    required super.succeeded,
    required super.failed,
    this.tagId,
    this.tagName,
  });

  factory BatchAddTagResult.fromJson(Map<String, dynamic> json) {
    final results = json['results'] as Map<String, dynamic>?;
    final succeededList = results?['succeeded'] as List<dynamic>? ?? [];
    final failedList = results?['failed'] as List<dynamic>? ?? [];
    final tag = json['tag'] as Map<String, dynamic>?;

    return BatchAddTagResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? '',
      succeeded: succeededList.map((e) => e as int).toList(),
      failed: failedList
          .map((e) => BatchFailedItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      tagId: tag?['id'] as int?,
      tagName: tag?['name'] as String?,
    );
  }
}

/// 批量操作 Repository
///
/// 负责处理所有批量操作相关的 API 调用，包括：
/// - 批量删除文件
/// - 批量添加标签
/// - 批量移除标签
/// - 批量修改文件元数据
///
/// **Validates: Requirements 7.2, 7.3, 7.4**
class BatchRepository {
  final ApiClient _apiClient;

  /// 批量操作最大文件数限制
  static const int maxBatchSize = 100;

  BatchRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  /// 批量删除文件
  ///
  /// [fileIds] - 要删除的文件 ID 列表
  ///
  /// 返回批量操作结果，包含成功和失败的文件 ID
  ///
  /// **Validates: Requirements 7.2**
  Future<BatchOperationResult> batchDelete(List<int> fileIds) async {
    if (fileIds.isEmpty) {
      return BatchOperationResult(
        success: false,
        message: '文件ID列表不能为空',
        succeeded: [],
        failed: [],
      );
    }

    if (fileIds.length > maxBatchSize) {
      return BatchOperationResult(
        success: false,
        message: '批量操作限制最多$maxBatchSize个文件',
        succeeded: [],
        failed: [],
      );
    }

    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.batchDelete,
      data: {'file_ids': fileIds},
    );

    return BatchOperationResult.fromJson(response.data!);
  }

  /// 批量添加标签
  ///
  /// [fileIds] - 要添加标签的文件 ID 列表
  /// [tagName] - 标签名称
  ///
  /// 返回批量操作结果，包含成功和失败的文件 ID
  ///
  /// **Validates: Requirements 7.3**
  Future<BatchAddTagResult> batchAddTag(
    List<int> fileIds,
    String tagName,
  ) async {
    if (fileIds.isEmpty) {
      return BatchAddTagResult(
        success: false,
        message: '文件ID列表不能为空',
        succeeded: [],
        failed: [],
      );
    }

    if (tagName.trim().isEmpty) {
      return BatchAddTagResult(
        success: false,
        message: '标签名称不能为空',
        succeeded: [],
        failed: [],
      );
    }

    if (fileIds.length > maxBatchSize) {
      return BatchAddTagResult(
        success: false,
        message: '批量操作限制最多$maxBatchSize个文件',
        succeeded: [],
        failed: [],
      );
    }

    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.batchTags,
      data: {
        'file_ids': fileIds,
        'tag_name': tagName.trim(),
      },
    );

    return BatchAddTagResult.fromJson(response.data!);
  }

  /// 批量移除标签
  ///
  /// [fileIds] - 要移除标签的文件 ID 列表
  /// [tagId] - 标签 ID
  ///
  /// 返回批量操作结果，包含成功和失败的文件 ID
  Future<BatchOperationResult> batchRemoveTag(
    List<int> fileIds,
    int tagId,
  ) async {
    if (fileIds.isEmpty) {
      return BatchOperationResult(
        success: false,
        message: '文件ID列表不能为空',
        succeeded: [],
        failed: [],
      );
    }

    if (fileIds.length > maxBatchSize) {
      return BatchOperationResult(
        success: false,
        message: '批量操作限制最多$maxBatchSize个文件',
        succeeded: [],
        failed: [],
      );
    }

    final response = await _apiClient.delete<Map<String, dynamic>>(
      ApiConstants.batchTags,
      data: {
        'file_ids': fileIds,
        'tag_id': tagId,
      },
    );

    return BatchOperationResult.fromJson(response.data!);
  }

  /// 批量修改文件
  ///
  /// [fileIds] - 要修改的文件 ID 列表
  /// [updates] - 更新内容
  ///
  /// 返回批量操作结果，包含成功和失败的文件 ID
  ///
  /// **Validates: Requirements 7.4**
  Future<BatchOperationResult> batchUpdate(
    List<int> fileIds,
    BatchUpdateData updates,
  ) async {
    if (fileIds.isEmpty) {
      return BatchOperationResult(
        success: false,
        message: '文件ID列表不能为空',
        succeeded: [],
        failed: [],
      );
    }

    if (fileIds.length > maxBatchSize) {
      return BatchOperationResult(
        success: false,
        message: '批量操作限制最多$maxBatchSize个文件',
        succeeded: [],
        failed: [],
      );
    }

    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.batchUpdate,
      data: {
        'file_ids': fileIds,
        'updates': updates.toJson(),
      },
    );

    return BatchOperationResult.fromJson(response.data!);
  }
}

/// 批量更新数据
class BatchUpdateData {
  final String? activityDate;
  final String? activityType;
  final String? activityName;
  final List<String>? freeTags;
  final String? tagMode; // 'add' or 'replace'

  BatchUpdateData({
    this.activityDate,
    this.activityType,
    this.activityName,
    this.freeTags,
    this.tagMode,
  });

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};

    if (activityDate != null) {
      json['activity_date'] = activityDate;
    }
    if (activityType != null) {
      json['activity_type'] = activityType;
    }
    if (activityName != null) {
      json['activity_name'] = activityName;
    }
    if (freeTags != null && freeTags!.isNotEmpty) {
      json['free_tags'] = freeTags;
      json['tag_mode'] = tagMode ?? 'add';
    }

    return json;
  }

  /// 检查是否有任何更新内容
  bool get hasUpdates =>
      activityDate != null ||
      activityType != null ||
      activityName != null ||
      (freeTags != null && freeTags!.isNotEmpty);
}

/// BatchRepository Provider
///
/// 提供 BatchRepository 实例的 Riverpod Provider
@Riverpod(keepAlive: true)
BatchRepository batchRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BatchRepository(apiClient: apiClient);
}
