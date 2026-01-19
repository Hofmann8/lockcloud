import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 开屏动画状态 Provider
/// 
/// 用于控制登录页logo的显示，等开屏动画的logo移动完成后再显示
final splashCompletedProvider = StateProvider<bool>((ref) => false);

/// 登录页logo的GlobalKey，用于获取精确位置
final loginLogoKeyProvider = Provider<GlobalKey>((ref) => GlobalKey());

