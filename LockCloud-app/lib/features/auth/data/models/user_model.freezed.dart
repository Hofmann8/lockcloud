// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'user_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$User {

/// 用户唯一标识符
 int get id;/// 用户邮箱地址
 String get email;/// 用户姓名
 String get name;/// 头像在 S3 中的 key
@JsonKey(name: 'avatar_key') String? get avatarKey;/// 头像完整 URL
@JsonKey(name: 'avatar_url') String? get avatarUrl;/// 账号创建时间
@JsonKey(name: 'created_at') DateTime get createdAt;/// 最后登录时间
@JsonKey(name: 'last_login') DateTime? get lastLogin;/// 账号是否激活
@JsonKey(name: 'is_active') bool get isActive;/// 是否为管理员
@JsonKey(name: 'is_admin') bool get isAdmin;
/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UserCopyWith<User> get copyWith => _$UserCopyWithImpl<User>(this as User, _$identity);

  /// Serializes this User to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is User&&(identical(other.id, id) || other.id == id)&&(identical(other.email, email) || other.email == email)&&(identical(other.name, name) || other.name == name)&&(identical(other.avatarKey, avatarKey) || other.avatarKey == avatarKey)&&(identical(other.avatarUrl, avatarUrl) || other.avatarUrl == avatarUrl)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.lastLogin, lastLogin) || other.lastLogin == lastLogin)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.isAdmin, isAdmin) || other.isAdmin == isAdmin));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,email,name,avatarKey,avatarUrl,createdAt,lastLogin,isActive,isAdmin);

@override
String toString() {
  return 'User(id: $id, email: $email, name: $name, avatarKey: $avatarKey, avatarUrl: $avatarUrl, createdAt: $createdAt, lastLogin: $lastLogin, isActive: $isActive, isAdmin: $isAdmin)';
}


}

/// @nodoc
abstract mixin class $UserCopyWith<$Res>  {
  factory $UserCopyWith(User value, $Res Function(User) _then) = _$UserCopyWithImpl;
@useResult
$Res call({
 int id, String email, String name,@JsonKey(name: 'avatar_key') String? avatarKey,@JsonKey(name: 'avatar_url') String? avatarUrl,@JsonKey(name: 'created_at') DateTime createdAt,@JsonKey(name: 'last_login') DateTime? lastLogin,@JsonKey(name: 'is_active') bool isActive,@JsonKey(name: 'is_admin') bool isAdmin
});




}
/// @nodoc
class _$UserCopyWithImpl<$Res>
    implements $UserCopyWith<$Res> {
  _$UserCopyWithImpl(this._self, this._then);

  final User _self;
  final $Res Function(User) _then;

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? email = null,Object? name = null,Object? avatarKey = freezed,Object? avatarUrl = freezed,Object? createdAt = null,Object? lastLogin = freezed,Object? isActive = null,Object? isAdmin = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,avatarKey: freezed == avatarKey ? _self.avatarKey : avatarKey // ignore: cast_nullable_to_non_nullable
as String?,avatarUrl: freezed == avatarUrl ? _self.avatarUrl : avatarUrl // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,lastLogin: freezed == lastLogin ? _self.lastLogin : lastLogin // ignore: cast_nullable_to_non_nullable
as DateTime?,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,isAdmin: null == isAdmin ? _self.isAdmin : isAdmin // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [User].
extension UserPatterns on User {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _User value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _User() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _User value)  $default,){
final _that = this;
switch (_that) {
case _User():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _User value)?  $default,){
final _that = this;
switch (_that) {
case _User() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String email,  String name, @JsonKey(name: 'avatar_key')  String? avatarKey, @JsonKey(name: 'avatar_url')  String? avatarUrl, @JsonKey(name: 'created_at')  DateTime createdAt, @JsonKey(name: 'last_login')  DateTime? lastLogin, @JsonKey(name: 'is_active')  bool isActive, @JsonKey(name: 'is_admin')  bool isAdmin)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _User() when $default != null:
return $default(_that.id,_that.email,_that.name,_that.avatarKey,_that.avatarUrl,_that.createdAt,_that.lastLogin,_that.isActive,_that.isAdmin);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String email,  String name, @JsonKey(name: 'avatar_key')  String? avatarKey, @JsonKey(name: 'avatar_url')  String? avatarUrl, @JsonKey(name: 'created_at')  DateTime createdAt, @JsonKey(name: 'last_login')  DateTime? lastLogin, @JsonKey(name: 'is_active')  bool isActive, @JsonKey(name: 'is_admin')  bool isAdmin)  $default,) {final _that = this;
switch (_that) {
case _User():
return $default(_that.id,_that.email,_that.name,_that.avatarKey,_that.avatarUrl,_that.createdAt,_that.lastLogin,_that.isActive,_that.isAdmin);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String email,  String name, @JsonKey(name: 'avatar_key')  String? avatarKey, @JsonKey(name: 'avatar_url')  String? avatarUrl, @JsonKey(name: 'created_at')  DateTime createdAt, @JsonKey(name: 'last_login')  DateTime? lastLogin, @JsonKey(name: 'is_active')  bool isActive, @JsonKey(name: 'is_admin')  bool isAdmin)?  $default,) {final _that = this;
switch (_that) {
case _User() when $default != null:
return $default(_that.id,_that.email,_that.name,_that.avatarKey,_that.avatarUrl,_that.createdAt,_that.lastLogin,_that.isActive,_that.isAdmin);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _User implements User {
  const _User({required this.id, required this.email, required this.name, @JsonKey(name: 'avatar_key') this.avatarKey, @JsonKey(name: 'avatar_url') this.avatarUrl, @JsonKey(name: 'created_at') required this.createdAt, @JsonKey(name: 'last_login') this.lastLogin, @JsonKey(name: 'is_active') required this.isActive, @JsonKey(name: 'is_admin') required this.isAdmin});
  factory _User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

/// 用户唯一标识符
@override final  int id;
/// 用户邮箱地址
@override final  String email;
/// 用户姓名
@override final  String name;
/// 头像在 S3 中的 key
@override@JsonKey(name: 'avatar_key') final  String? avatarKey;
/// 头像完整 URL
@override@JsonKey(name: 'avatar_url') final  String? avatarUrl;
/// 账号创建时间
@override@JsonKey(name: 'created_at') final  DateTime createdAt;
/// 最后登录时间
@override@JsonKey(name: 'last_login') final  DateTime? lastLogin;
/// 账号是否激活
@override@JsonKey(name: 'is_active') final  bool isActive;
/// 是否为管理员
@override@JsonKey(name: 'is_admin') final  bool isAdmin;

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UserCopyWith<_User> get copyWith => __$UserCopyWithImpl<_User>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UserToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _User&&(identical(other.id, id) || other.id == id)&&(identical(other.email, email) || other.email == email)&&(identical(other.name, name) || other.name == name)&&(identical(other.avatarKey, avatarKey) || other.avatarKey == avatarKey)&&(identical(other.avatarUrl, avatarUrl) || other.avatarUrl == avatarUrl)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.lastLogin, lastLogin) || other.lastLogin == lastLogin)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.isAdmin, isAdmin) || other.isAdmin == isAdmin));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,email,name,avatarKey,avatarUrl,createdAt,lastLogin,isActive,isAdmin);

@override
String toString() {
  return 'User(id: $id, email: $email, name: $name, avatarKey: $avatarKey, avatarUrl: $avatarUrl, createdAt: $createdAt, lastLogin: $lastLogin, isActive: $isActive, isAdmin: $isAdmin)';
}


}

/// @nodoc
abstract mixin class _$UserCopyWith<$Res> implements $UserCopyWith<$Res> {
  factory _$UserCopyWith(_User value, $Res Function(_User) _then) = __$UserCopyWithImpl;
@override @useResult
$Res call({
 int id, String email, String name,@JsonKey(name: 'avatar_key') String? avatarKey,@JsonKey(name: 'avatar_url') String? avatarUrl,@JsonKey(name: 'created_at') DateTime createdAt,@JsonKey(name: 'last_login') DateTime? lastLogin,@JsonKey(name: 'is_active') bool isActive,@JsonKey(name: 'is_admin') bool isAdmin
});




}
/// @nodoc
class __$UserCopyWithImpl<$Res>
    implements _$UserCopyWith<$Res> {
  __$UserCopyWithImpl(this._self, this._then);

  final _User _self;
  final $Res Function(_User) _then;

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? email = null,Object? name = null,Object? avatarKey = freezed,Object? avatarUrl = freezed,Object? createdAt = null,Object? lastLogin = freezed,Object? isActive = null,Object? isAdmin = null,}) {
  return _then(_User(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,avatarKey: freezed == avatarKey ? _self.avatarKey : avatarKey // ignore: cast_nullable_to_non_nullable
as String?,avatarUrl: freezed == avatarUrl ? _self.avatarUrl : avatarUrl // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,lastLogin: freezed == lastLogin ? _self.lastLogin : lastLogin // ignore: cast_nullable_to_non_nullable
as DateTime?,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,isAdmin: null == isAdmin ? _self.isAdmin : isAdmin // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
