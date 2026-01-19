// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'upload_queue_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$UploadMetadata {

/// 活动日期 (YYYY-MM-DD)
@JsonKey(name: 'activity_date') String get activityDate;/// 活动类型
@JsonKey(name: 'activity_type') String get activityType;/// 活动名称
@JsonKey(name: 'activity_name') String? get activityName;/// 自定义文件名
@JsonKey(name: 'custom_filename') String? get customFilename;
/// Create a copy of UploadMetadata
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UploadMetadataCopyWith<UploadMetadata> get copyWith => _$UploadMetadataCopyWithImpl<UploadMetadata>(this as UploadMetadata, _$identity);

  /// Serializes this UploadMetadata to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UploadMetadata&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.customFilename, customFilename) || other.customFilename == customFilename));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityType,activityName,customFilename);

@override
String toString() {
  return 'UploadMetadata(activityDate: $activityDate, activityType: $activityType, activityName: $activityName, customFilename: $customFilename)';
}


}

/// @nodoc
abstract mixin class $UploadMetadataCopyWith<$Res>  {
  factory $UploadMetadataCopyWith(UploadMetadata value, $Res Function(UploadMetadata) _then) = _$UploadMetadataCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'custom_filename') String? customFilename
});




}
/// @nodoc
class _$UploadMetadataCopyWithImpl<$Res>
    implements $UploadMetadataCopyWith<$Res> {
  _$UploadMetadataCopyWithImpl(this._self, this._then);

  final UploadMetadata _self;
  final $Res Function(UploadMetadata) _then;

/// Create a copy of UploadMetadata
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? activityDate = null,Object? activityType = null,Object? activityName = freezed,Object? customFilename = freezed,}) {
  return _then(_self.copyWith(
activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,customFilename: freezed == customFilename ? _self.customFilename : customFilename // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [UploadMetadata].
extension UploadMetadataPatterns on UploadMetadata {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UploadMetadata value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UploadMetadata() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UploadMetadata value)  $default,){
final _that = this;
switch (_that) {
case _UploadMetadata():
return $default(_that);}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UploadMetadata value)?  $default,){
final _that = this;
switch (_that) {
case _UploadMetadata() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'custom_filename')  String? customFilename)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UploadMetadata() when $default != null:
return $default(_that.activityDate,_that.activityType,_that.activityName,_that.customFilename);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'custom_filename')  String? customFilename)  $default,) {final _that = this;
switch (_that) {
case _UploadMetadata():
return $default(_that.activityDate,_that.activityType,_that.activityName,_that.customFilename);}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'custom_filename')  String? customFilename)?  $default,) {final _that = this;
switch (_that) {
case _UploadMetadata() when $default != null:
return $default(_that.activityDate,_that.activityType,_that.activityName,_that.customFilename);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _UploadMetadata implements UploadMetadata {
  const _UploadMetadata({@JsonKey(name: 'activity_date') required this.activityDate, @JsonKey(name: 'activity_type') required this.activityType, @JsonKey(name: 'activity_name') this.activityName, @JsonKey(name: 'custom_filename') this.customFilename});
  factory _UploadMetadata.fromJson(Map<String, dynamic> json) => _$UploadMetadataFromJson(json);

/// 活动日期 (YYYY-MM-DD)
@override@JsonKey(name: 'activity_date') final  String activityDate;
/// 活动类型
@override@JsonKey(name: 'activity_type') final  String activityType;
/// 活动名称
@override@JsonKey(name: 'activity_name') final  String? activityName;
/// 自定义文件名
@override@JsonKey(name: 'custom_filename') final  String? customFilename;

/// Create a copy of UploadMetadata
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UploadMetadataCopyWith<_UploadMetadata> get copyWith => __$UploadMetadataCopyWithImpl<_UploadMetadata>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UploadMetadataToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UploadMetadata&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.customFilename, customFilename) || other.customFilename == customFilename));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityType,activityName,customFilename);

@override
String toString() {
  return 'UploadMetadata(activityDate: $activityDate, activityType: $activityType, activityName: $activityName, customFilename: $customFilename)';
}


}

/// @nodoc
abstract mixin class _$UploadMetadataCopyWith<$Res> implements $UploadMetadataCopyWith<$Res> {
  factory _$UploadMetadataCopyWith(_UploadMetadata value, $Res Function(_UploadMetadata) _then) = __$UploadMetadataCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'custom_filename') String? customFilename
});




}
/// @nodoc
class __$UploadMetadataCopyWithImpl<$Res>
    implements _$UploadMetadataCopyWith<$Res> {
  __$UploadMetadataCopyWithImpl(this._self, this._then);

  final _UploadMetadata _self;
  final $Res Function(_UploadMetadata) _then;

/// Create a copy of UploadMetadata
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? activityDate = null,Object? activityType = null,Object? activityName = freezed,Object? customFilename = freezed,}) {
  return _then(_UploadMetadata(
activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,customFilename: freezed == customFilename ? _self.customFilename : customFilename // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$UploadQueueItem {

/// 唯一标识符
 String get id;/// 本地文件路径
@JsonKey(name: 'local_path') String get localPath;/// 原始文件名
@JsonKey(name: 'original_filename') String get originalFilename;/// 文件大小（字节）
 int get size;/// 内容类型
@JsonKey(name: 'content_type') String get contentType;/// 上传元数据
 UploadMetadata get metadata;/// 上传状态
 UploadStatus get status;/// 上传进度 (0.0 - 1.0)
 double get progress;/// 错误信息
@JsonKey(name: 'error_message') String? get errorMessage;/// S3 Key（上传成功后设置）
@JsonKey(name: 's3_key') String? get s3Key;/// 生成的文件名（从服务器获取）
@JsonKey(name: 'generated_filename') String? get generatedFilename;/// 创建时间
@JsonKey(name: 'created_at') DateTime get createdAt;/// 重试次数
@JsonKey(name: 'retry_count') int get retryCount;
/// Create a copy of UploadQueueItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UploadQueueItemCopyWith<UploadQueueItem> get copyWith => _$UploadQueueItemCopyWithImpl<UploadQueueItem>(this as UploadQueueItem, _$identity);

  /// Serializes this UploadQueueItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UploadQueueItem&&(identical(other.id, id) || other.id == id)&&(identical(other.localPath, localPath) || other.localPath == localPath)&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.size, size) || other.size == size)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.metadata, metadata) || other.metadata == metadata)&&(identical(other.status, status) || other.status == status)&&(identical(other.progress, progress) || other.progress == progress)&&(identical(other.errorMessage, errorMessage) || other.errorMessage == errorMessage)&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.generatedFilename, generatedFilename) || other.generatedFilename == generatedFilename)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.retryCount, retryCount) || other.retryCount == retryCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,localPath,originalFilename,size,contentType,metadata,status,progress,errorMessage,s3Key,generatedFilename,createdAt,retryCount);

@override
String toString() {
  return 'UploadQueueItem(id: $id, localPath: $localPath, originalFilename: $originalFilename, size: $size, contentType: $contentType, metadata: $metadata, status: $status, progress: $progress, errorMessage: $errorMessage, s3Key: $s3Key, generatedFilename: $generatedFilename, createdAt: $createdAt, retryCount: $retryCount)';
}


}

/// @nodoc
abstract mixin class $UploadQueueItemCopyWith<$Res>  {
  factory $UploadQueueItemCopyWith(UploadQueueItem value, $Res Function(UploadQueueItem) _then) = _$UploadQueueItemCopyWithImpl;
@useResult
$Res call({
 String id,@JsonKey(name: 'local_path') String localPath,@JsonKey(name: 'original_filename') String originalFilename, int size,@JsonKey(name: 'content_type') String contentType, UploadMetadata metadata, UploadStatus status, double progress,@JsonKey(name: 'error_message') String? errorMessage,@JsonKey(name: 's3_key') String? s3Key,@JsonKey(name: 'generated_filename') String? generatedFilename,@JsonKey(name: 'created_at') DateTime createdAt,@JsonKey(name: 'retry_count') int retryCount
});


$UploadMetadataCopyWith<$Res> get metadata;

}
/// @nodoc
class _$UploadQueueItemCopyWithImpl<$Res>
    implements $UploadQueueItemCopyWith<$Res> {
  _$UploadQueueItemCopyWithImpl(this._self, this._then);

  final UploadQueueItem _self;
  final $Res Function(UploadQueueItem) _then;

/// Create a copy of UploadQueueItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? localPath = null,Object? originalFilename = null,Object? size = null,Object? contentType = null,Object? metadata = null,Object? status = null,Object? progress = null,Object? errorMessage = freezed,Object? s3Key = freezed,Object? generatedFilename = freezed,Object? createdAt = null,Object? retryCount = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,localPath: null == localPath ? _self.localPath : localPath // ignore: cast_nullable_to_non_nullable
as String,originalFilename: null == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,metadata: null == metadata ? _self.metadata : metadata // ignore: cast_nullable_to_non_nullable
as UploadMetadata,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as UploadStatus,progress: null == progress ? _self.progress : progress // ignore: cast_nullable_to_non_nullable
as double,errorMessage: freezed == errorMessage ? _self.errorMessage : errorMessage // ignore: cast_nullable_to_non_nullable
as String?,s3Key: freezed == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String?,generatedFilename: freezed == generatedFilename ? _self.generatedFilename : generatedFilename // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,retryCount: null == retryCount ? _self.retryCount : retryCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}
/// Create a copy of UploadQueueItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UploadMetadataCopyWith<$Res> get metadata {
  
  return $UploadMetadataCopyWith<$Res>(_self.metadata, (value) {
    return _then(_self.copyWith(metadata: value));
  });
}
}


/// Adds pattern-matching-related methods to [UploadQueueItem].
extension UploadQueueItemPatterns on UploadQueueItem {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UploadQueueItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UploadQueueItem() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UploadQueueItem value)  $default,){
final _that = this;
switch (_that) {
case _UploadQueueItem():
return $default(_that);}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UploadQueueItem value)?  $default,){
final _that = this;
switch (_that) {
case _UploadQueueItem() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id, @JsonKey(name: 'local_path')  String localPath, @JsonKey(name: 'original_filename')  String originalFilename,  int size, @JsonKey(name: 'content_type')  String contentType,  UploadMetadata metadata,  UploadStatus status,  double progress, @JsonKey(name: 'error_message')  String? errorMessage, @JsonKey(name: 's3_key')  String? s3Key, @JsonKey(name: 'generated_filename')  String? generatedFilename, @JsonKey(name: 'created_at')  DateTime createdAt, @JsonKey(name: 'retry_count')  int retryCount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UploadQueueItem() when $default != null:
return $default(_that.id,_that.localPath,_that.originalFilename,_that.size,_that.contentType,_that.metadata,_that.status,_that.progress,_that.errorMessage,_that.s3Key,_that.generatedFilename,_that.createdAt,_that.retryCount);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id, @JsonKey(name: 'local_path')  String localPath, @JsonKey(name: 'original_filename')  String originalFilename,  int size, @JsonKey(name: 'content_type')  String contentType,  UploadMetadata metadata,  UploadStatus status,  double progress, @JsonKey(name: 'error_message')  String? errorMessage, @JsonKey(name: 's3_key')  String? s3Key, @JsonKey(name: 'generated_filename')  String? generatedFilename, @JsonKey(name: 'created_at')  DateTime createdAt, @JsonKey(name: 'retry_count')  int retryCount)  $default,) {final _that = this;
switch (_that) {
case _UploadQueueItem():
return $default(_that.id,_that.localPath,_that.originalFilename,_that.size,_that.contentType,_that.metadata,_that.status,_that.progress,_that.errorMessage,_that.s3Key,_that.generatedFilename,_that.createdAt,_that.retryCount);}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id, @JsonKey(name: 'local_path')  String localPath, @JsonKey(name: 'original_filename')  String originalFilename,  int size, @JsonKey(name: 'content_type')  String contentType,  UploadMetadata metadata,  UploadStatus status,  double progress, @JsonKey(name: 'error_message')  String? errorMessage, @JsonKey(name: 's3_key')  String? s3Key, @JsonKey(name: 'generated_filename')  String? generatedFilename, @JsonKey(name: 'created_at')  DateTime createdAt, @JsonKey(name: 'retry_count')  int retryCount)?  $default,) {final _that = this;
switch (_that) {
case _UploadQueueItem() when $default != null:
return $default(_that.id,_that.localPath,_that.originalFilename,_that.size,_that.contentType,_that.metadata,_that.status,_that.progress,_that.errorMessage,_that.s3Key,_that.generatedFilename,_that.createdAt,_that.retryCount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _UploadQueueItem extends UploadQueueItem {
  const _UploadQueueItem({required this.id, @JsonKey(name: 'local_path') required this.localPath, @JsonKey(name: 'original_filename') required this.originalFilename, required this.size, @JsonKey(name: 'content_type') required this.contentType, required this.metadata, this.status = UploadStatus.pending, this.progress = 0.0, @JsonKey(name: 'error_message') this.errorMessage, @JsonKey(name: 's3_key') this.s3Key, @JsonKey(name: 'generated_filename') this.generatedFilename, @JsonKey(name: 'created_at') required this.createdAt, @JsonKey(name: 'retry_count') this.retryCount = 0}): super._();
  factory _UploadQueueItem.fromJson(Map<String, dynamic> json) => _$UploadQueueItemFromJson(json);

/// 唯一标识符
@override final  String id;
/// 本地文件路径
@override@JsonKey(name: 'local_path') final  String localPath;
/// 原始文件名
@override@JsonKey(name: 'original_filename') final  String originalFilename;
/// 文件大小（字节）
@override final  int size;
/// 内容类型
@override@JsonKey(name: 'content_type') final  String contentType;
/// 上传元数据
@override final  UploadMetadata metadata;
/// 上传状态
@override@JsonKey() final  UploadStatus status;
/// 上传进度 (0.0 - 1.0)
@override@JsonKey() final  double progress;
/// 错误信息
@override@JsonKey(name: 'error_message') final  String? errorMessage;
/// S3 Key（上传成功后设置）
@override@JsonKey(name: 's3_key') final  String? s3Key;
/// 生成的文件名（从服务器获取）
@override@JsonKey(name: 'generated_filename') final  String? generatedFilename;
/// 创建时间
@override@JsonKey(name: 'created_at') final  DateTime createdAt;
/// 重试次数
@override@JsonKey(name: 'retry_count') final  int retryCount;

/// Create a copy of UploadQueueItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UploadQueueItemCopyWith<_UploadQueueItem> get copyWith => __$UploadQueueItemCopyWithImpl<_UploadQueueItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UploadQueueItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UploadQueueItem&&(identical(other.id, id) || other.id == id)&&(identical(other.localPath, localPath) || other.localPath == localPath)&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.size, size) || other.size == size)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.metadata, metadata) || other.metadata == metadata)&&(identical(other.status, status) || other.status == status)&&(identical(other.progress, progress) || other.progress == progress)&&(identical(other.errorMessage, errorMessage) || other.errorMessage == errorMessage)&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.generatedFilename, generatedFilename) || other.generatedFilename == generatedFilename)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.retryCount, retryCount) || other.retryCount == retryCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,localPath,originalFilename,size,contentType,metadata,status,progress,errorMessage,s3Key,generatedFilename,createdAt,retryCount);

@override
String toString() {
  return 'UploadQueueItem(id: $id, localPath: $localPath, originalFilename: $originalFilename, size: $size, contentType: $contentType, metadata: $metadata, status: $status, progress: $progress, errorMessage: $errorMessage, s3Key: $s3Key, generatedFilename: $generatedFilename, createdAt: $createdAt, retryCount: $retryCount)';
}


}

/// @nodoc
abstract mixin class _$UploadQueueItemCopyWith<$Res> implements $UploadQueueItemCopyWith<$Res> {
  factory _$UploadQueueItemCopyWith(_UploadQueueItem value, $Res Function(_UploadQueueItem) _then) = __$UploadQueueItemCopyWithImpl;
@override @useResult
$Res call({
 String id,@JsonKey(name: 'local_path') String localPath,@JsonKey(name: 'original_filename') String originalFilename, int size,@JsonKey(name: 'content_type') String contentType, UploadMetadata metadata, UploadStatus status, double progress,@JsonKey(name: 'error_message') String? errorMessage,@JsonKey(name: 's3_key') String? s3Key,@JsonKey(name: 'generated_filename') String? generatedFilename,@JsonKey(name: 'created_at') DateTime createdAt,@JsonKey(name: 'retry_count') int retryCount
});


@override $UploadMetadataCopyWith<$Res> get metadata;

}
/// @nodoc
class __$UploadQueueItemCopyWithImpl<$Res>
    implements _$UploadQueueItemCopyWith<$Res> {
  __$UploadQueueItemCopyWithImpl(this._self, this._then);

  final _UploadQueueItem _self;
  final $Res Function(_UploadQueueItem) _then;

/// Create a copy of UploadQueueItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? localPath = null,Object? originalFilename = null,Object? size = null,Object? contentType = null,Object? metadata = null,Object? status = null,Object? progress = null,Object? errorMessage = freezed,Object? s3Key = freezed,Object? generatedFilename = freezed,Object? createdAt = null,Object? retryCount = null,}) {
  return _then(_UploadQueueItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,localPath: null == localPath ? _self.localPath : localPath // ignore: cast_nullable_to_non_nullable
as String,originalFilename: null == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,metadata: null == metadata ? _self.metadata : metadata // ignore: cast_nullable_to_non_nullable
as UploadMetadata,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as UploadStatus,progress: null == progress ? _self.progress : progress // ignore: cast_nullable_to_non_nullable
as double,errorMessage: freezed == errorMessage ? _self.errorMessage : errorMessage // ignore: cast_nullable_to_non_nullable
as String?,s3Key: freezed == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String?,generatedFilename: freezed == generatedFilename ? _self.generatedFilename : generatedFilename // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,retryCount: null == retryCount ? _self.retryCount : retryCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

/// Create a copy of UploadQueueItem
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UploadMetadataCopyWith<$Res> get metadata {
  
  return $UploadMetadataCopyWith<$Res>(_self.metadata, (value) {
    return _then(_self.copyWith(metadata: value));
  });
}
}


/// @nodoc
mixin _$UploadUrlRequest {

@JsonKey(name: 'original_filename') String get originalFilename;@JsonKey(name: 'content_type') String get contentType; int get size;@JsonKey(name: 'activity_date') String get activityDate;@JsonKey(name: 'activity_type') String get activityType;@JsonKey(name: 'activity_name') String? get activityName;@JsonKey(name: 'custom_filename') String? get customFilename;
/// Create a copy of UploadUrlRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UploadUrlRequestCopyWith<UploadUrlRequest> get copyWith => _$UploadUrlRequestCopyWithImpl<UploadUrlRequest>(this as UploadUrlRequest, _$identity);

  /// Serializes this UploadUrlRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UploadUrlRequest&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.size, size) || other.size == size)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.customFilename, customFilename) || other.customFilename == customFilename));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,originalFilename,contentType,size,activityDate,activityType,activityName,customFilename);

@override
String toString() {
  return 'UploadUrlRequest(originalFilename: $originalFilename, contentType: $contentType, size: $size, activityDate: $activityDate, activityType: $activityType, activityName: $activityName, customFilename: $customFilename)';
}


}

/// @nodoc
abstract mixin class $UploadUrlRequestCopyWith<$Res>  {
  factory $UploadUrlRequestCopyWith(UploadUrlRequest value, $Res Function(UploadUrlRequest) _then) = _$UploadUrlRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'original_filename') String originalFilename,@JsonKey(name: 'content_type') String contentType, int size,@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'custom_filename') String? customFilename
});




}
/// @nodoc
class _$UploadUrlRequestCopyWithImpl<$Res>
    implements $UploadUrlRequestCopyWith<$Res> {
  _$UploadUrlRequestCopyWithImpl(this._self, this._then);

  final UploadUrlRequest _self;
  final $Res Function(UploadUrlRequest) _then;

/// Create a copy of UploadUrlRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? originalFilename = null,Object? contentType = null,Object? size = null,Object? activityDate = null,Object? activityType = null,Object? activityName = freezed,Object? customFilename = freezed,}) {
  return _then(_self.copyWith(
originalFilename: null == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,customFilename: freezed == customFilename ? _self.customFilename : customFilename // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [UploadUrlRequest].
extension UploadUrlRequestPatterns on UploadUrlRequest {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UploadUrlRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UploadUrlRequest() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UploadUrlRequest value)  $default,){
final _that = this;
switch (_that) {
case _UploadUrlRequest():
return $default(_that);}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UploadUrlRequest value)?  $default,){
final _that = this;
switch (_that) {
case _UploadUrlRequest() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'original_filename')  String originalFilename, @JsonKey(name: 'content_type')  String contentType,  int size, @JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'custom_filename')  String? customFilename)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UploadUrlRequest() when $default != null:
return $default(_that.originalFilename,_that.contentType,_that.size,_that.activityDate,_that.activityType,_that.activityName,_that.customFilename);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'original_filename')  String originalFilename, @JsonKey(name: 'content_type')  String contentType,  int size, @JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'custom_filename')  String? customFilename)  $default,) {final _that = this;
switch (_that) {
case _UploadUrlRequest():
return $default(_that.originalFilename,_that.contentType,_that.size,_that.activityDate,_that.activityType,_that.activityName,_that.customFilename);}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'original_filename')  String originalFilename, @JsonKey(name: 'content_type')  String contentType,  int size, @JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'custom_filename')  String? customFilename)?  $default,) {final _that = this;
switch (_that) {
case _UploadUrlRequest() when $default != null:
return $default(_that.originalFilename,_that.contentType,_that.size,_that.activityDate,_that.activityType,_that.activityName,_that.customFilename);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _UploadUrlRequest implements UploadUrlRequest {
  const _UploadUrlRequest({@JsonKey(name: 'original_filename') required this.originalFilename, @JsonKey(name: 'content_type') required this.contentType, required this.size, @JsonKey(name: 'activity_date') required this.activityDate, @JsonKey(name: 'activity_type') required this.activityType, @JsonKey(name: 'activity_name') this.activityName, @JsonKey(name: 'custom_filename') this.customFilename});
  factory _UploadUrlRequest.fromJson(Map<String, dynamic> json) => _$UploadUrlRequestFromJson(json);

@override@JsonKey(name: 'original_filename') final  String originalFilename;
@override@JsonKey(name: 'content_type') final  String contentType;
@override final  int size;
@override@JsonKey(name: 'activity_date') final  String activityDate;
@override@JsonKey(name: 'activity_type') final  String activityType;
@override@JsonKey(name: 'activity_name') final  String? activityName;
@override@JsonKey(name: 'custom_filename') final  String? customFilename;

/// Create a copy of UploadUrlRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UploadUrlRequestCopyWith<_UploadUrlRequest> get copyWith => __$UploadUrlRequestCopyWithImpl<_UploadUrlRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UploadUrlRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UploadUrlRequest&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.size, size) || other.size == size)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.customFilename, customFilename) || other.customFilename == customFilename));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,originalFilename,contentType,size,activityDate,activityType,activityName,customFilename);

@override
String toString() {
  return 'UploadUrlRequest(originalFilename: $originalFilename, contentType: $contentType, size: $size, activityDate: $activityDate, activityType: $activityType, activityName: $activityName, customFilename: $customFilename)';
}


}

/// @nodoc
abstract mixin class _$UploadUrlRequestCopyWith<$Res> implements $UploadUrlRequestCopyWith<$Res> {
  factory _$UploadUrlRequestCopyWith(_UploadUrlRequest value, $Res Function(_UploadUrlRequest) _then) = __$UploadUrlRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'original_filename') String originalFilename,@JsonKey(name: 'content_type') String contentType, int size,@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'custom_filename') String? customFilename
});




}
/// @nodoc
class __$UploadUrlRequestCopyWithImpl<$Res>
    implements _$UploadUrlRequestCopyWith<$Res> {
  __$UploadUrlRequestCopyWithImpl(this._self, this._then);

  final _UploadUrlRequest _self;
  final $Res Function(_UploadUrlRequest) _then;

/// Create a copy of UploadUrlRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? originalFilename = null,Object? contentType = null,Object? size = null,Object? activityDate = null,Object? activityType = null,Object? activityName = freezed,Object? customFilename = freezed,}) {
  return _then(_UploadUrlRequest(
originalFilename: null == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,customFilename: freezed == customFilename ? _self.customFilename : customFilename // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$UploadUrlResponse {

@JsonKey(name: 'upload_url') String get uploadUrl;@JsonKey(name: 's3_key') String get s3Key;@JsonKey(name: 'generated_filename') String get generatedFilename;@JsonKey(name: 'expires_in') int get expiresIn;
/// Create a copy of UploadUrlResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UploadUrlResponseCopyWith<UploadUrlResponse> get copyWith => _$UploadUrlResponseCopyWithImpl<UploadUrlResponse>(this as UploadUrlResponse, _$identity);

  /// Serializes this UploadUrlResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UploadUrlResponse&&(identical(other.uploadUrl, uploadUrl) || other.uploadUrl == uploadUrl)&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.generatedFilename, generatedFilename) || other.generatedFilename == generatedFilename)&&(identical(other.expiresIn, expiresIn) || other.expiresIn == expiresIn));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,uploadUrl,s3Key,generatedFilename,expiresIn);

@override
String toString() {
  return 'UploadUrlResponse(uploadUrl: $uploadUrl, s3Key: $s3Key, generatedFilename: $generatedFilename, expiresIn: $expiresIn)';
}


}

/// @nodoc
abstract mixin class $UploadUrlResponseCopyWith<$Res>  {
  factory $UploadUrlResponseCopyWith(UploadUrlResponse value, $Res Function(UploadUrlResponse) _then) = _$UploadUrlResponseCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'upload_url') String uploadUrl,@JsonKey(name: 's3_key') String s3Key,@JsonKey(name: 'generated_filename') String generatedFilename,@JsonKey(name: 'expires_in') int expiresIn
});




}
/// @nodoc
class _$UploadUrlResponseCopyWithImpl<$Res>
    implements $UploadUrlResponseCopyWith<$Res> {
  _$UploadUrlResponseCopyWithImpl(this._self, this._then);

  final UploadUrlResponse _self;
  final $Res Function(UploadUrlResponse) _then;

/// Create a copy of UploadUrlResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? uploadUrl = null,Object? s3Key = null,Object? generatedFilename = null,Object? expiresIn = null,}) {
  return _then(_self.copyWith(
uploadUrl: null == uploadUrl ? _self.uploadUrl : uploadUrl // ignore: cast_nullable_to_non_nullable
as String,s3Key: null == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String,generatedFilename: null == generatedFilename ? _self.generatedFilename : generatedFilename // ignore: cast_nullable_to_non_nullable
as String,expiresIn: null == expiresIn ? _self.expiresIn : expiresIn // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [UploadUrlResponse].
extension UploadUrlResponsePatterns on UploadUrlResponse {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UploadUrlResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UploadUrlResponse() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UploadUrlResponse value)  $default,){
final _that = this;
switch (_that) {
case _UploadUrlResponse():
return $default(_that);}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UploadUrlResponse value)?  $default,){
final _that = this;
switch (_that) {
case _UploadUrlResponse() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'upload_url')  String uploadUrl, @JsonKey(name: 's3_key')  String s3Key, @JsonKey(name: 'generated_filename')  String generatedFilename, @JsonKey(name: 'expires_in')  int expiresIn)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UploadUrlResponse() when $default != null:
return $default(_that.uploadUrl,_that.s3Key,_that.generatedFilename,_that.expiresIn);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'upload_url')  String uploadUrl, @JsonKey(name: 's3_key')  String s3Key, @JsonKey(name: 'generated_filename')  String generatedFilename, @JsonKey(name: 'expires_in')  int expiresIn)  $default,) {final _that = this;
switch (_that) {
case _UploadUrlResponse():
return $default(_that.uploadUrl,_that.s3Key,_that.generatedFilename,_that.expiresIn);}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'upload_url')  String uploadUrl, @JsonKey(name: 's3_key')  String s3Key, @JsonKey(name: 'generated_filename')  String generatedFilename, @JsonKey(name: 'expires_in')  int expiresIn)?  $default,) {final _that = this;
switch (_that) {
case _UploadUrlResponse() when $default != null:
return $default(_that.uploadUrl,_that.s3Key,_that.generatedFilename,_that.expiresIn);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _UploadUrlResponse implements UploadUrlResponse {
  const _UploadUrlResponse({@JsonKey(name: 'upload_url') required this.uploadUrl, @JsonKey(name: 's3_key') required this.s3Key, @JsonKey(name: 'generated_filename') required this.generatedFilename, @JsonKey(name: 'expires_in') required this.expiresIn});
  factory _UploadUrlResponse.fromJson(Map<String, dynamic> json) => _$UploadUrlResponseFromJson(json);

@override@JsonKey(name: 'upload_url') final  String uploadUrl;
@override@JsonKey(name: 's3_key') final  String s3Key;
@override@JsonKey(name: 'generated_filename') final  String generatedFilename;
@override@JsonKey(name: 'expires_in') final  int expiresIn;

/// Create a copy of UploadUrlResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UploadUrlResponseCopyWith<_UploadUrlResponse> get copyWith => __$UploadUrlResponseCopyWithImpl<_UploadUrlResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UploadUrlResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UploadUrlResponse&&(identical(other.uploadUrl, uploadUrl) || other.uploadUrl == uploadUrl)&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.generatedFilename, generatedFilename) || other.generatedFilename == generatedFilename)&&(identical(other.expiresIn, expiresIn) || other.expiresIn == expiresIn));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,uploadUrl,s3Key,generatedFilename,expiresIn);

@override
String toString() {
  return 'UploadUrlResponse(uploadUrl: $uploadUrl, s3Key: $s3Key, generatedFilename: $generatedFilename, expiresIn: $expiresIn)';
}


}

/// @nodoc
abstract mixin class _$UploadUrlResponseCopyWith<$Res> implements $UploadUrlResponseCopyWith<$Res> {
  factory _$UploadUrlResponseCopyWith(_UploadUrlResponse value, $Res Function(_UploadUrlResponse) _then) = __$UploadUrlResponseCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'upload_url') String uploadUrl,@JsonKey(name: 's3_key') String s3Key,@JsonKey(name: 'generated_filename') String generatedFilename,@JsonKey(name: 'expires_in') int expiresIn
});




}
/// @nodoc
class __$UploadUrlResponseCopyWithImpl<$Res>
    implements _$UploadUrlResponseCopyWith<$Res> {
  __$UploadUrlResponseCopyWithImpl(this._self, this._then);

  final _UploadUrlResponse _self;
  final $Res Function(_UploadUrlResponse) _then;

/// Create a copy of UploadUrlResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? uploadUrl = null,Object? s3Key = null,Object? generatedFilename = null,Object? expiresIn = null,}) {
  return _then(_UploadUrlResponse(
uploadUrl: null == uploadUrl ? _self.uploadUrl : uploadUrl // ignore: cast_nullable_to_non_nullable
as String,s3Key: null == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String,generatedFilename: null == generatedFilename ? _self.generatedFilename : generatedFilename // ignore: cast_nullable_to_non_nullable
as String,expiresIn: null == expiresIn ? _self.expiresIn : expiresIn // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$FileConfirmRequest {

@JsonKey(name: 's3_key') String get s3Key; int get size;@JsonKey(name: 'content_type') String get contentType;@JsonKey(name: 'original_filename') String get originalFilename;@JsonKey(name: 'activity_date') String get activityDate;@JsonKey(name: 'activity_type') String get activityType;@JsonKey(name: 'activity_name') String? get activityName;
/// Create a copy of FileConfirmRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileConfirmRequestCopyWith<FileConfirmRequest> get copyWith => _$FileConfirmRequestCopyWithImpl<FileConfirmRequest>(this as FileConfirmRequest, _$identity);

  /// Serializes this FileConfirmRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileConfirmRequest&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.size, size) || other.size == size)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,s3Key,size,contentType,originalFilename,activityDate,activityType,activityName);

@override
String toString() {
  return 'FileConfirmRequest(s3Key: $s3Key, size: $size, contentType: $contentType, originalFilename: $originalFilename, activityDate: $activityDate, activityType: $activityType, activityName: $activityName)';
}


}

/// @nodoc
abstract mixin class $FileConfirmRequestCopyWith<$Res>  {
  factory $FileConfirmRequestCopyWith(FileConfirmRequest value, $Res Function(FileConfirmRequest) _then) = _$FileConfirmRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 's3_key') String s3Key, int size,@JsonKey(name: 'content_type') String contentType,@JsonKey(name: 'original_filename') String originalFilename,@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'activity_name') String? activityName
});




}
/// @nodoc
class _$FileConfirmRequestCopyWithImpl<$Res>
    implements $FileConfirmRequestCopyWith<$Res> {
  _$FileConfirmRequestCopyWithImpl(this._self, this._then);

  final FileConfirmRequest _self;
  final $Res Function(FileConfirmRequest) _then;

/// Create a copy of FileConfirmRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? s3Key = null,Object? size = null,Object? contentType = null,Object? originalFilename = null,Object? activityDate = null,Object? activityType = null,Object? activityName = freezed,}) {
  return _then(_self.copyWith(
s3Key: null == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,originalFilename: null == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String,activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [FileConfirmRequest].
extension FileConfirmRequestPatterns on FileConfirmRequest {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileConfirmRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileConfirmRequest() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileConfirmRequest value)  $default,){
final _that = this;
switch (_that) {
case _FileConfirmRequest():
return $default(_that);}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileConfirmRequest value)?  $default,){
final _that = this;
switch (_that) {
case _FileConfirmRequest() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 's3_key')  String s3Key,  int size, @JsonKey(name: 'content_type')  String contentType, @JsonKey(name: 'original_filename')  String originalFilename, @JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileConfirmRequest() when $default != null:
return $default(_that.s3Key,_that.size,_that.contentType,_that.originalFilename,_that.activityDate,_that.activityType,_that.activityName);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 's3_key')  String s3Key,  int size, @JsonKey(name: 'content_type')  String contentType, @JsonKey(name: 'original_filename')  String originalFilename, @JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName)  $default,) {final _that = this;
switch (_that) {
case _FileConfirmRequest():
return $default(_that.s3Key,_that.size,_that.contentType,_that.originalFilename,_that.activityDate,_that.activityType,_that.activityName);}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 's3_key')  String s3Key,  int size, @JsonKey(name: 'content_type')  String contentType, @JsonKey(name: 'original_filename')  String originalFilename, @JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'activity_name')  String? activityName)?  $default,) {final _that = this;
switch (_that) {
case _FileConfirmRequest() when $default != null:
return $default(_that.s3Key,_that.size,_that.contentType,_that.originalFilename,_that.activityDate,_that.activityType,_that.activityName);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileConfirmRequest implements FileConfirmRequest {
  const _FileConfirmRequest({@JsonKey(name: 's3_key') required this.s3Key, required this.size, @JsonKey(name: 'content_type') required this.contentType, @JsonKey(name: 'original_filename') required this.originalFilename, @JsonKey(name: 'activity_date') required this.activityDate, @JsonKey(name: 'activity_type') required this.activityType, @JsonKey(name: 'activity_name') this.activityName});
  factory _FileConfirmRequest.fromJson(Map<String, dynamic> json) => _$FileConfirmRequestFromJson(json);

@override@JsonKey(name: 's3_key') final  String s3Key;
@override final  int size;
@override@JsonKey(name: 'content_type') final  String contentType;
@override@JsonKey(name: 'original_filename') final  String originalFilename;
@override@JsonKey(name: 'activity_date') final  String activityDate;
@override@JsonKey(name: 'activity_type') final  String activityType;
@override@JsonKey(name: 'activity_name') final  String? activityName;

/// Create a copy of FileConfirmRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileConfirmRequestCopyWith<_FileConfirmRequest> get copyWith => __$FileConfirmRequestCopyWithImpl<_FileConfirmRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileConfirmRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileConfirmRequest&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.size, size) || other.size == size)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,s3Key,size,contentType,originalFilename,activityDate,activityType,activityName);

@override
String toString() {
  return 'FileConfirmRequest(s3Key: $s3Key, size: $size, contentType: $contentType, originalFilename: $originalFilename, activityDate: $activityDate, activityType: $activityType, activityName: $activityName)';
}


}

/// @nodoc
abstract mixin class _$FileConfirmRequestCopyWith<$Res> implements $FileConfirmRequestCopyWith<$Res> {
  factory _$FileConfirmRequestCopyWith(_FileConfirmRequest value, $Res Function(_FileConfirmRequest) _then) = __$FileConfirmRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 's3_key') String s3Key, int size,@JsonKey(name: 'content_type') String contentType,@JsonKey(name: 'original_filename') String originalFilename,@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'activity_name') String? activityName
});




}
/// @nodoc
class __$FileConfirmRequestCopyWithImpl<$Res>
    implements _$FileConfirmRequestCopyWith<$Res> {
  __$FileConfirmRequestCopyWithImpl(this._self, this._then);

  final _FileConfirmRequest _self;
  final $Res Function(_FileConfirmRequest) _then;

/// Create a copy of FileConfirmRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? s3Key = null,Object? size = null,Object? contentType = null,Object? originalFilename = null,Object? activityDate = null,Object? activityType = null,Object? activityName = freezed,}) {
  return _then(_FileConfirmRequest(
s3Key: null == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,contentType: null == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String,originalFilename: null == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String,activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
