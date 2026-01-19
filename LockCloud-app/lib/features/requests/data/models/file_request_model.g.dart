// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'file_request_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_RequestFileInfo _$RequestFileInfoFromJson(Map<String, dynamic> json) =>
    _RequestFileInfo(
      id: (json['id'] as num).toInt(),
      filename: json['filename'] as String,
      activityDate: json['activity_date'] as String?,
      activityType: json['activity_type'] as String?,
      activityName: json['activity_name'] as String?,
    );

Map<String, dynamic> _$RequestFileInfoToJson(_RequestFileInfo instance) =>
    <String, dynamic>{
      'id': instance.id,
      'filename': instance.filename,
      'activity_date': instance.activityDate,
      'activity_type': instance.activityType,
      'activity_name': instance.activityName,
    };

_RequestUserInfo _$RequestUserInfoFromJson(Map<String, dynamic> json) =>
    _RequestUserInfo(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
    );

Map<String, dynamic> _$RequestUserInfoToJson(_RequestUserInfo instance) =>
    <String, dynamic>{'id': instance.id, 'name': instance.name};

_DirectoryInfo _$DirectoryInfoFromJson(Map<String, dynamic> json) =>
    _DirectoryInfo(
      activityDate: json['activity_date'] as String,
      activityName: json['activity_name'] as String,
      activityType: json['activity_type'] as String,
    );

Map<String, dynamic> _$DirectoryInfoToJson(_DirectoryInfo instance) =>
    <String, dynamic>{
      'activity_date': instance.activityDate,
      'activity_name': instance.activityName,
      'activity_type': instance.activityType,
    };

_ProposedChanges _$ProposedChangesFromJson(Map<String, dynamic> json) =>
    _ProposedChanges(
      activityDate: json['activity_date'] as String?,
      activityType: json['activity_type'] as String?,
      activityName: json['activity_name'] as String?,
      newActivityName: json['new_activity_name'] as String?,
      newActivityType: json['new_activity_type'] as String?,
      instructor: json['instructor'] as String?,
      filename: json['filename'] as String?,
      freeTags: (json['free_tags'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$ProposedChangesToJson(_ProposedChanges instance) =>
    <String, dynamic>{
      'activity_date': instance.activityDate,
      'activity_type': instance.activityType,
      'activity_name': instance.activityName,
      'new_activity_name': instance.newActivityName,
      'new_activity_type': instance.newActivityType,
      'instructor': instance.instructor,
      'filename': instance.filename,
      'free_tags': instance.freeTags,
    };

_FileRequestModel _$FileRequestModelFromJson(Map<String, dynamic> json) =>
    _FileRequestModel(
      id: (json['id'] as num).toInt(),
      fileId: (json['file_id'] as num?)?.toInt(),
      requesterId: (json['requester_id'] as num).toInt(),
      ownerId: (json['owner_id'] as num).toInt(),
      requestType: $enumDecode(_$RequestTypeEnumMap, json['request_type']),
      status: $enumDecode(_$RequestStatusEnumMap, json['status']),
      proposedChanges: json['proposed_changes'] == null
          ? null
          : ProposedChanges.fromJson(
              json['proposed_changes'] as Map<String, dynamic>,
            ),
      directoryInfo: json['directory_info'] == null
          ? null
          : DirectoryInfo.fromJson(
              json['directory_info'] as Map<String, dynamic>,
            ),
      message: json['message'] as String?,
      responseMessage: json['response_message'] as String?,
      createdAt: json['created_at'] as String,
      updatedAt: json['updated_at'] as String?,
      file: json['file'] == null
          ? null
          : RequestFileInfo.fromJson(json['file'] as Map<String, dynamic>),
      requester: json['requester'] == null
          ? null
          : RequestUserInfo.fromJson(json['requester'] as Map<String, dynamic>),
      owner: json['owner'] == null
          ? null
          : RequestUserInfo.fromJson(json['owner'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$FileRequestModelToJson(_FileRequestModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'file_id': instance.fileId,
      'requester_id': instance.requesterId,
      'owner_id': instance.ownerId,
      'request_type': _$RequestTypeEnumMap[instance.requestType]!,
      'status': _$RequestStatusEnumMap[instance.status]!,
      'proposed_changes': instance.proposedChanges,
      'directory_info': instance.directoryInfo,
      'message': instance.message,
      'response_message': instance.responseMessage,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
      'file': instance.file,
      'requester': instance.requester,
      'owner': instance.owner,
    };

const _$RequestTypeEnumMap = {
  RequestType.edit: 'edit',
  RequestType.delete: 'delete',
  RequestType.directoryEdit: 'directory_edit',
};

const _$RequestStatusEnumMap = {
  RequestStatus.pending: 'pending',
  RequestStatus.approved: 'approved',
  RequestStatus.rejected: 'rejected',
};

_CreateRequestParams _$CreateRequestParamsFromJson(Map<String, dynamic> json) =>
    _CreateRequestParams(
      fileId: (json['file_id'] as num).toInt(),
      requestType: json['request_type'] as String,
      proposedChanges: json['proposed_changes'] as Map<String, dynamic>?,
      message: json['message'] as String?,
    );

Map<String, dynamic> _$CreateRequestParamsToJson(
  _CreateRequestParams instance,
) => <String, dynamic>{
  'file_id': instance.fileId,
  'request_type': instance.requestType,
  'proposed_changes': instance.proposedChanges,
  'message': instance.message,
};

_CreateDirectoryRequestParams _$CreateDirectoryRequestParamsFromJson(
  Map<String, dynamic> json,
) => _CreateDirectoryRequestParams(
  activityDate: json['activity_date'] as String,
  activityName: json['activity_name'] as String,
  activityType: json['activity_type'] as String,
  proposedChanges: json['proposed_changes'] as Map<String, dynamic>,
  message: json['message'] as String?,
);

Map<String, dynamic> _$CreateDirectoryRequestParamsToJson(
  _CreateDirectoryRequestParams instance,
) => <String, dynamic>{
  'activity_date': instance.activityDate,
  'activity_name': instance.activityName,
  'activity_type': instance.activityType,
  'proposed_changes': instance.proposedChanges,
  'message': instance.message,
};

_BatchCreateRequestParams _$BatchCreateRequestParamsFromJson(
  Map<String, dynamic> json,
) => _BatchCreateRequestParams(
  fileIds: (json['file_ids'] as List<dynamic>)
      .map((e) => (e as num).toInt())
      .toList(),
  proposedChanges: json['proposed_changes'] as Map<String, dynamic>,
);

Map<String, dynamic> _$BatchCreateRequestParamsToJson(
  _BatchCreateRequestParams instance,
) => <String, dynamic>{
  'file_ids': instance.fileIds,
  'proposed_changes': instance.proposedChanges,
};
