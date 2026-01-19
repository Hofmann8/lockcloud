// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'upload_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$uploadRepositoryHash() => r'01b0c792447d4b0eb503b67f2e4f28e4ea0abf20';

/// UploadRepository Provider
///
/// 提供 UploadRepository 实例的 Riverpod Provider
///
/// Copied from [uploadRepository].
@ProviderFor(uploadRepository)
final uploadRepositoryProvider = Provider<UploadRepository>.internal(
  uploadRepository,
  name: r'uploadRepositoryProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$uploadRepositoryHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UploadRepositoryRef = ProviderRef<UploadRepository>;
String _$activityTypesHash() => r'8cc2b3229dfff9d08c37e23997c261fb1d6164c3';

/// 活动类型列表 Provider
///
/// Copied from [activityTypes].
@ProviderFor(activityTypes)
final activityTypesProvider =
    AutoDisposeFutureProvider<List<ActivityType>>.internal(
      activityTypes,
      name: r'activityTypesProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$activityTypesHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ActivityTypesRef = AutoDisposeFutureProviderRef<List<ActivityType>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
