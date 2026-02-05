import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../files/data/repositories/tags_repository.dart';
import '../models/upload_queue_item.dart';

part 'upload_repository.g.dart';

/// 活动名称信息（包含关联的活动类型）
class ActivityNameInfo {
  final String name;
  final String activityType;
  final String activityTypeDisplay;
  final int fileCount;

  ActivityNameInfo({
    required this.name,
    required this.activityType,
    required this.activityTypeDisplay,
    required this.fileCount,
  });

  factory ActivityNameInfo.fromJson(Map<String, dynamic> json) {
    return ActivityNameInfo(
      name: json['name'] as String,
      activityType: json['activity_type'] as String,
      activityTypeDisplay: json['activity_type_display'] as String,
      fileCount: json['file_count'] as int? ?? 0,
    );
  }
}

/// 文件名检查结果
class FilenameCheckResult {
  final List<String> existingFiles;
  final List<String> availableFiles;

  FilenameCheckResult({
    required this.existingFiles,
    required this.availableFiles,
  });

  factory FilenameCheckResult.fromJson(Map<String, dynamic> json) {
    return FilenameCheckResult(
      existingFiles: (json['existing_files'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      availableFiles: (json['available_files'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );
  }

  bool get hasConflicts => existingFiles.isNotEmpty;
}

/// 上传 Repository
///
/// 负责处理所有上传相关的 API 调用，包括：
/// - 获取预签名 URL
/// - 确认上传
/// - 检查文件名是否存在
/// - 获取活动类型预设
/// - 获取活动名称建议
///
/// **Validates: Requirements 3.6**
class UploadRepository {
  final ApiClient _apiClient;

  UploadRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  /// 获取预签名上传 URL
  ///
  /// 请求服务器生成 S3 预签名 URL，用于直接上传文件到 S3。
  ///
  /// [request] - 上传请求参数，包含文件信息和元数据
  ///
  /// 返回包含预签名 URL、S3 Key 和生成的文件名的响应
  ///
  /// **Validates: Requirements 3.6**
  Future<UploadUrlResponse> getPresignedUrl(UploadUrlRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.uploadPresign,
      data: request.toJson(),
    );

    return UploadUrlResponse.fromJson(response.data!);
  }

  /// 确认上传完成
  ///
  /// 在文件成功上传到 S3 后，调用此接口通知服务器创建文件记录。
  ///
  /// [request] - 确认请求参数，包含 S3 Key 和文件元数据
  ///
  /// 返回创建的文件信息
  ///
  /// **Validates: Requirements 3.6**
  Future<Map<String, dynamic>> confirmUpload(FileConfirmRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.uploadConfirm,
      data: request.toJson(),
    );

    return response.data!;
  }

  /// 批量检查文件名是否已存在
  ///
  /// 在上传前检查目标目录是否已存在同名文件。
  ///
  /// [filenames] - 文件名列表
  /// [activityDate] - 活动日期
  /// [activityType] - 活动类型
  ///
  /// 返回检查结果，包含已存在和可用的文件名列表
  Future<FilenameCheckResult> checkFilenames({
    required List<String> filenames,
    required String activityDate,
    required String activityType,
  }) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.checkFilenames,
      data: {
        'filenames': filenames,
        'activity_date': activityDate,
        'activity_type': activityType,
      },
    );

    return FilenameCheckResult.fromJson(response.data!);
  }

  /// 获取活动类型预设列表
  ///
  /// 从 API 获取所有可用的活动类型选项。
  Future<List<TagPresetModel>> getActivityTypePresets() async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.tagPresets,
      queryParameters: {'category': 'activity_type'},
    );

    final presetsList = response.data!['presets'] as List<dynamic>? ?? [];
    return presetsList
        .map((e) => TagPresetModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 获取指定日期的活动名称列表
  ///
  /// 返回该日期已有的活动名称及其关联的活动类型
  ///
  /// [date] - 活动日期 (YYYY-MM-DD)
  Future<List<ActivityNameInfo>> getActivityNamesByDate(String date) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.filesActivityNames,
      queryParameters: {'date': date},
    );

    final names = response.data!['activity_names'] as List<dynamic>? ?? [];
    return names
        .map((e) => ActivityNameInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

/// 活动类型模型
class ActivityType {
  final String value;
  final String display;

  const ActivityType({
    required this.value,
    required this.display,
  });
}

/// UploadRepository Provider
///
/// 提供 UploadRepository 实例的 Riverpod Provider
@Riverpod(keepAlive: true)
UploadRepository uploadRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  return UploadRepository(apiClient: apiClient);
}

/// 活动类型预设列表 Provider
@riverpod
Future<List<TagPresetModel>> activityTypePresets(Ref ref) async {
  final repository = ref.watch(uploadRepositoryProvider);
  return repository.getActivityTypePresets();
}

/// 指定日期的活动名称列表 Provider
@riverpod
Future<List<ActivityNameInfo>> activityNamesByDate(Ref ref, String date) async {
  final repository = ref.watch(uploadRepositoryProvider);
  return repository.getActivityNamesByDate(date);
}
