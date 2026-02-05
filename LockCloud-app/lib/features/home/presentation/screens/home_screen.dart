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

class _HomeScreenState extends ConsumerState<HomeScreen> with TickerProviderStateMixin {
  int _currentIndex = 0;
  late bool _showLoadingOverlay;  // 根据启动状态决定
  bool _animationStarted = false;
  bool _positionInitialized = false;
  
  // Logo 飞行动画（位置 + 缩放）
  late AnimationController _flyController;
  
  // 背景淡出动画
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  
  // 动画参数（会在第一次 build 时初始化）
  double _targetX = 0;
  double _targetY = 0;
  double _startX = 0;
  double _startY = 0;
  static const double _startSize = 200.0;
  static const double _endSize = 32.0;

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
    
    // 只有 app 启动时就已登录才显示遮罩和动画，手动登录跳转直接不显示
    final wasAuthOnLaunch = ref.read(wasAuthenticatedOnLaunchProvider);
    _showLoadingOverlay = wasAuthOnLaunch;
    
    // Logo 飞行动画控制器
    _flyController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    
    // 背景淡出控制器
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    
    _fadeController.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _showLoadingOverlay = false);
      }
    });
  }

  @override
  void dispose() {
    _flyController.dispose();
    _fadeController.dispose();
    super.dispose();
  }
  
  void _startTransitionAnimation(BuildContext context) {
    if (_animationStarted) return;
    _animationStarted = true;
    
    // 获取目标 logo 的精确位置
    final targetPos = _getTargetPosition();
    if (targetPos != null) {
      _targetX = targetPos.dx;
      _targetY = targetPos.dy;
    }
    
    // 开始动画序列
    _flyController.forward().then((_) {
      // Logo 飞到位后，淡出背景
      _fadeController.forward();
    });
  }
  
  /// 初始化位置参数（在第一次 build 时调用）
  void _initPositions(BuildContext context) {
    if (_positionInitialized) return;
    _positionInitialized = true;
    
    final screenSize = MediaQuery.of(context).size;
    
    // 起始位置：屏幕中心
    _startX = screenSize.width / 2;
    _startY = screenSize.height / 2;
  }
  
  /// 获取目标 logo 的精确位置
  Offset? _getTargetPosition() {
    final logoKey = ref.read(homeLogoKeyProvider);
    final renderBox = logoKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return null;
    
    final position = renderBox.localToGlobal(Offset.zero);
    final size = renderBox.size;
    return Offset(
      position.dx + size.width / 2,
      position.dy + size.height / 2,
    );
  }

  /// 切换页面
  void _onDestinationSelected(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    // 初始化位置参数（确保在动画开始前就有正确的起始位置）
    _initPositions(context);
    
    // 监听待处理请求数量
    final pendingCount = ref.watch(pendingRequestCountProvider);
    
    // 监听开屏动画完成和文件列表加载状态
    final splashCompleted = ref.watch(splashCompletedProvider);
    final filesState = ref.watch(filesNotifierProvider);
    final isFilesLoaded = !filesState.isLoading && filesState.files.isNotEmpty;
    
    // 开屏完成且文件加载好后，开始动画（只有 _showLoadingOverlay 为 true 时才会执行）
    if (splashCompleted && isFilesLoaded && _showLoadingOverlay && !_animationStarted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted) {
              _startTransitionAnimation(context);
            }
          });
        }
      });
    }

    return Stack(
      children: [
        // 主内容（直接渲染，被遮罩挡住）
        Scaffold(
          body: IndexedStack(
            index: _currentIndex,
            children: _pages,
          ),
          bottomNavigationBar: _buildBottomNavigationBar(pendingCount),
        ),
        
        // 加载遮罩（白色背景 + 飞行 logo）
        if (_showLoadingOverlay)
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _fadeAnimation,
              builder: (context, child) => Opacity(
                opacity: _fadeAnimation.value,
                child: Container(
                  color: Colors.white,
                  child: AnimatedBuilder(
                    animation: _flyController,
                    builder: (context, child) {
                      // 计算当前位置和大小
                      final progress = Curves.easeInOutCubic.transform(_flyController.value);
                      final currentX = _startX + (_targetX - _startX) * progress;
                      final currentY = _startY + (_targetY - _startY) * progress;
                      final currentSize = _startSize + (_endSize - _startSize) * progress;
                      
                      return Stack(
                        children: [
                          Positioned(
                            left: currentX - currentSize / 2,
                            top: currentY - currentSize / 2,
                            width: currentSize,
                            height: currentSize,
                            child: Image.asset(
                              'assets/images/icon.png',
                              fit: BoxFit.contain,
                            ),
                          ),
                        ],
                      );
                    },
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
              icon: Icon(Icons.swap_horiz_outlined),
              selectedIcon: Icon(Icons.swap_horiz),
              label: '传输',
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
