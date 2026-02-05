// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_router.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$authChangeNotifierHash() =>
    r'3c6868197eb2ce1715038c13858d7513fbe341b8';

/// 认证状态通知器 Provider
///
/// Copied from [authChangeNotifier].
@ProviderFor(authChangeNotifier)
final authChangeNotifierProvider = Provider<AuthChangeNotifier>.internal(
  authChangeNotifier,
  name: r'authChangeNotifierProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$authChangeNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AuthChangeNotifierRef = ProviderRef<AuthChangeNotifier>;
String _$appRouterHash() => r'25272607ab611e387b1c3067bd5253aa2c7714e8';

/// 应用路由配置 Provider
///
/// 使用 go_router 配置应用的路由表。
///
/// 路由结构：
/// - /login - 登录页面
/// - / - 主页面（底部导航）
///   - /files - 文件列表（底部导航 Tab）
///   - /upload - 上传页面（底部导航 Tab）
///   - /requests - 请求管理（底部导航 Tab）
///   - /profile - 个人中心（底部导航 Tab）
/// - /files/:id - 文件详情
///
/// Requirements: 9.3 - 底部导航栏包含四个入口：文件、上传、请求、我的
///
/// Copied from [appRouter].
@ProviderFor(appRouter)
final appRouterProvider = Provider<GoRouter>.internal(
  appRouter,
  name: r'appRouterProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$appRouterHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AppRouterRef = ProviderRef<GoRouter>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
