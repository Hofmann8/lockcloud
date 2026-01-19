// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'files_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$FilesState {

/// 文件列表
 List<FileModel> get files;/// 是否正在加载（首次加载或刷新）
 bool get isLoading;/// 是否正在加载更多
 bool get isLoadingMore;/// 是否还有更多数据
 bool get hasMore;/// 当前筛选条件
 FileFilters get filters;/// 分页信息
 PaginationInfo? get pagination;/// 时间线数据
 Map<String, Map<String, TimelineMonth>>? get timeline;/// 目录树
 List<DirectoryNode> get directoryTree;/// 标签列表
 List<TagWithCount> get tags;/// 错误信息
 String? get error;
/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FilesStateCopyWith<FilesState> get copyWith => _$FilesStateCopyWithImpl<FilesState>(this as FilesState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FilesState&&const DeepCollectionEquality().equals(other.files, files)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isLoadingMore, isLoadingMore) || other.isLoadingMore == isLoadingMore)&&(identical(other.hasMore, hasMore) || other.hasMore == hasMore)&&(identical(other.filters, filters) || other.filters == filters)&&(identical(other.pagination, pagination) || other.pagination == pagination)&&const DeepCollectionEquality().equals(other.timeline, timeline)&&const DeepCollectionEquality().equals(other.directoryTree, directoryTree)&&const DeepCollectionEquality().equals(other.tags, tags)&&(identical(other.error, error) || other.error == error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(files),isLoading,isLoadingMore,hasMore,filters,pagination,const DeepCollectionEquality().hash(timeline),const DeepCollectionEquality().hash(directoryTree),const DeepCollectionEquality().hash(tags),error);

@override
String toString() {
  return 'FilesState(files: $files, isLoading: $isLoading, isLoadingMore: $isLoadingMore, hasMore: $hasMore, filters: $filters, pagination: $pagination, timeline: $timeline, directoryTree: $directoryTree, tags: $tags, error: $error)';
}


}

/// @nodoc
abstract mixin class $FilesStateCopyWith<$Res>  {
  factory $FilesStateCopyWith(FilesState value, $Res Function(FilesState) _then) = _$FilesStateCopyWithImpl;
@useResult
$Res call({
 List<FileModel> files, bool isLoading, bool isLoadingMore, bool hasMore, FileFilters filters, PaginationInfo? pagination, Map<String, Map<String, TimelineMonth>>? timeline, List<DirectoryNode> directoryTree, List<TagWithCount> tags, String? error
});


$FileFiltersCopyWith<$Res> get filters;$PaginationInfoCopyWith<$Res>? get pagination;

}
/// @nodoc
class _$FilesStateCopyWithImpl<$Res>
    implements $FilesStateCopyWith<$Res> {
  _$FilesStateCopyWithImpl(this._self, this._then);

  final FilesState _self;
  final $Res Function(FilesState) _then;

/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? files = null,Object? isLoading = null,Object? isLoadingMore = null,Object? hasMore = null,Object? filters = null,Object? pagination = freezed,Object? timeline = freezed,Object? directoryTree = null,Object? tags = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
files: null == files ? _self.files : files // ignore: cast_nullable_to_non_nullable
as List<FileModel>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isLoadingMore: null == isLoadingMore ? _self.isLoadingMore : isLoadingMore // ignore: cast_nullable_to_non_nullable
as bool,hasMore: null == hasMore ? _self.hasMore : hasMore // ignore: cast_nullable_to_non_nullable
as bool,filters: null == filters ? _self.filters : filters // ignore: cast_nullable_to_non_nullable
as FileFilters,pagination: freezed == pagination ? _self.pagination : pagination // ignore: cast_nullable_to_non_nullable
as PaginationInfo?,timeline: freezed == timeline ? _self.timeline : timeline // ignore: cast_nullable_to_non_nullable
as Map<String, Map<String, TimelineMonth>>?,directoryTree: null == directoryTree ? _self.directoryTree : directoryTree // ignore: cast_nullable_to_non_nullable
as List<DirectoryNode>,tags: null == tags ? _self.tags : tags // ignore: cast_nullable_to_non_nullable
as List<TagWithCount>,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileFiltersCopyWith<$Res> get filters {
  
  return $FileFiltersCopyWith<$Res>(_self.filters, (value) {
    return _then(_self.copyWith(filters: value));
  });
}/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PaginationInfoCopyWith<$Res>? get pagination {
    if (_self.pagination == null) {
    return null;
  }

  return $PaginationInfoCopyWith<$Res>(_self.pagination!, (value) {
    return _then(_self.copyWith(pagination: value));
  });
}
}


/// Adds pattern-matching-related methods to [FilesState].
extension FilesStatePatterns on FilesState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FilesState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FilesState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FilesState value)  $default,){
final _that = this;
switch (_that) {
case _FilesState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FilesState value)?  $default,){
final _that = this;
switch (_that) {
case _FilesState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<FileModel> files,  bool isLoading,  bool isLoadingMore,  bool hasMore,  FileFilters filters,  PaginationInfo? pagination,  Map<String, Map<String, TimelineMonth>>? timeline,  List<DirectoryNode> directoryTree,  List<TagWithCount> tags,  String? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FilesState() when $default != null:
return $default(_that.files,_that.isLoading,_that.isLoadingMore,_that.hasMore,_that.filters,_that.pagination,_that.timeline,_that.directoryTree,_that.tags,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<FileModel> files,  bool isLoading,  bool isLoadingMore,  bool hasMore,  FileFilters filters,  PaginationInfo? pagination,  Map<String, Map<String, TimelineMonth>>? timeline,  List<DirectoryNode> directoryTree,  List<TagWithCount> tags,  String? error)  $default,) {final _that = this;
switch (_that) {
case _FilesState():
return $default(_that.files,_that.isLoading,_that.isLoadingMore,_that.hasMore,_that.filters,_that.pagination,_that.timeline,_that.directoryTree,_that.tags,_that.error);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<FileModel> files,  bool isLoading,  bool isLoadingMore,  bool hasMore,  FileFilters filters,  PaginationInfo? pagination,  Map<String, Map<String, TimelineMonth>>? timeline,  List<DirectoryNode> directoryTree,  List<TagWithCount> tags,  String? error)?  $default,) {final _that = this;
switch (_that) {
case _FilesState() when $default != null:
return $default(_that.files,_that.isLoading,_that.isLoadingMore,_that.hasMore,_that.filters,_that.pagination,_that.timeline,_that.directoryTree,_that.tags,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _FilesState implements FilesState {
  const _FilesState({final  List<FileModel> files = const [], this.isLoading = false, this.isLoadingMore = false, this.hasMore = true, this.filters = const FileFilters(), this.pagination, final  Map<String, Map<String, TimelineMonth>>? timeline, final  List<DirectoryNode> directoryTree = const [], final  List<TagWithCount> tags = const [], this.error}): _files = files,_timeline = timeline,_directoryTree = directoryTree,_tags = tags;
  

/// 文件列表
 final  List<FileModel> _files;
/// 文件列表
@override@JsonKey() List<FileModel> get files {
  if (_files is EqualUnmodifiableListView) return _files;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_files);
}

/// 是否正在加载（首次加载或刷新）
@override@JsonKey() final  bool isLoading;
/// 是否正在加载更多
@override@JsonKey() final  bool isLoadingMore;
/// 是否还有更多数据
@override@JsonKey() final  bool hasMore;
/// 当前筛选条件
@override@JsonKey() final  FileFilters filters;
/// 分页信息
@override final  PaginationInfo? pagination;
/// 时间线数据
 final  Map<String, Map<String, TimelineMonth>>? _timeline;
/// 时间线数据
@override Map<String, Map<String, TimelineMonth>>? get timeline {
  final value = _timeline;
  if (value == null) return null;
  if (_timeline is EqualUnmodifiableMapView) return _timeline;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(value);
}

/// 目录树
 final  List<DirectoryNode> _directoryTree;
/// 目录树
@override@JsonKey() List<DirectoryNode> get directoryTree {
  if (_directoryTree is EqualUnmodifiableListView) return _directoryTree;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_directoryTree);
}

/// 标签列表
 final  List<TagWithCount> _tags;
/// 标签列表
@override@JsonKey() List<TagWithCount> get tags {
  if (_tags is EqualUnmodifiableListView) return _tags;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_tags);
}

/// 错误信息
@override final  String? error;

/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FilesStateCopyWith<_FilesState> get copyWith => __$FilesStateCopyWithImpl<_FilesState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FilesState&&const DeepCollectionEquality().equals(other._files, _files)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isLoadingMore, isLoadingMore) || other.isLoadingMore == isLoadingMore)&&(identical(other.hasMore, hasMore) || other.hasMore == hasMore)&&(identical(other.filters, filters) || other.filters == filters)&&(identical(other.pagination, pagination) || other.pagination == pagination)&&const DeepCollectionEquality().equals(other._timeline, _timeline)&&const DeepCollectionEquality().equals(other._directoryTree, _directoryTree)&&const DeepCollectionEquality().equals(other._tags, _tags)&&(identical(other.error, error) || other.error == error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_files),isLoading,isLoadingMore,hasMore,filters,pagination,const DeepCollectionEquality().hash(_timeline),const DeepCollectionEquality().hash(_directoryTree),const DeepCollectionEquality().hash(_tags),error);

@override
String toString() {
  return 'FilesState(files: $files, isLoading: $isLoading, isLoadingMore: $isLoadingMore, hasMore: $hasMore, filters: $filters, pagination: $pagination, timeline: $timeline, directoryTree: $directoryTree, tags: $tags, error: $error)';
}


}

/// @nodoc
abstract mixin class _$FilesStateCopyWith<$Res> implements $FilesStateCopyWith<$Res> {
  factory _$FilesStateCopyWith(_FilesState value, $Res Function(_FilesState) _then) = __$FilesStateCopyWithImpl;
@override @useResult
$Res call({
 List<FileModel> files, bool isLoading, bool isLoadingMore, bool hasMore, FileFilters filters, PaginationInfo? pagination, Map<String, Map<String, TimelineMonth>>? timeline, List<DirectoryNode> directoryTree, List<TagWithCount> tags, String? error
});


@override $FileFiltersCopyWith<$Res> get filters;@override $PaginationInfoCopyWith<$Res>? get pagination;

}
/// @nodoc
class __$FilesStateCopyWithImpl<$Res>
    implements _$FilesStateCopyWith<$Res> {
  __$FilesStateCopyWithImpl(this._self, this._then);

  final _FilesState _self;
  final $Res Function(_FilesState) _then;

/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? files = null,Object? isLoading = null,Object? isLoadingMore = null,Object? hasMore = null,Object? filters = null,Object? pagination = freezed,Object? timeline = freezed,Object? directoryTree = null,Object? tags = null,Object? error = freezed,}) {
  return _then(_FilesState(
files: null == files ? _self._files : files // ignore: cast_nullable_to_non_nullable
as List<FileModel>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isLoadingMore: null == isLoadingMore ? _self.isLoadingMore : isLoadingMore // ignore: cast_nullable_to_non_nullable
as bool,hasMore: null == hasMore ? _self.hasMore : hasMore // ignore: cast_nullable_to_non_nullable
as bool,filters: null == filters ? _self.filters : filters // ignore: cast_nullable_to_non_nullable
as FileFilters,pagination: freezed == pagination ? _self.pagination : pagination // ignore: cast_nullable_to_non_nullable
as PaginationInfo?,timeline: freezed == timeline ? _self._timeline : timeline // ignore: cast_nullable_to_non_nullable
as Map<String, Map<String, TimelineMonth>>?,directoryTree: null == directoryTree ? _self._directoryTree : directoryTree // ignore: cast_nullable_to_non_nullable
as List<DirectoryNode>,tags: null == tags ? _self._tags : tags // ignore: cast_nullable_to_non_nullable
as List<TagWithCount>,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FileFiltersCopyWith<$Res> get filters {
  
  return $FileFiltersCopyWith<$Res>(_self.filters, (value) {
    return _then(_self.copyWith(filters: value));
  });
}/// Create a copy of FilesState
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PaginationInfoCopyWith<$Res>? get pagination {
    if (_self.pagination == null) {
    return null;
  }

  return $PaginationInfoCopyWith<$Res>(_self.pagination!, (value) {
    return _then(_self.copyWith(pagination: value));
  });
}
}

// dart format on
