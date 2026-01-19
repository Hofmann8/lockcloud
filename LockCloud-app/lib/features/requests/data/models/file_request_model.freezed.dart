// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'file_request_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$RequestFileInfo {

 int get id; String get filename;@JsonKey(name: 'activity_date') String? get activityDate;@JsonKey(name: 'activity_type') String? get activityType;@JsonKey(name: 'activity_name') String? get activityName;
/// Create a copy of RequestFileInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RequestFileInfoCopyWith<RequestFileInfo> get copyWith => _$RequestFileInfoCopyWithImpl<RequestFileInfo>(this as RequestFileInfo, _$identity);

  /// Serializes this RequestFileInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RequestFileInfo&&(identical(other.id, id) || other.id == id)&&(identical(other.filename, filename) || other.filename == filename)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,filename,activityDate,activityType,activityName);

@override
String toString() {
  return 'RequestFileInfo(id: $id, filename: $filename, activityDate: $activityDate, activityType: $activityType, activityName: $activityName)';
}


}

/// @nodoc
abstract mixin class $RequestFileInfoCopyWith<$Res>  {
  factory $RequestFileInfoCopyWith(RequestFileInfo value, $Res Function(RequestFileInfo) _then) = _$RequestFileInfoCopyWithImpl;
@useResult
$Res call({
 int id, String filename,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_name') String? activityName
});




}
/// @nodoc
class _$RequestFileInfoCopyWithImpl<$Res>
    implements $RequestFileInfoCopyWith<$Res> {
  _$RequestFileInfoCopyWithImpl(this._self, this._then);

  final RequestFileInfo _self;
  final $Res Function(RequestFileInfo) _then;

/// Create a copy of RequestFileInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? filename = null,Object? activityDate = freezed,Object? activityType = freezed,Object? activityName = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,filename: null == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [RequestFileInfo].
extension RequestFileInfoPatterns on RequestFileInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RequestFileInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RequestFileInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RequestFileInfo value)  $default,){
final _that = this;
switch (_that) {
case _RequestFileInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RequestFileInfo value)?  $default,){
final _that = this;
switch (_that) {
case _RequestFileInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String filename, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RequestFileInfo() when $default != null:
return $default(_that.id,_that.filename,_that.activityDate,_that.activityType,_that.activityName);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String filename, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName)  $default,) {final _that = this;
switch (_that) {
case _RequestFileInfo():
return $default(_that.id,_that.filename,_that.activityDate,_that.activityType,_that.activityName);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String filename, @JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName)?  $default,) {final _that = this;
switch (_that) {
case _RequestFileInfo() when $default != null:
return $default(_that.id,_that.filename,_that.activityDate,_that.activityType,_that.activityName);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RequestFileInfo implements RequestFileInfo {
  const _RequestFileInfo({required this.id, required this.filename, @JsonKey(name: 'activity_date') this.activityDate, @JsonKey(name: 'activity_type') this.activityType, @JsonKey(name: 'activity_name') this.activityName});
  factory _RequestFileInfo.fromJson(Map<String, dynamic> json) => _$RequestFileInfoFromJson(json);

@override final  int id;
@override final  String filename;
@override@JsonKey(name: 'activity_date') final  String? activityDate;
@override@JsonKey(name: 'activity_type') final  String? activityType;
@override@JsonKey(name: 'activity_name') final  String? activityName;

/// Create a copy of RequestFileInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RequestFileInfoCopyWith<_RequestFileInfo> get copyWith => __$RequestFileInfoCopyWithImpl<_RequestFileInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RequestFileInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RequestFileInfo&&(identical(other.id, id) || other.id == id)&&(identical(other.filename, filename) || other.filename == filename)&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,filename,activityDate,activityType,activityName);

@override
String toString() {
  return 'RequestFileInfo(id: $id, filename: $filename, activityDate: $activityDate, activityType: $activityType, activityName: $activityName)';
}


}

/// @nodoc
abstract mixin class _$RequestFileInfoCopyWith<$Res> implements $RequestFileInfoCopyWith<$Res> {
  factory _$RequestFileInfoCopyWith(_RequestFileInfo value, $Res Function(_RequestFileInfo) _then) = __$RequestFileInfoCopyWithImpl;
@override @useResult
$Res call({
 int id, String filename,@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_name') String? activityName
});




}
/// @nodoc
class __$RequestFileInfoCopyWithImpl<$Res>
    implements _$RequestFileInfoCopyWith<$Res> {
  __$RequestFileInfoCopyWithImpl(this._self, this._then);

  final _RequestFileInfo _self;
  final $Res Function(_RequestFileInfo) _then;

/// Create a copy of RequestFileInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? filename = null,Object? activityDate = freezed,Object? activityType = freezed,Object? activityName = freezed,}) {
  return _then(_RequestFileInfo(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,filename: null == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String,activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$RequestUserInfo {

 int get id; String get name;
/// Create a copy of RequestUserInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RequestUserInfoCopyWith<RequestUserInfo> get copyWith => _$RequestUserInfoCopyWithImpl<RequestUserInfo>(this as RequestUserInfo, _$identity);

  /// Serializes this RequestUserInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RequestUserInfo&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'RequestUserInfo(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class $RequestUserInfoCopyWith<$Res>  {
  factory $RequestUserInfoCopyWith(RequestUserInfo value, $Res Function(RequestUserInfo) _then) = _$RequestUserInfoCopyWithImpl;
@useResult
$Res call({
 int id, String name
});




}
/// @nodoc
class _$RequestUserInfoCopyWithImpl<$Res>
    implements $RequestUserInfoCopyWith<$Res> {
  _$RequestUserInfoCopyWithImpl(this._self, this._then);

  final RequestUserInfo _self;
  final $Res Function(RequestUserInfo) _then;

/// Create a copy of RequestUserInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [RequestUserInfo].
extension RequestUserInfoPatterns on RequestUserInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RequestUserInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RequestUserInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RequestUserInfo value)  $default,){
final _that = this;
switch (_that) {
case _RequestUserInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RequestUserInfo value)?  $default,){
final _that = this;
switch (_that) {
case _RequestUserInfo() when $default != null:
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
case _RequestUserInfo() when $default != null:
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
case _RequestUserInfo():
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
case _RequestUserInfo() when $default != null:
return $default(_that.id,_that.name);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RequestUserInfo implements RequestUserInfo {
  const _RequestUserInfo({required this.id, required this.name});
  factory _RequestUserInfo.fromJson(Map<String, dynamic> json) => _$RequestUserInfoFromJson(json);

@override final  int id;
@override final  String name;

/// Create a copy of RequestUserInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RequestUserInfoCopyWith<_RequestUserInfo> get copyWith => __$RequestUserInfoCopyWithImpl<_RequestUserInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RequestUserInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RequestUserInfo&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name);

@override
String toString() {
  return 'RequestUserInfo(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class _$RequestUserInfoCopyWith<$Res> implements $RequestUserInfoCopyWith<$Res> {
  factory _$RequestUserInfoCopyWith(_RequestUserInfo value, $Res Function(_RequestUserInfo) _then) = __$RequestUserInfoCopyWithImpl;
@override @useResult
$Res call({
 int id, String name
});




}
/// @nodoc
class __$RequestUserInfoCopyWithImpl<$Res>
    implements _$RequestUserInfoCopyWith<$Res> {
  __$RequestUserInfoCopyWithImpl(this._self, this._then);

  final _RequestUserInfo _self;
  final $Res Function(_RequestUserInfo) _then;

/// Create a copy of RequestUserInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,}) {
  return _then(_RequestUserInfo(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$DirectoryInfo {

@JsonKey(name: 'activity_date') String get activityDate;@JsonKey(name: 'activity_name') String get activityName;@JsonKey(name: 'activity_type') String get activityType;
/// Create a copy of DirectoryInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DirectoryInfoCopyWith<DirectoryInfo> get copyWith => _$DirectoryInfoCopyWithImpl<DirectoryInfo>(this as DirectoryInfo, _$identity);

  /// Serializes this DirectoryInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DirectoryInfo&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityType, activityType) || other.activityType == activityType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityName,activityType);

@override
String toString() {
  return 'DirectoryInfo(activityDate: $activityDate, activityName: $activityName, activityType: $activityType)';
}


}

/// @nodoc
abstract mixin class $DirectoryInfoCopyWith<$Res>  {
  factory $DirectoryInfoCopyWith(DirectoryInfo value, $Res Function(DirectoryInfo) _then) = _$DirectoryInfoCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_name') String activityName,@JsonKey(name: 'activity_type') String activityType
});




}
/// @nodoc
class _$DirectoryInfoCopyWithImpl<$Res>
    implements $DirectoryInfoCopyWith<$Res> {
  _$DirectoryInfoCopyWithImpl(this._self, this._then);

  final DirectoryInfo _self;
  final $Res Function(DirectoryInfo) _then;

/// Create a copy of DirectoryInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? activityDate = null,Object? activityName = null,Object? activityType = null,}) {
  return _then(_self.copyWith(
activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityName: null == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [DirectoryInfo].
extension DirectoryInfoPatterns on DirectoryInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DirectoryInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DirectoryInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DirectoryInfo value)  $default,){
final _that = this;
switch (_that) {
case _DirectoryInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DirectoryInfo value)?  $default,){
final _that = this;
switch (_that) {
case _DirectoryInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_name')  String activityName, @JsonKey(name: 'activity_type')  String activityType)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DirectoryInfo() when $default != null:
return $default(_that.activityDate,_that.activityName,_that.activityType);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_name')  String activityName, @JsonKey(name: 'activity_type')  String activityType)  $default,) {final _that = this;
switch (_that) {
case _DirectoryInfo():
return $default(_that.activityDate,_that.activityName,_that.activityType);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_name')  String activityName, @JsonKey(name: 'activity_type')  String activityType)?  $default,) {final _that = this;
switch (_that) {
case _DirectoryInfo() when $default != null:
return $default(_that.activityDate,_that.activityName,_that.activityType);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _DirectoryInfo implements DirectoryInfo {
  const _DirectoryInfo({@JsonKey(name: 'activity_date') required this.activityDate, @JsonKey(name: 'activity_name') required this.activityName, @JsonKey(name: 'activity_type') required this.activityType});
  factory _DirectoryInfo.fromJson(Map<String, dynamic> json) => _$DirectoryInfoFromJson(json);

@override@JsonKey(name: 'activity_date') final  String activityDate;
@override@JsonKey(name: 'activity_name') final  String activityName;
@override@JsonKey(name: 'activity_type') final  String activityType;

/// Create a copy of DirectoryInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DirectoryInfoCopyWith<_DirectoryInfo> get copyWith => __$DirectoryInfoCopyWithImpl<_DirectoryInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DirectoryInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DirectoryInfo&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityType, activityType) || other.activityType == activityType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityName,activityType);

@override
String toString() {
  return 'DirectoryInfo(activityDate: $activityDate, activityName: $activityName, activityType: $activityType)';
}


}

/// @nodoc
abstract mixin class _$DirectoryInfoCopyWith<$Res> implements $DirectoryInfoCopyWith<$Res> {
  factory _$DirectoryInfoCopyWith(_DirectoryInfo value, $Res Function(_DirectoryInfo) _then) = __$DirectoryInfoCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_name') String activityName,@JsonKey(name: 'activity_type') String activityType
});




}
/// @nodoc
class __$DirectoryInfoCopyWithImpl<$Res>
    implements _$DirectoryInfoCopyWith<$Res> {
  __$DirectoryInfoCopyWithImpl(this._self, this._then);

  final _DirectoryInfo _self;
  final $Res Function(_DirectoryInfo) _then;

/// Create a copy of DirectoryInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? activityDate = null,Object? activityName = null,Object? activityType = null,}) {
  return _then(_DirectoryInfo(
activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityName: null == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ProposedChanges {

@JsonKey(name: 'activity_date') String? get activityDate;@JsonKey(name: 'activity_type') String? get activityType;@JsonKey(name: 'activity_name') String? get activityName;@JsonKey(name: 'new_activity_name') String? get newActivityName;@JsonKey(name: 'new_activity_type') String? get newActivityType; String? get instructor; String? get filename;@JsonKey(name: 'free_tags') List<String>? get freeTags;
/// Create a copy of ProposedChanges
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProposedChangesCopyWith<ProposedChanges> get copyWith => _$ProposedChangesCopyWithImpl<ProposedChanges>(this as ProposedChanges, _$identity);

  /// Serializes this ProposedChanges to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProposedChanges&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.newActivityName, newActivityName) || other.newActivityName == newActivityName)&&(identical(other.newActivityType, newActivityType) || other.newActivityType == newActivityType)&&(identical(other.instructor, instructor) || other.instructor == instructor)&&(identical(other.filename, filename) || other.filename == filename)&&const DeepCollectionEquality().equals(other.freeTags, freeTags));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityType,activityName,newActivityName,newActivityType,instructor,filename,const DeepCollectionEquality().hash(freeTags));

@override
String toString() {
  return 'ProposedChanges(activityDate: $activityDate, activityType: $activityType, activityName: $activityName, newActivityName: $newActivityName, newActivityType: $newActivityType, instructor: $instructor, filename: $filename, freeTags: $freeTags)';
}


}

/// @nodoc
abstract mixin class $ProposedChangesCopyWith<$Res>  {
  factory $ProposedChangesCopyWith(ProposedChanges value, $Res Function(ProposedChanges) _then) = _$ProposedChangesCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'new_activity_name') String? newActivityName,@JsonKey(name: 'new_activity_type') String? newActivityType, String? instructor, String? filename,@JsonKey(name: 'free_tags') List<String>? freeTags
});




}
/// @nodoc
class _$ProposedChangesCopyWithImpl<$Res>
    implements $ProposedChangesCopyWith<$Res> {
  _$ProposedChangesCopyWithImpl(this._self, this._then);

  final ProposedChanges _self;
  final $Res Function(ProposedChanges) _then;

/// Create a copy of ProposedChanges
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? activityDate = freezed,Object? activityType = freezed,Object? activityName = freezed,Object? newActivityName = freezed,Object? newActivityType = freezed,Object? instructor = freezed,Object? filename = freezed,Object? freeTags = freezed,}) {
  return _then(_self.copyWith(
activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,newActivityName: freezed == newActivityName ? _self.newActivityName : newActivityName // ignore: cast_nullable_to_non_nullable
as String?,newActivityType: freezed == newActivityType ? _self.newActivityType : newActivityType // ignore: cast_nullable_to_non_nullable
as String?,instructor: freezed == instructor ? _self.instructor : instructor // ignore: cast_nullable_to_non_nullable
as String?,filename: freezed == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String?,freeTags: freezed == freeTags ? _self.freeTags : freeTags // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}

}


/// Adds pattern-matching-related methods to [ProposedChanges].
extension ProposedChangesPatterns on ProposedChanges {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProposedChanges value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProposedChanges() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProposedChanges value)  $default,){
final _that = this;
switch (_that) {
case _ProposedChanges():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProposedChanges value)?  $default,){
final _that = this;
switch (_that) {
case _ProposedChanges() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'new_activity_name')  String? newActivityName, @JsonKey(name: 'new_activity_type')  String? newActivityType,  String? instructor,  String? filename, @JsonKey(name: 'free_tags')  List<String>? freeTags)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProposedChanges() when $default != null:
return $default(_that.activityDate,_that.activityType,_that.activityName,_that.newActivityName,_that.newActivityType,_that.instructor,_that.filename,_that.freeTags);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'new_activity_name')  String? newActivityName, @JsonKey(name: 'new_activity_type')  String? newActivityType,  String? instructor,  String? filename, @JsonKey(name: 'free_tags')  List<String>? freeTags)  $default,) {final _that = this;
switch (_that) {
case _ProposedChanges():
return $default(_that.activityDate,_that.activityType,_that.activityName,_that.newActivityName,_that.newActivityType,_that.instructor,_that.filename,_that.freeTags);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'activity_date')  String? activityDate, @JsonKey(name: 'activity_type')  String? activityType, @JsonKey(name: 'activity_name')  String? activityName, @JsonKey(name: 'new_activity_name')  String? newActivityName, @JsonKey(name: 'new_activity_type')  String? newActivityType,  String? instructor,  String? filename, @JsonKey(name: 'free_tags')  List<String>? freeTags)?  $default,) {final _that = this;
switch (_that) {
case _ProposedChanges() when $default != null:
return $default(_that.activityDate,_that.activityType,_that.activityName,_that.newActivityName,_that.newActivityType,_that.instructor,_that.filename,_that.freeTags);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProposedChanges implements ProposedChanges {
  const _ProposedChanges({@JsonKey(name: 'activity_date') this.activityDate, @JsonKey(name: 'activity_type') this.activityType, @JsonKey(name: 'activity_name') this.activityName, @JsonKey(name: 'new_activity_name') this.newActivityName, @JsonKey(name: 'new_activity_type') this.newActivityType, this.instructor, this.filename, @JsonKey(name: 'free_tags') final  List<String>? freeTags}): _freeTags = freeTags;
  factory _ProposedChanges.fromJson(Map<String, dynamic> json) => _$ProposedChangesFromJson(json);

@override@JsonKey(name: 'activity_date') final  String? activityDate;
@override@JsonKey(name: 'activity_type') final  String? activityType;
@override@JsonKey(name: 'activity_name') final  String? activityName;
@override@JsonKey(name: 'new_activity_name') final  String? newActivityName;
@override@JsonKey(name: 'new_activity_type') final  String? newActivityType;
@override final  String? instructor;
@override final  String? filename;
 final  List<String>? _freeTags;
@override@JsonKey(name: 'free_tags') List<String>? get freeTags {
  final value = _freeTags;
  if (value == null) return null;
  if (_freeTags is EqualUnmodifiableListView) return _freeTags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of ProposedChanges
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProposedChangesCopyWith<_ProposedChanges> get copyWith => __$ProposedChangesCopyWithImpl<_ProposedChanges>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProposedChangesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProposedChanges&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.newActivityName, newActivityName) || other.newActivityName == newActivityName)&&(identical(other.newActivityType, newActivityType) || other.newActivityType == newActivityType)&&(identical(other.instructor, instructor) || other.instructor == instructor)&&(identical(other.filename, filename) || other.filename == filename)&&const DeepCollectionEquality().equals(other._freeTags, _freeTags));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityType,activityName,newActivityName,newActivityType,instructor,filename,const DeepCollectionEquality().hash(_freeTags));

@override
String toString() {
  return 'ProposedChanges(activityDate: $activityDate, activityType: $activityType, activityName: $activityName, newActivityName: $newActivityName, newActivityType: $newActivityType, instructor: $instructor, filename: $filename, freeTags: $freeTags)';
}


}

/// @nodoc
abstract mixin class _$ProposedChangesCopyWith<$Res> implements $ProposedChangesCopyWith<$Res> {
  factory _$ProposedChangesCopyWith(_ProposedChanges value, $Res Function(_ProposedChanges) _then) = __$ProposedChangesCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'activity_date') String? activityDate,@JsonKey(name: 'activity_type') String? activityType,@JsonKey(name: 'activity_name') String? activityName,@JsonKey(name: 'new_activity_name') String? newActivityName,@JsonKey(name: 'new_activity_type') String? newActivityType, String? instructor, String? filename,@JsonKey(name: 'free_tags') List<String>? freeTags
});




}
/// @nodoc
class __$ProposedChangesCopyWithImpl<$Res>
    implements _$ProposedChangesCopyWith<$Res> {
  __$ProposedChangesCopyWithImpl(this._self, this._then);

  final _ProposedChanges _self;
  final $Res Function(_ProposedChanges) _then;

/// Create a copy of ProposedChanges
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? activityDate = freezed,Object? activityType = freezed,Object? activityName = freezed,Object? newActivityName = freezed,Object? newActivityType = freezed,Object? instructor = freezed,Object? filename = freezed,Object? freeTags = freezed,}) {
  return _then(_ProposedChanges(
activityDate: freezed == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String?,activityType: freezed == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String?,activityName: freezed == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String?,newActivityName: freezed == newActivityName ? _self.newActivityName : newActivityName // ignore: cast_nullable_to_non_nullable
as String?,newActivityType: freezed == newActivityType ? _self.newActivityType : newActivityType // ignore: cast_nullable_to_non_nullable
as String?,instructor: freezed == instructor ? _self.instructor : instructor // ignore: cast_nullable_to_non_nullable
as String?,filename: freezed == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String?,freeTags: freezed == freeTags ? _self._freeTags : freeTags // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}


}


/// @nodoc
mixin _$FileRequestModel {

 int get id;@JsonKey(name: 'file_id') int? get fileId;@JsonKey(name: 'requester_id') int get requesterId;@JsonKey(name: 'owner_id') int get ownerId;@JsonKey(name: 'request_type') RequestType get requestType; RequestStatus get status;@JsonKey(name: 'proposed_changes') ProposedChanges? get proposedChanges;@JsonKey(name: 'directory_info') DirectoryInfo? get directoryInfo; String? get message;@JsonKey(name: 'response_message') String? get responseMessage;@JsonKey(name: 'created_at') String get createdAt;@JsonKey(name: 'updated_at') String? get updatedAt; RequestFileInfo? get file; RequestUserInfo? get requester; RequestUserInfo? get owner;
/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FileRequestModelCopyWith<FileRequestModel> get copyWith => _$FileRequestModelCopyWithImpl<FileRequestModel>(this as FileRequestModel, _$identity);

  /// Serializes this FileRequestModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FileRequestModel&&(identical(other.id, id) || other.id == id)&&(identical(other.fileId, fileId) || other.fileId == fileId)&&(identical(other.requesterId, requesterId) || other.requesterId == requesterId)&&(identical(other.ownerId, ownerId) || other.ownerId == ownerId)&&(identical(other.requestType, requestType) || other.requestType == requestType)&&(identical(other.status, status) || other.status == status)&&(identical(other.proposedChanges, proposedChanges) || other.proposedChanges == proposedChanges)&&(identical(other.directoryInfo, directoryInfo) || other.directoryInfo == directoryInfo)&&(identical(other.message, message) || other.message == message)&&(identical(other.responseMessage, responseMessage) || other.responseMessage == responseMessage)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.file, file) || other.file == file)&&(identical(other.requester, requester) || other.requester == requester)&&(identical(other.owner, owner) || other.owner == owner));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fileId,requesterId,ownerId,requestType,status,proposedChanges,directoryInfo,message,responseMessage,createdAt,updatedAt,file,requester,owner);

@override
String toString() {
  return 'FileRequestModel(id: $id, fileId: $fileId, requesterId: $requesterId, ownerId: $ownerId, requestType: $requestType, status: $status, proposedChanges: $proposedChanges, directoryInfo: $directoryInfo, message: $message, responseMessage: $responseMessage, createdAt: $createdAt, updatedAt: $updatedAt, file: $file, requester: $requester, owner: $owner)';
}


}

/// @nodoc
abstract mixin class $FileRequestModelCopyWith<$Res>  {
  factory $FileRequestModelCopyWith(FileRequestModel value, $Res Function(FileRequestModel) _then) = _$FileRequestModelCopyWithImpl;
@useResult
$Res call({
 int id,@JsonKey(name: 'file_id') int? fileId,@JsonKey(name: 'requester_id') int requesterId,@JsonKey(name: 'owner_id') int ownerId,@JsonKey(name: 'request_type') RequestType requestType, RequestStatus status,@JsonKey(name: 'proposed_changes') ProposedChanges? proposedChanges,@JsonKey(name: 'directory_info') DirectoryInfo? directoryInfo, String? message,@JsonKey(name: 'response_message') String? responseMessage,@JsonKey(name: 'created_at') String createdAt,@JsonKey(name: 'updated_at') String? updatedAt, RequestFileInfo? file, RequestUserInfo? requester, RequestUserInfo? owner
});


$ProposedChangesCopyWith<$Res>? get proposedChanges;$DirectoryInfoCopyWith<$Res>? get directoryInfo;$RequestFileInfoCopyWith<$Res>? get file;$RequestUserInfoCopyWith<$Res>? get requester;$RequestUserInfoCopyWith<$Res>? get owner;

}
/// @nodoc
class _$FileRequestModelCopyWithImpl<$Res>
    implements $FileRequestModelCopyWith<$Res> {
  _$FileRequestModelCopyWithImpl(this._self, this._then);

  final FileRequestModel _self;
  final $Res Function(FileRequestModel) _then;

/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fileId = freezed,Object? requesterId = null,Object? ownerId = null,Object? requestType = null,Object? status = null,Object? proposedChanges = freezed,Object? directoryInfo = freezed,Object? message = freezed,Object? responseMessage = freezed,Object? createdAt = null,Object? updatedAt = freezed,Object? file = freezed,Object? requester = freezed,Object? owner = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,fileId: freezed == fileId ? _self.fileId : fileId // ignore: cast_nullable_to_non_nullable
as int?,requesterId: null == requesterId ? _self.requesterId : requesterId // ignore: cast_nullable_to_non_nullable
as int,ownerId: null == ownerId ? _self.ownerId : ownerId // ignore: cast_nullable_to_non_nullable
as int,requestType: null == requestType ? _self.requestType : requestType // ignore: cast_nullable_to_non_nullable
as RequestType,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as RequestStatus,proposedChanges: freezed == proposedChanges ? _self.proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as ProposedChanges?,directoryInfo: freezed == directoryInfo ? _self.directoryInfo : directoryInfo // ignore: cast_nullable_to_non_nullable
as DirectoryInfo?,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,responseMessage: freezed == responseMessage ? _self.responseMessage : responseMessage // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,file: freezed == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as RequestFileInfo?,requester: freezed == requester ? _self.requester : requester // ignore: cast_nullable_to_non_nullable
as RequestUserInfo?,owner: freezed == owner ? _self.owner : owner // ignore: cast_nullable_to_non_nullable
as RequestUserInfo?,
  ));
}
/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ProposedChangesCopyWith<$Res>? get proposedChanges {
    if (_self.proposedChanges == null) {
    return null;
  }

  return $ProposedChangesCopyWith<$Res>(_self.proposedChanges!, (value) {
    return _then(_self.copyWith(proposedChanges: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DirectoryInfoCopyWith<$Res>? get directoryInfo {
    if (_self.directoryInfo == null) {
    return null;
  }

  return $DirectoryInfoCopyWith<$Res>(_self.directoryInfo!, (value) {
    return _then(_self.copyWith(directoryInfo: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RequestFileInfoCopyWith<$Res>? get file {
    if (_self.file == null) {
    return null;
  }

  return $RequestFileInfoCopyWith<$Res>(_self.file!, (value) {
    return _then(_self.copyWith(file: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RequestUserInfoCopyWith<$Res>? get requester {
    if (_self.requester == null) {
    return null;
  }

  return $RequestUserInfoCopyWith<$Res>(_self.requester!, (value) {
    return _then(_self.copyWith(requester: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RequestUserInfoCopyWith<$Res>? get owner {
    if (_self.owner == null) {
    return null;
  }

  return $RequestUserInfoCopyWith<$Res>(_self.owner!, (value) {
    return _then(_self.copyWith(owner: value));
  });
}
}


/// Adds pattern-matching-related methods to [FileRequestModel].
extension FileRequestModelPatterns on FileRequestModel {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FileRequestModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FileRequestModel() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FileRequestModel value)  $default,){
final _that = this;
switch (_that) {
case _FileRequestModel():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FileRequestModel value)?  $default,){
final _that = this;
switch (_that) {
case _FileRequestModel() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id, @JsonKey(name: 'file_id')  int? fileId, @JsonKey(name: 'requester_id')  int requesterId, @JsonKey(name: 'owner_id')  int ownerId, @JsonKey(name: 'request_type')  RequestType requestType,  RequestStatus status, @JsonKey(name: 'proposed_changes')  ProposedChanges? proposedChanges, @JsonKey(name: 'directory_info')  DirectoryInfo? directoryInfo,  String? message, @JsonKey(name: 'response_message')  String? responseMessage, @JsonKey(name: 'created_at')  String createdAt, @JsonKey(name: 'updated_at')  String? updatedAt,  RequestFileInfo? file,  RequestUserInfo? requester,  RequestUserInfo? owner)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FileRequestModel() when $default != null:
return $default(_that.id,_that.fileId,_that.requesterId,_that.ownerId,_that.requestType,_that.status,_that.proposedChanges,_that.directoryInfo,_that.message,_that.responseMessage,_that.createdAt,_that.updatedAt,_that.file,_that.requester,_that.owner);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id, @JsonKey(name: 'file_id')  int? fileId, @JsonKey(name: 'requester_id')  int requesterId, @JsonKey(name: 'owner_id')  int ownerId, @JsonKey(name: 'request_type')  RequestType requestType,  RequestStatus status, @JsonKey(name: 'proposed_changes')  ProposedChanges? proposedChanges, @JsonKey(name: 'directory_info')  DirectoryInfo? directoryInfo,  String? message, @JsonKey(name: 'response_message')  String? responseMessage, @JsonKey(name: 'created_at')  String createdAt, @JsonKey(name: 'updated_at')  String? updatedAt,  RequestFileInfo? file,  RequestUserInfo? requester,  RequestUserInfo? owner)  $default,) {final _that = this;
switch (_that) {
case _FileRequestModel():
return $default(_that.id,_that.fileId,_that.requesterId,_that.ownerId,_that.requestType,_that.status,_that.proposedChanges,_that.directoryInfo,_that.message,_that.responseMessage,_that.createdAt,_that.updatedAt,_that.file,_that.requester,_that.owner);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id, @JsonKey(name: 'file_id')  int? fileId, @JsonKey(name: 'requester_id')  int requesterId, @JsonKey(name: 'owner_id')  int ownerId, @JsonKey(name: 'request_type')  RequestType requestType,  RequestStatus status, @JsonKey(name: 'proposed_changes')  ProposedChanges? proposedChanges, @JsonKey(name: 'directory_info')  DirectoryInfo? directoryInfo,  String? message, @JsonKey(name: 'response_message')  String? responseMessage, @JsonKey(name: 'created_at')  String createdAt, @JsonKey(name: 'updated_at')  String? updatedAt,  RequestFileInfo? file,  RequestUserInfo? requester,  RequestUserInfo? owner)?  $default,) {final _that = this;
switch (_that) {
case _FileRequestModel() when $default != null:
return $default(_that.id,_that.fileId,_that.requesterId,_that.ownerId,_that.requestType,_that.status,_that.proposedChanges,_that.directoryInfo,_that.message,_that.responseMessage,_that.createdAt,_that.updatedAt,_that.file,_that.requester,_that.owner);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FileRequestModel extends FileRequestModel {
  const _FileRequestModel({required this.id, @JsonKey(name: 'file_id') this.fileId, @JsonKey(name: 'requester_id') required this.requesterId, @JsonKey(name: 'owner_id') required this.ownerId, @JsonKey(name: 'request_type') required this.requestType, required this.status, @JsonKey(name: 'proposed_changes') this.proposedChanges, @JsonKey(name: 'directory_info') this.directoryInfo, this.message, @JsonKey(name: 'response_message') this.responseMessage, @JsonKey(name: 'created_at') required this.createdAt, @JsonKey(name: 'updated_at') this.updatedAt, this.file, this.requester, this.owner}): super._();
  factory _FileRequestModel.fromJson(Map<String, dynamic> json) => _$FileRequestModelFromJson(json);

@override final  int id;
@override@JsonKey(name: 'file_id') final  int? fileId;
@override@JsonKey(name: 'requester_id') final  int requesterId;
@override@JsonKey(name: 'owner_id') final  int ownerId;
@override@JsonKey(name: 'request_type') final  RequestType requestType;
@override final  RequestStatus status;
@override@JsonKey(name: 'proposed_changes') final  ProposedChanges? proposedChanges;
@override@JsonKey(name: 'directory_info') final  DirectoryInfo? directoryInfo;
@override final  String? message;
@override@JsonKey(name: 'response_message') final  String? responseMessage;
@override@JsonKey(name: 'created_at') final  String createdAt;
@override@JsonKey(name: 'updated_at') final  String? updatedAt;
@override final  RequestFileInfo? file;
@override final  RequestUserInfo? requester;
@override final  RequestUserInfo? owner;

/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FileRequestModelCopyWith<_FileRequestModel> get copyWith => __$FileRequestModelCopyWithImpl<_FileRequestModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FileRequestModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FileRequestModel&&(identical(other.id, id) || other.id == id)&&(identical(other.fileId, fileId) || other.fileId == fileId)&&(identical(other.requesterId, requesterId) || other.requesterId == requesterId)&&(identical(other.ownerId, ownerId) || other.ownerId == ownerId)&&(identical(other.requestType, requestType) || other.requestType == requestType)&&(identical(other.status, status) || other.status == status)&&(identical(other.proposedChanges, proposedChanges) || other.proposedChanges == proposedChanges)&&(identical(other.directoryInfo, directoryInfo) || other.directoryInfo == directoryInfo)&&(identical(other.message, message) || other.message == message)&&(identical(other.responseMessage, responseMessage) || other.responseMessage == responseMessage)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.file, file) || other.file == file)&&(identical(other.requester, requester) || other.requester == requester)&&(identical(other.owner, owner) || other.owner == owner));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fileId,requesterId,ownerId,requestType,status,proposedChanges,directoryInfo,message,responseMessage,createdAt,updatedAt,file,requester,owner);

@override
String toString() {
  return 'FileRequestModel(id: $id, fileId: $fileId, requesterId: $requesterId, ownerId: $ownerId, requestType: $requestType, status: $status, proposedChanges: $proposedChanges, directoryInfo: $directoryInfo, message: $message, responseMessage: $responseMessage, createdAt: $createdAt, updatedAt: $updatedAt, file: $file, requester: $requester, owner: $owner)';
}


}

/// @nodoc
abstract mixin class _$FileRequestModelCopyWith<$Res> implements $FileRequestModelCopyWith<$Res> {
  factory _$FileRequestModelCopyWith(_FileRequestModel value, $Res Function(_FileRequestModel) _then) = __$FileRequestModelCopyWithImpl;
@override @useResult
$Res call({
 int id,@JsonKey(name: 'file_id') int? fileId,@JsonKey(name: 'requester_id') int requesterId,@JsonKey(name: 'owner_id') int ownerId,@JsonKey(name: 'request_type') RequestType requestType, RequestStatus status,@JsonKey(name: 'proposed_changes') ProposedChanges? proposedChanges,@JsonKey(name: 'directory_info') DirectoryInfo? directoryInfo, String? message,@JsonKey(name: 'response_message') String? responseMessage,@JsonKey(name: 'created_at') String createdAt,@JsonKey(name: 'updated_at') String? updatedAt, RequestFileInfo? file, RequestUserInfo? requester, RequestUserInfo? owner
});


@override $ProposedChangesCopyWith<$Res>? get proposedChanges;@override $DirectoryInfoCopyWith<$Res>? get directoryInfo;@override $RequestFileInfoCopyWith<$Res>? get file;@override $RequestUserInfoCopyWith<$Res>? get requester;@override $RequestUserInfoCopyWith<$Res>? get owner;

}
/// @nodoc
class __$FileRequestModelCopyWithImpl<$Res>
    implements _$FileRequestModelCopyWith<$Res> {
  __$FileRequestModelCopyWithImpl(this._self, this._then);

  final _FileRequestModel _self;
  final $Res Function(_FileRequestModel) _then;

/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fileId = freezed,Object? requesterId = null,Object? ownerId = null,Object? requestType = null,Object? status = null,Object? proposedChanges = freezed,Object? directoryInfo = freezed,Object? message = freezed,Object? responseMessage = freezed,Object? createdAt = null,Object? updatedAt = freezed,Object? file = freezed,Object? requester = freezed,Object? owner = freezed,}) {
  return _then(_FileRequestModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,fileId: freezed == fileId ? _self.fileId : fileId // ignore: cast_nullable_to_non_nullable
as int?,requesterId: null == requesterId ? _self.requesterId : requesterId // ignore: cast_nullable_to_non_nullable
as int,ownerId: null == ownerId ? _self.ownerId : ownerId // ignore: cast_nullable_to_non_nullable
as int,requestType: null == requestType ? _self.requestType : requestType // ignore: cast_nullable_to_non_nullable
as RequestType,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as RequestStatus,proposedChanges: freezed == proposedChanges ? _self.proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as ProposedChanges?,directoryInfo: freezed == directoryInfo ? _self.directoryInfo : directoryInfo // ignore: cast_nullable_to_non_nullable
as DirectoryInfo?,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,responseMessage: freezed == responseMessage ? _self.responseMessage : responseMessage // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,file: freezed == file ? _self.file : file // ignore: cast_nullable_to_non_nullable
as RequestFileInfo?,requester: freezed == requester ? _self.requester : requester // ignore: cast_nullable_to_non_nullable
as RequestUserInfo?,owner: freezed == owner ? _self.owner : owner // ignore: cast_nullable_to_non_nullable
as RequestUserInfo?,
  ));
}

/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ProposedChangesCopyWith<$Res>? get proposedChanges {
    if (_self.proposedChanges == null) {
    return null;
  }

  return $ProposedChangesCopyWith<$Res>(_self.proposedChanges!, (value) {
    return _then(_self.copyWith(proposedChanges: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DirectoryInfoCopyWith<$Res>? get directoryInfo {
    if (_self.directoryInfo == null) {
    return null;
  }

  return $DirectoryInfoCopyWith<$Res>(_self.directoryInfo!, (value) {
    return _then(_self.copyWith(directoryInfo: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RequestFileInfoCopyWith<$Res>? get file {
    if (_self.file == null) {
    return null;
  }

  return $RequestFileInfoCopyWith<$Res>(_self.file!, (value) {
    return _then(_self.copyWith(file: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RequestUserInfoCopyWith<$Res>? get requester {
    if (_self.requester == null) {
    return null;
  }

  return $RequestUserInfoCopyWith<$Res>(_self.requester!, (value) {
    return _then(_self.copyWith(requester: value));
  });
}/// Create a copy of FileRequestModel
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RequestUserInfoCopyWith<$Res>? get owner {
    if (_self.owner == null) {
    return null;
  }

  return $RequestUserInfoCopyWith<$Res>(_self.owner!, (value) {
    return _then(_self.copyWith(owner: value));
  });
}
}


/// @nodoc
mixin _$CreateRequestParams {

@JsonKey(name: 'file_id') int get fileId;@JsonKey(name: 'request_type') String get requestType;@JsonKey(name: 'proposed_changes') Map<String, dynamic>? get proposedChanges; String? get message;
/// Create a copy of CreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateRequestParamsCopyWith<CreateRequestParams> get copyWith => _$CreateRequestParamsCopyWithImpl<CreateRequestParams>(this as CreateRequestParams, _$identity);

  /// Serializes this CreateRequestParams to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateRequestParams&&(identical(other.fileId, fileId) || other.fileId == fileId)&&(identical(other.requestType, requestType) || other.requestType == requestType)&&const DeepCollectionEquality().equals(other.proposedChanges, proposedChanges)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fileId,requestType,const DeepCollectionEquality().hash(proposedChanges),message);

@override
String toString() {
  return 'CreateRequestParams(fileId: $fileId, requestType: $requestType, proposedChanges: $proposedChanges, message: $message)';
}


}

/// @nodoc
abstract mixin class $CreateRequestParamsCopyWith<$Res>  {
  factory $CreateRequestParamsCopyWith(CreateRequestParams value, $Res Function(CreateRequestParams) _then) = _$CreateRequestParamsCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'file_id') int fileId,@JsonKey(name: 'request_type') String requestType,@JsonKey(name: 'proposed_changes') Map<String, dynamic>? proposedChanges, String? message
});




}
/// @nodoc
class _$CreateRequestParamsCopyWithImpl<$Res>
    implements $CreateRequestParamsCopyWith<$Res> {
  _$CreateRequestParamsCopyWithImpl(this._self, this._then);

  final CreateRequestParams _self;
  final $Res Function(CreateRequestParams) _then;

/// Create a copy of CreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fileId = null,Object? requestType = null,Object? proposedChanges = freezed,Object? message = freezed,}) {
  return _then(_self.copyWith(
fileId: null == fileId ? _self.fileId : fileId // ignore: cast_nullable_to_non_nullable
as int,requestType: null == requestType ? _self.requestType : requestType // ignore: cast_nullable_to_non_nullable
as String,proposedChanges: freezed == proposedChanges ? _self.proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateRequestParams].
extension CreateRequestParamsPatterns on CreateRequestParams {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateRequestParams value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateRequestParams() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateRequestParams value)  $default,){
final _that = this;
switch (_that) {
case _CreateRequestParams():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateRequestParams value)?  $default,){
final _that = this;
switch (_that) {
case _CreateRequestParams() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'file_id')  int fileId, @JsonKey(name: 'request_type')  String requestType, @JsonKey(name: 'proposed_changes')  Map<String, dynamic>? proposedChanges,  String? message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateRequestParams() when $default != null:
return $default(_that.fileId,_that.requestType,_that.proposedChanges,_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'file_id')  int fileId, @JsonKey(name: 'request_type')  String requestType, @JsonKey(name: 'proposed_changes')  Map<String, dynamic>? proposedChanges,  String? message)  $default,) {final _that = this;
switch (_that) {
case _CreateRequestParams():
return $default(_that.fileId,_that.requestType,_that.proposedChanges,_that.message);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'file_id')  int fileId, @JsonKey(name: 'request_type')  String requestType, @JsonKey(name: 'proposed_changes')  Map<String, dynamic>? proposedChanges,  String? message)?  $default,) {final _that = this;
switch (_that) {
case _CreateRequestParams() when $default != null:
return $default(_that.fileId,_that.requestType,_that.proposedChanges,_that.message);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateRequestParams implements CreateRequestParams {
  const _CreateRequestParams({@JsonKey(name: 'file_id') required this.fileId, @JsonKey(name: 'request_type') required this.requestType, @JsonKey(name: 'proposed_changes') final  Map<String, dynamic>? proposedChanges, this.message}): _proposedChanges = proposedChanges;
  factory _CreateRequestParams.fromJson(Map<String, dynamic> json) => _$CreateRequestParamsFromJson(json);

@override@JsonKey(name: 'file_id') final  int fileId;
@override@JsonKey(name: 'request_type') final  String requestType;
 final  Map<String, dynamic>? _proposedChanges;
@override@JsonKey(name: 'proposed_changes') Map<String, dynamic>? get proposedChanges {
  final value = _proposedChanges;
  if (value == null) return null;
  if (_proposedChanges is EqualUnmodifiableMapView) return _proposedChanges;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

@override final  String? message;

/// Create a copy of CreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateRequestParamsCopyWith<_CreateRequestParams> get copyWith => __$CreateRequestParamsCopyWithImpl<_CreateRequestParams>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateRequestParamsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateRequestParams&&(identical(other.fileId, fileId) || other.fileId == fileId)&&(identical(other.requestType, requestType) || other.requestType == requestType)&&const DeepCollectionEquality().equals(other._proposedChanges, _proposedChanges)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fileId,requestType,const DeepCollectionEquality().hash(_proposedChanges),message);

@override
String toString() {
  return 'CreateRequestParams(fileId: $fileId, requestType: $requestType, proposedChanges: $proposedChanges, message: $message)';
}


}

/// @nodoc
abstract mixin class _$CreateRequestParamsCopyWith<$Res> implements $CreateRequestParamsCopyWith<$Res> {
  factory _$CreateRequestParamsCopyWith(_CreateRequestParams value, $Res Function(_CreateRequestParams) _then) = __$CreateRequestParamsCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'file_id') int fileId,@JsonKey(name: 'request_type') String requestType,@JsonKey(name: 'proposed_changes') Map<String, dynamic>? proposedChanges, String? message
});




}
/// @nodoc
class __$CreateRequestParamsCopyWithImpl<$Res>
    implements _$CreateRequestParamsCopyWith<$Res> {
  __$CreateRequestParamsCopyWithImpl(this._self, this._then);

  final _CreateRequestParams _self;
  final $Res Function(_CreateRequestParams) _then;

/// Create a copy of CreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fileId = null,Object? requestType = null,Object? proposedChanges = freezed,Object? message = freezed,}) {
  return _then(_CreateRequestParams(
fileId: null == fileId ? _self.fileId : fileId // ignore: cast_nullable_to_non_nullable
as int,requestType: null == requestType ? _self.requestType : requestType // ignore: cast_nullable_to_non_nullable
as String,proposedChanges: freezed == proposedChanges ? _self._proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>?,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CreateDirectoryRequestParams {

@JsonKey(name: 'activity_date') String get activityDate;@JsonKey(name: 'activity_name') String get activityName;@JsonKey(name: 'activity_type') String get activityType;@JsonKey(name: 'proposed_changes') Map<String, dynamic> get proposedChanges; String? get message;
/// Create a copy of CreateDirectoryRequestParams
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateDirectoryRequestParamsCopyWith<CreateDirectoryRequestParams> get copyWith => _$CreateDirectoryRequestParamsCopyWithImpl<CreateDirectoryRequestParams>(this as CreateDirectoryRequestParams, _$identity);

  /// Serializes this CreateDirectoryRequestParams to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateDirectoryRequestParams&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&const DeepCollectionEquality().equals(other.proposedChanges, proposedChanges)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityName,activityType,const DeepCollectionEquality().hash(proposedChanges),message);

@override
String toString() {
  return 'CreateDirectoryRequestParams(activityDate: $activityDate, activityName: $activityName, activityType: $activityType, proposedChanges: $proposedChanges, message: $message)';
}


}

/// @nodoc
abstract mixin class $CreateDirectoryRequestParamsCopyWith<$Res>  {
  factory $CreateDirectoryRequestParamsCopyWith(CreateDirectoryRequestParams value, $Res Function(CreateDirectoryRequestParams) _then) = _$CreateDirectoryRequestParamsCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_name') String activityName,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'proposed_changes') Map<String, dynamic> proposedChanges, String? message
});




}
/// @nodoc
class _$CreateDirectoryRequestParamsCopyWithImpl<$Res>
    implements $CreateDirectoryRequestParamsCopyWith<$Res> {
  _$CreateDirectoryRequestParamsCopyWithImpl(this._self, this._then);

  final CreateDirectoryRequestParams _self;
  final $Res Function(CreateDirectoryRequestParams) _then;

/// Create a copy of CreateDirectoryRequestParams
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? activityDate = null,Object? activityName = null,Object? activityType = null,Object? proposedChanges = null,Object? message = freezed,}) {
  return _then(_self.copyWith(
activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityName: null == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,proposedChanges: null == proposedChanges ? _self.proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateDirectoryRequestParams].
extension CreateDirectoryRequestParamsPatterns on CreateDirectoryRequestParams {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateDirectoryRequestParams value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateDirectoryRequestParams() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateDirectoryRequestParams value)  $default,){
final _that = this;
switch (_that) {
case _CreateDirectoryRequestParams():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateDirectoryRequestParams value)?  $default,){
final _that = this;
switch (_that) {
case _CreateDirectoryRequestParams() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_name')  String activityName, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'proposed_changes')  Map<String, dynamic> proposedChanges,  String? message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateDirectoryRequestParams() when $default != null:
return $default(_that.activityDate,_that.activityName,_that.activityType,_that.proposedChanges,_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_name')  String activityName, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'proposed_changes')  Map<String, dynamic> proposedChanges,  String? message)  $default,) {final _that = this;
switch (_that) {
case _CreateDirectoryRequestParams():
return $default(_that.activityDate,_that.activityName,_that.activityType,_that.proposedChanges,_that.message);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'activity_date')  String activityDate, @JsonKey(name: 'activity_name')  String activityName, @JsonKey(name: 'activity_type')  String activityType, @JsonKey(name: 'proposed_changes')  Map<String, dynamic> proposedChanges,  String? message)?  $default,) {final _that = this;
switch (_that) {
case _CreateDirectoryRequestParams() when $default != null:
return $default(_that.activityDate,_that.activityName,_that.activityType,_that.proposedChanges,_that.message);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateDirectoryRequestParams implements CreateDirectoryRequestParams {
  const _CreateDirectoryRequestParams({@JsonKey(name: 'activity_date') required this.activityDate, @JsonKey(name: 'activity_name') required this.activityName, @JsonKey(name: 'activity_type') required this.activityType, @JsonKey(name: 'proposed_changes') required final  Map<String, dynamic> proposedChanges, this.message}): _proposedChanges = proposedChanges;
  factory _CreateDirectoryRequestParams.fromJson(Map<String, dynamic> json) => _$CreateDirectoryRequestParamsFromJson(json);

@override@JsonKey(name: 'activity_date') final  String activityDate;
@override@JsonKey(name: 'activity_name') final  String activityName;
@override@JsonKey(name: 'activity_type') final  String activityType;
 final  Map<String, dynamic> _proposedChanges;
@override@JsonKey(name: 'proposed_changes') Map<String, dynamic> get proposedChanges {
  if (_proposedChanges is EqualUnmodifiableMapView) return _proposedChanges;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_proposedChanges);
}

@override final  String? message;

/// Create a copy of CreateDirectoryRequestParams
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateDirectoryRequestParamsCopyWith<_CreateDirectoryRequestParams> get copyWith => __$CreateDirectoryRequestParamsCopyWithImpl<_CreateDirectoryRequestParams>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateDirectoryRequestParamsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateDirectoryRequestParams&&(identical(other.activityDate, activityDate) || other.activityDate == activityDate)&&(identical(other.activityName, activityName) || other.activityName == activityName)&&(identical(other.activityType, activityType) || other.activityType == activityType)&&const DeepCollectionEquality().equals(other._proposedChanges, _proposedChanges)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activityDate,activityName,activityType,const DeepCollectionEquality().hash(_proposedChanges),message);

@override
String toString() {
  return 'CreateDirectoryRequestParams(activityDate: $activityDate, activityName: $activityName, activityType: $activityType, proposedChanges: $proposedChanges, message: $message)';
}


}

/// @nodoc
abstract mixin class _$CreateDirectoryRequestParamsCopyWith<$Res> implements $CreateDirectoryRequestParamsCopyWith<$Res> {
  factory _$CreateDirectoryRequestParamsCopyWith(_CreateDirectoryRequestParams value, $Res Function(_CreateDirectoryRequestParams) _then) = __$CreateDirectoryRequestParamsCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'activity_date') String activityDate,@JsonKey(name: 'activity_name') String activityName,@JsonKey(name: 'activity_type') String activityType,@JsonKey(name: 'proposed_changes') Map<String, dynamic> proposedChanges, String? message
});




}
/// @nodoc
class __$CreateDirectoryRequestParamsCopyWithImpl<$Res>
    implements _$CreateDirectoryRequestParamsCopyWith<$Res> {
  __$CreateDirectoryRequestParamsCopyWithImpl(this._self, this._then);

  final _CreateDirectoryRequestParams _self;
  final $Res Function(_CreateDirectoryRequestParams) _then;

/// Create a copy of CreateDirectoryRequestParams
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? activityDate = null,Object? activityName = null,Object? activityType = null,Object? proposedChanges = null,Object? message = freezed,}) {
  return _then(_CreateDirectoryRequestParams(
activityDate: null == activityDate ? _self.activityDate : activityDate // ignore: cast_nullable_to_non_nullable
as String,activityName: null == activityName ? _self.activityName : activityName // ignore: cast_nullable_to_non_nullable
as String,activityType: null == activityType ? _self.activityType : activityType // ignore: cast_nullable_to_non_nullable
as String,proposedChanges: null == proposedChanges ? _self._proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$BatchCreateRequestParams {

@JsonKey(name: 'file_ids') List<int> get fileIds;@JsonKey(name: 'proposed_changes') Map<String, dynamic> get proposedChanges;
/// Create a copy of BatchCreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BatchCreateRequestParamsCopyWith<BatchCreateRequestParams> get copyWith => _$BatchCreateRequestParamsCopyWithImpl<BatchCreateRequestParams>(this as BatchCreateRequestParams, _$identity);

  /// Serializes this BatchCreateRequestParams to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BatchCreateRequestParams&&const DeepCollectionEquality().equals(other.fileIds, fileIds)&&const DeepCollectionEquality().equals(other.proposedChanges, proposedChanges));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(fileIds),const DeepCollectionEquality().hash(proposedChanges));

@override
String toString() {
  return 'BatchCreateRequestParams(fileIds: $fileIds, proposedChanges: $proposedChanges)';
}


}

/// @nodoc
abstract mixin class $BatchCreateRequestParamsCopyWith<$Res>  {
  factory $BatchCreateRequestParamsCopyWith(BatchCreateRequestParams value, $Res Function(BatchCreateRequestParams) _then) = _$BatchCreateRequestParamsCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: 'file_ids') List<int> fileIds,@JsonKey(name: 'proposed_changes') Map<String, dynamic> proposedChanges
});




}
/// @nodoc
class _$BatchCreateRequestParamsCopyWithImpl<$Res>
    implements $BatchCreateRequestParamsCopyWith<$Res> {
  _$BatchCreateRequestParamsCopyWithImpl(this._self, this._then);

  final BatchCreateRequestParams _self;
  final $Res Function(BatchCreateRequestParams) _then;

/// Create a copy of BatchCreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fileIds = null,Object? proposedChanges = null,}) {
  return _then(_self.copyWith(
fileIds: null == fileIds ? _self.fileIds : fileIds // ignore: cast_nullable_to_non_nullable
as List<int>,proposedChanges: null == proposedChanges ? _self.proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,
  ));
}

}


/// Adds pattern-matching-related methods to [BatchCreateRequestParams].
extension BatchCreateRequestParamsPatterns on BatchCreateRequestParams {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BatchCreateRequestParams value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BatchCreateRequestParams() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BatchCreateRequestParams value)  $default,){
final _that = this;
switch (_that) {
case _BatchCreateRequestParams():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BatchCreateRequestParams value)?  $default,){
final _that = this;
switch (_that) {
case _BatchCreateRequestParams() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: 'file_ids')  List<int> fileIds, @JsonKey(name: 'proposed_changes')  Map<String, dynamic> proposedChanges)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BatchCreateRequestParams() when $default != null:
return $default(_that.fileIds,_that.proposedChanges);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: 'file_ids')  List<int> fileIds, @JsonKey(name: 'proposed_changes')  Map<String, dynamic> proposedChanges)  $default,) {final _that = this;
switch (_that) {
case _BatchCreateRequestParams():
return $default(_that.fileIds,_that.proposedChanges);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: 'file_ids')  List<int> fileIds, @JsonKey(name: 'proposed_changes')  Map<String, dynamic> proposedChanges)?  $default,) {final _that = this;
switch (_that) {
case _BatchCreateRequestParams() when $default != null:
return $default(_that.fileIds,_that.proposedChanges);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BatchCreateRequestParams implements BatchCreateRequestParams {
  const _BatchCreateRequestParams({@JsonKey(name: 'file_ids') required final  List<int> fileIds, @JsonKey(name: 'proposed_changes') required final  Map<String, dynamic> proposedChanges}): _fileIds = fileIds,_proposedChanges = proposedChanges;
  factory _BatchCreateRequestParams.fromJson(Map<String, dynamic> json) => _$BatchCreateRequestParamsFromJson(json);

 final  List<int> _fileIds;
@override@JsonKey(name: 'file_ids') List<int> get fileIds {
  if (_fileIds is EqualUnmodifiableListView) return _fileIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_fileIds);
}

 final  Map<String, dynamic> _proposedChanges;
@override@JsonKey(name: 'proposed_changes') Map<String, dynamic> get proposedChanges {
  if (_proposedChanges is EqualUnmodifiableMapView) return _proposedChanges;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_proposedChanges);
}


/// Create a copy of BatchCreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BatchCreateRequestParamsCopyWith<_BatchCreateRequestParams> get copyWith => __$BatchCreateRequestParamsCopyWithImpl<_BatchCreateRequestParams>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BatchCreateRequestParamsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BatchCreateRequestParams&&const DeepCollectionEquality().equals(other._fileIds, _fileIds)&&const DeepCollectionEquality().equals(other._proposedChanges, _proposedChanges));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_fileIds),const DeepCollectionEquality().hash(_proposedChanges));

@override
String toString() {
  return 'BatchCreateRequestParams(fileIds: $fileIds, proposedChanges: $proposedChanges)';
}


}

/// @nodoc
abstract mixin class _$BatchCreateRequestParamsCopyWith<$Res> implements $BatchCreateRequestParamsCopyWith<$Res> {
  factory _$BatchCreateRequestParamsCopyWith(_BatchCreateRequestParams value, $Res Function(_BatchCreateRequestParams) _then) = __$BatchCreateRequestParamsCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: 'file_ids') List<int> fileIds,@JsonKey(name: 'proposed_changes') Map<String, dynamic> proposedChanges
});




}
/// @nodoc
class __$BatchCreateRequestParamsCopyWithImpl<$Res>
    implements _$BatchCreateRequestParamsCopyWith<$Res> {
  __$BatchCreateRequestParamsCopyWithImpl(this._self, this._then);

  final _BatchCreateRequestParams _self;
  final $Res Function(_BatchCreateRequestParams) _then;

/// Create a copy of BatchCreateRequestParams
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fileIds = null,Object? proposedChanges = null,}) {
  return _then(_BatchCreateRequestParams(
fileIds: null == fileIds ? _self._fileIds : fileIds // ignore: cast_nullable_to_non_nullable
as List<int>,proposedChanges: null == proposedChanges ? _self._proposedChanges : proposedChanges // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,
  ));
}


}

// dart format on
