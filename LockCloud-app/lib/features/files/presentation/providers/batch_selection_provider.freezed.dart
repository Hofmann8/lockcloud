// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'batch_selection_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$BatchSelectionState {

/// 选中的文件 ID 集合
 Set<int> get selectedIds;/// 是否处于选择模式
 bool get isSelectionMode;/// 是否全选模式
 bool get isSelectAllMode;
/// Create a copy of BatchSelectionState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BatchSelectionStateCopyWith<BatchSelectionState> get copyWith => _$BatchSelectionStateCopyWithImpl<BatchSelectionState>(this as BatchSelectionState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BatchSelectionState&&const DeepCollectionEquality().equals(other.selectedIds, selectedIds)&&(identical(other.isSelectionMode, isSelectionMode) || other.isSelectionMode == isSelectionMode)&&(identical(other.isSelectAllMode, isSelectAllMode) || other.isSelectAllMode == isSelectAllMode));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(selectedIds),isSelectionMode,isSelectAllMode);

@override
String toString() {
  return 'BatchSelectionState(selectedIds: $selectedIds, isSelectionMode: $isSelectionMode, isSelectAllMode: $isSelectAllMode)';
}


}

/// @nodoc
abstract mixin class $BatchSelectionStateCopyWith<$Res>  {
  factory $BatchSelectionStateCopyWith(BatchSelectionState value, $Res Function(BatchSelectionState) _then) = _$BatchSelectionStateCopyWithImpl;
@useResult
$Res call({
 Set<int> selectedIds, bool isSelectionMode, bool isSelectAllMode
});




}
/// @nodoc
class _$BatchSelectionStateCopyWithImpl<$Res>
    implements $BatchSelectionStateCopyWith<$Res> {
  _$BatchSelectionStateCopyWithImpl(this._self, this._then);

  final BatchSelectionState _self;
  final $Res Function(BatchSelectionState) _then;

/// Create a copy of BatchSelectionState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? selectedIds = null,Object? isSelectionMode = null,Object? isSelectAllMode = null,}) {
  return _then(_self.copyWith(
selectedIds: null == selectedIds ? _self.selectedIds : selectedIds // ignore: cast_nullable_to_non_nullable
as Set<int>,isSelectionMode: null == isSelectionMode ? _self.isSelectionMode : isSelectionMode // ignore: cast_nullable_to_non_nullable
as bool,isSelectAllMode: null == isSelectAllMode ? _self.isSelectAllMode : isSelectAllMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [BatchSelectionState].
extension BatchSelectionStatePatterns on BatchSelectionState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BatchSelectionState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BatchSelectionState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BatchSelectionState value)  $default,){
final _that = this;
switch (_that) {
case _BatchSelectionState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BatchSelectionState value)?  $default,){
final _that = this;
switch (_that) {
case _BatchSelectionState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( Set<int> selectedIds,  bool isSelectionMode,  bool isSelectAllMode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BatchSelectionState() when $default != null:
return $default(_that.selectedIds,_that.isSelectionMode,_that.isSelectAllMode);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( Set<int> selectedIds,  bool isSelectionMode,  bool isSelectAllMode)  $default,) {final _that = this;
switch (_that) {
case _BatchSelectionState():
return $default(_that.selectedIds,_that.isSelectionMode,_that.isSelectAllMode);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( Set<int> selectedIds,  bool isSelectionMode,  bool isSelectAllMode)?  $default,) {final _that = this;
switch (_that) {
case _BatchSelectionState() when $default != null:
return $default(_that.selectedIds,_that.isSelectionMode,_that.isSelectAllMode);case _:
  return null;

}
}

}

/// @nodoc


class _BatchSelectionState implements BatchSelectionState {
  const _BatchSelectionState({final  Set<int> selectedIds = const {}, this.isSelectionMode = false, this.isSelectAllMode = false}): _selectedIds = selectedIds;
  

/// 选中的文件 ID 集合
 final  Set<int> _selectedIds;
/// 选中的文件 ID 集合
@override@JsonKey() Set<int> get selectedIds {
  if (_selectedIds is EqualUnmodifiableSetView) return _selectedIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableSetView(_selectedIds);
}

/// 是否处于选择模式
@override@JsonKey() final  bool isSelectionMode;
/// 是否全选模式
@override@JsonKey() final  bool isSelectAllMode;

/// Create a copy of BatchSelectionState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BatchSelectionStateCopyWith<_BatchSelectionState> get copyWith => __$BatchSelectionStateCopyWithImpl<_BatchSelectionState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BatchSelectionState&&const DeepCollectionEquality().equals(other._selectedIds, _selectedIds)&&(identical(other.isSelectionMode, isSelectionMode) || other.isSelectionMode == isSelectionMode)&&(identical(other.isSelectAllMode, isSelectAllMode) || other.isSelectAllMode == isSelectAllMode));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_selectedIds),isSelectionMode,isSelectAllMode);

@override
String toString() {
  return 'BatchSelectionState(selectedIds: $selectedIds, isSelectionMode: $isSelectionMode, isSelectAllMode: $isSelectAllMode)';
}


}

/// @nodoc
abstract mixin class _$BatchSelectionStateCopyWith<$Res> implements $BatchSelectionStateCopyWith<$Res> {
  factory _$BatchSelectionStateCopyWith(_BatchSelectionState value, $Res Function(_BatchSelectionState) _then) = __$BatchSelectionStateCopyWithImpl;
@override @useResult
$Res call({
 Set<int> selectedIds, bool isSelectionMode, bool isSelectAllMode
});




}
/// @nodoc
class __$BatchSelectionStateCopyWithImpl<$Res>
    implements _$BatchSelectionStateCopyWith<$Res> {
  __$BatchSelectionStateCopyWithImpl(this._self, this._then);

  final _BatchSelectionState _self;
  final $Res Function(_BatchSelectionState) _then;

/// Create a copy of BatchSelectionState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? selectedIds = null,Object? isSelectionMode = null,Object? isSelectAllMode = null,}) {
  return _then(_BatchSelectionState(
selectedIds: null == selectedIds ? _self._selectedIds : selectedIds // ignore: cast_nullable_to_non_nullable
as Set<int>,isSelectionMode: null == isSelectionMode ? _self.isSelectionMode : isSelectionMode // ignore: cast_nullable_to_non_nullable
as bool,isSelectAllMode: null == isSelectAllMode ? _self.isSelectAllMode : isSelectAllMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
