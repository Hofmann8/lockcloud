import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../features/auth/presentation/providers/auth_provider.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/files/presentation/screens/file_detail_screen.dart';
import '../features/files/presentation/screens/video_detail_screen.dart';
import '../features/files/presentation/models/file_detail_entry.dart';
import '../features/home/presentation/screens/home_screen.dart';

part 'app_router.g.dart';

/// 路由路径常量
class AppRoutes {
  static const String login = '/login';
  static const String home = '/';
  static const String files = '/files';
  static const String fileDetail = '/files/:id';
  static const String upload = '/upload';
  static const String requests = '/requests';
  static const String profile = '/profile';
}

/// 认证状态变化通知器，用于触发路由刷新
class AuthChangeNotifier extends ChangeNotifier {
  bool _isAuthenticated = false;
  
  bool get isAuthenticated => _isAuthenticated;
  
  set isAuthenticated(bool value) {
    if (_isAuthenticated != value) {
      _isAuthenticated = value;
      notifyListeners();
    }
  }
}

/// 认证状态通知器 Provider
@Riverpod(keepAlive: true)
AuthChangeNotifier authChangeNotifier(Ref ref) {
  final notifier = AuthChangeNotifier();
  
  // 监听认证状态变化，更新 notifier
  ref.listen<bool>(isAuthenticatedProvider, (previous, next) {
    notifier.isAuthenticated = next;
  });
  
  // 初始化当前状态
  notifier._isAuthenticated = ref.read(isAuthenticatedProvider);
  
  return notifier;
}

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
@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final authNotifier = ref.watch(authChangeNotifierProvider);
  
  return GoRouter(
    initialLocation: AppRoutes.home,
    debugLogDiagnostics: true,
    refreshListenable: authNotifier,
    
    // 认证重定向逻辑
    redirect: (context, state) {
      final isAuth = authNotifier.isAuthenticated;
      final isLoginRoute = state.matchedLocation == AppRoutes.login;
      
      // 未认证且不在登录页，重定向到登录页
      if (!isAuth && !isLoginRoute) {
        return AppRoutes.login;
      }
      
      // 已认证且在登录页，重定向到主页
      if (isAuth && isLoginRoute) {
        return AppRoutes.home;
      }
      
      return null;
    },
    
    routes: [
      // 登录路由
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      
      // 主页面（底部导航）
      GoRoute(
        path: AppRoutes.home,
        name: 'home',
        builder: (context, state) => const HomeScreen(),
        routes: [
          // 文件详情（嵌套路由）
          // 根据文件类型自动选择图片详情页或视频详情页
          GoRoute(
            path: 'files/:id',
            name: 'fileDetail',
            builder: (context, state) {
              final fileIdStr = state.pathParameters['id'] ?? '0';
              final fileId = int.tryParse(fileIdStr) ?? 0;
              final entry = state.extra is FileDetailEntry
                  ? state.extra as FileDetailEntry
                  : null;
              
              // 根据 entry.isVideo 决定使用哪个详情页
              if (entry?.isVideo == true) {
                return VideoDetailScreen(fileId: fileId, entry: entry);
              }
              return FileDetailScreen(fileId: fileId, entry: entry);
            },
          ),
        ],
      ),
    ],
    
    // 错误页面
    errorBuilder: (context, state) => _ErrorScreen(error: state.error),
  );
}

/// 错误页面
class _ErrorScreen extends StatelessWidget {
  final Exception? error;
  
  const _ErrorScreen({this.error});
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('错误'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              '页面未找到',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              error?.toString() ?? '未知错误',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => context.go(AppRoutes.home),
              child: const Text('返回首页'),
            ),
          ],
        ),
      ),
    );
  }
}
