import 'package:freezed_annotation/freezed_annotation.dart';

part 'upload_queue_item.freezed.dart';
part 'upload_queue_item.g.dart';

/// 上传状态枚举
enum UploadStatus {
  /// 等待上传
  pending,
  /// 正在上传
  uploading,
  /// 上传成功
  success,
  /// 上传失败
  failed,
  /// 已取消
  cancelled,
}

/// 上传元数据
@freezed
sealed class UploadMetadata with _$UploadMetadata {
  const factory UploadMetadata({
    /// 活动日期 (YYYY-MM-DD)
    @JsonKey(name: 'activity_date') required String activityDate,
    /// 活动类型
    @JsonKey(name: 'activity_type') required String activityType,
    /// 活动名称
    @JsonKey(name: 'activity_name') String? activityName,
    /// 自定义文件名
    @JsonKey(name: 'custom_filename') String? customFilename,
  }) = _UploadMetadata;

  factory UploadMetadata.fromJson(Map<String, dynamic> json) =>
      _$UploadMetadataFromJson(json);
}

/// 上传队列项
@freezed
sealed class UploadQueueItem with _$UploadQueueItem {
  const UploadQueueItem._();

  const factory UploadQueueItem({
    /// 唯一标识符
    required String id,
    /// 本地文件路径
    @JsonKey(name: 'local_path') required String localPath,
    /// 原始文件名
    @JsonKey(name: 'original_filename') required String originalFilename,
    /// 文件大小（字节）
    required int size,
    /// 内容类型
    @JsonKey(name: 'content_type') required String contentType,
    /// 上传元数据
    required UploadMetadata metadata,
    /// 上传状态
    @Default(UploadStatus.pending) UploadStatus status,
    /// 上传进度 (0.0 - 1.0)
    @Default(0.0) double progress,
    /// 错误信息
    @JsonKey(name: 'error_message') String? errorMessage,
    /// S3 Key（上传成功后设置）
    @JsonKey(name: 's3_key') String? s3Key,
    /// 生成的文件名（从服务器获取）
    @JsonKey(name: 'generated_filename') String? generatedFilename,
    /// 创建时间
    @JsonKey(name: 'created_at') required DateTime createdAt,
    /// 重试次数
    @JsonKey(name: 'retry_count') @Default(0) int retryCount,
  }) = _UploadQueueItem;

  factory UploadQueueItem.fromJson(Map<String, dynamic> json) =>
      _$UploadQueueItemFromJson(json);

  /// 是否正在上传
  bool get isUploading => status == UploadStatus.uploading;

  /// 是否已完成（成功或失败）
  bool get isCompleted =>
      status == UploadStatus.success || status == UploadStatus.failed;

  /// 是否可以重试
  bool get canRetry => status == UploadStatus.failed && retryCount < 3;

  /// 获取格式化的文件大小
  String get formattedSize {
    double size = this.size.toDouble();
    const units = ['B', 'KB', 'MB', 'GB'];
    int unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return '${size.toStringAsFixed(2)} ${units[unitIndex]}';
  }

  /// 获取进度百分比字符串
  String get progressPercent => '${(progress * 100).toStringAsFixed(1)}%';
}

/// 获取预签名 URL 的请求参数
@freezed
sealed class UploadUrlRequest with _$UploadUrlRequest {
  const factory UploadUrlRequest({
    @JsonKey(name: 'original_filename') required String originalFilename,
    @JsonKey(name: 'content_type') required String contentType,
    required int size,
    @JsonKey(name: 'activity_date') required String activityDate,
    @JsonKey(name: 'activity_type') required String activityType,
    @JsonKey(name: 'activity_name') String? activityName,
    @JsonKey(name: 'custom_filename') String? customFilename,
  }) = _UploadUrlRequest;

  factory UploadUrlRequest.fromJson(Map<String, dynamic> json) =>
      _$UploadUrlRequestFromJson(json);
}

/// 预签名 URL 响应
@freezed
sealed class UploadUrlResponse with _$UploadUrlResponse {
  const factory UploadUrlResponse({
    @JsonKey(name: 'upload_url') required String uploadUrl,
    @JsonKey(name: 's3_key') required String s3Key,
    @JsonKey(name: 'generated_filename') required String generatedFilename,
    @JsonKey(name: 'expires_in') required int expiresIn,
  }) = _UploadUrlResponse;

  factory UploadUrlResponse.fromJson(Map<String, dynamic> json) =>
      _$UploadUrlResponseFromJson(json);
}

/// 确认上传的请求参数
@freezed
sealed class FileConfirmRequest with _$FileConfirmRequest {
  const factory FileConfirmRequest({
    @JsonKey(name: 's3_key') required String s3Key,
    required int size,
    @JsonKey(name: 'content_type') required String contentType,
    @JsonKey(name: 'original_filename') required String originalFilename,
    @JsonKey(name: 'activity_date') required String activityDate,
    @JsonKey(name: 'activity_type') required String activityType,
    @JsonKey(name: 'activity_name') String? activityName,
  }) = _FileConfirmRequest;

  factory FileConfirmRequest.fromJson(Map<String, dynamic> json) =>
      _$FileConfirmRequestFromJson(json);
}
