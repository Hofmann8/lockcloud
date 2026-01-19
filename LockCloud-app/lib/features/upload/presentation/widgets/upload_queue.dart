import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/upload_queue_item.dart';
import '../providers/upload_queue_provider.dart';

/// 上传队列组件
///
/// 显示上传队列项列表，包括：
/// - 文件名、大小
/// - 上传进度
/// - 上传状态
/// - 重试和删除操作
///
/// **Validates: Requirements 3.5, 3.7, 3.8, 3.9**
class UploadQueueWidget extends ConsumerWidget {
  const UploadQueueWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueState = ref.watch(uploadQueueNotifierProvider);
    final items = queueState.items;

    if (items.isEmpty) {
      return const Center(
        child: Text(
          '暂无上传任务',
          style: TextStyle(
            color: ThemeConfig.onSurfaceVariantColor,
            fontSize: 14,
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        return UploadQueueItemWidget(item: item);
      },
    );
  }
}

/// 上传队列项组件
///
/// 显示单个上传项的信息和操作
///
/// **Validates: Requirements 3.5, 3.7, 3.8, 3.9**
class UploadQueueItemWidget extends ConsumerWidget {
  final UploadQueueItem item;

  const UploadQueueItemWidget({
    super.key,
    required this.item,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _getBorderColor(),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 文件信息行
          Row(
            children: [
              // 文件图标
              _buildFileIcon(),
              const SizedBox(width: 12),

              // 文件名和大小
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.originalFilename,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: ThemeConfig.onBackgroundColor,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.formattedSize,
                      style: const TextStyle(
                        fontSize: 12,
                        color: ThemeConfig.onSurfaceVariantColor,
                      ),
                    ),
                  ],
                ),
              ),

              // 状态和操作
              _buildStatusAndActions(ref),
            ],
          ),

          // 进度条（上传中时显示）
          if (item.status == UploadStatus.uploading) ...[
            const SizedBox(height: 12),
            _buildProgressBar(),
          ],

          // 错误信息（失败时显示）
          if (item.status == UploadStatus.failed &&
              item.errorMessage != null) ...[
            const SizedBox(height: 8),
            _buildErrorMessage(),
          ],
        ],
      ),
    );
  }

  /// 获取边框颜色
  Color _getBorderColor() {
    switch (item.status) {
      case UploadStatus.uploading:
        return ThemeConfig.primaryColor.withValues(alpha: 0.5);
      case UploadStatus.success:
        return ThemeConfig.accentGreen.withValues(alpha: 0.5);
      case UploadStatus.failed:
        return ThemeConfig.errorColor.withValues(alpha: 0.5);
      default:
        return ThemeConfig.borderColor;
    }
  }

  /// 构建文件图标
  Widget _buildFileIcon() {
    final isVideo = item.contentType.startsWith('video/');
    final IconData icon;
    final Color color;

    switch (item.status) {
      case UploadStatus.pending:
        icon = isVideo ? Icons.videocam : Icons.image;
        color = ThemeConfig.onSurfaceVariantColor;
        break;
      case UploadStatus.uploading:
        icon = Icons.cloud_upload;
        color = ThemeConfig.primaryColor;
        break;
      case UploadStatus.success:
        icon = Icons.check_circle;
        color = ThemeConfig.accentGreen;
        break;
      case UploadStatus.failed:
        icon = Icons.error;
        color = ThemeConfig.errorColor;
        break;
      case UploadStatus.cancelled:
        icon = Icons.cancel;
        color = ThemeConfig.warningColor;
        break;
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        icon,
        color: color,
        size: 24,
      ),
    );
  }

  /// 构建状态和操作按钮
  Widget _buildStatusAndActions(WidgetRef ref) {
    switch (item.status) {
      case UploadStatus.pending:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatusChip('等待中', ThemeConfig.warningColor),
            const SizedBox(width: 8),
            _buildRemoveButton(ref),
          ],
        );

      case UploadStatus.uploading:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              item.progressPercent,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: ThemeConfig.primaryColor,
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: ThemeConfig.primaryColor,
                backgroundColor: ThemeConfig.surfaceContainerColor,
              ),
            ),
          ],
        );

      case UploadStatus.success:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatusChip('已完成', ThemeConfig.accentGreen),
            const SizedBox(width: 8),
            _buildRemoveButton(ref),
          ],
        );

      case UploadStatus.failed:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (item.canRetry) ...[
              _buildRetryButton(ref),
              const SizedBox(width: 8),
            ],
            _buildRemoveButton(ref),
          ],
        );

      case UploadStatus.cancelled:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatusChip('已取消', ThemeConfig.warningColor),
            const SizedBox(width: 8),
            _buildRemoveButton(ref),
          ],
        );
    }
  }

  /// 构建状态标签
  Widget _buildStatusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
    );
  }

  /// 构建重试按钮
  ///
  /// **Validates: Requirements 3.8**
  Widget _buildRetryButton(WidgetRef ref) {
    return IconButton(
      onPressed: () {
        ref.read(uploadQueueNotifierProvider.notifier).retryItem(item.id);
      },
      icon: const Icon(Icons.refresh),
      iconSize: 20,
      color: ThemeConfig.primaryColor,
      tooltip: '重试',
      constraints: const BoxConstraints(
        minWidth: 32,
        minHeight: 32,
      ),
      padding: EdgeInsets.zero,
    );
  }

  /// 构建删除按钮
  Widget _buildRemoveButton(WidgetRef ref) {
    return IconButton(
      onPressed: () {
        ref.read(uploadQueueNotifierProvider.notifier).removeItem(item.id);
      },
      icon: const Icon(Icons.close),
      iconSize: 20,
      color: ThemeConfig.onSurfaceVariantColor,
      tooltip: '移除',
      constraints: const BoxConstraints(
        minWidth: 32,
        minHeight: 32,
      ),
      padding: EdgeInsets.zero,
    );
  }

  /// 构建进度条
  ///
  /// **Validates: Requirements 3.7**
  Widget _buildProgressBar() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: item.progress,
            backgroundColor: ThemeConfig.surfaceContainerColor,
            valueColor: const AlwaysStoppedAnimation<Color>(
              ThemeConfig.primaryColor,
            ),
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          _getProgressText(),
          style: const TextStyle(
            fontSize: 11,
            color: ThemeConfig.onSurfaceVariantColor,
          ),
        ),
      ],
    );
  }

  /// 获取进度文本
  String _getProgressText() {
    final uploadedBytes = (item.size * item.progress).round();
    final uploadedSize = _formatSize(uploadedBytes);
    return '$uploadedSize / ${item.formattedSize}';
  }

  /// 格式化文件大小
  String _formatSize(int bytes) {
    double size = bytes.toDouble();
    const units = ['B', 'KB', 'MB', 'GB'];
    int unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return '${size.toStringAsFixed(2)} ${units[unitIndex]}';
  }

  /// 构建错误信息
  ///
  /// **Validates: Requirements 3.8**
  Widget _buildErrorMessage() {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: ThemeConfig.errorColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline,
            size: 16,
            color: ThemeConfig.errorColor,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              item.errorMessage!,
              style: const TextStyle(
                fontSize: 12,
                color: ThemeConfig.errorColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
