import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/transfer_task.dart';
import '../providers/transfer_queue_provider.dart';

/// 传输队列组件
class TransferQueueWidget extends ConsumerWidget {
  const TransferQueueWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueState = ref.watch(transferQueueNotifierProvider);
    final tasks = queueState.tasks;

    if (tasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.swap_horiz, size: 48, color: ThemeConfig.accentGray.withValues(alpha: 0.4)),
            const SizedBox(height: 12),
            Text('暂无传输任务', style: TextStyle(color: ThemeConfig.accentGray, fontSize: 14)),
            const SizedBox(height: 4),
            Text('上传或下载文件时将显示在这里', style: TextStyle(color: ThemeConfig.accentGray.withValues(alpha: 0.7), fontSize: 12)),
          ],
        ),
      );
    }

    return Column(
      children: [
        // 头部
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Icon(Icons.swap_horiz, size: 20, color: ThemeConfig.primaryColor),
              const SizedBox(width: 8),
              Text('传输队列', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ThemeConfig.primaryBlack)),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: ThemeConfig.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('${tasks.length}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ThemeConfig.primaryColor)),
              ),
              const Spacer(),
              if (tasks.any((t) => t.status == TransferStatus.completed))
                TextButton(
                  onPressed: () => ref.read(transferQueueNotifierProvider.notifier).clearCompleted(),
                  child: Text('清除已完成', style: TextStyle(fontSize: 12, color: ThemeConfig.accentGray)),
                ),
            ],
          ),
        ),
        const Divider(height: 1),
        // 任务列表
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: tasks.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) => _TaskCard(task: tasks[index]),
          ),
        ),
      ],
    );
  }
}

class _TaskCard extends ConsumerWidget {
  final TransferTask task;
  const _TaskCard({required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(transferQueueNotifierProvider.notifier);
    final pausedTasks = ref.watch(transferQueueNotifierProvider).pausedTasks;
    final isPaused = pausedTasks.contains(task.id);
    final isUpload = task.type == TransferType.upload;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ThemeConfig.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 头部：类型、状态、操作
          Row(
            children: [
              _TypeBadge(type: task.type),
              const SizedBox(width: 8),
              isPaused ? _StatusBadge(label: '已暂停', color: ThemeConfig.warningColor) : _StatusBadge.fromStatus(task.status, task.type),
              const SizedBox(width: 8),
              Text('${task.completedCount}/${task.totalCount} 文件', style: TextStyle(fontSize: 12, color: ThemeConfig.accentGray)),
              const Spacer(),
              // 操作按钮
              if (task.isActive && !isPaused)
                _IconBtn(icon: Icons.pause, onTap: () => notifier.pauseTask(task.id), tooltip: '暂停'),
              if (isPaused)
                _IconBtn(icon: Icons.play_arrow, onTap: () => notifier.resumeTask(task.id), tooltip: '继续', color: ThemeConfig.accentGreen),
              if (task.isActive || isPaused)
                _IconBtn(icon: Icons.close, onTap: () => notifier.cancelTask(task.id), tooltip: '取消', color: ThemeConfig.errorColor),
              if (!task.isActive && !isPaused)
                _IconBtn(icon: Icons.close, onTap: () => notifier.removeTask(task.id), tooltip: '移除'),
            ],
          ),
          // 上传任务显示活动信息
          if (isUpload && task is UploadTask) ...[
            const SizedBox(height: 8),
            Text(
              '${(task as UploadTask).activityType}${(task as UploadTask).activityName != null ? ' · ${(task as UploadTask).activityName}' : ''}',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: ThemeConfig.primaryBlack),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text((task as UploadTask).activityDate, style: TextStyle(fontSize: 12, color: ThemeConfig.accentGray)),
          ],
          // 进度条
          if (task.status == TransferStatus.processing) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: task.overallProgress,
                backgroundColor: ThemeConfig.borderColor,
                valueColor: AlwaysStoppedAnimation(ThemeConfig.primaryColor),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 4),
            Text('${(task.overallProgress * 100).toStringAsFixed(0)}%', style: TextStyle(fontSize: 11, color: ThemeConfig.primaryColor, fontWeight: FontWeight.w500)),
          ],
          // 文件列表（最多显示2个）
          const SizedBox(height: 8),
          ...task.fileItems.take(2).map((f) => _FileItemRow(file: f, type: task.type)),
          if (task.fileItems.length > 2)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('还有 ${task.fileItems.length - 2} 个文件', style: TextStyle(fontSize: 12, color: ThemeConfig.accentGray)),
            ),
          // 错误信息
          if (task.error != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: ThemeConfig.errorColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, size: 14, color: ThemeConfig.errorColor),
                  const SizedBox(width: 6),
                  Expanded(child: Text(task.error!, style: TextStyle(fontSize: 12, color: ThemeConfig.errorColor))),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FileItemRow extends StatelessWidget {
  final TransferFileItem file;
  final TransferType type;
  const _FileItemRow({required this.file, required this.type});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(_getIcon(), size: 16, color: _getColor()),
          const SizedBox(width: 8),
          Expanded(
            child: Text(file.displayFilename, style: TextStyle(fontSize: 12, color: ThemeConfig.primaryBlack), maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 8),
          if (file.status == TransferStatus.processing)
            Text(file.progressPercent, style: TextStyle(fontSize: 11, color: ThemeConfig.primaryColor, fontWeight: FontWeight.w500))
          else
            _StatusBadge.fromStatus(file.status, type, compact: true),
        ],
      ),
    );
  }

  IconData _getIcon() {
    if (file.status == TransferStatus.completed) return Icons.check_circle;
    if (file.status == TransferStatus.failed) return Icons.error;
    if (file.status == TransferStatus.processing) return type == TransferType.upload ? Icons.cloud_upload : Icons.cloud_download;
    return Icons.insert_drive_file;
  }

  Color _getColor() {
    if (file.status == TransferStatus.completed) return ThemeConfig.accentGreen;
    if (file.status == TransferStatus.failed) return ThemeConfig.errorColor;
    if (file.status == TransferStatus.processing) return ThemeConfig.primaryColor;
    return ThemeConfig.accentGray;
  }
}

class _TypeBadge extends StatelessWidget {
  final TransferType type;
  const _TypeBadge({required this.type});

  @override
  Widget build(BuildContext context) {
    final isUpload = type == TransferType.upload;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: (isUpload ? ThemeConfig.primaryColor : ThemeConfig.accentGreen).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(isUpload ? Icons.cloud_upload : Icons.cloud_download, size: 12, color: isUpload ? ThemeConfig.primaryColor : ThemeConfig.accentGreen),
          const SizedBox(width: 4),
          Text(isUpload ? '上传' : '下载', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: isUpload ? ThemeConfig.primaryColor : ThemeConfig.accentGreen)),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final bool compact;

  const _StatusBadge({required this.label, required this.color, this.compact = false});

  factory _StatusBadge.fromStatus(TransferStatus status, TransferType type, {bool compact = false}) {
    switch (status) {
      case TransferStatus.pending:
        return _StatusBadge(label: compact ? '等待' : '等待中', color: ThemeConfig.accentGray, compact: compact);
      case TransferStatus.processing:
        return _StatusBadge(label: type == TransferType.upload ? (compact ? '上传' : '上传中') : (compact ? '下载' : '下载中'), color: ThemeConfig.primaryColor, compact: compact);
      case TransferStatus.completed:
        return _StatusBadge(label: compact ? '完成' : '已完成', color: ThemeConfig.accentGreen, compact: compact);
      case TransferStatus.failed:
        return _StatusBadge(label: '失败', color: ThemeConfig.errorColor, compact: compact);
      case TransferStatus.paused:
        return _StatusBadge(label: '暂停', color: ThemeConfig.warningColor, compact: compact);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 4 : 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: TextStyle(fontSize: compact ? 10 : 11, fontWeight: FontWeight.w500, color: color)),
    );
  }
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final Color? color;

  const _IconBtn({required this.icon, required this.onTap, required this.tooltip, this.color});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      color: color ?? ThemeConfig.accentGray,
      tooltip: tooltip,
      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      padding: EdgeInsets.zero,
    );
  }
}
