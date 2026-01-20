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
      // 动画结束，切换到静态logo
      setState(() => _showStaticLogo = true);
      _checkHideSplash();
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
          widget.child,
          
          // 开屏层
          if (_showSplash)
            Container(
              color: Colors.white,
              child: Center(
                child: _showStaticLogo
                    // 静态logo（承接动画结尾，避免卡顿可见）
                    ? SizedBox(
                        width: 200,
                        height: 200,
                        child: Image.asset(
                          'assets/images/icon.png',
                          fit: BoxFit.contain,
                        ),
                      )
                    // Lottie动画
                    : Lottie.asset(
                        'assets/animations/splash-animation.json',
                        width: 200,
                        height: 200,
                        fit: BoxFit.contain,
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
                          // 动画加载失败，直接跳过
                          Future.microtask(() => _onAnimationFinish());
                          return const SizedBox.shrink();
                        },
                      ),
              ),
            ),
        ],
      ),
    );
  }
}
