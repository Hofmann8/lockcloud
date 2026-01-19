import 'package:freezed_annotation/freezed_annotation.dart';

part 'file_model.freezed.dart';
part 'file_model.g.dart';

/// 自由标签模型
@freezed
sealed class FreeTag with _$FreeTag {
  const factory FreeTag({
    required int id,
    required String name,
  }) = _FreeTag;

  factory FreeTag.fromJson(Map<String, dynamic> json) => _$FreeTagFromJson(json);
}

/// 带计数的标签模型
@freezed
sealed class TagWithCount with _$TagWithCount {
  const factory TagWithCount({
    required int id,
    required String name,
    required int count,
  }) = _TagWithCount;

  factory TagWithCount.fromJson(Map<String, dynamic> json) =>
      _$TagWithCountFromJson(json);
}

/// 上传者信息
@freezed
sealed class FileUploader with _$FileUploader {
  const factory FileUploader({
    required int id,
    required String name,
    String? email,
    @JsonKey(name: 'avatar_key') String? avatarKey,
  }) = _FileUploader;

  factory FileUploader.fromJson(Map<String, dynamic> json) =>
      _$FileUploaderFromJson(json);
}

/// 文件模型
@freezed
sealed class FileModel with _$FileModel {
  const FileModel._();

  const factory FileModel({
    required int id,
    required String filename,
    @JsonKey(name: 'original_filename') String? originalFilename,
    required String directory,
    @JsonKey(name: 's3_key') required String s3Key,
    required int size,
    @JsonKey(name: 'content_type') String? contentType,
    @JsonKey(name: 'activity_date') String? activityDate,
    @JsonKey(name: 'activity_type') String? activityType,
    @JsonKey(name: 'activity_type_display') String? activityTypeDisplay,
    @JsonKey(name: 'activity_name') String? activityName,
    String? instructor,
    @JsonKey(name: 'is_legacy') @Default(false) bool isLegacy,
    @JsonKey(name: 'uploader_id') required int uploaderId,
    @JsonKey(name: 'uploaded_at') required String uploadedAt,
    @JsonKey(name: 'public_url') String? publicUrl,
    FileUploader? uploader,
    @JsonKey(name: 'free_tags') @Default([]) List<FreeTag> freeTags,
    String? thumbhash,
  }) = _FileModel;

  factory FileModel.fromJson(Map<String, dynamic> json) =>
      _$FileModelFromJson(json);

  /// 是否为图片
  bool get isImage {
    final type = contentType?.toLowerCase() ?? '';
    return type.startsWith('image/');
  }

  /// 是否为视频
  bool get isVideo {
    final type = contentType?.toLowerCase() ?? '';
    return type.startsWith('video/');
  }

  /// 获取格式化的文件大小
  String get formattedSize {
    double size = this.size.toDouble();
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    int unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return '${size.toStringAsFixed(2)} ${units[unitIndex]}';
  }
}

/// 目录节点模型
@freezed
sealed class DirectoryNode with _$DirectoryNode {
  const factory DirectoryNode({
    String? value,
    required String name,
    required String path,
    @Default([]) List<DirectoryNode> subdirectories,
    @JsonKey(name: 'file_count') int? fileCount,
    @JsonKey(name: 'activity_date') String? activityDate,
    @JsonKey(name: 'activity_name') String? activityName,
    @JsonKey(name: 'activity_type') String? activityType,
  }) = _DirectoryNode;

  factory DirectoryNode.fromJson(Map<String, dynamic> json) =>
      _$DirectoryNodeFromJson(json);
}

/// 标签预设模型
@freezed
sealed class TagPreset with _$TagPreset {
  const factory TagPreset({
    required int id,
    required String category,
    required String value,
    @JsonKey(name: 'display_name') required String displayName,
    @JsonKey(name: 'is_active') @Default(true) bool isActive,
    @JsonKey(name: 'created_at') String? createdAt,
  }) = _TagPreset;

  factory TagPreset.fromJson(Map<String, dynamic> json) =>
      _$TagPresetFromJson(json);
}

/// 时间线月份
@freezed
sealed class TimelineMonth with _$TimelineMonth {
  const factory TimelineMonth({
    required int count,
  }) = _TimelineMonth;

  factory TimelineMonth.fromJson(Map<String, dynamic> json) =>
      _$TimelineMonthFromJson(json);
}

/// 分页信息
@freezed
sealed class PaginationInfo with _$PaginationInfo {
  const factory PaginationInfo({
    required int page,
    @JsonKey(name: 'per_page') required int perPage,
    required int total,
    required int pages,
    @JsonKey(name: 'has_prev') required bool hasPrev,
    @JsonKey(name: 'has_next') required bool hasNext,
  }) = _PaginationInfo;

  factory PaginationInfo.fromJson(Map<String, dynamic> json) =>
      _$PaginationInfoFromJson(json);
}

/// 文件列表响应
@freezed
sealed class FileListResponse with _$FileListResponse {
  const factory FileListResponse({
    required List<FileModel> files,
    required PaginationInfo pagination,
    Map<String, Map<String, TimelineMonth>>? timeline,
  }) = _FileListResponse;

  factory FileListResponse.fromJson(Map<String, dynamic> json) =>
      _$FileListResponseFromJson(json);
}

/// 文件筛选条件
@freezed
sealed class FileFilters with _$FileFilters {
  const factory FileFilters({
    String? directory,
    @JsonKey(name: 'activity_type') String? activityType,
    @JsonKey(name: 'activity_name') String? activityName,
    @JsonKey(name: 'activity_date') String? activityDate,
    @JsonKey(name: 'date_from') String? dateFrom,
    @JsonKey(name: 'date_to') String? dateTo,
    @JsonKey(name: 'uploader_id') int? uploaderId,
    String? search,
    @Default(1) int page,
    @JsonKey(name: 'per_page') @Default(50) int perPage,
    @JsonKey(name: 'media_type') @Default('all') String mediaType,
    @Default([]) List<String> tags,
    int? year,
    int? month,
  }) = _FileFilters;

  factory FileFilters.fromJson(Map<String, dynamic> json) =>
      _$FileFiltersFromJson(json);
}

/// HLS 视频清晰度模型
@freezed
sealed class HLSQuality with _$HLSQuality {
  const factory HLSQuality({
    required int height,
    required int bitrate,
    required String label,
    required String playlist,
    @Default(false) bool isAvailable,
  }) = _HLSQuality;

  factory HLSQuality.fromJson(Map<String, dynamic> json) =>
      _$HLSQualityFromJson(json);
}
