import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/theme_config.dart';
import 'router/app_router.dart';

/// LockCloud 应用主入口组件
/// 
/// 该组件是应用的根 Widget，负责配置主题、路由和全局状态管理。
/// 使用与 Web 前端一致的浅色主题。
class LockCloudApp extends ConsumerWidget {
  const LockCloudApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 获取路由配置
    final router = ref.watch(appRouterProvider);
    
    return MaterialApp.router(
      title: 'LockCloud',
      debugShowCheckedModeBanner: false,
      
      // 使用浅色主题 - 与 Web 前端保持一致
      theme: ThemeConfig.lightTheme,
      
      // 使用 go_router 路由配置
      routerConfig: router,
    );
  }
}
