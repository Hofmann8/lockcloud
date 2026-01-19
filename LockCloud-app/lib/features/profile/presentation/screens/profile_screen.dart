import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/config/theme_config.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/profile_provider.dart';
import '../widgets/avatar_picker.dart';

/// 个人中心页面 - 与 Web 端 UserMenu 风格一致
///
/// 显示用户头像、姓名、邮箱和退出登录按钮。
/// 支持头像上传功能。
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final ImagePicker _imagePicker = ImagePicker();
  bool _isLoggingOut = false;

  /// 选择并上传头像
  Future<void> _pickAndUploadAvatar() async {
    // 显示选择来源对话框
    final source = await _showImageSourceDialog();
    if (source == null) return;

    try {
      final XFile? pickedFile = await _imagePicker.pickImage(
        source: source,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 85,
      );

      if (pickedFile == null) return;

      // 获取内容类型
      final extension = pickedFile.path.split('.').last.toLowerCase();
      String contentType;
      switch (extension) {
        case 'png':
          contentType = 'image/png';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'webp':
          contentType = 'image/webp';
          break;
        default:
          contentType = 'image/jpeg';
      }

      // 上传头像
      final success = await ref.read(avatarUploadNotifierProvider.notifier).uploadAvatar(
        localPath: pickedFile.path,
        contentType: contentType,
      );

      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('头像更新成功'),
              backgroundColor: ThemeConfig.successColor,
            ),
          );
        } else {
          final state = ref.read(avatarUploadNotifierProvider);
          final errorMessage = switch (state) {
            AvatarUploadStateError(:final message) => message,
            _ => '上传失败',
          };
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMessage),
              backgroundColor: ThemeConfig.errorColor,
            ),
          );
        }
        // 重置上传状态
        ref.read(avatarUploadNotifierProvider.notifier).reset();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('选择图片失败: $e'),
            backgroundColor: ThemeConfig.errorColor,
          ),
        );
      }
    }
  }

  /// 显示图片来源选择对话框
  Future<ImageSource?> _showImageSourceDialog() async {
    return showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: ThemeConfig.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 拖动指示器
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: ThemeConfig.accentGray.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: Icon(Icons.camera_alt_outlined, color: ThemeConfig.primaryColor),
                title: Text('拍照', style: TextStyle(color: ThemeConfig.primaryBlack)),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: Icon(Icons.photo_library_outlined, color: ThemeConfig.primaryColor),
                title: Text('从相册选择', style: TextStyle(color: ThemeConfig.primaryBlack)),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
              const SizedBox(height: 8),
              ListTile(
                leading: Icon(Icons.close, color: ThemeConfig.accentGray),
                title: Text('取消', style: TextStyle(color: ThemeConfig.accentGray)),
                onTap: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 处理退出登录
  Future<void> _handleLogout() async {
    // 显示确认对话框
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('退出登录', style: TextStyle(color: ThemeConfig.primaryBlack)),
        content: Text('确定要退出登录吗？', style: TextStyle(color: ThemeConfig.onSurfaceVariantColor)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('取消', style: TextStyle(color: ThemeConfig.accentGray)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.errorColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('退出'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isLoggingOut = true);

    try {
      await ref.read(authNotifierProvider.notifier).logout();
    } finally {
      if (mounted) {
        setState(() => _isLoggingOut = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final uploadState = ref.watch(avatarUploadNotifierProvider);

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: Text('我的', style: TextStyle(color: ThemeConfig.primaryBlack)),
        backgroundColor: ThemeConfig.surfaceColor,
        elevation: 0,
        centerTitle: true,
      ),
      body: user == null
          ? Center(
              child: CircularProgressIndicator(
                color: ThemeConfig.primaryColor,
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // 用户信息卡片
                  _buildUserInfoCard(user, uploadState),
                  
                  const SizedBox(height: 24),
                  
                  // 设置选项
                  _buildSettingsSection(),
                  
                  const SizedBox(height: 24),
                  
                  // 退出登录按钮
                  _buildLogoutButton(),
                  
                  const SizedBox(height: 32),
                  
                  // 版本信息
                  _buildVersionInfo(),
                ],
              ),
            ),
    );
  }

  /// 构建用户信息卡片
  Widget _buildUserInfoCard(user, AvatarUploadState uploadState) {
    final isUploading = uploadState is AvatarUploadStateUploading;
    final uploadProgress = switch (uploadState) {
      AvatarUploadStateUploading(:final progress) => progress,
      _ => 0.0,
    };

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ThemeConfig.borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // 头像
          AvatarPicker(
            avatarUrl: user.avatarUrl,
            name: user.name,
            size: 100,
            isUploading: isUploading,
            uploadProgress: uploadProgress,
            onTap: isUploading ? null : _pickAndUploadAvatar,
          ),
          
          const SizedBox(height: 16),
          
          // 姓名
          Text(
            user.name,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: ThemeConfig.primaryBlack,
            ),
          ),
          
          const SizedBox(height: 8),
          
          // 邮箱
          Text(
            user.email,
            style: TextStyle(
              fontSize: 14,
              color: ThemeConfig.accentGray,
            ),
          ),
          
          // 管理员标识
          if (user.isAdmin) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: ThemeConfig.primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: ThemeConfig.primaryColor.withValues(alpha: 0.3)),
              ),
              child: Text(
                '管理员',
                style: TextStyle(
                  fontSize: 12,
                  color: ThemeConfig.primaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// 构建设置选项区域
  Widget _buildSettingsSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ThemeConfig.borderColor),
      ),
      child: Column(
        children: [
          _buildSettingItem(
            icon: Icons.info_outline,
            title: '关于 LockCloud',
            onTap: () => _showAboutDialog(),
          ),
        ],
      ),
    );
  }

  /// 构建设置项
  Widget _buildSettingItem({
    required IconData icon,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(icon, color: ThemeConfig.accentGray),
      title: Text(
        title,
        style: TextStyle(
          color: ThemeConfig.primaryBlack,
          fontSize: 16,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(
                color: ThemeConfig.accentGray,
                fontSize: 13,
              ),
            )
          : null,
      trailing: trailing ?? Icon(
        Icons.chevron_right,
        color: ThemeConfig.accentGray,
      ),
      onTap: onTap,
    );
  }

  /// 构建退出登录按钮
  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _isLoggingOut ? null : _handleLogout,
        icon: _isLoggingOut
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: ThemeConfig.errorColor,
                ),
              )
            : Icon(Icons.logout, color: ThemeConfig.errorColor),
        label: Text(
          _isLoggingOut ? '退出中...' : '退出登录',
          style: TextStyle(color: ThemeConfig.errorColor),
        ),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: ThemeConfig.errorColor),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  /// 构建版本信息
  Widget _buildVersionInfo() {
    return Text(
      'LockCloud v1.0.0',
      style: TextStyle(
        fontSize: 12,
        color: ThemeConfig.accentGray,
      ),
    );
  }

  /// 显示关于对话框
  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('关于 LockCloud', style: TextStyle(color: ThemeConfig.primaryBlack)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'LockCloud 是浙江大学 DFM Locking 舞队的私有云存储服务。',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '版本: 1.0.0',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 14,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('确定', style: TextStyle(color: ThemeConfig.primaryColor)),
          ),
        ],
      ),
    );
  }
}
