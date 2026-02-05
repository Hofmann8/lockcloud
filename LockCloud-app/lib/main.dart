import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/theme_config.dart';
import 'features/auth/presentation/providers/auth_provider.dart';
import 'shared/providers/splash_state_provider.dart';
import 'shared/widgets/animated_splash_screen.dart';

/// 应用入口点
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 设置系统导航栏颜色与底部菜单栏一致
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: ThemeConfig.surfaceColor,  // 底部导航栏背景色（白色）
      systemNavigationBarIconBrightness: Brightness.dark,
      systemNavigationBarContrastEnforced: false,  // 禁用系统强制对比度
    ),
  );
  
  // 启用边到边显示
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  
  runApp(
    const ProviderScope(
      child: AppWithSplash(),
    ),
  );
}

/// 带开屏动画的应用入口
class AppWithSplash extends ConsumerStatefulWidget {
  const AppWithSplash({super.key});

  @override
  ConsumerState<AppWithSplash> createState() => _AppWithSplashState();
}

class _AppWithSplashState extends ConsumerState<AppWithSplash> {
  bool _isReady = false;

  @override
  void initState() {
    super.initState();
    // 延迟初始化，确保 widget 树已构建
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeApp();
    });
  }

  Future<void> _initializeApp() async {
    try {
      // 检查认证状态
      await ref.read(authNotifierProvider.notifier).checkAuthStatus();
      
      // 检查启动时是否已登录，用于决定首页是否播放后半截动画
      final isAuth = ref.read(isAuthenticatedProvider);
      if (isAuth) {
        ref.read(wasAuthenticatedOnLaunchProvider.notifier).state = true;
      }
    } catch (e) {
      debugPrint('Init error: $e');
    } finally {
      if (mounted) {
        setState(() => _isReady = true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSplashScreen(
      isReady: _isReady,
      child: const LockCloudApp(),
    );
  }
}
