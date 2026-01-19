// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'file_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FreeTag {

 int get id; String get name;
/// Create a copy of FreeTag
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FreeTagCopyWith<FreeTag> get copyWith => _$FreeTagCopyWithImpl<FreeTag>(this as FreeTag, _$identity);

  /// Serializes this FreeTag to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FreeTag&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'FreeTag(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class $FreeTagCopyWith<$Res>  {
  factory $FreeTagCopyWith(FreeTag value, $Res Function(FreeTag) _then) = _$FreeTagCopyWithImpl;
@useResult
$Res call({
 int id, String name
});




}
/// @nodoc
class _$FreeTagCopyWithImpl<$Res>
    implements $FreeTagCopyWith<$Res> {
  _$FreeTagCopyWithImpl(this._self, this._then);

  final FreeTag _self;
  final $Res Function(FreeTag) _then;

/// Create a copy of FreeTag
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [FreeTag].
extension FreeTagPatterns on FreeTag {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FreeTag value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FreeTag() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FreeTag value)  $default,){
final _that = this;
switch (_that) {
case _FreeTag():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FreeTag value)?  $default,){
final _that = this;
switch (_that) {
case _FreeTag() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String name)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FreeTag() when $default != null:
return $default(_that.id,_that.name);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String name)  $default,) {final _that = this;
switch (_that) {
case _FreeTag():
return $default(_that.id,_that.name);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String name)?  $default,) {final _that = this;
switch (_that) {
case _FreeTag() when $default != null:
return $default(_that.id,_that.name);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FreeTag implements FreeTag {
  const _FreeTag({required this.id, required this.name});
  factory _FreeTag.fromJson(Map<String, dynamic> json) => _$FreeTagFromJson(json);

@override final  int id;
@override final  String name;

/// Create a copy of FreeTag
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FreeTagCopyWith<_FreeTag> get copyWith => __$FreeTagCopyWithImpl<_FreeTag>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FreeTagToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FreeTag&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'FreeTag(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class _$FreeTagCopyWith<$Res> implements $FreeTagCopyWith<$Res> {
  factory _$FreeTagCopyWith(_FreeTag value, $Res Function(_FreeTag) _then) = __$FreeTagCopyWithImpl;
@override @useResult
$Res call({
 int id, String name
});




}
/// @nodoc
class __$FreeTagCopyWithImpl<$Res>
    implements _$FreeTagCopyWith<$Res> {
  __$FreeTagCopyWithImpl(this._self, this._then);

  final _FreeTag _self;
  final $Res Function(_FreeTag) _then;

/// Create a copy of FreeTag
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,}) {
  return _then(_FreeTag(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$TagWithCount {

 int get id; String get name; int get count;
/// Create a copy of TagWithCount
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TagWithCountCopyWith<TagWithCount> get copyWith => _$TagWithCountCopyWithImpl<TagWithCount>(this as TagWithCount, _$identity);

  /// Serializes this TagWithCount to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TagWithCount&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,count);

@override
String toString() {
  return 'TagWithCount(id: $id, name: $name, count: $count)';
}


}

/// @nodoc
abstract mixin class $TagWithCountCopyWith<$Res>  {
  factory $TagWithCountCopyWith(TagWithCount value, $Res Function(TagWithCount) _then) = _$TagWithCountCopyWithImpl;
@useResult
$Res call({
 int id, String name, int count
});




}
/// @nodoc
class _$TagWithCountCopyWithImpl<$Res>
    implements $TagWithCountCopyWith<$Res> {
  _$TagWithCountCopyWithImpl(this._self, this._then);

  final TagWithCount _self;
  final $Res Function(TagWithCount) _then;

/// Create a copy of TagWithCount
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? count = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [TagWithCount].
extension TagWithCountPatterns on TagWithCount {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TagWithCount value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TagWithCount() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TagWithCount value)  $default,){
final _that = this;
switch (_that) {
case _TagWithCount():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TagWithCount value)?  $default,){
final _that = this;
switch (_that) {
case _TagWithCount() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String name,  int count)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TagWithCount() when $default != null:
return $default(_that.id,_that.name,_that.count);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String name,  int count)  $default,) {final _that = this;
switch (_that) {
case _TagWithCount():
return $default(_that.id,_that.name,_that.count);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String name,  int count)?  $default,) {final _that = this;
switch (_that) {
case _TagWithCount() when $default != null:
return $default(_that.id,_that.name,_that.count);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TagWithCount implements TagWithCount {
  const _TagWithCount({required this.id, required this.name, required this.count});
  factory _TagWithCount.fromJson(Map<String, dynamic> json) => _$TagWithCountFromJson(json);

@override final  int id;
@override final  String name;
@override final  int count;

/// Create a copy of TagWithCount
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TagWithCountCopyWith<_TagWithCount> get copyWith => __$TagWithCountCopyWithImpl<_TagWithCount>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TagWithCountToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TagWithCount&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,count);

@override
String toString() {
  return 'TagWithCount(id: $id, name: $name, count: $count)';
}


}

/// @nodoc
abstract mixin class _$TagWithCountCopyWith<$Res> implements $TagWithCountCopyWith<$Res> {
  factory _$TagWithCountCopyWith(_TagWithCount value, $Res Function(_TagWithCount) _then) = __$TagWithCountCopyWithImpl;
@override @useResult
$Res call({
 int id, String name, int count
});




}
/// @nodoc
class __$TagWithCountCopyWithImpl<$Res>
    implements _$TagWithCountCopyWith<$Res> {
  __$TagWithCountCopyWithImpl(this._self, this._then);

  final _TagWithCount _self;
  final $Res Function(_TagWithCount) _then;

/// Create a copy of TagWithCount
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? count = null,}) {
  return _then(_TagWithCount(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$FileUploader {

 int get id; String get name; String? get email;@JsonKey(name: 'avatar_key') String? get avatarKey;
/// Create a copy of FileUploader
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileUploaderCopyWith<FileUploader> get copyWith => _$FileUploaderCopyWithImpl<FileUploader>(this as FileUploader, _$identity);

  /// Serializes this FileUploader to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileUploader&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.email, email) || other.email == email)&&(identical(other.avatarKey, avatarKey) || other.avatarKey == avatarKey));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,email,avatarKey);

@override
String toString() {
  return 'FileUploader(id: $id, name: $name, email: $email, avatarKey: $avatarKey)';
}


}

/// @nodoc
abstract mixin class $FileUploaderCopyWith<$Res>  {
  factory $FileUploaderCopyWith(FileUploader value, $Res Function(FileUploader) _then) = _$FileUploaderCopyWithImpl;
@useResult
$Res call({
 int id, String name, String? email,@JsonKey(name: 'avatar_key') String? avatarKey
});




}
/// @nodoc
class _$FileUploaderCopyWithImpl<$Res>
    implements $FileUploaderCopyWith<$Res> {
  _$FileUploaderCopyWithImpl(this._self, this._then);

  final FileUploader _self;
  final $Res Function(FileUploader) _then;

/// Create a copy of FileUploader
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? email = freezed,Object? avatarKey = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,avatarKey: freezed == avatarKey ? _self.avatarKey : avatarKey // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [FileUploader].
extension FileUploaderPatterns on FileUploader {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileUploader value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileUploader() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileUploader value)  $default,){
final _that = this;
switch (_that) {
case _FileUploader():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileUploader value)?  $default,){
final _that = this;
switch (_that) {
case _FileUploader() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String name,  String? email, @JsonKey(name: 'avatar_key')  String? avatarKey)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileUploader() when $default != null:
return $default(_that.id,_that.name,_that.email,_that.avatarKey);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String name,  String? email, @JsonKey(name: 'avatar_key')  String? avatarKey)  $default,) {final _that = this;
switch (_that) {
case _FileUploader():
return $default(_that.id,_that.name,_that.email,_that.avatarKey);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String name,  String? email, @JsonKey(name: 'avatar_key')  String? avatarKey)?  $default,) {final _that = this;
switch (_that) {
case _FileUploader() when $default != null:
return $default(_that.id,_that.name,_that.email,_that.avatarKey);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileUploader implements FileUploader {
  const _FileUploader({required this.id, required this.name, this.email, @JsonKey(name: 'avatar_key') this.avatarKey});
  factory _FileUploader.fromJson(Map<String, dynamic> json) => _$FileUploaderFromJson(json);

@override final  int id;
@override final  String name;
@override final  String? email;
@override@JsonKey(name: 'avatar_key') final  String? avatarKey;

/// Create a copy of FileUploader
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileUploaderCopyWith<_FileUploader> get copyWith => __$FileUploaderCopyWithImpl<_FileUploader>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileUploaderToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileUploader&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.email, email) || other.email == email)&&(identical(other.avatarKey, avatarKey) || other.avatarKey == avatarKey));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,email,avatarKey);

@override
String toString() {
  return 'FileUploader(id: $id, name: $name, email: $email, avatarKey: $avatarKey)';
}


}

/// @nodoc
abstract mixin class _$FileUploaderCopyWith<$Res> implements $FileUploaderCopyWith<$Res> {
  factory _$FileUploaderCopyWith(_FileUploader value, $Res Function(_FileUploader) _then) = __$FileUploaderCopyWithImpl;
@override @useResult
$Res call({
 int id, String name, String? email,@JsonKey(name: 'avatar_key') String? avatarKey
});




}
/// @nodoc
class __$FileUploaderCopyWithImpl<$Res>
    implements _$FileUploaderCopyWith<$Res> {
  __$FileUploaderCopyWithImpl(this._self, this._then);

  final _FileUploader _self;
  final $Res Function(_FileUploader) _then;

/// Create a copy of FileUploader
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? email = freezed,Object? avatarKey = freezed,}) {
  return _then(_FileUploader(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,avatarKey: freezed == avatarKey ? _self.avatarKey : avatarKey // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$FileModel {

 int get id; String get filename;@JsonKey(name: 'original_filename') String? get originalFilename; String get directory;@JsonKey(name: 's3_key') String get s3Key; int get size;@JsonKey(name: 'content_type') String? get contentType;@JsonKey(name: 'activity_date') String? get activityDate;@JsonKey(name: 'activity_type') String? get activityType;@JsonKey(name: 'activity_type_display') String? get activityTypeDisplay;@JsonKey(name: 'activity_name') String? get activityName; String? get instructor;@JsonKey(name: 'is_legacy') bool get isLegacy;@JsonKey(name: 'uploader_id') int get uploaderId;@JsonKey(name: 'uploaded_at') String get uploadedAt;@JsonKey(name: 'public_url') String? get publicUrl; FileUploader? get uploader;@JsonKey(name: 'free_tags') List<FreeTag> get freeTags; String? get thumbhash;
/// Create a copy of FileModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileModelCopyWith<FileModel> get copyWith => _$FileModelCopyWithImpl<FileModel>(this as FileModel, _$identity);

  /// Serializes this FileModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileModel&&(identical(other.id, id) || other.id == id)&&(identical(other.filename, filename) || other.filename == filename)&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.directory, directory) || other.directory == directory)&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.size, size) || other.size == size)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityTypeDisplay, activityTypeDisplay) || other.activityTypeDisplay == activityTypeDisplay)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.instructor, instructor) || other.instructor == instructor)&&(identical(other.isLegacy, isLegacy) || other.isLegacy == isLegacy)&&(identical(other.uploaderId, uploaderId) || other.uploaderId == uploaderId)&&(identical(other.uploadedAt, uploadedAt) || other.uploadedAt == uploadedAt)&&(identical(other.publicUrl, publicUrl) || other.publicUrl == publicUrl)&&(identical(other.uploader, uploader) || other.uploader == uploader)&&const DeepCollectionEquality().equals(other.freeTags, freeTags)&&(identical(other.thumbhash, thumbhash) || other.thumbhash == thumbhash));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,filename,originalFilename,directory,s3Key,size,contentType,activityDate,activityType,activityTypeDisplay,activityName,instructor,isLegacy,uploaderId,uploadedAt,publicUrl,uploader,const DeepCollectionEquality().hash(freeTags),thumbhash]);

@override
String toString() {
  return 'FileModel(id: $id, filename: $filename, originalFilename: $originalFilename, directory: $directory, s3Key: $s3Key, size: $size, contentType: $contentType, activityDate: $activityDate, activityType: $activityType, activityTypeDisplay: $activityTypeDisplay, activityName: $activityName, instructor: $instructor, isLegacy: $isLegacy, uploaderId: $uploaderId, uploadedAt: $uploadedAt, publicUrl: $publicUrl, uploader: $uploader, freeTags: $freeTags, thumbhash: $thumbhash)';
}


}

/// @nodoc
abstract mixin class $FileModelCopyWith<$Res>  {
  factory $FileModelCopyWith(FileModel value, $Res Function(FileModel) _then) = _$FileModelCopyWithImpl;
@useResult
$Res call({
 int id, String filename,@JsonKey(name: 'original_filename') String? originalFilename, String directory,@JsonKey(name: 's3_key') String s3Key, int size,@JsonKey(name: 'content_type') String? contentType,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_type_display') String? activityTypeDisplay,@JsonKey(name: 'activity_name') String? activityName, String? instructor,@JsonKey(name: 'is_legacy') bool isLegacy,@JsonKey(name: 'uploader_id') int uploaderId,@JsonKey(name: 'uploaded_at') String uploadedAt,@JsonKey(name: 'public_url') String? publicUrl, FileUploader? uploader,@JsonKey(name: 'free_tags') List<FreeTag> freeTags, String? thumbhash
});


$FileUploaderCopyWith<$Res>? get uploader;

}
/// @nodoc
class _$FileModelCopyWithImpl<$Res>
    implements $FileModelCopyWith<$Res> {
  _$FileModelCopyWithImpl(this._self, this._then);

  final FileModel _self;
  final $Res Function(FileModel) _then;

/// Create a copy of FileModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? filename = null,Object? originalFilename = freezed,Object? directory = null,Object? s3Key = null,Object? size = null,Object? contentType = freezed,Object? activityDate = freezed,Object? activityType = freezed,Object? activityTypeDisplay = freezed,Object? activityName = freezed,Object? instructor = freezed,Object? isLegacy = null,Object? uploaderId = null,Object? uploadedAt = null,Object? publicUrl = freezed,Object? uploader = freezed,Object? freeTags = null,Object? thumbhash = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,filename: null == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String,originalFilename: freezed == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String?,directory: null == directory ? _self.directory : directory // ignore: cast_nullable_to_non_nullable
as String,s3Key: null == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,contentType: freezed == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String?,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityTypeDisplay: freezed == activityTypeDisplay ? _self.activityTypeDisplay : activityTypeDisplay // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,instructor: freezed == instructor ? _self.instructor : instructor // ignore: cast_nullable_to_non_nullable
as String?,isLegacy: null == isLegacy ? _self.isLegacy : isLegacy // ignore: cast_nullable_to_non_nullable
as bool,uploaderId: null == uploaderId ? _self.uploaderId : uploaderId // ignore: cast_nullable_to_non_nullable
as int,uploadedAt: null == uploadedAt ? _self.uploadedAt : uploadedAt // ignore: cast_nullable_to_non_nullable
as String,publicUrl: freezed == publicUrl ? _self.publicUrl : publicUrl // ignore: cast_nullable_to_non_nullable
as String?,uploader: freezed == uploader ? _self.uploader : uploader // ignore: cast_nullable_to_non_nullable
as FileUploader?,freeTags: null == freeTags ? _self.freeTags : freeTags // ignore: cast_nullable_to_non_nullable
as List<FreeTag>,thumbhash: freezed == thumbhash ? _self.thumbhash : thumbhash // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of FileModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileUploaderCopyWith<$Res>? get uploader {
    if (_self.uploader == null) {
    return null;
  }

  return $FileUploaderCopyWith<$Res>(_self.uploader!, (value) {
    return _then(_self.copyWith(uploader: value));
  });
}
}


/// Adds pattern-matching-related methods to [FileModel].
extension FileModelPatterns on FileModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileModel value)  $default,){
final _that = this;
switch (_that) {
case _FileModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileModel value)?  $default,){
final _that = this;
switch (_that) {
case _FileModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String filename, @JsonKey(name: 'original_filename')  String? originalFilename,  String directory, @JsonKey(name: 's3_key')  String s3Key,  int size, @JsonKey(name: 'content_type')  String? contentType, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_type_display')  String? activityTypeDisplay, @JsonKey(name: 'activity_name')  String? activityName,  String? instructor, @JsonKey(name: 'is_legacy')  bool isLegacy, @JsonKey(name: 'uploader_id')  int uploaderId, @JsonKey(name: 'uploaded_at')  String uploadedAt, @JsonKey(name: 'public_url')  String? publicUrl,  FileUploader? uploader, @JsonKey(name: 'free_tags')  List<FreeTag> freeTags,  String? thumbhash)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileModel() when $default != null:
return $default(_that.id,_that.filename,_that.originalFilename,_that.directory,_that.s3Key,_that.size,_that.contentType,_that.activityDate,_that.activityType,_that.activityTypeDisplay,_that.activityName,_that.instructor,_that.isLegacy,_that.uploaderId,_that.uploadedAt,_that.publicUrl,_that.uploader,_that.freeTags,_that.thumbhash);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String filename, @JsonKey(name: 'original_filename')  String? originalFilename,  String directory, @JsonKey(name: 's3_key')  String s3Key,  int size, @JsonKey(name: 'content_type')  String? contentType, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_type_display')  String? activityTypeDisplay, @JsonKey(name: 'activity_name')  String? activityName,  String? instructor, @JsonKey(name: 'is_legacy')  bool isLegacy, @JsonKey(name: 'uploader_id')  int uploaderId, @JsonKey(name: 'uploaded_at')  String uploadedAt, @JsonKey(name: 'public_url')  String? publicUrl,  FileUploader? uploader, @JsonKey(name: 'free_tags')  List<FreeTag> freeTags,  String? thumbhash)  $default,) {final _that = this;
switch (_that) {
case _FileModel():
return $default(_that.id,_that.filename,_that.originalFilename,_that.directory,_that.s3Key,_that.size,_that.contentType,_that.activityDate,_that.activityType,_that.activityTypeDisplay,_that.activityName,_that.instructor,_that.isLegacy,_that.uploaderId,_that.uploadedAt,_that.publicUrl,_that.uploader,_that.freeTags,_that.thumbhash);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String filename, @JsonKey(name: 'original_filename')  String? originalFilename,  String directory, @JsonKey(name: 's3_key')  String s3Key,  int size, @JsonKey(name: 'content_type')  String? contentType, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_type_display')  String? activityTypeDisplay, @JsonKey(name: 'activity_name')  String? activityName,  String? instructor, @JsonKey(name: 'is_legacy')  bool isLegacy, @JsonKey(name: 'uploader_id')  int uploaderId, @JsonKey(name: 'uploaded_at')  String uploadedAt, @JsonKey(name: 'public_url')  String? publicUrl,  FileUploader? uploader, @JsonKey(name: 'free_tags')  List<FreeTag> freeTags,  String? thumbhash)?  $default,) {final _that = this;
switch (_that) {
case _FileModel() when $default != null:
return $default(_that.id,_that.filename,_that.originalFilename,_that.directory,_that.s3Key,_that.size,_that.contentType,_that.activityDate,_that.activityType,_that.activityTypeDisplay,_that.activityName,_that.instructor,_that.isLegacy,_that.uploaderId,_that.uploadedAt,_that.publicUrl,_that.uploader,_that.freeTags,_that.thumbhash);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileModel extends FileModel {
  const _FileModel({required this.id, required this.filename, @JsonKey(name: 'original_filename') this.originalFilename, required this.directory, @JsonKey(name: 's3_key') required this.s3Key, required this.size, @JsonKey(name: 'content_type') this.contentType, @JsonKey(name: 'activity_date') this.activityDate, @JsonKey(name: 'activity_type') this.activityType, @JsonKey(name: 'activity_type_display') this.activityTypeDisplay, @JsonKey(name: 'activity_name') this.activityName, this.instructor, @JsonKey(name: 'is_legacy') this.isLegacy = false, @JsonKey(name: 'uploader_id') required this.uploaderId, @JsonKey(name: 'uploaded_at') required this.uploadedAt, @JsonKey(name: 'public_url') this.publicUrl, this.uploader, @JsonKey(name: 'free_tags') final  List<FreeTag> freeTags = const [], this.thumbhash}): _freeTags = freeTags,super._();
  factory _FileModel.fromJson(Map<String, dynamic> json) => _$FileModelFromJson(json);

@override final  int id;
@override final  String filename;
@override@JsonKey(name: 'original_filename') final  String? originalFilename;
@override final  String directory;
@override@JsonKey(name: 's3_key') final  String s3Key;
@override final  int size;
@override@JsonKey(name: 'content_type') final  String? contentType;
@override@JsonKey(name: 'activity_date') final  String? activityDate;
@override@JsonKey(name: 'activity_type') final  String? activityType;
@override@JsonKey(name: 'activity_type_display') final  String? activityTypeDisplay;
@override@JsonKey(name: 'activity_name') final  String? activityName;
@override final  String? instructor;
@override@JsonKey(name: 'is_legacy') final  bool isLegacy;
@override@JsonKey(name: 'uploader_id') final  int uploaderId;
@override@JsonKey(name: 'uploaded_at') final  String uploadedAt;
@override@JsonKey(name: 'public_url') final  String? publicUrl;
@override final  FileUploader? uploader;
 final  List<FreeTag> _freeTags;
@override@JsonKey(name: 'free_tags') List<FreeTag> get freeTags {
  if (_freeTags is EqualUnmodifiableListView) return _freeTags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_freeTags);
}

@override final  String? thumbhash;

/// Create a copy of FileModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileModelCopyWith<_FileModel> get copyWith => __$FileModelCopyWithImpl<_FileModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileModel&&(identical(other.id, id) || other.id == id)&&(identical(other.filename, filename) || other.filename == filename)&&(identical(other.originalFilename, originalFilename) || other.originalFilename == originalFilename)&&(identical(other.directory, directory) || other.directory == directory)&&(identical(other.s3Key, s3Key) || other.s3Key == s3Key)&&(identical(other.size, size) || other.size == size)&&(identical(other.contentType, contentType) || other.contentType == contentType)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityTypeDisplay, activityTypeDisplay) || other.activityTypeDisplay == activityTypeDisplay)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.instructor, instructor) || other.instructor == instructor)&&(identical(other.isLegacy, isLegacy) || other.isLegacy == isLegacy)&&(identical(other.uploaderId, uploaderId) || other.uploaderId == uploaderId)&&(identical(other.uploadedAt, uploadedAt) || other.uploadedAt == uploadedAt)&&(identical(other.publicUrl, publicUrl) || other.publicUrl == publicUrl)&&(identical(other.uploader, uploader) || other.uploader == uploader)&&const DeepCollectionEquality().equals(other._freeTags, _freeTags)&&(identical(other.thumbhash, thumbhash) || other.thumbhash == thumbhash));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,filename,originalFilename,directory,s3Key,size,contentType,activityDate,activityType,activityTypeDisplay,activityName,instructor,isLegacy,uploaderId,uploadedAt,publicUrl,uploader,const DeepCollectionEquality().hash(_freeTags),thumbhash]);

@override
String toString() {
  return 'FileModel(id: $id, filename: $filename, originalFilename: $originalFilename, directory: $directory, s3Key: $s3Key, size: $size, contentType: $contentType, activityDate: $activityDate, activityType: $activityType, activityTypeDisplay: $activityTypeDisplay, activityName: $activityName, instructor: $instructor, isLegacy: $isLegacy, uploaderId: $uploaderId, uploadedAt: $uploadedAt, publicUrl: $publicUrl, uploader: $uploader, freeTags: $freeTags, thumbhash: $thumbhash)';
}


}

/// @nodoc
abstract mixin class _$FileModelCopyWith<$Res> implements $FileModelCopyWith<$Res> {
  factory _$FileModelCopyWith(_FileModel value, $Res Function(_FileModel) _then) = __$FileModelCopyWithImpl;
@override @useResult
$Res call({
 int id, String filename,@JsonKey(name: 'original_filename') String? originalFilename, String directory,@JsonKey(name: 's3_key') String s3Key, int size,@JsonKey(name: 'content_type') String? contentType,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_type_display') String? activityTypeDisplay,@JsonKey(name: 'activity_name') String? activityName, String? instructor,@JsonKey(name: 'is_legacy') bool isLegacy,@JsonKey(name: 'uploader_id') int uploaderId,@JsonKey(name: 'uploaded_at') String uploadedAt,@JsonKey(name: 'public_url') String? publicUrl, FileUploader? uploader,@JsonKey(name: 'free_tags') List<FreeTag> freeTags, String? thumbhash
});


@override $FileUploaderCopyWith<$Res>? get uploader;

}
/// @nodoc
class __$FileModelCopyWithImpl<$Res>
    implements _$FileModelCopyWith<$Res> {
  __$FileModelCopyWithImpl(this._self, this._then);

  final _FileModel _self;
  final $Res Function(_FileModel) _then;

/// Create a copy of FileModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? filename = null,Object? originalFilename = freezed,Object? directory = null,Object? s3Key = null,Object? size = null,Object? contentType = freezed,Object? activityDate = freezed,Object? activityType = freezed,Object? activityTypeDisplay = freezed,Object? activityName = freezed,Object? instructor = freezed,Object? isLegacy = null,Object? uploaderId = null,Object? uploadedAt = null,Object? publicUrl = freezed,Object? uploader = freezed,Object? freeTags = null,Object? thumbhash = freezed,}) {
  return _then(_FileModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,filename: null == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String,originalFilename: freezed == originalFilename ? _self.originalFilename : originalFilename // ignore: cast_nullable_to_non_nullable
as String?,directory: null == directory ? _self.directory : directory // ignore: cast_nullable_to_non_nullable
as String,s3Key: null == s3Key ? _self.s3Key : s3Key // ignore: cast_nullable_to_non_nullable
as String,size: null == size ? _self.size : size // ignore: cast_nullable_to_non_nullable
as int,contentType: freezed == contentType ? _self.contentType : contentType // ignore: cast_nullable_to_non_nullable
as String?,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityTypeDisplay: freezed == activityTypeDisplay ? _self.activityTypeDisplay : activityTypeDisplay // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,instructor: freezed == instructor ? _self.instructor : instructor // ignore: cast_nullable_to_non_nullable
as String?,isLegacy: null == isLegacy ? _self.isLegacy : isLegacy // ignore: cast_nullable_to_non_nullable
as bool,uploaderId: null == uploaderId ? _self.uploaderId : uploaderId // ignore: cast_nullable_to_non_nullable
as int,uploadedAt: null == uploadedAt ? _self.uploadedAt : uploadedAt // ignore: cast_nullable_to_non_nullable
as String,publicUrl: freezed == publicUrl ? _self.publicUrl : publicUrl // ignore: cast_nullable_to_non_nullable
as String?,uploader: freezed == uploader ? _self.uploader : uploader // ignore: cast_nullable_to_non_nullable
as FileUploader?,freeTags: null == freeTags ? _self._freeTags : freeTags // ignore: cast_nullable_to_non_nullable
as List<FreeTag>,thumbhash: freezed == thumbhash ? _self.thumbhash : thumbhash // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of FileModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileUploaderCopyWith<$Res>? get uploader {
    if (_self.uploader == null) {
    return null;
  }

  return $FileUploaderCopyWith<$Res>(_self.uploader!, (value) {
    return _then(_self.copyWith(uploader: value));
  });
}
}


/// @nodoc
mixin _$DirectoryNode {

 String? get value; String get name; String get path; List<DirectoryNode> get subdirectories;@JsonKey(name: 'file_count') int? get fileCount;@JsonKey(name: 'activity_date') String? get activityDate;@JsonKey(name: 'activity_name') String? get activityName;@JsonKey(name: 'activity_type') String? get activityType;
/// Create a copy of DirectoryNode
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DirectoryNodeCopyWith<DirectoryNode> get copyWith => _$DirectoryNodeCopyWithImpl<DirectoryNode>(this as DirectoryNode, _$identity);

  /// Serializes this DirectoryNode to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DirectoryNode&&(identical(other.value, value) || other.value == value)&&(identical(other.name, name) || other.name == name)&&(identical(other.path, path) || other.path == path)&&const DeepCollectionEquality().equals(other.subdirectories, subdirectories)&&(identical(other.fileCount, fileCount) || other.fileCount == fileCount)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityType, activityType) || other.activityType == activityType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,value,name,path,const DeepCollectionEquality().hash(subdirectories),fileCount,activityDate,activityName,activityType);

@override
String toString() {
  return 'DirectoryNode(value: $value, name: $name, path: $path, subdirectories: $subdirectories, fileCount: $fileCount, activityDate: $activityDate, activityName: $activityName, activityType: $activityType)';
}


}

/// @nodoc
abstract mixin class $DirectoryNodeCopyWith<$Res>  {
  factory $DirectoryNodeCopyWith(DirectoryNode value, $Res Function(DirectoryNode) _then) = _$DirectoryNodeCopyWithImpl;
@useResult
$Res call({
 String? value, String name, String path, List<DirectoryNode> subdirectories,@JsonKey(name: 'file_count') int? fileCount,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'activity_type') String? activityType
});




}
/// @nodoc
class _$DirectoryNodeCopyWithImpl<$Res>
    implements $DirectoryNodeCopyWith<$Res> {
  _$DirectoryNodeCopyWithImpl(this._self, this._then);

  final DirectoryNode _self;
  final $Res Function(DirectoryNode) _then;

/// Create a copy of DirectoryNode
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? value = freezed,Object? name = null,Object? path = null,Object? subdirectories = null,Object? fileCount = freezed,Object? activityDate = freezed,Object? activityName = freezed,Object? activityType = freezed,}) {
  return _then(_self.copyWith(
value: freezed == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as String?,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,path: null == path ? _self.path : path // ignore: cast_nullable_to_non_nullable
as String,subdirectories: null == subdirectories ? _self.subdirectories : subdirectories // ignore: cast_nullable_to_non_nullable
as List<DirectoryNode>,fileCount: freezed == fileCount ? _self.fileCount : fileCount // ignore: cast_nullable_to_non_nullable
as int?,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [DirectoryNode].
extension DirectoryNodePatterns on DirectoryNode {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DirectoryNode value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DirectoryNode() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DirectoryNode value)  $default,){
final _that = this;
switch (_that) {
case _DirectoryNode():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DirectoryNode value)?  $default,){
final _that = this;
switch (_that) {
case _DirectoryNode() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? value,  String name,  String path,  List<DirectoryNode> subdirectories, @JsonKey(name: 'file_count')  int? fileCount, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'activity_type')  String? activityType)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DirectoryNode() when $default != null:
return $default(_that.value,_that.name,_that.path,_that.subdirectories,_that.fileCount,_that.activityDate,_that.activityName,_that.activityType);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? value,  String name,  String path,  List<DirectoryNode> subdirectories, @JsonKey(name: 'file_count')  int? fileCount, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'activity_type')  String? activityType)  $default,) {final _that = this;
switch (_that) {
case _DirectoryNode():
return $default(_that.value,_that.name,_that.path,_that.subdirectories,_that.fileCount,_that.activityDate,_that.activityName,_that.activityType);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? value,  String name,  String path,  List<DirectoryNode> subdirectories, @JsonKey(name: 'file_count')  int? fileCount, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'activity_type')  String? activityType)?  $default,) {final _that = this;
switch (_that) {
case _DirectoryNode() when $default != null:
return $default(_that.value,_that.name,_that.path,_that.subdirectories,_that.fileCount,_that.activityDate,_that.activityName,_that.activityType);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DirectoryNode implements DirectoryNode {
  const _DirectoryNode({this.value, required this.name, required this.path, final  List<DirectoryNode> subdirectories = const [], @JsonKey(name: 'file_count') this.fileCount, @JsonKey(name: 'activity_date') this.activityDate, @JsonKey(name: 'activity_name') this.activityName, @JsonKey(name: 'activity_type') this.activityType}): _subdirectories = subdirectories;
  factory _DirectoryNode.fromJson(Map<String, dynamic> json) => _$DirectoryNodeFromJson(json);

@override final  String? value;
@override final  String name;
@override final  String path;
 final  List<DirectoryNode> _subdirectories;
@override@JsonKey() List<DirectoryNode> get subdirectories {
  if (_subdirectories is EqualUnmodifiableListView) return _subdirectories;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_subdirectories);
}

@override@JsonKey(name: 'file_count') final  int? fileCount;
@override@JsonKey(name: 'activity_date') final  String? activityDate;
@override@JsonKey(name: 'activity_name') final  String? activityName;
@override@JsonKey(name: 'activity_type') final  String? activityType;

/// Create a copy of DirectoryNode
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DirectoryNodeCopyWith<_DirectoryNode> get copyWith => __$DirectoryNodeCopyWithImpl<_DirectoryNode>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DirectoryNodeToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DirectoryNode&&(identical(other.value, value) || other.value == value)&&(identical(other.name, name) || other.name == name)&&(identical(other.path, path) || other.path == path)&&const DeepCollectionEquality().equals(other._subdirectories, _subdirectories)&&(identical(other.fileCount, fileCount) || other.fileCount == fileCount)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityType, activityType) || other.activityType == activityType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,value,name,path,const DeepCollectionEquality().hash(_subdirectories),fileCount,activityDate,activityName,activityType);

@override
String toString() {
  return 'DirectoryNode(value: $value, name: $name, path: $path, subdirectories: $subdirectories, fileCount: $fileCount, activityDate: $activityDate, activityName: $activityName, activityType: $activityType)';
}


}

/// @nodoc
abstract mixin class _$DirectoryNodeCopyWith<$Res> implements $DirectoryNodeCopyWith<$Res> {
  factory _$DirectoryNodeCopyWith(_DirectoryNode value, $Res Function(_DirectoryNode) _then) = __$DirectoryNodeCopyWithImpl;
@override @useResult
$Res call({
 String? value, String name, String path, List<DirectoryNode> subdirectories,@JsonKey(name: 'file_count') int? fileCount,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'activity_type') String? activityType
});




}
/// @nodoc
class __$DirectoryNodeCopyWithImpl<$Res>
    implements _$DirectoryNodeCopyWith<$Res> {
  __$DirectoryNodeCopyWithImpl(this._self, this._then);

  final _DirectoryNode _self;
  final $Res Function(_DirectoryNode) _then;

/// Create a copy of DirectoryNode
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? value = freezed,Object? name = null,Object? path = null,Object? subdirectories = null,Object? fileCount = freezed,Object? activityDate = freezed,Object? activityName = freezed,Object? activityType = freezed,}) {
  return _then(_DirectoryNode(
value: freezed == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as String?,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,path: null == path ? _self.path : path // ignore: cast_nullable_to_non_nullable
as String,subdirectories: null == subdirectories ? _self._subdirectories : subdirectories // ignore: cast_nullable_to_non_nullable
as List<DirectoryNode>,fileCount: freezed == fileCount ? _self.fileCount : fileCount // ignore: cast_nullable_to_non_nullable
as int?,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$TagPreset {

 int get id; String get category; String get value;@JsonKey(name: 'display_name') String get displayName;@JsonKey(name: 'is_active') bool get isActive;@JsonKey(name: 'created_at') String? get createdAt;
/// Create a copy of TagPreset
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TagPresetCopyWith<TagPreset> get copyWith => _$TagPresetCopyWithImpl<TagPreset>(this as TagPreset, _$identity);

  /// Serializes this TagPreset to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TagPreset&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.value, value) || other.value == value)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,value,displayName,isActive,createdAt);

@override
String toString() {
  return 'TagPreset(id: $id, category: $category, value: $value, displayName: $displayName, isActive: $isActive, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $TagPresetCopyWith<$Res>  {
  factory $TagPresetCopyWith(TagPreset value, $Res Function(TagPreset) _then) = _$TagPresetCopyWithImpl;
@useResult
$Res call({
 int id, String category, String value,@JsonKey(name: 'display_name') String displayName,@JsonKey(name: 'is_active') bool isActive,@JsonKey(name: 'created_at') String? createdAt
});




}
/// @nodoc
class _$TagPresetCopyWithImpl<$Res>
    implements $TagPresetCopyWith<$Res> {
  _$TagPresetCopyWithImpl(this._self, this._then);

  final TagPreset _self;
  final $Res Function(TagPreset) _then;

/// Create a copy of TagPreset
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? category = null,Object? value = null,Object? displayName = null,Object? isActive = null,Object? createdAt = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [TagPreset].
extension TagPresetPatterns on TagPreset {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TagPreset value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TagPreset() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TagPreset value)  $default,){
final _that = this;
switch (_that) {
case _TagPreset():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TagPreset value)?  $default,){
final _that = this;
switch (_that) {
case _TagPreset() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String category,  String value, @JsonKey(name: 'display_name')  String displayName, @JsonKey(name: 'is_active')  bool isActive, @JsonKey(name: 'created_at')  String? createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TagPreset() when $default != null:
return $default(_that.id,_that.category,_that.value,_that.displayName,_that.isActive,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String category,  String value, @JsonKey(name: 'display_name')  String displayName, @JsonKey(name: 'is_active')  bool isActive, @JsonKey(name: 'created_at')  String? createdAt)  $default,) {final _that = this;
switch (_that) {
case _TagPreset():
return $default(_that.id,_that.category,_that.value,_that.displayName,_that.isActive,_that.createdAt);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String category,  String value, @JsonKey(name: 'display_name')  String displayName, @JsonKey(name: 'is_active')  bool isActive, @JsonKey(name: 'created_at')  String? createdAt)?  $default,) {final _that = this;
switch (_that) {
case _TagPreset() when $default != null:
return $default(_that.id,_that.category,_that.value,_that.displayName,_that.isActive,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TagPreset implements TagPreset {
  const _TagPreset({required this.id, required this.category, required this.value, @JsonKey(name: 'display_name') required this.displayName, @JsonKey(name: 'is_active') this.isActive = true, @JsonKey(name: 'created_at') this.createdAt});
  factory _TagPreset.fromJson(Map<String, dynamic> json) => _$TagPresetFromJson(json);

@override final  int id;
@override final  String category;
@override final  String value;
@override@JsonKey(name: 'display_name') final  String displayName;
@override@JsonKey(name: 'is_active') final  bool isActive;
@override@JsonKey(name: 'created_at') final  String? createdAt;

/// Create a copy of TagPreset
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TagPresetCopyWith<_TagPreset> get copyWith => __$TagPresetCopyWithImpl<_TagPreset>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TagPresetToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TagPreset&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.value, value) || other.value == value)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,value,displayName,isActive,createdAt);

@override
String toString() {
  return 'TagPreset(id: $id, category: $category, value: $value, displayName: $displayName, isActive: $isActive, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$TagPresetCopyWith<$Res> implements $TagPresetCopyWith<$Res> {
  factory _$TagPresetCopyWith(_TagPreset value, $Res Function(_TagPreset) _then) = __$TagPresetCopyWithImpl;
@override @useResult
$Res call({
 int id, String category, String value,@JsonKey(name: 'display_name') String displayName,@JsonKey(name: 'is_active') bool isActive,@JsonKey(name: 'created_at') String? createdAt
});




}
/// @nodoc
class __$TagPresetCopyWithImpl<$Res>
    implements _$TagPresetCopyWith<$Res> {
  __$TagPresetCopyWithImpl(this._self, this._then);

  final _TagPreset _self;
  final $Res Function(_TagPreset) _then;

/// Create a copy of TagPreset
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? category = null,Object? value = null,Object? displayName = null,Object? isActive = null,Object? createdAt = freezed,}) {
  return _then(_TagPreset(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,value: null == value ? _self.value : value // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,createdAt: freezed == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$TimelineMonth {

 int get count;
/// Create a copy of TimelineMonth
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TimelineMonthCopyWith<TimelineMonth> get copyWith => _$TimelineMonthCopyWithImpl<TimelineMonth>(this as TimelineMonth, _$identity);

  /// Serializes this TimelineMonth to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TimelineMonth&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,count);

@override
String toString() {
  return 'TimelineMonth(count: $count)';
}


}

/// @nodoc
abstract mixin class $TimelineMonthCopyWith<$Res>  {
  factory $TimelineMonthCopyWith(TimelineMonth value, $Res Function(TimelineMonth) _then) = _$TimelineMonthCopyWithImpl;
@useResult
$Res call({
 int count
});




}
/// @nodoc
class _$TimelineMonthCopyWithImpl<$Res>
    implements $TimelineMonthCopyWith<$Res> {
  _$TimelineMonthCopyWithImpl(this._self, this._then);

  final TimelineMonth _self;
  final $Res Function(TimelineMonth) _then;

/// Create a copy of TimelineMonth
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? count = null,}) {
  return _then(_self.copyWith(
count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [TimelineMonth].
extension TimelineMonthPatterns on TimelineMonth {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TimelineMonth value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TimelineMonth() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TimelineMonth value)  $default,){
final _that = this;
switch (_that) {
case _TimelineMonth():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TimelineMonth value)?  $default,){
final _that = this;
switch (_that) {
case _TimelineMonth() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int count)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TimelineMonth() when $default != null:
return $default(_that.count);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int count)  $default,) {final _that = this;
switch (_that) {
case _TimelineMonth():
return $default(_that.count);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int count)?  $default,) {final _that = this;
switch (_that) {
case _TimelineMonth() when $default != null:
return $default(_that.count);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TimelineMonth implements TimelineMonth {
  const _TimelineMonth({required this.count});
  factory _TimelineMonth.fromJson(Map<String, dynamic> json) => _$TimelineMonthFromJson(json);

@override final  int count;

/// Create a copy of TimelineMonth
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TimelineMonthCopyWith<_TimelineMonth> get copyWith => __$TimelineMonthCopyWithImpl<_TimelineMonth>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TimelineMonthToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TimelineMonth&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,count);

@override
String toString() {
  return 'TimelineMonth(count: $count)';
}


}

/// @nodoc
abstract mixin class _$TimelineMonthCopyWith<$Res> implements $TimelineMonthCopyWith<$Res> {
  factory _$TimelineMonthCopyWith(_TimelineMonth value, $Res Function(_TimelineMonth) _then) = __$TimelineMonthCopyWithImpl;
@override @useResult
$Res call({
 int count
});




}
/// @nodoc
class __$TimelineMonthCopyWithImpl<$Res>
    implements _$TimelineMonthCopyWith<$Res> {
  __$TimelineMonthCopyWithImpl(this._self, this._then);

  final _TimelineMonth _self;
  final $Res Function(_TimelineMonth) _then;

/// Create a copy of TimelineMonth
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? count = null,}) {
  return _then(_TimelineMonth(
count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$PaginationInfo {

 int get page;@JsonKey(name: 'per_page') int get perPage; int get total; int get pages;@JsonKey(name: 'has_prev') bool get hasPrev;@JsonKey(name: 'has_next') bool get hasNext;
/// Create a copy of PaginationInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaginationInfoCopyWith<PaginationInfo> get copyWith => _$PaginationInfoCopyWithImpl<PaginationInfo>(this as PaginationInfo, _$identity);

  /// Serializes this PaginationInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaginationInfo&&(identical(other.page, page) || other.page == page)&&(identical(other.perPage, perPage) || other.perPage == perPage)&&(identical(other.total, total) || other.total == total)&&(identical(other.pages, pages) || other.pages == pages)&&(identical(other.hasPrev, hasPrev) || other.hasPrev == hasPrev)&&(identical(other.hasNext, hasNext) || other.hasNext == hasNext));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,page,perPage,total,pages,hasPrev,hasNext);

@override
String toString() {
  return 'PaginationInfo(page: $page, perPage: $perPage, total: $total, pages: $pages, hasPrev: $hasPrev, hasNext: $hasNext)';
}


}

/// @nodoc
abstract mixin class $PaginationInfoCopyWith<$Res>  {
  factory $PaginationInfoCopyWith(PaginationInfo value, $Res Function(PaginationInfo) _then) = _$PaginationInfoCopyWithImpl;
@useResult
$Res call({
 int page,@JsonKey(name: 'per_page') int perPage, int total, int pages,@JsonKey(name: 'has_prev') bool hasPrev,@JsonKey(name: 'has_next') bool hasNext
});




}
/// @nodoc
class _$PaginationInfoCopyWithImpl<$Res>
    implements $PaginationInfoCopyWith<$Res> {
  _$PaginationInfoCopyWithImpl(this._self, this._then);

  final PaginationInfo _self;
  final $Res Function(PaginationInfo) _then;

/// Create a copy of PaginationInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? page = null,Object? perPage = null,Object? total = null,Object? pages = null,Object? hasPrev = null,Object? hasNext = null,}) {
  return _then(_self.copyWith(
page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,perPage: null == perPage ? _self.perPage : perPage // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,pages: null == pages ? _self.pages : pages // ignore: cast_nullable_to_non_nullable
as int,hasPrev: null == hasPrev ? _self.hasPrev : hasPrev // ignore: cast_nullable_to_non_nullable
as bool,hasNext: null == hasNext ? _self.hasNext : hasNext // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PaginationInfo].
extension PaginationInfoPatterns on PaginationInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaginationInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaginationInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaginationInfo value)  $default,){
final _that = this;
switch (_that) {
case _PaginationInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaginationInfo value)?  $default,){
final _that = this;
switch (_that) {
case _PaginationInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int page, @JsonKey(name: 'per_page')  int perPage,  int total,  int pages, @JsonKey(name: 'has_prev')  bool hasPrev, @JsonKey(name: 'has_next')  bool hasNext)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaginationInfo() when $default != null:
return $default(_that.page,_that.perPage,_that.total,_that.pages,_that.hasPrev,_that.hasNext);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int page, @JsonKey(name: 'per_page')  int perPage,  int total,  int pages, @JsonKey(name: 'has_prev')  bool hasPrev, @JsonKey(name: 'has_next')  bool hasNext)  $default,) {final _that = this;
switch (_that) {
case _PaginationInfo():
return $default(_that.page,_that.perPage,_that.total,_that.pages,_that.hasPrev,_that.hasNext);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int page, @JsonKey(name: 'per_page')  int perPage,  int total,  int pages, @JsonKey(name: 'has_prev')  bool hasPrev, @JsonKey(name: 'has_next')  bool hasNext)?  $default,) {final _that = this;
switch (_that) {
case _PaginationInfo() when $default != null:
return $default(_that.page,_that.perPage,_that.total,_that.pages,_that.hasPrev,_that.hasNext);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaginationInfo implements PaginationInfo {
  const _PaginationInfo({required this.page, @JsonKey(name: 'per_page') required this.perPage, required this.total, required this.pages, @JsonKey(name: 'has_prev') required this.hasPrev, @JsonKey(name: 'has_next') required this.hasNext});
  factory _PaginationInfo.fromJson(Map<String, dynamic> json) => _$PaginationInfoFromJson(json);

@override final  int page;
@override@JsonKey(name: 'per_page') final  int perPage;
@override final  int total;
@override final  int pages;
@override@JsonKey(name: 'has_prev') final  bool hasPrev;
@override@JsonKey(name: 'has_next') final  bool hasNext;

/// Create a copy of PaginationInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaginationInfoCopyWith<_PaginationInfo> get copyWith => __$PaginationInfoCopyWithImpl<_PaginationInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaginationInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaginationInfo&&(identical(other.page, page) || other.page == page)&&(identical(other.perPage, perPage) || other.perPage == perPage)&&(identical(other.total, total) || other.total == total)&&(identical(other.pages, pages) || other.pages == pages)&&(identical(other.hasPrev, hasPrev) || other.hasPrev == hasPrev)&&(identical(other.hasNext, hasNext) || other.hasNext == hasNext));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,page,perPage,total,pages,hasPrev,hasNext);

@override
String toString() {
  return 'PaginationInfo(page: $page, perPage: $perPage, total: $total, pages: $pages, hasPrev: $hasPrev, hasNext: $hasNext)';
}


}

/// @nodoc
abstract mixin class _$PaginationInfoCopyWith<$Res> implements $PaginationInfoCopyWith<$Res> {
  factory _$PaginationInfoCopyWith(_PaginationInfo value, $Res Function(_PaginationInfo) _then) = __$PaginationInfoCopyWithImpl;
@override @useResult
$Res call({
 int page,@JsonKey(name: 'per_page') int perPage, int total, int pages,@JsonKey(name: 'has_prev') bool hasPrev,@JsonKey(name: 'has_next') bool hasNext
});




}
/// @nodoc
class __$PaginationInfoCopyWithImpl<$Res>
    implements _$PaginationInfoCopyWith<$Res> {
  __$PaginationInfoCopyWithImpl(this._self, this._then);

  final _PaginationInfo _self;
  final $Res Function(_PaginationInfo) _then;

/// Create a copy of PaginationInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? page = null,Object? perPage = null,Object? total = null,Object? pages = null,Object? hasPrev = null,Object? hasNext = null,}) {
  return _then(_PaginationInfo(
page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,perPage: null == perPage ? _self.perPage : perPage // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,pages: null == pages ? _self.pages : pages // ignore: cast_nullable_to_non_nullable
as int,hasPrev: null == hasPrev ? _self.hasPrev : hasPrev // ignore: cast_nullable_to_non_nullable
as bool,hasNext: null == hasNext ? _self.hasNext : hasNext // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$FileListResponse {

 List<FileModel> get files; PaginationInfo get pagination; Map<String, Map<String, TimelineMonth>>? get timeline;
/// Create a copy of FileListResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileListResponseCopyWith<FileListResponse> get copyWith => _$FileListResponseCopyWithImpl<FileListResponse>(this as FileListResponse, _$identity);

  /// Serializes this FileListResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileListResponse&&const DeepCollectionEquality().equals(other.files, files)&&(identical(other.pagination, pagination) || other.pagination == pagination)&&const DeepCollectionEquality().equals(other.timeline, timeline));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(files),pagination,const DeepCollectionEquality().hash(timeline));

@override
String toString() {
  return 'FileListResponse(files: $files, pagination: $pagination, timeline: $timeline)';
}


}

/// @nodoc
abstract mixin class $FileListResponseCopyWith<$Res>  {
  factory $FileListResponseCopyWith(FileListResponse value, $Res Function(FileListResponse) _then) = _$FileListResponseCopyWithImpl;
@useResult
$Res call({
 List<FileModel> files, PaginationInfo pagination, Map<String, Map<String, TimelineMonth>>? timeline
});


$PaginationInfoCopyWith<$Res> get pagination;

}
/// @nodoc
class _$FileListResponseCopyWithImpl<$Res>
    implements $FileListResponseCopyWith<$Res> {
  _$FileListResponseCopyWithImpl(this._self, this._then);

  final FileListResponse _self;
  final $Res Function(FileListResponse) _then;

/// Create a copy of FileListResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? files = null,Object? pagination = null,Object? timeline = freezed,}) {
  return _then(_self.copyWith(
files: null == files ? _self.files : files // ignore: cast_nullable_to_non_nullable
as List<FileModel>,pagination: null == pagination ? _self.pagination : pagination // ignore: cast_nullable_to_non_nullable
as PaginationInfo,timeline: freezed == timeline ? _self.timeline : timeline // ignore: cast_nullable_to_non_nullable
as Map<String, Map<String, TimelineMonth>>?,
  ));
}
/// Create a copy of FileListResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PaginationInfoCopyWith<$Res> get pagination {
  
  return $PaginationInfoCopyWith<$Res>(_self.pagination, (value) {
    return _then(_self.copyWith(pagination: value));
  });
}
}


/// Adds pattern-matching-related methods to [FileListResponse].
extension FileListResponsePatterns on FileListResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileListResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileListResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileListResponse value)  $default,){
final _that = this;
switch (_that) {
case _FileListResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileListResponse value)?  $default,){
final _that = this;
switch (_that) {
case _FileListResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<FileModel> files,  PaginationInfo pagination,  Map<String, Map<String, TimelineMonth>>? timeline)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileListResponse() when $default != null:
return $default(_that.files,_that.pagination,_that.timeline);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<FileModel> files,  PaginationInfo pagination,  Map<String, Map<String, TimelineMonth>>? timeline)  $default,) {final _that = this;
switch (_that) {
case _FileListResponse():
return $default(_that.files,_that.pagination,_that.timeline);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<FileModel> files,  PaginationInfo pagination,  Map<String, Map<String, TimelineMonth>>? timeline)?  $default,) {final _that = this;
switch (_that) {
case _FileListResponse() when $default != null:
return $default(_that.files,_that.pagination,_that.timeline);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileListResponse implements FileListResponse {
  const _FileListResponse({required final  List<FileModel> files, required this.pagination, final  Map<String, Map<String, TimelineMonth>>? timeline}): _files = files,_timeline = timeline;
  factory _FileListResponse.fromJson(Map<String, dynamic> json) => _$FileListResponseFromJson(json);

 final  List<FileModel> _files;
@override List<FileModel> get files {
  if (_files is EqualUnmodifiableListView) return _files;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_files);
}

@override final  PaginationInfo pagination;
 final  Map<String, Map<String, TimelineMonth>>? _timeline;
@override Map<String, Map<String, TimelineMonth>>? get timeline {
  final value = _timeline;
  if (value == null) return null;
  if (_timeline is EqualUnmodifiableMapView) return _timeline;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}


/// Create a copy of FileListResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileListResponseCopyWith<_FileListResponse> get copyWith => __$FileListResponseCopyWithImpl<_FileListResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileListResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileListResponse&&const DeepCollectionEquality().equals(other._files, _files)&&(identical(other.pagination, pagination) || other.pagination == pagination)&&const DeepCollectionEquality().equals(other._timeline, _timeline));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_files),pagination,const DeepCollectionEquality().hash(_timeline));

@override
String toString() {
  return 'FileListResponse(files: $files, pagination: $pagination, timeline: $timeline)';
}


}

/// @nodoc
abstract mixin class _$FileListResponseCopyWith<$Res> implements $FileListResponseCopyWith<$Res> {
  factory _$FileListResponseCopyWith(_FileListResponse value, $Res Function(_FileListResponse) _then) = __$FileListResponseCopyWithImpl;
@override @useResult
$Res call({
 List<FileModel> files, PaginationInfo pagination, Map<String, Map<String, TimelineMonth>>? timeline
});


@override $PaginationInfoCopyWith<$Res> get pagination;

}
/// @nodoc
class __$FileListResponseCopyWithImpl<$Res>
    implements _$FileListResponseCopyWith<$Res> {
  __$FileListResponseCopyWithImpl(this._self, this._then);

  final _FileListResponse _self;
  final $Res Function(_FileListResponse) _then;

/// Create a copy of FileListResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? files = null,Object? pagination = null,Object? timeline = freezed,}) {
  return _then(_FileListResponse(
files: null == files ? _self._files : files // ignore: cast_nullable_to_non_nullable
as List<FileModel>,pagination: null == pagination ? _self.pagination : pagination // ignore: cast_nullable_to_non_nullable
as PaginationInfo,timeline: freezed == timeline ? _self._timeline : timeline // ignore: cast_nullable_to_non_nullable
as Map<String, Map<String, TimelineMonth>>?,
  ));
}

/// Create a copy of FileListResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PaginationInfoCopyWith<$Res> get pagination {
  
  return $PaginationInfoCopyWith<$Res>(_self.pagination, (value) {
    return _then(_self.copyWith(pagination: value));
  });
}
}


/// @nodoc
mixin _$FileFilters {

 String? get directory;@JsonKey(name: 'activity_type') String? get activityType;@JsonKey(name: 'activity_name') String? get activityName;@JsonKey(name: 'activity_date') String? get activityDate;@JsonKey(name: 'date_from') String? get dateFrom;@JsonKey(name: 'date_to') String? get dateTo;@JsonKey(name: 'uploader_id') int? get uploaderId; String? get search; int get page;@JsonKey(name: 'per_page') int get perPage;@JsonKey(name: 'media_type') String get mediaType; List<String> get tags; int? get year; int? get month;
/// Create a copy of FileFilters
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileFiltersCopyWith<FileFilters> get copyWith => _$FileFiltersCopyWithImpl<FileFilters>(this as FileFilters, _$identity);

  /// Serializes this FileFilters to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileFilters&&(identical(other.directory, directory) || other.directory == directory)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.dateFrom, dateFrom) || other.dateFrom == dateFrom)&&(identical(other.dateTo, dateTo) || other.dateTo == dateTo)&&(identical(other.uploaderId, uploaderId) || other.uploaderId == uploaderId)&&(identical(other.search, search) || other.search == search)&&(identical(other.page, page) || other.page == page)&&(identical(other.perPage, perPage) || other.perPage == perPage)&&(identical(other.mediaType, mediaType) || other.mediaType == mediaType)&&const DeepCollectionEquality().equals(other.tags, tags)&&(identical(other.year, year) || other.year == year)&&(identical(other.month, month) || other.month == month));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,directory,activityType,activityName,activityDate,dateFrom,dateTo,uploaderId,search,page,perPage,mediaType,const DeepCollectionEquality().hash(tags),year,month);

@override
String toString() {
  return 'FileFilters(directory: $directory, activityType: $activityType, activityName: $activityName, activityDate: $activityDate, dateFrom: $dateFrom, dateTo: $dateTo, uploaderId: $uploaderId, search: $search, page: $page, perPage: $perPage, mediaType: $mediaType, tags: $tags, year: $year, month: $month)';
}


}

/// @nodoc
abstract mixin class $FileFiltersCopyWith<$Res>  {
  factory $FileFiltersCopyWith(FileFilters value, $Res Function(FileFilters) _then) = _$FileFiltersCopyWithImpl;
@useResult
$Res call({
 String? directory,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'date_from') String? dateFrom,@JsonKey(name: 'date_to') String? dateTo,@JsonKey(name: 'uploader_id') int? uploaderId, String? search, int page,@JsonKey(name: 'per_page') int perPage,@JsonKey(name: 'media_type') String mediaType, List<String> tags, int? year, int? month
});




}
/// @nodoc
class _$FileFiltersCopyWithImpl<$Res>
    implements $FileFiltersCopyWith<$Res> {
  _$FileFiltersCopyWithImpl(this._self, this._then);

  final FileFilters _self;
  final $Res Function(FileFilters) _then;

/// Create a copy of FileFilters
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? directory = freezed,Object? activityType = freezed,Object? activityName = freezed,Object? activityDate = freezed,Object? dateFrom = freezed,Object? dateTo = freezed,Object? uploaderId = freezed,Object? search = freezed,Object? page = null,Object? perPage = null,Object? mediaType = null,Object? tags = null,Object? year = freezed,Object? month = freezed,}) {
  return _then(_self.copyWith(
directory: freezed == directory ? _self.directory : directory // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,dateFrom: freezed == dateFrom ? _self.dateFrom : dateFrom // ignore: cast_nullable_to_non_nullable
as String?,dateTo: freezed == dateTo ? _self.dateTo : dateTo // ignore: cast_nullable_to_non_nullable
as String?,uploaderId: freezed == uploaderId ? _self.uploaderId : uploaderId // ignore: cast_nullable_to_non_nullable
as int?,search: freezed == search ? _self.search : search // ignore: cast_nullable_to_non_nullable
as String?,page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,perPage: null == perPage ? _self.perPage : perPage // ignore: cast_nullable_to_non_nullable
as int,mediaType: null == mediaType ? _self.mediaType : mediaType // ignore: cast_nullable_to_non_nullable
as String,tags: null == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,year: freezed == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as int?,month: freezed == month ? _self.month : month // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [FileFilters].
extension FileFiltersPatterns on FileFilters {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileFilters value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileFilters() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileFilters value)  $default,){
final _that = this;
switch (_that) {
case _FileFilters():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileFilters value)?  $default,){
final _that = this;
switch (_that) {
case _FileFilters() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? directory, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'date_from')  String? dateFrom, @JsonKey(name: 'date_to')  String? dateTo, @JsonKey(name: 'uploader_id')  int? uploaderId,  String? search,  int page, @JsonKey(name: 'per_page')  int perPage, @JsonKey(name: 'media_type')  String mediaType,  List<String> tags,  int? year,  int? month)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileFilters() when $default != null:
return $default(_that.directory,_that.activityType,_that.activityName,_that.activityDate,_that.dateFrom,_that.dateTo,_that.uploaderId,_that.search,_that.page,_that.perPage,_that.mediaType,_that.tags,_that.year,_that.month);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? directory, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'date_from')  String? dateFrom, @JsonKey(name: 'date_to')  String? dateTo, @JsonKey(name: 'uploader_id')  int? uploaderId,  String? search,  int page, @JsonKey(name: 'per_page')  int perPage, @JsonKey(name: 'media_type')  String mediaType,  List<String> tags,  int? year,  int? month)  $default,) {final _that = this;
switch (_that) {
case _FileFilters():
return $default(_that.directory,_that.activityType,_that.activityName,_that.activityDate,_that.dateFrom,_that.dateTo,_that.uploaderId,_that.search,_that.page,_that.perPage,_that.mediaType,_that.tags,_that.year,_that.month);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? directory, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'date_from')  String? dateFrom, @JsonKey(name: 'date_to')  String? dateTo, @JsonKey(name: 'uploader_id')  int? uploaderId,  String? search,  int page, @JsonKey(name: 'per_page')  int perPage, @JsonKey(name: 'media_type')  String mediaType,  List<String> tags,  int? year,  int? month)?  $default,) {final _that = this;
switch (_that) {
case _FileFilters() when $default != null:
return $default(_that.directory,_that.activityType,_that.activityName,_that.activityDate,_that.dateFrom,_that.dateTo,_that.uploaderId,_that.search,_that.page,_that.perPage,_that.mediaType,_that.tags,_that.year,_that.month);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileFilters implements FileFilters {
  const _FileFilters({this.directory, @JsonKey(name: 'activity_type') this.activityType, @JsonKey(name: 'activity_name') this.activityName, @JsonKey(name: 'activity_date') this.activityDate, @JsonKey(name: 'date_from') this.dateFrom, @JsonKey(name: 'date_to') this.dateTo, @JsonKey(name: 'uploader_id') this.uploaderId, this.search, this.page = 1, @JsonKey(name: 'per_page') this.perPage = 50, @JsonKey(name: 'media_type') this.mediaType = 'all', final  List<String> tags = const [], this.year, this.month}): _tags = tags;
  factory _FileFilters.fromJson(Map<String, dynamic> json) => _$FileFiltersFromJson(json);

@override final  String? directory;
@override@JsonKey(name: 'activity_type') final  String? activityType;
@override@JsonKey(name: 'activity_name') final  String? activityName;
@override@JsonKey(name: 'activity_date') final  String? activityDate;
@override@JsonKey(name: 'date_from') final  String? dateFrom;
@override@JsonKey(name: 'date_to') final  String? dateTo;
@override@JsonKey(name: 'uploader_id') final  int? uploaderId;
@override final  String? search;
@override@JsonKey() final  int page;
@override@JsonKey(name: 'per_page') final  int perPage;
@override@JsonKey(name: 'media_type') final  String mediaType;
 final  List<String> _tags;
@override@JsonKey() List<String> get tags {
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tags);
}

@override final  int? year;
@override final  int? month;

/// Create a copy of FileFilters
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileFiltersCopyWith<_FileFilters> get copyWith => __$FileFiltersCopyWithImpl<_FileFilters>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileFiltersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileFilters&&(identical(other.directory, directory) || other.directory == directory)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.dateFrom, dateFrom) || other.dateFrom == dateFrom)&&(identical(other.dateTo, dateTo) || other.dateTo == dateTo)&&(identical(other.uploaderId, uploaderId) || other.uploaderId == uploaderId)&&(identical(other.search, search) || other.search == search)&&(identical(other.page, page) || other.page == page)&&(identical(other.perPage, perPage) || other.perPage == perPage)&&(identical(other.mediaType, mediaType) || other.mediaType == mediaType)&&const DeepCollectionEquality().equals(other._tags, _tags)&&(identical(other.year, year) || other.year == year)&&(identical(other.month, month) || other.month == month));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,directory,activityType,activityName,activityDate,dateFrom,dateTo,uploaderId,search,page,perPage,mediaType,const DeepCollectionEquality().hash(_tags),year,month);

@override
String toString() {
  return 'FileFilters(directory: $directory, activityType: $activityType, activityName: $activityName, activityDate: $activityDate, dateFrom: $dateFrom, dateTo: $dateTo, uploaderId: $uploaderId, search: $search, page: $page, perPage: $perPage, mediaType: $mediaType, tags: $tags, year: $year, month: $month)';
}


}

/// @nodoc
abstract mixin class _$FileFiltersCopyWith<$Res> implements $FileFiltersCopyWith<$Res> {
  factory _$FileFiltersCopyWith(_FileFilters value, $Res Function(_FileFilters) _then) = __$FileFiltersCopyWithImpl;
@override @useResult
$Res call({
 String? directory,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'date_from') String? dateFrom,@JsonKey(name: 'date_to') String? dateTo,@JsonKey(name: 'uploader_id') int? uploaderId, String? search, int page,@JsonKey(name: 'per_page') int perPage,@JsonKey(name: 'media_type') String mediaType, List<String> tags, int? year, int? month
});




}
/// @nodoc
class __$FileFiltersCopyWithImpl<$Res>
    implements _$FileFiltersCopyWith<$Res> {
  __$FileFiltersCopyWithImpl(this._self, this._then);

  final _FileFilters _self;
  final $Res Function(_FileFilters) _then;

/// Create a copy of FileFilters
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? directory = freezed,Object? activityType = freezed,Object? activityName = freezed,Object? activityDate = freezed,Object? dateFrom = freezed,Object? dateTo = freezed,Object? uploaderId = freezed,Object? search = freezed,Object? page = null,Object? perPage = null,Object? mediaType = null,Object? tags = null,Object? year = freezed,Object? month = freezed,}) {
  return _then(_FileFilters(
directory: freezed == directory ? _self.directory : directory // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,dateFrom: freezed == dateFrom ? _self.dateFrom : dateFrom // ignore: cast_nullable_to_non_nullable
as String?,dateTo: freezed == dateTo ? _self.dateTo : dateTo // ignore: cast_nullable_to_non_nullable
as String?,uploaderId: freezed == uploaderId ? _self.uploaderId : uploaderId // ignore: cast_nullable_to_non_nullable
as int?,search: freezed == search ? _self.search : search // ignore: cast_nullable_to_non_nullable
as String?,page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,perPage: null == perPage ? _self.perPage : perPage // ignore: cast_nullable_to_non_nullable
as int,mediaType: null == mediaType ? _self.mediaType : mediaType // ignore: cast_nullable_to_non_nullable
as String,tags: null == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<String>,year: freezed == year ? _self.year : year // ignore: cast_nullable_to_non_nullable
as int?,month: freezed == month ? _self.month : month // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$HLSQuality {

 int get height; int get bitrate; String get label; String get playlist; bool get isAvailable;
/// Create a copy of HLSQuality
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$HLSQualityCopyWith<HLSQuality> get copyWith => _$HLSQualityCopyWithImpl<HLSQuality>(this as HLSQuality, _$identity);

  /// Serializes this HLSQuality to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is HLSQuality&&(identical(other.height, height) || other.height == height)&&(identical(other.bitrate, bitrate) || other.bitrate == bitrate)&&(identical(other.label, label) || other.label == label)&&(identical(other.playlist, playlist) || other.playlist == playlist)&&(identical(other.isAvailable, isAvailable) || other.isAvailable == isAvailable));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,height,bitrate,label,playlist,isAvailable);

@override
String toString() {
  return 'HLSQuality(height: $height, bitrate: $bitrate, label: $label, playlist: $playlist, isAvailable: $isAvailable)';
}


}

/// @nodoc
abstract mixin class $HLSQualityCopyWith<$Res>  {
  factory $HLSQualityCopyWith(HLSQuality value, $Res Function(HLSQuality) _then) = _$HLSQualityCopyWithImpl;
@useResult
$Res call({
 int height, int bitrate, String label, String playlist, bool isAvailable
});




}
/// @nodoc
class _$HLSQualityCopyWithImpl<$Res>
    implements $HLSQualityCopyWith<$Res> {
  _$HLSQualityCopyWithImpl(this._self, this._then);

  final HLSQuality _self;
  final $Res Function(HLSQuality) _then;

/// Create a copy of HLSQuality
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? height = null,Object? bitrate = null,Object? label = null,Object? playlist = null,Object? isAvailable = null,}) {
  return _then(_self.copyWith(
height: null == height ? _self.height : height // ignore: cast_nullable_to_non_nullable
as int,bitrate: null == bitrate ? _self.bitrate : bitrate // ignore: cast_nullable_to_non_nullable
as int,label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,playlist: null == playlist ? _self.playlist : playlist // ignore: cast_nullable_to_non_nullable
as String,isAvailable: null == isAvailable ? _self.isAvailable : isAvailable // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [HLSQuality].
extension HLSQualityPatterns on HLSQuality {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _HLSQuality value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _HLSQuality() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _HLSQuality value)  $default,){
final _that = this;
switch (_that) {
case _HLSQuality():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _HLSQuality value)?  $default,){
final _that = this;
switch (_that) {
case _HLSQuality() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int height,  int bitrate,  String label,  String playlist,  bool isAvailable)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _HLSQuality() when $default != null:
return $default(_that.height,_that.bitrate,_that.label,_that.playlist,_that.isAvailable);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int height,  int bitrate,  String label,  String playlist,  bool isAvailable)  $default,) {final _that = this;
switch (_that) {
case _HLSQuality():
return $default(_that.height,_that.bitrate,_that.label,_that.playlist,_that.isAvailable);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int height,  int bitrate,  String label,  String playlist,  bool isAvailable)?  $default,) {final _that = this;
switch (_that) {
case _HLSQuality() when $default != null:
return $default(_that.height,_that.bitrate,_that.label,_that.playlist,_that.isAvailable);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _HLSQuality implements HLSQuality {
  const _HLSQuality({required this.height, required this.bitrate, required this.label, required this.playlist, this.isAvailable = false});
  factory _HLSQuality.fromJson(Map<String, dynamic> json) => _$HLSQualityFromJson(json);

@override final  int height;
@override final  int bitrate;
@override final  String label;
@override final  String playlist;
@override@JsonKey() final  bool isAvailable;

/// Create a copy of HLSQuality
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$HLSQualityCopyWith<_HLSQuality> get copyWith => __$HLSQualityCopyWithImpl<_HLSQuality>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$HLSQualityToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _HLSQuality&&(identical(other.height, height) || other.height == height)&&(identical(other.bitrate, bitrate) || other.bitrate == bitrate)&&(identical(other.label, label) || other.label == label)&&(identical(other.playlist, playlist) || other.playlist == playlist)&&(identical(other.isAvailable, isAvailable) || other.isAvailable == isAvailable));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,height,bitrate,label,playlist,isAvailable);

@override
String toString() {
  return 'HLSQuality(height: $height, bitrate: $bitrate, label: $label, playlist: $playlist, isAvailable: $isAvailable)';
}


}

/// @nodoc
abstract mixin class _$HLSQualityCopyWith<$Res> implements $HLSQualityCopyWith<$Res> {
  factory _$HLSQualityCopyWith(_HLSQuality value, $Res Function(_HLSQuality) _then) = __$HLSQualityCopyWithImpl;
@override @useResult
$Res call({
 int height, int bitrate, String label, String playlist, bool isAvailable
});




}
/// @nodoc
class __$HLSQualityCopyWithImpl<$Res>
    implements _$HLSQualityCopyWith<$Res> {
  __$HLSQualityCopyWithImpl(this._self, this._then);

  final _HLSQuality _self;
  final $Res Function(_HLSQuality) _then;

/// Create a copy of HLSQuality
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? height = null,Object? bitrate = null,Object? label = null,Object? playlist = null,Object? isAvailable = null,}) {
  return _then(_HLSQuality(
height: null == height ? _self.height : height // ignore: cast_nullable_to_non_nullable
as int,bitrate: null == bitrate ? _self.bitrate : bitrate // ignore: cast_nullable_to_non_nullable
as int,label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,playlist: null == playlist ? _self.playlist : playlist // ignore: cast_nullable_to_non_nullable
as String,isAvailable: null == isAvailable ? _self.isAvailable : isAvailable // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
