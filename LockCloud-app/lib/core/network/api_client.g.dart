// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_client.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$secureStorageHash() => r'5c9908c0046ad0e39469ee7acbb5540397b36693';

/// SecureStorage Provider
///
/// 提供 SecureStorage 实例的 Riverpod Provider
///
/// Copied from [secureStorage].
@ProviderFor(secureStorage)
final secureStorageProvider = Provider<SecureStorage>.internal(
  secureStorage,
  name: r'secureStorageProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$secureStorageHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef SecureStorageRef = ProviderRef<SecureStorage>;
String _$onLogoutCallbackHash() => r'422f08fb7acb4b275850938a639695d51e4964a4';

/// 登出回调 Provider
///
/// 提供登出回调函数的 Provider
/// 当 Token 刷新失败时，ApiClient 会调用此回调
///
/// 注意：此 Provider 需要在应用初始化时被覆盖（override）
/// 以提供实际的登出逻辑（如导航到登录页面）
///
/// Copied from [onLogoutCallback].
@ProviderFor(onLogoutCallback)
final onLogoutCallbackProvider = Provider<void Function()?>.internal(
  onLogoutCallback,
  name: r'onLogoutCallbackProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$onLogoutCallbackHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef OnLogoutCallbackRef = ProviderRef<void Function()?>;
String _$apiClientHash() => r'df1589dd35f2c9f78850f45047b7acfe467dcf1c';

/// ApiClient Provider
///
/// 提供 ApiClient 实例的 Riverpod Provider
/// 依赖于 SecureStorage Provider 和 onLogoutCallback Provider
///
/// **Validates: Requirements 8.2, 8.4**
///
/// Copied from [apiClient].
@ProviderFor(apiClient)
final apiClientProvider = Provider<ApiClient>.internal(
  apiClient,
  name: r'apiClientProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$apiClientHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ApiClientRef = ProviderRef<ApiClient>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
