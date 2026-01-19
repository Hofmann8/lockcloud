// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'requests_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$RequestsState {

/// 收到的请求列表
 List<FileRequestModel> get receivedRequests;/// 发出的请求列表
 List<FileRequestModel> get sentRequests;/// 当前 Tab
 RequestTab get currentTab;/// 状态筛选 (all, pending, approved, rejected)
 String get statusFilter;/// 是否正在加载
 bool get isLoading;/// 是否正在加载更多
 bool get isLoadingMore;/// 收到的请求是否还有更多
 bool get receivedHasMore;/// 发出的请求是否还有更多
 bool get sentHasMore;/// 收到的请求当前页码
 int get receivedPage;/// 发出的请求当前页码
 int get sentPage;/// 待处理请求数量
 int get pendingCount;/// 错误信息
 String? get error;
/// Create a copy of RequestsState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RequestsStateCopyWith<RequestsState> get copyWith => _$RequestsStateCopyWithImpl<RequestsState>(this as RequestsState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RequestsState&&const DeepCollectionEquality().equals(other.receivedRequests, receivedRequests)&&const DeepCollectionEquality().equals(other.sentRequests, sentRequests)&&(identical(other.currentTab, currentTab) || other.currentTab == currentTab)&&(identical(other.statusFilter, statusFilter) || other.statusFilter == statusFilter)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isLoadingMore, isLoadingMore) || other.isLoadingMore == isLoadingMore)&&(identical(other.receivedHasMore, receivedHasMore) || other.receivedHasMore == receivedHasMore)&&(identical(other.sentHasMore, sentHasMore) || other.sentHasMore == sentHasMore)&&(identical(other.receivedPage, receivedPage) || other.receivedPage == receivedPage)&&(identical(other.sentPage, sentPage) || other.sentPage == sentPage)&&(identical(other.pendingCount, pendingCount) || other.pendingCount == pendingCount)&&(identical(other.error, error) || other.error == error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(receivedRequests),const DeepCollectionEquality().hash(sentRequests),currentTab,statusFilter,isLoading,isLoadingMore,receivedHasMore,sentHasMore,receivedPage,sentPage,pendingCount,error);

@override
String toString() {
  return 'RequestsState(receivedRequests: $receivedRequests, sentRequests: $sentRequests, currentTab: $currentTab, statusFilter: $statusFilter, isLoading: $isLoading, isLoadingMore: $isLoadingMore, receivedHasMore: $receivedHasMore, sentHasMore: $sentHasMore, receivedPage: $receivedPage, sentPage: $sentPage, pendingCount: $pendingCount, error: $error)';
}


}

/// @nodoc
abstract mixin class $RequestsStateCopyWith<$Res>  {
  factory $RequestsStateCopyWith(RequestsState value, $Res Function(RequestsState) _then) = _$RequestsStateCopyWithImpl;
@useResult
$Res call({
 List<FileRequestModel> receivedRequests, List<FileRequestModel> sentRequests, RequestTab currentTab, String statusFilter, bool isLoading, bool isLoadingMore, bool receivedHasMore, bool sentHasMore, int receivedPage, int sentPage, int pendingCount, String? error
});




}
/// @nodoc
class _$RequestsStateCopyWithImpl<$Res>
    implements $RequestsStateCopyWith<$Res> {
  _$RequestsStateCopyWithImpl(this._self, this._then);

  final RequestsState _self;
  final $Res Function(RequestsState) _then;

/// Create a copy of RequestsState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? receivedRequests = null,Object? sentRequests = null,Object? currentTab = null,Object? statusFilter = null,Object? isLoading = null,Object? isLoadingMore = null,Object? receivedHasMore = null,Object? sentHasMore = null,Object? receivedPage = null,Object? sentPage = null,Object? pendingCount = null,Object? error = freezed,}) {
  return _then(_self.copyWith(
receivedRequests: null == receivedRequests ? _self.receivedRequests : receivedRequests // ignore: cast_nullable_to_non_nullable
as List<FileRequestModel>,sentRequests: null == sentRequests ? _self.sentRequests : sentRequests // ignore: cast_nullable_to_non_nullable
as List<FileRequestModel>,currentTab: null == currentTab ? _self.currentTab : currentTab // ignore: cast_nullable_to_non_nullable
as RequestTab,statusFilter: null == statusFilter ? _self.statusFilter : statusFilter // ignore: cast_nullable_to_non_nullable
as String,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isLoadingMore: null == isLoadingMore ? _self.isLoadingMore : isLoadingMore // ignore: cast_nullable_to_non_nullable
as bool,receivedHasMore: null == receivedHasMore ? _self.receivedHasMore : receivedHasMore // ignore: cast_nullable_to_non_nullable
as bool,sentHasMore: null == sentHasMore ? _self.sentHasMore : sentHasMore // ignore: cast_nullable_to_non_nullable
as bool,receivedPage: null == receivedPage ? _self.receivedPage : receivedPage // ignore: cast_nullable_to_non_nullable
as int,sentPage: null == sentPage ? _self.sentPage : sentPage // ignore: cast_nullable_to_non_nullable
as int,pendingCount: null == pendingCount ? _self.pendingCount : pendingCount // ignore: cast_nullable_to_non_nullable
as int,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [RequestsState].
extension RequestsStatePatterns on RequestsState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RequestsState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RequestsState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RequestsState value)  $default,){
final _that = this;
switch (_that) {
case _RequestsState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RequestsState value)?  $default,){
final _that = this;
switch (_that) {
case _RequestsState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<FileRequestModel> receivedRequests,  List<FileRequestModel> sentRequests,  RequestTab currentTab,  String statusFilter,  bool isLoading,  bool isLoadingMore,  bool receivedHasMore,  bool sentHasMore,  int receivedPage,  int sentPage,  int pendingCount,  String? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RequestsState() when $default != null:
return $default(_that.receivedRequests,_that.sentRequests,_that.currentTab,_that.statusFilter,_that.isLoading,_that.isLoadingMore,_that.receivedHasMore,_that.sentHasMore,_that.receivedPage,_that.sentPage,_that.pendingCount,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<FileRequestModel> receivedRequests,  List<FileRequestModel> sentRequests,  RequestTab currentTab,  String statusFilter,  bool isLoading,  bool isLoadingMore,  bool receivedHasMore,  bool sentHasMore,  int receivedPage,  int sentPage,  int pendingCount,  String? error)  $default,) {final _that = this;
switch (_that) {
case _RequestsState():
return $default(_that.receivedRequests,_that.sentRequests,_that.currentTab,_that.statusFilter,_that.isLoading,_that.isLoadingMore,_that.receivedHasMore,_that.sentHasMore,_that.receivedPage,_that.sentPage,_that.pendingCount,_that.error);}
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<FileRequestModel> receivedRequests,  List<FileRequestModel> sentRequests,  RequestTab currentTab,  String statusFilter,  bool isLoading,  bool isLoadingMore,  bool receivedHasMore,  bool sentHasMore,  int receivedPage,  int sentPage,  int pendingCount,  String? error)?  $default,) {final _that = this;
switch (_that) {
case _RequestsState() when $default != null:
return $default(_that.receivedRequests,_that.sentRequests,_that.currentTab,_that.statusFilter,_that.isLoading,_that.isLoadingMore,_that.receivedHasMore,_that.sentHasMore,_that.receivedPage,_that.sentPage,_that.pendingCount,_that.error);case _:
  return null;

}
}

}

/// @nodoc


class _RequestsState implements RequestsState {
  const _RequestsState({final  List<FileRequestModel> receivedRequests = const [], final  List<FileRequestModel> sentRequests = const [], this.currentTab = RequestTab.received, this.statusFilter = 'all', this.isLoading = false, this.isLoadingMore = false, this.receivedHasMore = true, this.sentHasMore = true, this.receivedPage = 1, this.sentPage = 1, this.pendingCount = 0, this.error}): _receivedRequests = receivedRequests,_sentRequests = sentRequests;
  

/// 收到的请求列表
 final  List<FileRequestModel> _receivedRequests;
/// 收到的请求列表
@override@JsonKey() List<FileRequestModel> get receivedRequests {
  if (_receivedRequests is EqualUnmodifiableListView) return _receivedRequests;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_receivedRequests);
}

/// 发出的请求列表
 final  List<FileRequestModel> _sentRequests;
/// 发出的请求列表
@override@JsonKey() List<FileRequestModel> get sentRequests {
  if (_sentRequests is EqualUnmodifiableListView) return _sentRequests;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_sentRequests);
}

/// 当前 Tab
@override@JsonKey() final  RequestTab currentTab;
/// 状态筛选 (all, pending, approved, rejected)
@override@JsonKey() final  String statusFilter;
/// 是否正在加载
@override@JsonKey() final  bool isLoading;
/// 是否正在加载更多
@override@JsonKey() final  bool isLoadingMore;
/// 收到的请求是否还有更多
@override@JsonKey() final  bool receivedHasMore;
/// 发出的请求是否还有更多
@override@JsonKey() final  bool sentHasMore;
/// 收到的请求当前页码
@override@JsonKey() final  int receivedPage;
/// 发出的请求当前页码
@override@JsonKey() final  int sentPage;
/// 待处理请求数量
@override@JsonKey() final  int pendingCount;
/// 错误信息
@override final  String? error;

/// Create a copy of RequestsState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RequestsStateCopyWith<_RequestsState> get copyWith => __$RequestsStateCopyWithImpl<_RequestsState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RequestsState&&const DeepCollectionEquality().equals(other._receivedRequests, _receivedRequests)&&const DeepCollectionEquality().equals(other._sentRequests, _sentRequests)&&(identical(other.currentTab, currentTab) || other.currentTab == currentTab)&&(identical(other.statusFilter, statusFilter) || other.statusFilter == statusFilter)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isLoadingMore, isLoadingMore) || other.isLoadingMore == isLoadingMore)&&(identical(other.receivedHasMore, receivedHasMore) || other.receivedHasMore == receivedHasMore)&&(identical(other.sentHasMore, sentHasMore) || other.sentHasMore == sentHasMore)&&(identical(other.receivedPage, receivedPage) || other.receivedPage == receivedPage)&&(identical(other.sentPage, sentPage) || other.sentPage == sentPage)&&(identical(other.pendingCount, pendingCount) || other.pendingCount == pendingCount)&&(identical(other.error, error) || other.error == error));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_receivedRequests),const DeepCollectionEquality().hash(_sentRequests),currentTab,statusFilter,isLoading,isLoadingMore,receivedHasMore,sentHasMore,receivedPage,sentPage,pendingCount,error);

@override
String toString() {
  return 'RequestsState(receivedRequests: $receivedRequests, sentRequests: $sentRequests, currentTab: $currentTab, statusFilter: $statusFilter, isLoading: $isLoading, isLoadingMore: $isLoadingMore, receivedHasMore: $receivedHasMore, sentHasMore: $sentHasMore, receivedPage: $receivedPage, sentPage: $sentPage, pendingCount: $pendingCount, error: $error)';
}


}

/// @nodoc
abstract mixin class _$RequestsStateCopyWith<$Res> implements $RequestsStateCopyWith<$Res> {
  factory _$RequestsStateCopyWith(_RequestsState value, $Res Function(_RequestsState) _then) = __$RequestsStateCopyWithImpl;
@override @useResult
$Res call({
 List<FileRequestModel> receivedRequests, List<FileRequestModel> sentRequests, RequestTab currentTab, String statusFilter, bool isLoading, bool isLoadingMore, bool receivedHasMore, bool sentHasMore, int receivedPage, int sentPage, int pendingCount, String? error
});




}
/// @nodoc
class __$RequestsStateCopyWithImpl<$Res>
    implements _$RequestsStateCopyWith<$Res> {
  __$RequestsStateCopyWithImpl(this._self, this._then);

  final _RequestsState _self;
  final $Res Function(_RequestsState) _then;

/// Create a copy of RequestsState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? receivedRequests = null,Object? sentRequests = null,Object? currentTab = null,Object? statusFilter = null,Object? isLoading = null,Object? isLoadingMore = null,Object? receivedHasMore = null,Object? sentHasMore = null,Object? receivedPage = null,Object? sentPage = null,Object? pendingCount = null,Object? error = freezed,}) {
  return _then(_RequestsState(
receivedRequests: null == receivedRequests ? _self._receivedRequests : receivedRequests // ignore: cast_nullable_to_non_nullable
as List<FileRequestModel>,sentRequests: null == sentRequests ? _self._sentRequests : sentRequests // ignore: cast_nullable_to_non_nullable
as List<FileRequestModel>,currentTab: null == currentTab ? _self.currentTab : currentTab // ignore: cast_nullable_to_non_nullable
as RequestTab,statusFilter: null == statusFilter ? _self.statusFilter : statusFilter // ignore: cast_nullable_to_non_nullable
as String,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isLoadingMore: null == isLoadingMore ? _self.isLoadingMore : isLoadingMore // ignore: cast_nullable_to_non_nullable
as bool,receivedHasMore: null == receivedHasMore ? _self.receivedHasMore : receivedHasMore // ignore: cast_nullable_to_non_nullable
as bool,sentHasMore: null == sentHasMore ? _self.sentHasMore : sentHasMore // ignore: cast_nullable_to_non_nullable
as bool,receivedPage: null == receivedPage ? _self.receivedPage : receivedPage // ignore: cast_nullable_to_non_nullable
as int,sentPage: null == sentPage ? _self.sentPage : sentPage // ignore: cast_nullable_to_non_nullable
as int,pendingCount: null == pendingCount ? _self.pendingCount : pendingCount // ignore: cast_nullable_to_non_nullable
as int,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
