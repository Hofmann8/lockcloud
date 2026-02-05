import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../router/app_router.dart';
import '../../../../shared/providers/splash_state_provider.dart';
import '../providers/auth_provider.dart';

/// 登录页面
///
/// 内嵌登录表单，直接调用 SSO 的 /api/auth/login 接口进行登录
/// 布局与 Web 前端 auth/layout.tsx 保持一致
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  bool _obscurePassword = true;
  
  // 是否需要播放动画（只有首次启动才播放）
  late bool _shouldPlayAnimation;
  
  // 移动logo动画
  late AnimationController _logoMoveController;
  late Animation<double> _logoPositionAnimation;
  late Animation<double> _logoScaleAnimation;
  bool _showMovingLogo = false;
  Offset? _targetOffset;
  
  // 内容淡入动画
  late AnimationController _fadeController;
  late Animation<double> _titleAnimation;
  late Animation<double> _formAnimation;
  late Animation<double> _footerAnimation;

  @override
  void initState() {
    super.initState();
    
    // 检查是否是首次启动，决定是否播放动画
    _shouldPlayAnimation = ref.read(isFirstLaunchProvider);
    
    // Logo移动动画
    _logoMoveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _logoPositionAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoMoveController, curve: Curves.easeInOutCubic),
    );
    _logoScaleAnimation = Tween<double>(begin: 1.0, end: 0.5).animate(
      CurvedAnimation(parent: _logoMoveController, curve: Curves.easeInOutCubic),
    );
    
    // 内容淡入动画
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    
    // 标题先出现
    _titleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _fadeController,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
      ),
    );
    
    // 表单稍后出现
    _formAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _fadeController,
        curve: const Interval(0.2, 0.7, curve: Curves.easeOut),
      ),
    );
    
    // Footer最后出现
    _footerAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _fadeController,
        curve: const Interval(0.4, 1.0, curve: Curves.easeOut),
      ),
    );
    
    // Logo移动完成后开始内容淡入
    _logoMoveController.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _showMovingLogo = false);
        _fadeController.forward();
        // 动画播放完成后标记不再是首次启动
        ref.read(isFirstLaunchProvider.notifier).state = false;
      }
    });
    
    // 如果不需要播放动画，直接显示内容
    if (!_shouldPlayAnimation) {
      _fadeController.value = 1.0;  // 直接设置为完成状态
    }
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAuthState();
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _logoMoveController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  void _checkAuthState() {
    final authState = ref.read(authNotifierProvider);
    if (authState is AuthStateAuthenticated) {
      context.go(AppRoutes.home);
    }
  }
  
  /// 获取目标logo的精确位置
  Offset? _getTargetPosition() {
    final logoKey = ref.read(loginLogoKeyProvider);
    final renderBox = logoKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return null;
    
    final position = renderBox.localToGlobal(Offset.zero);
    final size = renderBox.size;
    return Offset(
      position.dx + size.width / 2,
      position.dy + size.height / 2,
    );
  }
  
  /// 开始logo移动动画
  void _startLogoAnimation() {
    if (_showMovingLogo || _logoMoveController.isAnimating) return;
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      
      _targetOffset = _getTargetPosition();
      setState(() => _showMovingLogo = true);
      
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted) {
          _logoMoveController.forward();
        }
      });
    });
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await ref.read(authNotifierProvider.notifier).login(
        _emailController.text.trim(),
        _passwordController.text,
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // 监听认证状态
    ref.listen<AuthState>(authNotifierProvider, (previous, next) {
      switch (next) {
        case AuthStateAuthenticated():
          context.go(AppRoutes.home);
          break;
        case AuthStateError(:final message):
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: ThemeConfig.errorColor,
            ),
          );
          break;
        default:
          break;
      }
    });
    
    // 监听开屏动画完成，触发logo移动动画（只有首次启动才播放）
    if (_shouldPlayAnimation) {
      ref.listen<bool>(splashCompletedProvider, (previous, next) {
        if (next && !_logoMoveController.isAnimating && _logoMoveController.value == 0) {
          _startLogoAnimation();
        }
      });
    }

    final authState = ref.watch(authNotifierProvider);
    final isAuthLoading = authState is AuthStateLoading;
    final isDisabled = _isLoading || isAuthLoading;
    // 不播放动画时 logo 直接显示，否则等动画完成
    final logoAnimationDone = !_shouldPlayAnimation || _logoMoveController.isCompleted;
    
    final screenSize = MediaQuery.of(context).size;
    final screenCenter = Offset(screenSize.width / 2, screenSize.height / 2);
    final targetOffset = _targetOffset ?? screenCenter;
    final deltaX = targetOffset.dx - screenCenter.dx;
    final deltaY = targetOffset.dy - screenCenter.dy;

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      body: Stack(
        children: [
          // 主内容
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: AnimatedBuilder(
                  animation: _fadeController,
                  builder: (context, child) {
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Header: Logo + Title + Subtitle
                        _buildHeader(logoAnimationDone, _titleAnimation.value),
                        
                        const SizedBox(height: 32),
                        
                        // Form Card
                        Opacity(
                          opacity: _formAnimation.value,
                          child: _buildFormCard(isDisabled),
                        ),
                        
                        const SizedBox(height: 32),
                        
                        // Footer
                        Opacity(
                          opacity: _footerAnimation.value,
                          child: _buildFooter(),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
          
          // 移动的logo（覆盖在上面）
          if (_showMovingLogo)
            AnimatedBuilder(
              animation: _logoMoveController,
              builder: (context, child) {
                return Positioned.fill(
                  child: IgnorePointer(
                    child: Center(
                      child: Transform.translate(
                        offset: Offset(
                          deltaX * _logoPositionAnimation.value,
                          deltaY * _logoPositionAnimation.value,
                        ),
                        child: Transform.scale(
                          scale: _logoScaleAnimation.value,
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
                );
              },
            ),
        ],
      ),
    );
  }

  /// Header: Logo + LockCloud + Funk & Love 云存储
  Widget _buildHeader(bool logoAnimationDone, double titleOpacity) {
    final logoKey = ref.watch(loginLogoKeyProvider);
    
    return Column(
      children: [
        // Logo - logo动画完成后才显示
        Opacity(
          opacity: logoAnimationDone ? 1.0 : 0.0,
          child: SizedBox(
            key: logoKey,
            width: 100,
            height: 100,
            child: Image.asset(
              'assets/images/icon.png',
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const Icon(
                Icons.cloud_outlined,
                size: 80,
                color: Colors.black,
              ),
            ),
          ),
        ),
        
        const SizedBox(height: 16),
        
        // Title
        Opacity(
          opacity: titleOpacity,
          child: Text(
            'LockCloud',
            style: TextStyle(
              fontSize: 36,
              fontWeight: FontWeight.bold,
              color: ThemeConfig.primaryBlack,
              letterSpacing: 1,
            ),
          ),
        ),
        
        const SizedBox(height: 8),
        
        // Subtitle
        Opacity(
          opacity: titleOpacity,
          child: Text(
            'Funk & Love 云存储',
            style: TextStyle(
              fontSize: 16,
              color: ThemeConfig.accentGray,
            ),
          ),
        ),
      ],
    );
  }

  /// Form Card: 登录表单卡片 - 与 Web 端 hand-drawn-card 风格一致
  Widget _buildFormCard(bool isDisabled) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 400),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ThemeConfig.borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Form Title
            Text(
              '登录',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: ThemeConfig.primaryBlack,
              ),
            ),
            
            const SizedBox(height: 4),
            
            Text(
              '欢迎回到 LockCloud',
              style: TextStyle(
                fontSize: 14,
                color: ThemeConfig.accentGray,
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Email Input
            _buildTextField(
              controller: _emailController,
              hintText: '邮箱',
              keyboardType: TextInputType.emailAddress,
              enabled: !isDisabled,
              prefixIcon: Icons.email_outlined,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return '请输入邮箱';
                }
                return null;
              },
            ),
            
            const SizedBox(height: 16),
            
            // Password Input
            _buildTextField(
              controller: _passwordController,
              hintText: '密码',
              obscureText: _obscurePassword,
              enabled: !isDisabled,
              prefixIcon: Icons.lock_outlined,
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: ThemeConfig.accentGray,
                  size: 20,
                ),
                onPressed: () {
                  setState(() => _obscurePassword = !_obscurePassword);
                },
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '请输入密码';
                }
                return null;
              },
              onFieldSubmitted: (_) => _handleLogin(),
            ),
            
            const SizedBox(height: 24),
            
            // Login Button - 与 Web 端 btn-functional primary 风格一致
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: isDisabled ? null : _handleLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeConfig.primaryBlack,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: ThemeConfig.accentGray,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: isDisabled
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text(
                        '登录',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Hint
            Text(
              '使用 Funk & Love 统一账号登录',
              style: TextStyle(
                fontSize: 12,
                color: ThemeConfig.hintColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建输入框 - 与 Web 端 input-functional 风格一致
  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    TextInputType? keyboardType,
    bool obscureText = false,
    bool enabled = true,
    IconData? prefixIcon,
    Widget? suffixIcon,
    String? Function(String?)? validator,
    void Function(String)? onFieldSubmitted,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      autocorrect: false,
      enabled: enabled,
      style: TextStyle(
        color: ThemeConfig.primaryBlack,
        fontSize: 16,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(color: ThemeConfig.hintColor),
        filled: true,
        fillColor: ThemeConfig.surfaceContainerColor,
        prefixIcon: prefixIcon != null
            ? Icon(prefixIcon, color: ThemeConfig.accentGray, size: 20)
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: ThemeConfig.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: ThemeConfig.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: ThemeConfig.primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: ThemeConfig.errorColor),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: ThemeConfig.errorColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        suffixIcon: suffixIcon,
      ),
      validator: validator,
      onFieldSubmitted: onFieldSubmitted,
    );
  }

  /// Footer: 浙江大学 DFM Locking 舞队 / 建设者：Hofmann
  Widget _buildFooter() {
    return Column(
      children: [
        Text(
          '浙江大学 DFM Locking 舞队',
          style: TextStyle(
            fontSize: 13,
            color: ThemeConfig.accentGray,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '建设者：Hofmann',
          style: TextStyle(
            fontSize: 13,
            color: ThemeConfig.accentGray,
          ),
        ),
      ],
    );
  }
}
