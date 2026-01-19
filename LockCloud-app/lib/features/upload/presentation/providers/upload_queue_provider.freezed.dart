// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'upload_queue_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$UploadQueueState {

/// 上传队列项列表
 List<UploadQueueItem> get items;/// 是否正在处理队列
 bool get isProcessing;/// 当前正在上传的项 ID
 String? get currentUploadId;/// 全局错误信息
 String? get error;
/// Create a copy of UploadQueueState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UploadQueueStateCopyWith<UploadQueueState> get copyWith => _$UploadQueueStateCopyWithImpl<UploadQueueState>(this as UploadQueueState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UploadQueueState&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.isProcessing, isProcessing) || other.isProcessing == isProcessing)&&(identical(other.currentUploadId, currentUploadId) || other.currentUploadId == currentUploadId)&&(identical(other.error, error) || other.error == error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(items),isProcessing,currentUploadId,error);

@override
String toString() {
  return 'UploadQueueState(items: $items, isProcessing: $isProcessing, currentUploadId: $currentUploadId, error: $error)';
}


}

/// @nodoc
abstract mixin class $UploadQueueStateCopyWith<$Res>  {
  factory $UploadQueueStateCopyWith(UploadQueueState value, $Res Function(UploadQueueState) _then) = _$UploadQueueStateCopyWithImpl;
@useResult
$Res call({
 List<UploadQueueItem> items, bool isProcessing, String? currentUploadId, String? error
});




}
/// @nodoc
class _$UploadQueueStateCopyWithImpl<$Res>
    implements $UploadQueueStateCopyWith<$Res> {
  _$UploadQueueStateCopyWithImpl(this._self, this._then);

  final UploadQueueState _self;
  final $Res Function(UploadQueueState) _then;

/// Create a copy of UploadQueueState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? isProcessing = null,Object? currentUploadId = freezed,Object? error = freezed,}) {
  return _then(_self.copyWith(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<UploadQueueItem>,isProcessing: null == isProcessing ? _self.isProcessing : isProcessing // ignore: cast_nullable_to_non_nullable
as bool,currentUploadId: freezed == currentUploadId ? _self.currentUploadId : currentUploadId // ignore: cast_nullable_to_non_nullable
as String?,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [UploadQueueState].
extension UploadQueueStatePatterns on UploadQueueState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UploadQueueState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UploadQueueState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UploadQueueState value)  $default,){
final _that = this;
switch (_that) {
case _UploadQueueState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UploadQueueState value)?  $default,){
final _that = this;
switch (_that) {
case _UploadQueueState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<UploadQueueItem> items,  bool isProcessing,  String? currentUploadId,  String? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UploadQueueState() when $default != null:
return $default(_that.items,_that.isProcessing,_that.currentUploadId,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<UploadQueueItem> items,  bool isProcessing,  String? currentUploadId,  String? error)  $default,) {final _that = this;
switch (_that) {
case _UploadQueueState():
return $default(_that.items,_that.isProcessing,_that.currentUploadId,_that.error);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<UploadQueueItem> items,  bool isProcessing,  String? currentUploadId,  String? error)?  $default,) {final _that = this;
switch (_that) {
case _UploadQueueState() when $default != null:
return $default(_that.items,_that.isProcessing,_that.currentUploadId,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _UploadQueueState implements UploadQueueState {
  const _UploadQueueState({final  List<UploadQueueItem> items = const [], this.isProcessing = false, this.currentUploadId, this.error}): _items = items;
  

/// 上传队列项列表
 final  List<UploadQueueItem> _items;
/// 上传队列项列表
@override@JsonKey() List<UploadQueueItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

/// 是否正在处理队列
@override@JsonKey() final  bool isProcessing;
/// 当前正在上传的项 ID
@override final  String? currentUploadId;
/// 全局错误信息
@override final  String? error;

/// Create a copy of UploadQueueState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UploadQueueStateCopyWith<_UploadQueueState> get copyWith => __$UploadQueueStateCopyWithImpl<_UploadQueueState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UploadQueueState&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.isProcessing, isProcessing) || other.isProcessing == isProcessing)&&(identical(other.currentUploadId, currentUploadId) || other.currentUploadId == currentUploadId)&&(identical(other.error, error) || other.error == error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),isProcessing,currentUploadId,error);

@override
String toString() {
  return 'UploadQueueState(items: $items, isProcessing: $isProcessing, currentUploadId: $currentUploadId, error: $error)';
}


}

/// @nodoc
abstract mixin class _$UploadQueueStateCopyWith<$Res> implements $UploadQueueStateCopyWith<$Res> {
  factory _$UploadQueueStateCopyWith(_UploadQueueState value, $Res Function(_UploadQueueState) _then) = __$UploadQueueStateCopyWithImpl;
@override @useResult
$Res call({
 List<UploadQueueItem> items, bool isProcessing, String? currentUploadId, String? error
});




}
/// @nodoc
class __$UploadQueueStateCopyWithImpl<$Res>
    implements _$UploadQueueStateCopyWith<$Res> {
  __$UploadQueueStateCopyWithImpl(this._self, this._then);

  final _UploadQueueState _self;
  final $Res Function(_UploadQueueState) _then;

/// Create a copy of UploadQueueState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? isProcessing = null,Object? currentUploadId = freezed,Object? error = freezed,}) {
  return _then(_UploadQueueState(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<UploadQueueItem>,isProcessing: null == isProcessing ? _self.isProcessing : isProcessing // ignore: cast_nullable_to_non_nullable
as bool,currentUploadId: freezed == currentUploadId ? _self.currentUploadId : currentUploadId // ignore: cast_nullable_to_non_nullable
as String?,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
