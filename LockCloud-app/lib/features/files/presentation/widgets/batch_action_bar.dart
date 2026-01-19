import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/repositories/batch_repository.dart';
import '../providers/batch_selection_provider.dart';
import '../providers/files_provider.dart';
import 'batch_delete_dialog.dart';
import 'batch_tag_dialog.dart';
import 'batch_edit_dialog.dart';

/// 批量操作栏组件 - 与 Web 端 BatchActionToolbar 风格一致
///
/// 显示批量操作选项，包括：
/// - 已选数量
/// - 全选/取消全选按钮
/// - 删除按钮
/// - 添加标签按钮
/// - 修改按钮
/// - 取消选择按钮
class BatchActionBar extends ConsumerWidget {
  const BatchActionBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedCount = ref.watch(selectedCountProvider);
    final isAllSelected = ref.watch(isAllSelectedProvider);
    final filesState = ref.watch(filesNotifierProvider);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        border: Border(
          top: BorderSide(color: ThemeConfig.borderColor),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // 已选数量
            _buildSelectedCount(selectedCount),

            const SizedBox(width: 16),

            // 全选/取消全选按钮
            _buildSelectAllButton(ref, isAllSelected, filesState),

            const Spacer(),

            // 操作按钮
            _buildActionButtons(context, ref, selectedCount),

            const SizedBox(width: 8),

            // 取消按钮
            _buildCancelButton(ref),
          ],
        ),
      ),
    );
  }

  /// 构建已选数量显示
  Widget _buildSelectedCount(int count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: ThemeConfig.primaryColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: ThemeConfig.primaryColor.withValues(alpha: 0.3)),
      ),
      child: Text(
        '已选 $count 项',
        style: TextStyle(
          color: ThemeConfig.primaryColor,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  /// 构建全选/取消全选按钮
  Widget _buildSelectAllButton(
    WidgetRef ref,
    bool isAllSelected,
    FilesState filesState,
  ) {
    return TextButton.icon(
      onPressed: () {
        final notifier = ref.read(batchSelectionNotifierProvider.notifier);
        if (isAllSelected) {
          notifier.deselectAll();
        } else {
          final allIds = filesState.files.map((f) => f.id).toList();
          notifier.selectAll(allIds);
        }
      },
      icon: Icon(
        isAllSelected ? Icons.deselect : Icons.select_all,
        size: 18,
        color: ThemeConfig.onSurfaceVariantColor,
      ),
      label: Text(
        isAllSelected ? '取消全选' : '全选',
        style: TextStyle(
          color: ThemeConfig.onSurfaceVariantColor,
          fontSize: 13,
        ),
      ),
    );
  }

  /// 构建操作按钮
  Widget _buildActionButtons(
    BuildContext context,
    WidgetRef ref,
    int selectedCount,
  ) {
    final isEnabled = selectedCount > 0;
    final isOverLimit = selectedCount > BatchRepository.maxBatchSize;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 修改按钮
        _ActionButton(
          icon: Icons.edit_outlined,
          label: '修改',
          onPressed: isEnabled && !isOverLimit
              ? () => _showBatchEditDialog(context, ref)
              : null,
        ),

        const SizedBox(width: 8),

        // 添加标签按钮
        _ActionButton(
          icon: Icons.label_outline,
          label: '标签',
          onPressed: isEnabled && !isOverLimit
              ? () => _showAddTagDialog(context, ref)
              : null,
        ),

        const SizedBox(width: 8),

        // 删除按钮
        _ActionButton(
          icon: Icons.delete_outline,
          label: '删除',
          color: ThemeConfig.errorColor,
          onPressed: isEnabled && !isOverLimit
              ? () => _showDeleteConfirmDialog(context, ref, selectedCount)
              : null,
        ),
      ],
    );
  }

  /// 构建取消按钮
  Widget _buildCancelButton(WidgetRef ref) {
    return IconButton(
      onPressed: () {
        ref.read(batchSelectionNotifierProvider.notifier).exitSelectionMode();
      },
      icon: Icon(
        Icons.close,
        color: ThemeConfig.accentGray,
      ),
      tooltip: '取消选择',
    );
  }

  /// 显示添加标签对话框
  void _showAddTagDialog(BuildContext context, WidgetRef ref) {
    final filesState = ref.read(filesNotifierProvider);
    final selectedIds = ref.read(selectedFileIdsProvider);

    showDialog(
      context: context,
      builder: (context) => BatchTagDialog(
        tags: filesState.tags.map((t) => t.name).toList(),
        selectedFileIds: selectedIds,
      ),
    );
  }

  /// 显示删除确认对话框
  void _showDeleteConfirmDialog(
    BuildContext context,
    WidgetRef ref,
    int count,
  ) {
    final selectedIds = ref.read(selectedFileIdsProvider);

    showDialog(
      context: context,
      builder: (context) => BatchDeleteDialog(
        selectedFileIds: selectedIds,
        count: count,
      ),
    );
  }

  /// 显示批量修改对话框
  void _showBatchEditDialog(BuildContext context, WidgetRef ref) {
    final selectedIds = ref.read(selectedFileIdsProvider);

    showDialog(
      context: context,
      builder: (context) => BatchEditDialog(
        selectedFileIds: selectedIds,
      ),
    );
  }
}

/// 操作按钮组件
class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback? onPressed;

  const _ActionButton({
    required this.icon,
    required this.label,
    this.color,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final isEnabled = onPressed != null;
    final buttonColor = color ?? ThemeConfig.primaryColor;

    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isEnabled
              ? buttonColor.withValues(alpha: 0.1)
              : ThemeConfig.surfaceContainerColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isEnabled ? buttonColor.withValues(alpha: 0.3) : ThemeConfig.borderColor,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: isEnabled ? buttonColor : ThemeConfig.accentGray,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isEnabled ? buttonColor : ThemeConfig.accentGray,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
