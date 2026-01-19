// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$isAuthenticatedHash() => r'85528828e1d411d8da7e5322b8ad8f5a3c35e3b5';

/// 是否已认证 Provider
///
/// 便捷 Provider，用于快速检查用户是否已认证。
/// 用于路由守卫等场景。
///
/// Copied from [isAuthenticated].
@ProviderFor(isAuthenticated)
final isAuthenticatedProvider = AutoDisposeProvider<bool>.internal(
  isAuthenticated,
  name: r'isAuthenticatedProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isAuthenticatedHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef IsAuthenticatedRef = AutoDisposeProviderRef<bool>;
String _$currentUserHash() => r'9f53bf42e41fd7d14f5ec943cb3a85ba3febcafe';

/// 当前用户 Provider
///
/// 便捷 Provider，用于获取当前登录用户。
/// 如果未登录，返回 null。
///
/// Copied from [currentUser].
@ProviderFor(currentUser)
final currentUserProvider = AutoDisposeProvider<User?>.internal(
  currentUser,
  name: r'currentUserProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentUserHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentUserRef = AutoDisposeProviderRef<User?>;
String _$authNotifierHash() => r'2865402b08ab9aaf640c16379d2d155b0a6b586f';

/// 认证状态管理器
///
/// 使用 Riverpod 管理认证状态，提供以下功能：
/// - 检查认证状态（应用启动时）
/// - SSO 登录
/// - Token 刷新
/// - 登出
///
/// **Validates: Requirements 1.1, 1.5, 1.8**
///
/// Copied from [AuthNotifier].
@ProviderFor(AuthNotifier)
final authNotifierProvider = NotifierProvider<AuthNotifier, AuthState>.internal(
  AuthNotifier.new,
  name: r'authNotifierProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$authNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$AuthNotifier = Notifier<AuthState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
