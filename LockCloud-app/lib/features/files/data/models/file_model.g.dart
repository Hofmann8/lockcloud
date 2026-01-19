// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'file_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FreeTag _$FreeTagFromJson(Map<String, dynamic> json) =>
    _FreeTag(id: (json['id'] as num).toInt(), name: json['name'] as String);

Map<String, dynamic> _$FreeTagToJson(_FreeTag instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
};

_TagWithCount _$TagWithCountFromJson(Map<String, dynamic> json) =>
    _TagWithCount(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      count: (json['count'] as num).toInt(),
    );

Map<String, dynamic> _$TagWithCountToJson(_TagWithCount instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'count': instance.count,
    };

_FileUploader _$FileUploaderFromJson(Map<String, dynamic> json) =>
    _FileUploader(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      email: json['email'] as String?,
      avatarKey: json['avatar_key'] as String?,
    );

Map<String, dynamic> _$FileUploaderToJson(_FileUploader instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'avatar_key': instance.avatarKey,
    };

_FileModel _$FileModelFromJson(Map<String, dynamic> json) => _FileModel(
  id: (json['id'] as num).toInt(),
  filename: json['filename'] as String,
  originalFilename: json['original_filename'] as String?,
  directory: json['directory'] as String,
  s3Key: json['s3_key'] as String,
  size: (json['size'] as num).toInt(),
  contentType: json['content_type'] as String?,
  activityDate: json['activity_date'] as String?,
  activityType: json['activity_type'] as String?,
  activityTypeDisplay: json['activity_type_display'] as String?,
  activityName: json['activity_name'] as String?,
  instructor: json['instructor'] as String?,
  isLegacy: json['is_legacy'] as bool? ?? false,
  uploaderId: (json['uploader_id'] as num).toInt(),
  uploadedAt: json['uploaded_at'] as String,
  publicUrl: json['public_url'] as String?,
  uploader: json['uploader'] == null
      ? null
      : FileUploader.fromJson(json['uploader'] as Map<String, dynamic>),
  freeTags:
      (json['free_tags'] as List<dynamic>?)
          ?.map((e) => FreeTag.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  thumbhash: json['thumbhash'] as String?,
);

Map<String, dynamic> _$FileModelToJson(_FileModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'filename': instance.filename,
      'original_filename': instance.originalFilename,
      'directory': instance.directory,
      's3_key': instance.s3Key,
      'size': instance.size,
      'content_type': instance.contentType,
      'activity_date': instance.activityDate,
      'activity_type': instance.activityType,
      'activity_type_display': instance.activityTypeDisplay,
      'activity_name': instance.activityName,
      'instructor': instance.instructor,
      'is_legacy': instance.isLegacy,
      'uploader_id': instance.uploaderId,
      'uploaded_at': instance.uploadedAt,
      'public_url': instance.publicUrl,
      'uploader': instance.uploader,
      'free_tags': instance.freeTags,
      'thumbhash': instance.thumbhash,
    };

_DirectoryNode _$DirectoryNodeFromJson(Map<String, dynamic> json) =>
    _DirectoryNode(
      value: json['value'] as String?,
      name: json['name'] as String,
      path: json['path'] as String,
      subdirectories:
          (json['subdirectories'] as List<dynamic>?)
              ?.map((e) => DirectoryNode.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      fileCount: (json['file_count'] as num?)?.toInt(),
      activityDate: json['activity_date'] as String?,
      activityName: json['activity_name'] as String?,
      activityType: json['activity_type'] as String?,
    );

Map<String, dynamic> _$DirectoryNodeToJson(_DirectoryNode instance) =>
    <String, dynamic>{
      'value': instance.value,
      'name': instance.name,
      'path': instance.path,
      'subdirectories': instance.subdirectories,
      'file_count': instance.fileCount,
      'activity_date': instance.activityDate,
      'activity_name': instance.activityName,
      'activity_type': instance.activityType,
    };

_TagPreset _$TagPresetFromJson(Map<String, dynamic> json) => _TagPreset(
  id: (json['id'] as num).toInt(),
  category: json['category'] as String,
  value: json['value'] as String,
  displayName: json['display_name'] as String,
  isActive: json['is_active'] as bool? ?? true,
  createdAt: json['created_at'] as String?,
);

Map<String, dynamic> _$TagPresetToJson(_TagPreset instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': instance.category,
      'value': instance.value,
      'display_name': instance.displayName,
      'is_active': instance.isActive,
      'created_at': instance.createdAt,
    };

_TimelineMonth _$TimelineMonthFromJson(Map<String, dynamic> json) =>
    _TimelineMonth(count: (json['count'] as num).toInt());

Map<String, dynamic> _$TimelineMonthToJson(_TimelineMonth instance) =>
    <String, dynamic>{'count': instance.count};

_PaginationInfo _$PaginationInfoFromJson(Map<String, dynamic> json) =>
    _PaginationInfo(
      page: (json['page'] as num).toInt(),
      perPage: (json['per_page'] as num).toInt(),
      total: (json['total'] as num).toInt(),
      pages: (json['pages'] as num).toInt(),
      hasPrev: json['has_prev'] as bool,
      hasNext: json['has_next'] as bool,
    );

Map<String, dynamic> _$PaginationInfoToJson(_PaginationInfo instance) =>
    <String, dynamic>{
      'page': instance.page,
      'per_page': instance.perPage,
      'total': instance.total,
      'pages': instance.pages,
      'has_prev': instance.hasPrev,
      'has_next': instance.hasNext,
    };

_FileListResponse _$FileListResponseFromJson(Map<String, dynamic> json) =>
    _FileListResponse(
      files: (json['files'] as List<dynamic>)
          .map((e) => FileModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: PaginationInfo.fromJson(
        json['pagination'] as Map<String, dynamic>,
      ),
      timeline: (json['timeline'] as Map<String, dynamic>?)?.map(
        (k, e) => MapEntry(
          k,
          (e as Map<String, dynamic>).map(
            (k, e) =>
                MapEntry(k, TimelineMonth.fromJson(e as Map<String, dynamic>)),
          ),
        ),
      ),
    );

Map<String, dynamic> _$FileListResponseToJson(_FileListResponse instance) =>
    <String, dynamic>{
      'files': instance.files,
      'pagination': instance.pagination,
      'timeline': instance.timeline,
    };

_FileFilters _$FileFiltersFromJson(Map<String, dynamic> json) => _FileFilters(
  directory: json['directory'] as String?,
  activityType: json['activity_type'] as String?,
  activityName: json['activity_name'] as String?,
  activityDate: json['activity_date'] as String?,
  dateFrom: json['date_from'] as String?,
  dateTo: json['date_to'] as String?,
  uploaderId: (json['uploader_id'] as num?)?.toInt(),
  search: json['search'] as String?,
  page: (json['page'] as num?)?.toInt() ?? 1,
  perPage: (json['per_page'] as num?)?.toInt() ?? 50,
  mediaType: json['media_type'] as String? ?? 'all',
  tags:
      (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  year: (json['year'] as num?)?.toInt(),
  month: (json['month'] as num?)?.toInt(),
);

Map<String, dynamic> _$FileFiltersToJson(_FileFilters instance) =>
    <String, dynamic>{
      'directory': instance.directory,
      'activity_type': instance.activityType,
      'activity_name': instance.activityName,
      'activity_date': instance.activityDate,
      'date_from': instance.dateFrom,
      'date_to': instance.dateTo,
      'uploader_id': instance.uploaderId,
      'search': instance.search,
      'page': instance.page,
      'per_page': instance.perPage,
      'media_type': instance.mediaType,
      'tags': instance.tags,
      'year': instance.year,
      'month': instance.month,
    };

_HLSQuality _$HLSQualityFromJson(Map<String, dynamic> json) => _HLSQuality(
  height: (json['height'] as num).toInt(),
  bitrate: (json['bitrate'] as num).toInt(),
  label: json['label'] as String,
  playlist: json['playlist'] as String,
  isAvailable: json['isAvailable'] as bool? ?? false,
);

Map<String, dynamic> _$HLSQualityToJson(_HLSQuality instance) =>
    <String, dynamic>{
      'height': instance.height,
      'bitrate': instance.bitrate,
      'label': instance.label,
      'playlist': instance.playlist,
      'isAvailable': instance.isAvailable,
    };
