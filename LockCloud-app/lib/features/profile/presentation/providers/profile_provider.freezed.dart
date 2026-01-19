// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'profile_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$AvatarUploadState {





@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AvatarUploadState);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'AvatarUploadState()';
}


}

/// @nodoc
class $AvatarUploadStateCopyWith<$Res>  {
$AvatarUploadStateCopyWith(AvatarUploadState _, $Res Function(AvatarUploadState) __);
}


/// Adds pattern-matching-related methods to [AvatarUploadState].
extension AvatarUploadStatePatterns on AvatarUploadState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>({TResult Function( AvatarUploadStateInitial value)?  initial,TResult Function( AvatarUploadStateUploading value)?  uploading,TResult Function( AvatarUploadStateSuccess value)?  success,TResult Function( AvatarUploadStateError value)?  error,required TResult orElse(),}){
final _that = this;
switch (_that) {
case AvatarUploadStateInitial() when initial != null:
return initial(_that);case AvatarUploadStateUploading() when uploading != null:
return uploading(_that);case AvatarUploadStateSuccess() when success != null:
return success(_that);case AvatarUploadStateError() when error != null:
return error(_that);case _:
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

@optionalTypeArgs TResult map<TResult extends Object?>({required TResult Function( AvatarUploadStateInitial value)  initial,required TResult Function( AvatarUploadStateUploading value)  uploading,required TResult Function( AvatarUploadStateSuccess value)  success,required TResult Function( AvatarUploadStateError value)  error,}){
final _that = this;
switch (_that) {
case AvatarUploadStateInitial():
return initial(_that);case AvatarUploadStateUploading():
return uploading(_that);case AvatarUploadStateSuccess():
return success(_that);case AvatarUploadStateError():
return error(_that);}
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>({TResult? Function( AvatarUploadStateInitial value)?  initial,TResult? Function( AvatarUploadStateUploading value)?  uploading,TResult? Function( AvatarUploadStateSuccess value)?  success,TResult? Function( AvatarUploadStateError value)?  error,}){
final _that = this;
switch (_that) {
case AvatarUploadStateInitial() when initial != null:
return initial(_that);case AvatarUploadStateUploading() when uploading != null:
return uploading(_that);case AvatarUploadStateSuccess() when success != null:
return success(_that);case AvatarUploadStateError() when error != null:
return error(_that);case _:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>({TResult Function()?  initial,TResult Function( double progress)?  uploading,TResult Function( User user)?  success,TResult Function( String message)?  error,required TResult orElse(),}) {final _that = this;
switch (_that) {
case AvatarUploadStateInitial() when initial != null:
return initial();case AvatarUploadStateUploading() when uploading != null:
return uploading(_that.progress);case AvatarUploadStateSuccess() when success != null:
return success(_that.user);case AvatarUploadStateError() when error != null:
return error(_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>({required TResult Function()  initial,required TResult Function( double progress)  uploading,required TResult Function( User user)  success,required TResult Function( String message)  error,}) {final _that = this;
switch (_that) {
case AvatarUploadStateInitial():
return initial();case AvatarUploadStateUploading():
return uploading(_that.progress);case AvatarUploadStateSuccess():
return success(_that.user);case AvatarUploadStateError():
return error(_that.message);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>({TResult? Function()?  initial,TResult? Function( double progress)?  uploading,TResult? Function( User user)?  success,TResult? Function( String message)?  error,}) {final _that = this;
switch (_that) {
case AvatarUploadStateInitial() when initial != null:
return initial();case AvatarUploadStateUploading() when uploading != null:
return uploading(_that.progress);case AvatarUploadStateSuccess() when success != null:
return success(_that.user);case AvatarUploadStateError() when error != null:
return error(_that.message);case _:
  return null;

}
}

}

/// @nodoc


class AvatarUploadStateInitial implements AvatarUploadState {
  const AvatarUploadStateInitial();
  






@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AvatarUploadStateInitial);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'AvatarUploadState.initial()';
}


}




/// @nodoc


class AvatarUploadStateUploading implements AvatarUploadState {
  const AvatarUploadStateUploading({this.progress = 0.0});
  

@JsonKey() final  double progress;

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AvatarUploadStateUploadingCopyWith<AvatarUploadStateUploading> get copyWith => _$AvatarUploadStateUploadingCopyWithImpl<AvatarUploadStateUploading>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AvatarUploadStateUploading&&(identical(other.progress, progress) || other.progress == progress));
}


@override
int get hashCode => Object.hash(runtimeType,progress);

@override
String toString() {
  return 'AvatarUploadState.uploading(progress: $progress)';
}


}

/// @nodoc
abstract mixin class $AvatarUploadStateUploadingCopyWith<$Res> implements $AvatarUploadStateCopyWith<$Res> {
  factory $AvatarUploadStateUploadingCopyWith(AvatarUploadStateUploading value, $Res Function(AvatarUploadStateUploading) _then) = _$AvatarUploadStateUploadingCopyWithImpl;
@useResult
$Res call({
 double progress
});




}
/// @nodoc
class _$AvatarUploadStateUploadingCopyWithImpl<$Res>
    implements $AvatarUploadStateUploadingCopyWith<$Res> {
  _$AvatarUploadStateUploadingCopyWithImpl(this._self, this._then);

  final AvatarUploadStateUploading _self;
  final $Res Function(AvatarUploadStateUploading) _then;

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? progress = null,}) {
  return _then(AvatarUploadStateUploading(
progress: null == progress ? _self.progress : progress // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}

/// @nodoc


class AvatarUploadStateSuccess implements AvatarUploadState {
  const AvatarUploadStateSuccess({required this.user});
  

 final  User user;

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AvatarUploadStateSuccessCopyWith<AvatarUploadStateSuccess> get copyWith => _$AvatarUploadStateSuccessCopyWithImpl<AvatarUploadStateSuccess>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AvatarUploadStateSuccess&&(identical(other.user, user) || other.user == user));
}


@override
int get hashCode => Object.hash(runtimeType,user);

@override
String toString() {
  return 'AvatarUploadState.success(user: $user)';
}


}

/// @nodoc
abstract mixin class $AvatarUploadStateSuccessCopyWith<$Res> implements $AvatarUploadStateCopyWith<$Res> {
  factory $AvatarUploadStateSuccessCopyWith(AvatarUploadStateSuccess value, $Res Function(AvatarUploadStateSuccess) _then) = _$AvatarUploadStateSuccessCopyWithImpl;
@useResult
$Res call({
 User user
});


$UserCopyWith<$Res> get user;

}
/// @nodoc
class _$AvatarUploadStateSuccessCopyWithImpl<$Res>
    implements $AvatarUploadStateSuccessCopyWith<$Res> {
  _$AvatarUploadStateSuccessCopyWithImpl(this._self, this._then);

  final AvatarUploadStateSuccess _self;
  final $Res Function(AvatarUploadStateSuccess) _then;

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? user = null,}) {
  return _then(AvatarUploadStateSuccess(
user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as User,
  ));
}

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UserCopyWith<$Res> get user {
  
  return $UserCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}

/// @nodoc


class AvatarUploadStateError implements AvatarUploadState {
  const AvatarUploadStateError({required this.message});
  

 final  String message;

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AvatarUploadStateErrorCopyWith<AvatarUploadStateError> get copyWith => _$AvatarUploadStateErrorCopyWithImpl<AvatarUploadStateError>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AvatarUploadStateError&&(identical(other.message, message) || other.message == message));
}


@override
int get hashCode => Object.hash(runtimeType,message);

@override
String toString() {
  return 'AvatarUploadState.error(message: $message)';
}


}

/// @nodoc
abstract mixin class $AvatarUploadStateErrorCopyWith<$Res> implements $AvatarUploadStateCopyWith<$Res> {
  factory $AvatarUploadStateErrorCopyWith(AvatarUploadStateError value, $Res Function(AvatarUploadStateError) _then) = _$AvatarUploadStateErrorCopyWithImpl;
@useResult
$Res call({
 String message
});




}
/// @nodoc
class _$AvatarUploadStateErrorCopyWithImpl<$Res>
    implements $AvatarUploadStateErrorCopyWith<$Res> {
  _$AvatarUploadStateErrorCopyWithImpl(this._self, this._then);

  final AvatarUploadStateError _self;
  final $Res Function(AvatarUploadStateError) _then;

/// Create a copy of AvatarUploadState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? message = null,}) {
  return _then(AvatarUploadStateError(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
