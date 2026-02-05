import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lottie/lottie.dart';

import '../providers/splash_state_provider.dart';

/// 动画开屏组件
///
/// 显示 Lottie 动画，动画完成后显示静态logo过渡，再通知后续页面
class AnimatedSplashScreen extends ConsumerStatefulWidget {
  final Widget child;
  final bool isReady;

  const AnimatedSplashScreen({
    super.key,
    required this.child,
    required this.isReady,
  });

  @override
  ConsumerState<AnimatedSplashScreen> createState() => _AnimatedSplashScreenState();
}

class _AnimatedSplashScreenState extends ConsumerState<AnimatedSplashScreen>
    with TickerProviderStateMixin {
  bool _animationFinished = false;
  bool _showSplash = true;
  bool _showStaticLogo = false; // 显示静态logo过渡
  bool _isFadingOut = false;
  bool _childBuilt = false;  // 延迟构建 child
  AnimationController? _lottieController;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _lottieController?.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(AnimatedSplashScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isReady && !oldWidget.isReady) {
      _checkHideSplash();
    }
  }

  void _onAnimationFinish() {
    if (!_animationFinished && mounted) {
      _animationFinished = true;
      // 标记 Lottie 动画完成
      ref.read(lottieFinishedProvider.notifier).state = true;
      // 先切换到静态 logo
      setState(() => _showStaticLogo = true);
      
      // 等静态 logo 渲染完成后，再构建 child，避免白屏
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() => _childBuilt = true);
          _checkHideSplash();
        }
      });
    }
  }

  void _checkHideSplash() {
    if (_animationFinished && widget.isReady && _showSplash && !_isFadingOut) {
      _isFadingOut = true;
      // 静态logo停留一小段时间，让后续页面有时间准备
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          ref.read(splashCompletedProvider.notifier).state = true;
          setState(() => _showSplash = false);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Stack(
        children: [
          // 延迟构建 child，直到 Lottie 动画完成
          if (_childBuilt) widget.child,
          
          // 开屏层
          if (_showSplash)
            Stack(
              children: [
                // 最底层：静态 logo（始终存在）
                Container(
                  color: Colors.white,
                  child: Center(
                    child: Image.asset(
                      'assets/images/icon.png',
                      width: 200,
                      height: 200,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                
                // 中间层：白色背景 + Lottie 动画（动画结束后隐藏）
                if (!_showStaticLogo)
                  Container(
                    color: Colors.white,
                    child: Center(
                      child: Lottie.asset(
                        'assets/animations/splash-animation.json',
                        width: 200,
                        height: 200,
                        fit: BoxFit.contain,
                        options: LottieOptions(enableMergePaths: true),
                        onLoaded: (composition) {
                          _lottieController = AnimationController(
                            vsync: this,
                            duration: composition.duration,
                          );
                          _lottieController!.addStatusListener((status) {
                            if (status == AnimationStatus.completed) {
                              _onAnimationFinish();
                            }
                          });
                          _lottieController!.forward();
                        },
                        controller: _lottieController,
                        errorBuilder: (context, error, stackTrace) {
                          Future.microtask(() => _onAnimationFinish());
                          return const SizedBox.shrink();
                        },
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
