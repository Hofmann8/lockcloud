// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$AuthState {





@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuthState);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'AuthState()';
}


}

/// @nodoc
class $AuthStateCopyWith<$Res>  {
$AuthStateCopyWith(AuthState _, $Res Function(AuthState) __);
}


/// Adds pattern-matching-related methods to [AuthState].
extension AuthStatePatterns on AuthState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>({TResult Function( AuthStateInitial value)?  initial,TResult Function( AuthStateLoading value)?  loading,TResult Function( AuthStateAuthenticated value)?  authenticated,TResult Function( AuthStateUnauthenticated value)?  unauthenticated,TResult Function( AuthStateError value)?  error,required TResult orElse(),}){
final _that = this;
switch (_that) {
case AuthStateInitial() when initial != null:
return initial(_that);case AuthStateLoading() when loading != null:
return loading(_that);case AuthStateAuthenticated() when authenticated != null:
return authenticated(_that);case AuthStateUnauthenticated() when unauthenticated != null:
return unauthenticated(_that);case AuthStateError() when error != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>({required TResult Function( AuthStateInitial value)  initial,required TResult Function( AuthStateLoading value)  loading,required TResult Function( AuthStateAuthenticated value)  authenticated,required TResult Function( AuthStateUnauthenticated value)  unauthenticated,required TResult Function( AuthStateError value)  error,}){
final _that = this;
switch (_that) {
case AuthStateInitial():
return initial(_that);case AuthStateLoading():
return loading(_that);case AuthStateAuthenticated():
return authenticated(_that);case AuthStateUnauthenticated():
return unauthenticated(_that);case AuthStateError():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>({TResult? Function( AuthStateInitial value)?  initial,TResult? Function( AuthStateLoading value)?  loading,TResult? Function( AuthStateAuthenticated value)?  authenticated,TResult? Function( AuthStateUnauthenticated value)?  unauthenticated,TResult? Function( AuthStateError value)?  error,}){
final _that = this;
switch (_that) {
case AuthStateInitial() when initial != null:
return initial(_that);case AuthStateLoading() when loading != null:
return loading(_that);case AuthStateAuthenticated() when authenticated != null:
return authenticated(_that);case AuthStateUnauthenticated() when unauthenticated != null:
return unauthenticated(_that);case AuthStateError() when error != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>({TResult Function()?  initial,TResult Function()?  loading,TResult Function( User user,  String token)?  authenticated,TResult Function()?  unauthenticated,TResult Function( String message,  String? code)?  error,required TResult orElse(),}) {final _that = this;
switch (_that) {
case AuthStateInitial() when initial != null:
return initial();case AuthStateLoading() when loading != null:
return loading();case AuthStateAuthenticated() when authenticated != null:
return authenticated(_that.user,_that.token);case AuthStateUnauthenticated() when unauthenticated != null:
return unauthenticated();case AuthStateError() when error != null:
return error(_that.message,_that.code);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>({required TResult Function()  initial,required TResult Function()  loading,required TResult Function( User user,  String token)  authenticated,required TResult Function()  unauthenticated,required TResult Function( String message,  String? code)  error,}) {final _that = this;
switch (_that) {
case AuthStateInitial():
return initial();case AuthStateLoading():
return loading();case AuthStateAuthenticated():
return authenticated(_that.user,_that.token);case AuthStateUnauthenticated():
return unauthenticated();case AuthStateError():
return error(_that.message,_that.code);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>({TResult? Function()?  initial,TResult? Function()?  loading,TResult? Function( User user,  String token)?  authenticated,TResult? Function()?  unauthenticated,TResult? Function( String message,  String? code)?  error,}) {final _that = this;
switch (_that) {
case AuthStateInitial() when initial != null:
return initial();case AuthStateLoading() when loading != null:
return loading();case AuthStateAuthenticated() when authenticated != null:
return authenticated(_that.user,_that.token);case AuthStateUnauthenticated() when unauthenticated != null:
return unauthenticated();case AuthStateError() when error != null:
return error(_that.message,_that.code);case _:
  return null;

}
}

}

/// @nodoc


class AuthStateInitial implements AuthState {
  const AuthStateInitial();
  






@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuthStateInitial);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'AuthState.initial()';
}


}




/// @nodoc


class AuthStateLoading implements AuthState {
  const AuthStateLoading();
  






@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuthStateLoading);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'AuthState.loading()';
}


}




/// @nodoc


class AuthStateAuthenticated implements AuthState {
  const AuthStateAuthenticated({required this.user, required this.token});
  

 final  User user;
 final  String token;

/// Create a copy of AuthState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AuthStateAuthenticatedCopyWith<AuthStateAuthenticated> get copyWith => _$AuthStateAuthenticatedCopyWithImpl<AuthStateAuthenticated>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuthStateAuthenticated&&(identical(other.user, user) || other.user == user)&&(identical(other.token, token) || other.token == token));
}


@override
int get hashCode => Object.hash(runtimeType,user,token);

@override
String toString() {
  return 'AuthState.authenticated(user: $user, token: $token)';
}


}

/// @nodoc
abstract mixin class $AuthStateAuthenticatedCopyWith<$Res> implements $AuthStateCopyWith<$Res> {
  factory $AuthStateAuthenticatedCopyWith(AuthStateAuthenticated value, $Res Function(AuthStateAuthenticated) _then) = _$AuthStateAuthenticatedCopyWithImpl;
@useResult
$Res call({
 User user, String token
});


$UserCopyWith<$Res> get user;

}
/// @nodoc
class _$AuthStateAuthenticatedCopyWithImpl<$Res>
    implements $AuthStateAuthenticatedCopyWith<$Res> {
  _$AuthStateAuthenticatedCopyWithImpl(this._self, this._then);

  final AuthStateAuthenticated _self;
  final $Res Function(AuthStateAuthenticated) _then;

/// Create a copy of AuthState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? user = null,Object? token = null,}) {
  return _then(AuthStateAuthenticated(
user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as User,token: null == token ? _self.token : token // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

/// Create a copy of AuthState
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


class AuthStateUnauthenticated implements AuthState {
  const AuthStateUnauthenticated();
  






@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuthStateUnauthenticated);
}


@override
int get hashCode => runtimeType.hashCode;

@override
String toString() {
  return 'AuthState.unauthenticated()';
}


}




/// @nodoc


class AuthStateError implements AuthState {
  const AuthStateError({required this.message, this.code});
  

 final  String message;
 final  String? code;

/// Create a copy of AuthState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AuthStateErrorCopyWith<AuthStateError> get copyWith => _$AuthStateErrorCopyWithImpl<AuthStateError>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuthStateError&&(identical(other.message, message) || other.message == message)&&(identical(other.code, code) || other.code == code));
}


@override
int get hashCode => Object.hash(runtimeType,message,code);

@override
String toString() {
  return 'AuthState.error(message: $message, code: $code)';
}


}

/// @nodoc
abstract mixin class $AuthStateErrorCopyWith<$Res> implements $AuthStateCopyWith<$Res> {
  factory $AuthStateErrorCopyWith(AuthStateError value, $Res Function(AuthStateError) _then) = _$AuthStateErrorCopyWithImpl;
@useResult
$Res call({
 String message, String? code
});




}
/// @nodoc
class _$AuthStateErrorCopyWithImpl<$Res>
    implements $AuthStateErrorCopyWith<$Res> {
  _$AuthStateErrorCopyWithImpl(this._self, this._then);

  final AuthStateError _self;
  final $Res Function(AuthStateError) _then;

/// Create a copy of AuthState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') $Res call({Object? message = null,Object? code = freezed,}) {
  return _then(AuthStateError(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,code: freezed == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
