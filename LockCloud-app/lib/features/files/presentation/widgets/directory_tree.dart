import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/file_model.dart';
import '../providers/files_provider.dart';

/// 目录树选择器
///
/// 显示年/月/活动层级结构的目录树，支持：
/// - 展开/折叠节点
/// - 选择目录进行筛选
///
/// **Validates: Requirements 2.6**
class DirectoryTreePicker extends ConsumerStatefulWidget {
  final ScrollController scrollController;
  final void Function(String? directory) onSelect;

  const DirectoryTreePicker({
    super.key,
    required this.scrollController,
    required this.onSelect,
  });

  @override
  ConsumerState<DirectoryTreePicker> createState() =>
      _DirectoryTreePickerState();
}

class _DirectoryTreePickerState extends ConsumerState<DirectoryTreePicker> {
  /// 展开的节点路径集合
  final Set<String> _expandedPaths = {};

  @override
  Widget build(BuildContext context) {
    final filesState = ref.watch(filesNotifierProvider);
    final currentDirectory = ref.watch(currentDirectoryProvider);

    return Column(
      children: [
        // 标题栏
        _buildHeader(currentDirectory),

        const Divider(height: 1, color: ThemeConfig.dividerColor),

        // 目录树
        Expanded(
          child: filesState.directoryTree.isEmpty
              ? _buildEmptyState()
              : _buildDirectoryList(filesState.directoryTree, currentDirectory),
        ),
      ],
    );
  }

  /// 构建标题栏
  Widget _buildHeader(String? currentDirectory) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Text(
            '选择目录',
            style: TextStyle(
              color: ThemeConfig.onBackgroundColor,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          if (currentDirectory != null)
            TextButton(
              onPressed: () => widget.onSelect(null),
              child: const Text(
                '清除',
                style: TextStyle(color: ThemeConfig.primaryColor),
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
            Icons.folder_off,
            size: 48,
            color: ThemeConfig.onSurfaceVariantColor,
          ),
          const SizedBox(height: 16),
          const Text(
            '暂无目录',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建目录列表
  Widget _buildDirectoryList(
    List<DirectoryNode> directories,
    String? currentDirectory,
  ) {
    return ListView.builder(
      controller: widget.scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      itemCount: directories.length,
      itemBuilder: (context, index) {
        return _buildDirectoryNode(
          directories[index],
          currentDirectory,
          0,
        );
      },
    );
  }

  /// 构建目录节点
  Widget _buildDirectoryNode(
    DirectoryNode node,
    String? currentDirectory,
    int depth,
  ) {
    final isExpanded = _expandedPaths.contains(node.path);
    final isSelected = currentDirectory == node.path;
    final hasChildren = node.subdirectories.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 节点项
        InkWell(
          onTap: () => widget.onSelect(node.path),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: EdgeInsets.only(
              left: 16.0 + depth * 20.0,
              right: 16,
              top: 12,
              bottom: 12,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? ThemeConfig.primaryColor.withValues(alpha: 0.1)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                // 展开/折叠按钮
                if (hasChildren)
                  GestureDetector(
                    onTap: () => _toggleExpand(node.path),
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Icon(
                        isExpanded
                            ? Icons.keyboard_arrow_down
                            : Icons.keyboard_arrow_right,
                        size: 20,
                        color: ThemeConfig.onSurfaceVariantColor,
                      ),
                    ),
                  )
                else
                  const SizedBox(width: 28),

                // 文件夹图标
                Icon(
                  _getNodeIcon(node, depth),
                  size: 20,
                  color: isSelected
                      ? ThemeConfig.primaryColor
                      : _getNodeIconColor(depth),
                ),
                const SizedBox(width: 12),

                // 节点名称
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        node.name,
                        style: TextStyle(
                          color: isSelected
                              ? ThemeConfig.primaryColor
                              : ThemeConfig.onBackgroundColor,
                          fontSize: 14,
                          fontWeight:
                              isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                      if (node.activityName != null &&
                          node.activityName!.isNotEmpty)
                        const Text(
                          '',
                          style: TextStyle(
                            color: ThemeConfig.onSurfaceVariantColor,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),

                // 文件数量
                if (node.fileCount != null && node.fileCount! > 0)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: ThemeConfig.surfaceContainerColor,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${node.fileCount}',
                      style: const TextStyle(
                        color: ThemeConfig.onSurfaceVariantColor,
                        fontSize: 11,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),

        // 子节点
        if (isExpanded && hasChildren)
          ...node.subdirectories.map(
            (child) => _buildDirectoryNode(child, currentDirectory, depth + 1),
          ),
      ],
    );
  }

  /// 获取节点图标
  IconData _getNodeIcon(DirectoryNode node, int depth) {
    switch (depth) {
      case 0:
        return Icons.calendar_today; // 年
      case 1:
        return Icons.date_range; // 月
      default:
        return Icons.folder; // 活动
    }
  }

  /// 获取节点图标颜色
  Color _getNodeIconColor(int depth) {
    switch (depth) {
      case 0:
        return ThemeConfig.warningColor;
      case 1:
        return ThemeConfig.accentGreen;
      default:
        return ThemeConfig.accentBlue;
    }
  }

  /// 切换展开状态
  void _toggleExpand(String path) {
    setState(() {
      if (_expandedPaths.contains(path)) {
        _expandedPaths.remove(path);
      } else {
        _expandedPaths.add(path);
      }
    });
  }
}

/// 简化的目录树组件（用于其他场景）
class DirectoryTree extends ConsumerWidget {
  final void Function(String? directory)? onSelect;

  const DirectoryTree({
    super.key,
    this.onSelect,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filesState = ref.watch(filesNotifierProvider);
    final currentDirectory = ref.watch(currentDirectoryProvider);

    if (filesState.directoryTree.isEmpty) {
      return const SizedBox.shrink();
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: filesState.directoryTree.length,
      itemBuilder: (context, index) {
        final node = filesState.directoryTree[index];
        return _DirectoryNodeTile(
          node: node,
          currentDirectory: currentDirectory,
          onSelect: onSelect,
          depth: 0,
        );
      },
    );
  }
}

/// 目录节点瓦片
class _DirectoryNodeTile extends StatefulWidget {
  final DirectoryNode node;
  final String? currentDirectory;
  final void Function(String? directory)? onSelect;
  final int depth;

  const _DirectoryNodeTile({
    required this.node,
    required this.currentDirectory,
    required this.onSelect,
    required this.depth,
  });

  @override
  State<_DirectoryNodeTile> createState() => _DirectoryNodeTileState();
}

class _DirectoryNodeTileState extends State<_DirectoryNodeTile> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final isSelected = widget.currentDirectory == widget.node.path;
    final hasChildren = widget.node.subdirectories.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          dense: true,
          contentPadding: EdgeInsets.only(left: 16.0 + widget.depth * 16.0),
          leading: hasChildren
              ? IconButton(
                  icon: Icon(
                    _isExpanded ? Icons.expand_less : Icons.expand_more,
                    color: ThemeConfig.onSurfaceVariantColor,
                  ),
                  onPressed: () {
                    setState(() {
                      _isExpanded = !_isExpanded;
                    });
                  },
                )
              : const SizedBox(width: 48),
          title: Text(
            widget.node.name,
            style: TextStyle(
              color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.onBackgroundColor,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          trailing: widget.node.fileCount != null
              ? Text(
                  '${widget.node.fileCount}',
                  style: const TextStyle(color: ThemeConfig.onSurfaceVariantColor),
                )
              : null,
          selected: isSelected,
          selectedTileColor: ThemeConfig.primaryColor.withValues(alpha: 0.1),
          onTap: () => widget.onSelect?.call(widget.node.path),
        ),
        if (_isExpanded && hasChildren)
          ...widget.node.subdirectories.map(
            (child) => _DirectoryNodeTile(
              node: child,
              currentDirectory: widget.currentDirectory,
              onSelect: widget.onSelect,
              depth: widget.depth + 1,
            ),
          ),
      ],
    );
  }
}
