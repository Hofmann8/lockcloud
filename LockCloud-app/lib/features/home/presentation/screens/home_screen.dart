import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../shared/providers/splash_state_provider.dart';
import '../../../files/presentation/providers/files_provider.dart';
import '../../../files/presentation/screens/files_screen.dart';
import '../../../profile/presentation/screens/profile_screen.dart';
import '../../../requests/presentation/providers/requests_provider.dart';
import '../../../requests/presentation/screens/requests_screen.dart';
import '../../../upload/presentation/screens/upload_screen.dart';

/// 主页面框架
///
/// 实现底部导航栏，包含四个入口：
/// - 文件：文件列表页面
/// - 上传：文件上传页面
/// - 请求：请求管理页面（显示待处理数量徽章）
/// - 我的：个人中心页面
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  bool _showLoadingOverlay = true;
  late AnimationController _overlayFadeController;
  late Animation<double> _overlayFadeAnimation;

  /// 页面列表
  final List<Widget> _pages = const [
    FilesScreen(),
    UploadScreen(),
    RequestsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    
    _overlayFadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _overlayFadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _overlayFadeController, curve: Curves.easeOut),
    );
    
    _overlayFadeController.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _showLoadingOverlay = false);
      }
    });
  }

  @override
  void dispose() {
    _overlayFadeController.dispose();
    super.dispose();
  }

  /// 切换页面
  void _onDestinationSelected(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    // 监听待处理请求数量
    final pendingCount = ref.watch(pendingRequestCountProvider);
    
    // 监听开屏动画完成和文件列表加载状态
    final splashCompleted = ref.watch(splashCompletedProvider);
    final filesState = ref.watch(filesNotifierProvider);
    final isFilesLoaded = !filesState.isLoading && filesState.files.isNotEmpty;
    
    // 开屏完成且文件加载好后，淡出遮罩
    if (splashCompleted && isFilesLoaded && _showLoadingOverlay && !_overlayFadeController.isAnimating) {
      Future.microtask(() {
        if (mounted) {
          _overlayFadeController.forward();
        }
      });
    }

    return Stack(
      children: [
        Scaffold(
          body: IndexedStack(
            index: _currentIndex,
            children: _pages,
          ),
          bottomNavigationBar: _buildBottomNavigationBar(pendingCount),
        ),
        
        // 加载遮罩（白色背景+logo居中，覆盖整个屏幕包括导航栏）
        if (_showLoadingOverlay)
          Positioned.fill(
            child: FadeTransition(
              opacity: _overlayFadeAnimation,
              child: Container(
                color: Colors.white,
                child: Center(
                  child: SizedBox(
                    width: 200,
                    height: 200,
                    child: Image.asset(
                      'assets/images/icon.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  /// 构建底部导航栏 - 与 Web 前端风格一致
  Widget _buildBottomNavigationBar(int pendingCount) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        border: Border(
          top: BorderSide(
            color: ThemeConfig.borderColor,
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _onDestinationSelected,
          backgroundColor: Colors.transparent,
          indicatorColor: ThemeConfig.primaryColor.withValues(alpha: 0.1),
          elevation: 0,
          height: 64,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.folder_outlined),
              selectedIcon: Icon(Icons.folder),
              label: '文件',
            ),
            const NavigationDestination(
              icon: Icon(Icons.cloud_upload_outlined),
              selectedIcon: Icon(Icons.cloud_upload),
              label: '上传',
            ),
            // 请求 Tab - 显示待处理数量徽章
            NavigationDestination(
              icon: _buildRequestIcon(Icons.inbox_outlined, pendingCount),
              selectedIcon: _buildRequestIcon(Icons.inbox, pendingCount),
              label: '请求',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: '我的',
            ),
          ],
        ),
      ),
    );
  }

  /// 构建请求图标（带徽章）
  Widget _buildRequestIcon(IconData icon, int pendingCount) {
    if (pendingCount <= 0) {
      return Icon(icon);
    }

    return Badge(
      label: Text(
        pendingCount > 99 ? '99+' : pendingCount.toString(),
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      backgroundColor: ThemeConfig.errorColor,
      child: Icon(icon),
    );
  }
}
