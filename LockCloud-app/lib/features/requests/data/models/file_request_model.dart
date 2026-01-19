import 'package:freezed_annotation/freezed_annotation.dart';

part 'file_request_model.freezed.dart';
part 'file_request_model.g.dart';

/// 请求类型枚举
enum RequestType {
  @JsonValue('edit')
  edit,
  @JsonValue('delete')
  delete,
  @JsonValue('directory_edit')
  directoryEdit,
}

/// 请求状态枚举
enum RequestStatus {
  @JsonValue('pending')
  pending,
  @JsonValue('approved')
  approved,
  @JsonValue('rejected')
  rejected,
}

/// 请求中的文件信息
@freezed
sealed class RequestFileInfo with _$RequestFileInfo {
  const factory RequestFileInfo({
    required int id,
    required String filename,
    @JsonKey(name: 'activity_date') String? activityDate,
    @JsonKey(name: 'activity_type') String? activityType,
    @JsonKey(name: 'activity_name') String? activityName,
  }) = _RequestFileInfo;

  factory RequestFileInfo.fromJson(Map<String, dynamic> json) =>
      _$RequestFileInfoFromJson(json);
}

/// 请求中的用户信息
@freezed
sealed class RequestUserInfo with _$RequestUserInfo {
  const factory RequestUserInfo({
    required int id,
    required String name,
  }) = _RequestUserInfo;

  factory RequestUserInfo.fromJson(Map<String, dynamic> json) =>
      _$RequestUserInfoFromJson(json);
}

/// 目录信息（用于目录编辑请求）
@freezed
sealed class DirectoryInfo with _$DirectoryInfo {
  const factory DirectoryInfo({
    @JsonKey(name: 'activity_date') required String activityDate,
    @JsonKey(name: 'activity_name') required String activityName,
    @JsonKey(name: 'activity_type') required String activityType,
  }) = _DirectoryInfo;

  factory DirectoryInfo.fromJson(Map<String, dynamic> json) =>
      _$DirectoryInfoFromJson(json);
}

/// 提议的修改内容
@freezed
sealed class ProposedChanges with _$ProposedChanges {
  const factory ProposedChanges({
    @JsonKey(name: 'activity_date') String? activityDate,
    @JsonKey(name: 'activity_type') String? activityType,
    @JsonKey(name: 'activity_name') String? activityName,
    @JsonKey(name: 'new_activity_name') String? newActivityName,
    @JsonKey(name: 'new_activity_type') String? newActivityType,
    String? instructor,
    String? filename,
    @JsonKey(name: 'free_tags') List<String>? freeTags,
  }) = _ProposedChanges;

  factory ProposedChanges.fromJson(Map<String, dynamic> json) =>
      _$ProposedChangesFromJson(json);
}

/// 文件请求模型
@freezed
sealed class FileRequestModel with _$FileRequestModel {
  const FileRequestModel._();

  const factory FileRequestModel({
    required int id,
    @JsonKey(name: 'file_id') int? fileId,
    @JsonKey(name: 'requester_id') required int requesterId,
    @JsonKey(name: 'owner_id') required int ownerId,
    @JsonKey(name: 'request_type') required RequestType requestType,
    required RequestStatus status,
    @JsonKey(name: 'proposed_changes') ProposedChanges? proposedChanges,
    @JsonKey(name: 'directory_info') DirectoryInfo? directoryInfo,
    String? message,
    @JsonKey(name: 'response_message') String? responseMessage,
    @JsonKey(name: 'created_at') required String createdAt,
    @JsonKey(name: 'updated_at') String? updatedAt,
    RequestFileInfo? file,
    RequestUserInfo? requester,
    RequestUserInfo? owner,
  }) = _FileRequestModel;

  factory FileRequestModel.fromJson(Map<String, dynamic> json) =>
      _$FileRequestModelFromJson(json);

  /// 是否为待处理状态
  bool get isPending => status == RequestStatus.pending;

  /// 是否为已批准状态
  bool get isApproved => status == RequestStatus.approved;

  /// 是否为已拒绝状态
  bool get isRejected => status == RequestStatus.rejected;

  /// 是否为目录编辑请求
  bool get isDirectoryRequest => requestType == RequestType.directoryEdit;

  /// 获取请求类型显示名称
  String get requestTypeDisplay {
    switch (requestType) {
      case RequestType.edit:
        return '编辑';
      case RequestType.delete:
        return '删除';
      case RequestType.directoryEdit:
        return '目录编辑';
    }
  }

  /// 获取状态显示名称
  String get statusDisplay {
    switch (status) {
      case RequestStatus.pending:
        return '待处理';
      case RequestStatus.approved:
        return '已批准';
      case RequestStatus.rejected:
        return '已拒绝';
    }
  }
}

/// 创建请求的参数
@freezed
sealed class CreateRequestParams with _$CreateRequestParams {
  const factory CreateRequestParams({
    @JsonKey(name: 'file_id') required int fileId,
    @JsonKey(name: 'request_type') required String requestType,
    @JsonKey(name: 'proposed_changes') Map<String, dynamic>? proposedChanges,
    String? message,
  }) = _CreateRequestParams;

  factory CreateRequestParams.fromJson(Map<String, dynamic> json) =>
      _$CreateRequestParamsFromJson(json);
}

/// 创建目录请求的参数
@freezed
sealed class CreateDirectoryRequestParams with _$CreateDirectoryRequestParams {
  const factory CreateDirectoryRequestParams({
    @JsonKey(name: 'activity_date') required String activityDate,
    @JsonKey(name: 'activity_name') required String activityName,
    @JsonKey(name: 'activity_type') required String activityType,
    @JsonKey(name: 'proposed_changes') required Map<String, dynamic> proposedChanges,
    String? message,
  }) = _CreateDirectoryRequestParams;

  factory CreateDirectoryRequestParams.fromJson(Map<String, dynamic> json) =>
      _$CreateDirectoryRequestParamsFromJson(json);
}

/// 批量创建请求的参数
@freezed
sealed class BatchCreateRequestParams with _$BatchCreateRequestParams {
  const factory BatchCreateRequestParams({
    @JsonKey(name: 'file_ids') required List<int> fileIds,
    @JsonKey(name: 'proposed_changes') required Map<String, dynamic> proposedChanges,
  }) = _BatchCreateRequestParams;

  factory BatchCreateRequestParams.fromJson(Map<String, dynamic> json) =>
      _$BatchCreateRequestParamsFromJson(json);
}
