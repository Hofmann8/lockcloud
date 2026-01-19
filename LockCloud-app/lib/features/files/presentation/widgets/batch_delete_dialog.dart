import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/repositories/batch_repository.dart';
import '../providers/batch_selection_provider.dart';
import '../providers/files_provider.dart';

/// 批量删除确认对话框
///
/// 显示删除确认信息，调用批量删除 API，处理部分成功情况
///
/// **Validates: Requirements 7.2, 7.5**
class BatchDeleteDialog extends ConsumerStatefulWidget {
  final List<int> selectedFileIds;
  final int count;

  const BatchDeleteDialog({
    super.key,
    required this.selectedFileIds,
    required this.count,
  });

  @override
  ConsumerState<BatchDeleteDialog> createState() => _BatchDeleteDialogState();
}

class _BatchDeleteDialogState extends ConsumerState<BatchDeleteDialog> {
  bool _isDeleting = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: ThemeConfig.surfaceColor,
      title: const Text(
        '确认删除',
        style: TextStyle(color: ThemeConfig.onBackgroundColor),
      ),
      content: _buildContent(),
      actions: _buildActions(),
    );
  }

  Widget _buildContent() {
    if (_isDeleting) {
      return const SizedBox(
        height: 80,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: ThemeConfig.primaryColor,
              ),
              SizedBox(height: 16),
              Text(
                '正在删除...',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.red),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _error!,
                  style: const TextStyle(color: Colors.red),
                ),
              ),
            ],
          ),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '确定要删除选中的 ${widget.count} 个文件吗？',
          style: const TextStyle(color: ThemeConfig.onBackgroundColor),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: ThemeConfig.errorColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: ThemeConfig.errorColor.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Icon(
                Icons.warning_amber_rounded,
                color: ThemeConfig.warningColor,
                size: 20,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  '此操作不可撤销，文件将被永久删除。\n只能删除您自己上传的文件。',
                  style: TextStyle(
                    color: ThemeConfig.onSurfaceVariantColor,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<Widget> _buildActions() {
    if (_isDeleting) {
      return [];
    }

    return [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text(
          '取消',
          style: TextStyle(color: ThemeConfig.onSurfaceVariantColor),
        ),
      ),
      ElevatedButton(
        onPressed: _performBatchDelete,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeConfig.errorColor,
        ),
        child: const Text('删除'),
      ),
    ];
  }

  /// 执行批量删除
  ///
  /// **Validates: Requirements 7.2, 7.5**
  Future<void> _performBatchDelete() async {
    setState(() {
      _isDeleting = true;
      _error = null;
    });

    try {
      final batchRepo = ref.read(batchRepositoryProvider);
      final result = await batchRepo.batchDelete(widget.selectedFileIds);

      if (!mounted) return;

      if (result.isAllSuccess) {
        // 全部成功
        _showSuccessAndClose(
          '成功删除 ${result.succeeded.length} 个文件',
          result.succeeded,
        );
      } else if (result.isPartialSuccess) {
        // 部分成功
        _showPartialSuccessDialog(result);
      } else if (result.isAllFailed) {
        // 全部失败
        setState(() {
          _isDeleting = false;
          _error = result.message.isNotEmpty
              ? result.message
              : '删除失败，请稍后重试';
        });
      } else {
        // 其他情况（如空列表）
        setState(() {
          _isDeleting = false;
          _error = result.message.isNotEmpty ? result.message : '操作失败';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isDeleting = false;
        _error = '删除失败: ${e.toString()}';
      });
    }
  }

  /// 显示成功消息并关闭对话框
  void _showSuccessAndClose(String message, List<int> deletedIds) {
    // 从列表中移除已删除的文件
    for (final id in deletedIds) {
      ref.read(filesNotifierProvider.notifier).removeFile(id);
    }

    // 从选择中移除已删除的文件
    ref
        .read(batchSelectionNotifierProvider.notifier)
        .removeDeletedFiles(deletedIds);

    // 退出选择模式
    ref.read(batchSelectionNotifierProvider.notifier).exitSelectionMode();

    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
      ),
    );
  }

  /// 显示部分成功对话框
  ///
  /// **Validates: Requirements 7.5**
  void _showPartialSuccessDialog(BatchOperationResult result) {
    // 先从列表中移除成功删除的文件
    for (final id in result.succeeded) {
      ref.read(filesNotifierProvider.notifier).removeFile(id);
    }

    // 从选择中移除已删除的文件
    ref
        .read(batchSelectionNotifierProvider.notifier)
        .removeDeletedFiles(result.succeeded);

    Navigator.pop(context);

    // 显示部分成功对话框
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: ThemeConfig.warningColor),
            const SizedBox(width: 8),
            const Text(
              '部分操作完成',
              style: TextStyle(color: ThemeConfig.onBackgroundColor),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '成功删除: ${result.succeeded.length} 个文件',
              style: TextStyle(color: ThemeConfig.accentGreen),
            ),
            const SizedBox(height: 8),
            Text(
              '删除失败: ${result.failed.length} 个文件',
              style: TextStyle(color: ThemeConfig.errorColor),
            ),
            if (result.failed.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text(
                '失败原因:',
                style: TextStyle(
                  color: ThemeConfig.onSurfaceVariantColor,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                constraints: const BoxConstraints(maxHeight: 150),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: result.failed.map((item) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Text(
                          '• 文件 ${item.fileId}: ${item.error}',
                          style: const TextStyle(
                            color: ThemeConfig.onSurfaceVariantColor,
                            fontSize: 12,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // 退出选择模式
              ref
                  .read(batchSelectionNotifierProvider.notifier)
                  .exitSelectionMode();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
            ),
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }
}
