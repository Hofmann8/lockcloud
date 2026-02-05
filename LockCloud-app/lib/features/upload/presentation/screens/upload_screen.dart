import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/config/theme_config.dart';
import '../providers/upload_queue_provider.dart';
import '../widgets/upload_form.dart';
import '../widgets/upload_queue.dart';

/// 上传页面 - 与 Web 端 upload 页面风格一致
///
/// 显示文件选择器入口和上传队列，支持：
/// - 选择图片或视频文件
/// - 填写上传元数据
/// - 查看上传队列和进度
class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  final ImagePicker _picker = ImagePicker();
  List<XFile>? _selectedFiles;
  bool _showForm = false;

  /// 选择图片
  Future<void> _pickImages() async {
    try {
      final files = await _picker.pickMultiImage(
        imageQuality: 100,
      );

      if (files.isNotEmpty) {
        setState(() {
          _selectedFiles = files;
          _showForm = true;
        });
      }
    } catch (e) {
      _showErrorSnackBar('选择图片失败: $e');
    }
  }

  /// 选择视频
  Future<void> _pickVideo() async {
    try {
      final file = await _picker.pickVideo(
        source: ImageSource.gallery,
      );

      if (file != null) {
        setState(() {
          _selectedFiles = [file];
          _showForm = true;
        });
      }
    } catch (e) {
      _showErrorSnackBar('选择视频失败: $e');
    }
  }

  /// 拍照
  Future<void> _takePhoto() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 100,
      );

      if (file != null) {
        setState(() {
          _selectedFiles = [file];
          _showForm = true;
        });
      }
    } catch (e) {
      _showErrorSnackBar('拍照失败: $e');
    }
  }

  /// 录制视频
  Future<void> _recordVideo() async {
    try {
      final file = await _picker.pickVideo(
        source: ImageSource.camera,
      );

      if (file != null) {
        setState(() {
          _selectedFiles = [file];
          _showForm = true;
        });
      }
    } catch (e) {
      _showErrorSnackBar('录制视频失败: $e');
    }
  }

  /// 取消选择
  void _cancelSelection() {
    setState(() {
      _selectedFiles = null;
      _showForm = false;
    });
  }

  /// 显示错误提示
  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ThemeConfig.errorColor,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasUploadTasks = ref.watch(hasUploadTasksProvider);

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: Text('传输', style: TextStyle(color: ThemeConfig.primaryBlack)),
        backgroundColor: ThemeConfig.surfaceColor,
        elevation: 0,
        centerTitle: true,
        actions: [
          if (hasUploadTasks)
            IconButton(
              icon: Icon(Icons.delete_sweep_outlined, color: ThemeConfig.accentGray),
              onPressed: () {
                _showClearConfirmDialog();
              },
              tooltip: '清除已完成',
            ),
        ],
      ),
      body: SafeArea(
        child: _showForm && _selectedFiles != null
            ? _buildUploadForm()
            : _buildMainContent(hasUploadTasks),
      ),
    );
  }

  /// 构建主内容
  Widget _buildMainContent(bool hasUploadTasks) {
    return Column(
      children: [
        // 文件选择区域
        _buildFilePickerSection(),

        // 传输队列
        if (hasUploadTasks)
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Icon(Icons.swap_horiz, size: 20, color: ThemeConfig.primaryColor),
                      const SizedBox(width: 8),
                      Text(
                        '传输队列',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: ThemeConfig.primaryBlack,
                        ),
                      ),
                      const Spacer(),
                      _buildQueueStats(),
                    ],
                  ),
                ),
                const Expanded(
                  child: UploadQueueWidget(),
                ),
              ],
            ),
          )
        else
          Expanded(
            child: _buildEmptyState(),
          ),
      ],
    );
  }

  /// 构建文件选择区域 - 与 Web 端 MultiFileUploadZone 风格一致
  Widget _buildFilePickerSection() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: ThemeConfig.borderColor,
          width: 1,
        ),
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
          Icon(
            Icons.cloud_upload_outlined,
            size: 56,
            color: ThemeConfig.primaryColor,
          ),
          const SizedBox(height: 16),
          Text(
            '选择要上传的文件',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: ThemeConfig.primaryBlack,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '支持图片和视频文件',
            style: TextStyle(
              fontSize: 14,
              color: ThemeConfig.accentGray,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: _buildPickerButton(
                  icon: Icons.photo_library_outlined,
                  label: '选择图片',
                  onTap: _pickImages,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPickerButton(
                  icon: Icons.video_library_outlined,
                  label: '选择视频',
                  onTap: _pickVideo,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildPickerButton(
                  icon: Icons.camera_alt_outlined,
                  label: '拍照',
                  onTap: _takePhoto,
                  outlined: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildPickerButton(
                  icon: Icons.videocam_outlined,
                  label: '录制视频',
                  onTap: _recordVideo,
                  outlined: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 构建选择按钮
  Widget _buildPickerButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool outlined = false,
  }) {
    if (outlined) {
      return OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: ThemeConfig.primaryColor,
          side: BorderSide(color: ThemeConfig.primaryColor),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    }

    return ElevatedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 20),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: ThemeConfig.primaryColor,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        elevation: 0,
      ),
    );
  }

  /// 构建队列统计
  Widget _buildQueueStats() {
    final pendingCount = ref.watch(pendingUploadCountProvider);
    final uploadingCount = ref.watch(uploadingCountProvider);
    final completedCount = ref.watch(completedUploadCountProvider);
    final failedCount = ref.watch(failedUploadCountProvider);

    return Row(
      children: [
        if (uploadingCount > 0)
          _buildStatBadge(
            count: uploadingCount,
            color: ThemeConfig.accentBlue,
            icon: Icons.upload,
          ),
        if (pendingCount > 0)
          _buildStatBadge(
            count: pendingCount,
            color: ThemeConfig.warningColor,
            icon: Icons.schedule,
          ),
        if (completedCount > 0)
          _buildStatBadge(
            count: completedCount,
            color: ThemeConfig.successColor,
            icon: Icons.check_circle,
          ),
        if (failedCount > 0)
          _buildStatBadge(
            count: failedCount,
            color: ThemeConfig.errorColor,
            icon: Icons.error,
          ),
      ],
    );
  }

  /// 构建统计徽章
  Widget _buildStatBadge({
    required int count,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      margin: const EdgeInsets.only(left: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            '$count',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建空状态
  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inbox_outlined,
            size: 80,
            color: ThemeConfig.accentGray.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            '暂无传输任务',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '上传或下载文件时将显示在这里',
            style: TextStyle(
              color: ThemeConfig.accentGray,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建上传表单
  Widget _buildUploadForm() {
    return UploadFormWidget(
      files: _selectedFiles!,
      onCancel: _cancelSelection,
      onSubmit: () {
        setState(() {
          _selectedFiles = null;
          _showForm = false;
        });
      },
    );
  }

  /// 显示清除确认对话框
  void _showClearConfirmDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('清除已完成', style: TextStyle(color: ThemeConfig.primaryBlack)),
        content: Text('确定要清除所有已完成的上传任务吗？', style: TextStyle(color: ThemeConfig.onSurfaceVariantColor)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('取消', style: TextStyle(color: ThemeConfig.accentGray)),
          ),
          ElevatedButton(
            onPressed: () {
              ref.read(uploadQueueNotifierProvider.notifier).clearCompleted();
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }
}
