import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../providers/files_provider.dart';
import 'directory_tree.dart';
import 'tag_filter.dart';

/// 筛选栏组件 - 与 Web 端 FilterPanel 风格一致
///
/// 显示文件筛选选项，包括：
/// - 目录选择按钮
/// - 媒体类型切换（全部/图片/视频）
/// - 文件计数
/// - 标签筛选
class FilterBar extends ConsumerWidget {
  const FilterBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        border: Border(
          bottom: BorderSide(color: ThemeConfig.borderColor),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 主筛选栏
          _buildMainFilterBar(context, ref),

          // 标签筛选
          const TagFilter(),
        ],
      ),
    );
  }

  /// 构建主筛选栏
  Widget _buildMainFilterBar(BuildContext context, WidgetRef ref) {
    final currentDirectory = ref.watch(currentDirectoryProvider);
    final fileCount = ref.watch(fileCountProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          // 目录选择按钮
          _buildDirectoryButton(context, ref, currentDirectory),

          const SizedBox(width: 12),

          // 媒体类型切换
          Expanded(
            child: _buildMediaTypeToggle(ref),
          ),

          const SizedBox(width: 12),

          // 文件计数
          _buildFileCount(fileCount),
        ],
      ),
    );
  }

  /// 构建目录选择按钮
  Widget _buildDirectoryButton(
    BuildContext context,
    WidgetRef ref,
    String? currentDirectory,
  ) {
    final hasDirectory = currentDirectory != null;
    
    return InkWell(
      onTap: () => _showDirectoryPicker(context, ref),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: hasDirectory
              ? ThemeConfig.primaryColor.withValues(alpha: 0.1)
              : ThemeConfig.surfaceContainerColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: hasDirectory
                ? ThemeConfig.primaryColor
                : ThemeConfig.borderColor,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.folder_outlined,
              size: 18,
              color: hasDirectory
                  ? ThemeConfig.primaryColor
                  : ThemeConfig.accentGray,
            ),
            const SizedBox(width: 6),
            Text(
              hasDirectory
                  ? _formatDirectoryName(currentDirectory)
                  : '目录',
              style: TextStyle(
                color: hasDirectory
                    ? ThemeConfig.primaryColor
                    : ThemeConfig.onSurfaceVariantColor,
                fontSize: 13,
                fontWeight: hasDirectory ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
            if (hasDirectory) ...[
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () {
                  ref.read(filesNotifierProvider.notifier).setDirectory(null);
                },
                child: Icon(
                  Icons.close,
                  size: 16,
                  color: ThemeConfig.primaryColor,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// 格式化目录名称
  String _formatDirectoryName(String directory) {
    // 取最后一级目录名
    final parts = directory.split('/');
    final name = parts.isNotEmpty ? parts.last : directory;
    // 限制长度
    if (name.length > 10) {
      return '${name.substring(0, 10)}...';
    }
    return name;
  }

  /// 构建媒体类型切换 - 与 Web 端 MediaTypeFilter 风格一致
  Widget _buildMediaTypeToggle(WidgetRef ref) {
    final currentMediaType = ref.watch(currentMediaTypeProvider);

    return Container(
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ThemeConfig.borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildMediaTypeButton(
            ref: ref,
            label: '全部',
            value: 'all',
            isSelected: currentMediaType == 'all',
          ),
          _buildMediaTypeButton(
            ref: ref,
            label: '图片',
            value: 'image',
            isSelected: currentMediaType == 'image',
          ),
          _buildMediaTypeButton(
            ref: ref,
            label: '视频',
            value: 'video',
            isSelected: currentMediaType == 'video',
          ),
        ],
      ),
    );
  }

  /// 构建媒体类型按钮
  Widget _buildMediaTypeButton({
    required WidgetRef ref,
    required String label,
    required String value,
    required bool isSelected,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          ref.read(filesNotifierProvider.notifier).setMediaType(value);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? ThemeConfig.primaryColor : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? Colors.white : ThemeConfig.onSurfaceVariantColor,
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  /// 构建文件计数
  Widget _buildFileCount(int count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ThemeConfig.borderColor),
      ),
      child: Text(
        '$count 个',
        style: TextStyle(
          color: ThemeConfig.onSurfaceVariantColor,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  /// 显示目录选择器
  void _showDirectoryPicker(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: ThemeConfig.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => DirectoryTreePicker(
          scrollController: scrollController,
          onSelect: (directory) {
            ref.read(filesNotifierProvider.notifier).setDirectory(directory);
            Navigator.pop(context);
          },
        ),
      ),
    );
  }
}
