// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'upload_queue_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_UploadMetadata _$UploadMetadataFromJson(Map<String, dynamic> json) =>
    _UploadMetadata(
      activityDate: json['activity_date'] as String,
      activityType: json['activity_type'] as String,
      activityName: json['activity_name'] as String?,
      customFilename: json['custom_filename'] as String?,
    );

Map<String, dynamic> _$UploadMetadataToJson(_UploadMetadata instance) =>
    <String, dynamic>{
      'activity_date': instance.activityDate,
      'activity_type': instance.activityType,
      'activity_name': instance.activityName,
      'custom_filename': instance.customFilename,
    };

_UploadQueueItem _$UploadQueueItemFromJson(Map<String, dynamic> json) =>
    _UploadQueueItem(
      id: json['id'] as String,
      localPath: json['local_path'] as String,
      originalFilename: json['original_filename'] as String,
      size: (json['size'] as num).toInt(),
      contentType: json['content_type'] as String,
      metadata: UploadMetadata.fromJson(
        json['metadata'] as Map<String, dynamic>,
      ),
      status:
          $enumDecodeNullable(_$UploadStatusEnumMap, json['status']) ??
          UploadStatus.pending,
      progress: (json['progress'] as num?)?.toDouble() ?? 0.0,
      errorMessage: json['error_message'] as String?,
      s3Key: json['s3_key'] as String?,
      generatedFilename: json['generated_filename'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      retryCount: (json['retry_count'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$UploadQueueItemToJson(_UploadQueueItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'local_path': instance.localPath,
      'original_filename': instance.originalFilename,
      'size': instance.size,
      'content_type': instance.contentType,
      'metadata': instance.metadata,
      'status': _$UploadStatusEnumMap[instance.status]!,
      'progress': instance.progress,
      'error_message': instance.errorMessage,
      's3_key': instance.s3Key,
      'generated_filename': instance.generatedFilename,
      'created_at': instance.createdAt.toIso8601String(),
      'retry_count': instance.retryCount,
    };

const _$UploadStatusEnumMap = {
  UploadStatus.pending: 'pending',
  UploadStatus.uploading: 'uploading',
  UploadStatus.success: 'success',
  UploadStatus.failed: 'failed',
  UploadStatus.cancelled: 'cancelled',
};

_UploadUrlRequest _$UploadUrlRequestFromJson(Map<String, dynamic> json) =>
    _UploadUrlRequest(
      originalFilename: json['original_filename'] as String,
      contentType: json['content_type'] as String,
      size: (json['size'] as num).toInt(),
      activityDate: json['activity_date'] as String,
      activityType: json['activity_type'] as String,
      activityName: json['activity_name'] as String?,
      customFilename: json['custom_filename'] as String?,
    );

Map<String, dynamic> _$UploadUrlRequestToJson(_UploadUrlRequest instance) =>
    <String, dynamic>{
      'original_filename': instance.originalFilename,
      'content_type': instance.contentType,
      'size': instance.size,
      'activity_date': instance.activityDate,
      'activity_type': instance.activityType,
      'activity_name': instance.activityName,
      'custom_filename': instance.customFilename,
    };

_UploadUrlResponse _$UploadUrlResponseFromJson(Map<String, dynamic> json) =>
    _UploadUrlResponse(
      uploadUrl: json['upload_url'] as String,
      s3Key: json['s3_key'] as String,
      generatedFilename: json['generated_filename'] as String,
      expiresIn: (json['expires_in'] as num).toInt(),
    );

Map<String, dynamic> _$UploadUrlResponseToJson(_UploadUrlResponse instance) =>
    <String, dynamic>{
      'upload_url': instance.uploadUrl,
      's3_key': instance.s3Key,
      'generated_filename': instance.generatedFilename,
      'expires_in': instance.expiresIn,
    };

_FileConfirmRequest _$FileConfirmRequestFromJson(Map<String, dynamic> json) =>
    _FileConfirmRequest(
      s3Key: json['s3_key'] as String,
      size: (json['size'] as num).toInt(),
      contentType: json['content_type'] as String,
      originalFilename: json['original_filename'] as String,
      activityDate: json['activity_date'] as String,
      activityType: json['activity_type'] as String,
      activityName: json['activity_name'] as String?,
    );

Map<String, dynamic> _$FileConfirmRequestToJson(_FileConfirmRequest instance) =>
    <String, dynamic>{
      's3_key': instance.s3Key,
      'size': instance.size,
      'content_type': instance.contentType,
      'original_filename': instance.originalFilename,
      'activity_date': instance.activityDate,
      'activity_type': instance.activityType,
      'activity_name': instance.activityName,
    };
