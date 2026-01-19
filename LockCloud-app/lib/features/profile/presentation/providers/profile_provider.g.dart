// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$avatarUploadNotifierHash() =>
    r'82f750f7bec8ab570f0bf3e5b6bb28b267c3b746';

/// 头像上传状态管理器
///
/// 管理头像上传的状态和进度
///
/// **Validates: Requirements 9.5**
///
/// Copied from [AvatarUploadNotifier].
@ProviderFor(AvatarUploadNotifier)
final avatarUploadNotifierProvider =
    AutoDisposeNotifierProvider<
      AvatarUploadNotifier,
      AvatarUploadState
    >.internal(
      AvatarUploadNotifier.new,
      name: r'avatarUploadNotifierProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$avatarUploadNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$AvatarUploadNotifier = AutoDisposeNotifier<AvatarUploadState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
