import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/repositories/batch_repository.dart';
import '../providers/batch_selection_provider.dart';
import '../providers/files_provider.dart';

/// 批量添加标签对话框
///
/// 显示标签选择界面，支持选择已有标签或创建新标签
///
/// **Validates: Requirements 7.3**
class BatchTagDialog extends ConsumerStatefulWidget {
  final List<String> tags;
  final List<int> selectedFileIds;

  const BatchTagDialog({
    super.key,
    required this.tags,
    required this.selectedFileIds,
  });

  @override
  ConsumerState<BatchTagDialog> createState() => _BatchTagDialogState();
}

class _BatchTagDialogState extends ConsumerState<BatchTagDialog> {
  final Set<String> _selectedTags = {};
  final TextEditingController _newTagController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _newTagController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: ThemeConfig.surfaceColor,
      title: Text(
        '为 ${widget.selectedFileIds.length} 个文件添加标签',
        style: const TextStyle(color: ThemeConfig.onBackgroundColor, fontSize: 16),
      ),
      content: _buildContent(),
      actions: _buildActions(),
    );
  }

  Widget _buildContent() {
    if (_isSubmitting) {
      return const SizedBox(
        height: 100,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: ThemeConfig.primaryColor,
              ),
              SizedBox(height: 16),
              Text(
                '正在添加标签...',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      width: double.maxFinite,
      height: 350,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 错误提示
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // 新建标签输入框
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _newTagController,
                  style: const TextStyle(color: ThemeConfig.onBackgroundColor),
                  decoration: InputDecoration(
                    hintText: '输入新标签...',
                    hintStyle: const TextStyle(color: ThemeConfig.onSurfaceVariantColor),
                    filled: true,
                    fillColor: ThemeConfig.surfaceContainerColor,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                  ),
                  onSubmitted: (_) => _addNewTag(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _addNewTag,
                icon: const Icon(
                  Icons.add_circle,
                  color: ThemeConfig.primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 已选标签
          if (_selectedTags.isNotEmpty) ...[
            const Text(
              '已选标签:',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _selectedTags.map((tag) {
                return Chip(
                  label: Text(tag),
                  deleteIcon: const Icon(Icons.close, size: 16),
                  onDeleted: () {
                    setState(() {
                      _selectedTags.remove(tag);
                    });
                  },
                  backgroundColor: ThemeConfig.primaryColor,
                  labelStyle: const TextStyle(color: Colors.white),
                  deleteIconColor: Colors.white70,
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
          ],

          // 已有标签列表
          const Text(
            '选择已有标签:',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: widget.tags.isEmpty
                ? const Center(
                    child: Text(
                      '暂无标签',
                      style: TextStyle(color: ThemeConfig.onSurfaceVariantColor),
                    ),
                  )
                : SingleChildScrollView(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.tags.map((tag) {
                        final isSelected = _selectedTags.contains(tag);
                        return FilterChip(
                          label: Text(tag),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              if (selected) {
                                _selectedTags.add(tag);
                              } else {
                                _selectedTags.remove(tag);
                              }
                            });
                          },
                          selectedColor: ThemeConfig.primaryColor,
                          checkmarkColor: Colors.white,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : ThemeConfig.onBackgroundColor,
                          ),
                          backgroundColor: ThemeConfig.surfaceContainerColor,
                        );
                      }).toList(),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildActions() {
    if (_isSubmitting) {
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
        onPressed: _selectedTags.isNotEmpty ? _submitTags : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeConfig.primaryColor,
        ),
        child: const Text('确定'),
      ),
    ];
  }

  void _addNewTag() {
    final newTag = _newTagController.text.trim();
    if (newTag.isNotEmpty) {
      if (newTag.length > 100) {
        setState(() {
          _error = '标签名称过长（最多100字符）';
        });
        return;
      }
      setState(() {
        _selectedTags.add(newTag);
        _error = null;
      });
      _newTagController.clear();
    }
  }

  /// 提交标签
  ///
  /// **Validates: Requirements 7.3**
  Future<void> _submitTags() async {
    if (_selectedTags.isEmpty) return;

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final batchRepo = ref.read(batchRepositoryProvider);

      // 逐个添加标签（API 一次只能添加一个标签）
      int totalSucceeded = 0;
      int totalFailed = 0;
      final List<String> failedTags = [];

      for (final tagName in _selectedTags) {
        final result = await batchRepo.batchAddTag(
          widget.selectedFileIds,
          tagName,
        );

        if (result.isAllSuccess || result.isPartialSuccess) {
          totalSucceeded += result.succeeded.length;
          totalFailed += result.failed.length;
        } else {
          failedTags.add(tagName);
        }
      }

      if (!mounted) return;

      if (failedTags.isEmpty) {
        // 全部成功
        _showSuccessAndClose(
          '成功为 ${widget.selectedFileIds.length} 个文件添加 ${_selectedTags.length} 个标签',
        );
      } else if (failedTags.length < _selectedTags.length) {
        // 部分成功
        _showPartialSuccessAndClose(
          '部分标签添加成功',
          failedTags,
        );
      } else {
        // 全部失败
        setState(() {
          _isSubmitting = false;
          _error = '添加标签失败，请稍后重试';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _error = '添加标签失败: ${e.toString()}';
      });
    }
  }

  void _showSuccessAndClose(String message) {
    // 刷新标签列表
    ref.read(filesNotifierProvider.notifier).loadTags();

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

  void _showPartialSuccessAndClose(String message, List<String> failedTags) {
    // 刷新标签列表
    ref.read(filesNotifierProvider.notifier).loadTags();

    // 退出选择模式
    ref.read(batchSelectionNotifierProvider.notifier).exitSelectionMode();

    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$message\n失败的标签: ${failedTags.join(", ")}'),
        backgroundColor: Colors.orange,
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
