import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 开屏动画状态 Provider
/// 
/// 用于控制登录页logo的显示，等开屏动画的logo移动完成后再显示
final splashCompletedProvider = StateProvider<bool>((ref) => false);

/// Lottie 动画完成状态（用于延迟数据加载）
final lottieFinishedProvider = StateProvider<bool>((ref) => false);

/// 登录页logo的GlobalKey，用于获取精确位置
final loginLogoKeyProvider = Provider<GlobalKey>((ref) => GlobalKey());

/// 首页logo的GlobalKey，用于获取精确位置
final homeLogoKeyProvider = Provider<GlobalKey>((ref) => GlobalKey());

/// 标记是否是 app 启动时就已登录的状态
/// 
/// true = app 启动时检测到已登录，首页应播放后半截动画
/// false = 用户手动登录后跳转，首页不应播放动画
final wasAuthenticatedOnLaunchProvider = StateProvider<bool>((ref) => false);

/// 标记是否是 app 首次启动（用于控制登录页动画）
/// 
/// true = app 刚启动，登录页应播放后半截动画
/// false = 退出登录后返回登录页，不应播放动画
final isFirstLaunchProvider = StateProvider<bool>((ref) => true);

