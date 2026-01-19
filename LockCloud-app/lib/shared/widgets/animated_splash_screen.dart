import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lottie/lottie.dart';

import '../providers/splash_state_provider.dart';

/// 动画开屏组件
///
/// 显示 Lottie 动画，动画完成后淡出
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
  bool _isFadingOut = false;
  AnimationController? _lottieController;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    
    _fadeController.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        ref.read(splashCompletedProvider.notifier).state = true;
        setState(() => _showSplash = false);
      }
    });
  }

  @override
  void dispose() {
    _lottieController?.dispose();
    _fadeController.dispose();
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
      _checkHideSplash();
    }
  }

  void _checkHideSplash() {
    if (_animationFinished && widget.isReady && _showSplash && !_isFadingOut) {
      _isFadingOut = true;
      Future.delayed(const Duration(milliseconds: 50), () {
        if (mounted) {
          _fadeController.forward();
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
          
          // 开屏背景和Lottie动画
          if (_showSplash)
            FadeTransition(
              opacity: _fadeAnimation,
              child: Container(
                color: Colors.white,
                child: Center(
                  child: Lottie.asset(
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
                      Future.microtask(() => _onAnimationFinish());
                      return Image.asset(
                        'assets/images/icon.png',
                        width: 100,
                        height: 100,
                        errorBuilder: (context, error, stackTrace) {
                          return const Icon(
                            Icons.cloud_outlined,
                            size: 100,
                            color: Color(0xFF5fa8d3),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
