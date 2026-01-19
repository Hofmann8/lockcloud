import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/upload_queue_item.dart';

part 'upload_repository.g.dart';

/// 上传 Repository
///
/// 负责处理所有上传相关的 API 调用，包括：
/// - 获取预签名 URL
/// - 确认上传
/// - 检查文件名是否存在
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

  /// 检查文件名是否已存在
  ///
  /// 在上传前检查目标目录是否已存在同名文件。
  ///
  /// [filename] - 文件名
  /// [directory] - 目标目录路径
  ///
  /// 返回 true 表示文件已存在，false 表示不存在
  ///
  /// **Validates: Requirements 3.10**
  Future<bool> checkFilenameExists({
    required String filename,
    required String directory,
  }) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '${ApiConstants.files}/check-filename',
        queryParameters: {
          'filename': filename,
          'directory': directory,
        },
      );

      return response.data?['exists'] == true;
    } catch (e) {
      // 如果接口不存在或出错，默认返回 false
      return false;
    }
  }

  /// 获取活动类型列表
  ///
  /// 获取所有可用的活动类型选项。
  Future<List<ActivityType>> getActivityTypes() async {
    // 活动类型是固定的，直接返回
    return const [
      ActivityType(value: 'routine', display: '日常训练'),
      ActivityType(value: 'performance', display: '演出'),
      ActivityType(value: 'competition', display: '比赛'),
      ActivityType(value: 'workshop', display: '工作坊'),
      ActivityType(value: 'other', display: '其他'),
    ];
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

/// 活动类型列表 Provider
@riverpod
Future<List<ActivityType>> activityTypes(Ref ref) async {
  final repository = ref.watch(uploadRepositoryProvider);
  return repository.getActivityTypes();
}
