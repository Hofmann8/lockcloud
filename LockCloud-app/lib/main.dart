import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'features/auth/presentation/providers/auth_provider.dart';
import 'shared/widgets/animated_splash_screen.dart';

/// 应用入口点
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
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
