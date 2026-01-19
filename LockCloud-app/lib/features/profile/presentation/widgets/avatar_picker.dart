import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/config/theme_config.dart';

/// 头像选择器组件
///
/// 显示用户头像，支持点击更换。
/// 显示上传进度和加载状态。
///
/// **Validates: Requirements 9.5**
class AvatarPicker extends StatelessWidget {
  /// 头像 URL
  final String? avatarUrl;

  /// 用户姓名（用于生成默认头像）
  final String name;

  /// 头像大小
  final double size;

  /// 是否正在上传
  final bool isUploading;

  /// 上传进度 (0.0 - 1.0)
  final double uploadProgress;

  /// 点击回调
  final VoidCallback? onTap;

  const AvatarPicker({
    super.key,
    this.avatarUrl,
    required this.name,
    this.size = 80,
    this.isUploading = false,
    this.uploadProgress = 0.0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        children: [
          // 头像
          _buildAvatar(),

          // 上传进度遮罩
          if (isUploading) _buildUploadOverlay(),

          // 编辑图标
          if (!isUploading && onTap != null) _buildEditBadge(),
        ],
      ),
    );
  }

  /// 构建头像
  Widget _buildAvatar() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: ThemeConfig.surfaceContainerColor,
        border: Border.all(
          color: ThemeConfig.primaryColor.withValues(alpha: 0.3),
          width: 3,
        ),
      ),
      child: ClipOval(
        child: avatarUrl != null && avatarUrl!.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: avatarUrl!,
                fit: BoxFit.cover,
                placeholder: (context, url) => _buildDefaultAvatar(),
                errorWidget: (context, url, error) => _buildDefaultAvatar(),
              )
            : _buildDefaultAvatar(),
      ),
    );
  }

  /// 构建默认头像（显示姓名首字母）
  Widget _buildDefaultAvatar() {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      color: ThemeConfig.primaryColor.withValues(alpha: 0.2),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            fontSize: size * 0.4,
            fontWeight: FontWeight.bold,
            color: ThemeConfig.primaryColor,
          ),
        ),
      ),
    );
  }

  /// 构建上传进度遮罩
  Widget _buildUploadOverlay() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.black.withValues(alpha: 0.6),
      ),
      child: Center(
        child: SizedBox(
          width: size * 0.5,
          height: size * 0.5,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 进度环
              CircularProgressIndicator(
                value: uploadProgress,
                strokeWidth: 3,
                color: ThemeConfig.primaryColor,
                backgroundColor: ThemeConfig.surfaceContainerColor,
              ),
              // 进度百分比
              Text(
                '${(uploadProgress * 100).toInt()}%',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建编辑图标徽章
  Widget _buildEditBadge() {
    return Positioned(
      right: 0,
      bottom: 0,
      child: Container(
        width: size * 0.32,
        height: size * 0.32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: ThemeConfig.primaryColor,
          border: Border.all(
            color: ThemeConfig.surfaceColor,
            width: 2,
          ),
        ),
        child: Icon(
          Icons.camera_alt,
          size: size * 0.16,
          color: Colors.white,
        ),
      ),
    );
  }
}
