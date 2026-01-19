import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../providers/files_provider.dart';

/// 标签筛选组件 - 与 Web 端 FreeTagFilter 风格一致
///
/// 显示可滚动的标签行，支持：
/// - 水平滚动浏览所有标签
/// - 点击标签进行筛选
/// - 显示标签使用次数
class TagFilter extends ConsumerWidget {
  const TagFilter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filesState = ref.watch(filesNotifierProvider);
    final currentTags = ref.watch(currentTagsProvider);

    // 如果没有标签，不显示
    if (filesState.tags.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: ThemeConfig.borderColor.withValues(alpha: 0.5)),
        ),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: filesState.tags.length,
        itemBuilder: (context, index) {
          final tag = filesState.tags[index];
          final isSelected = currentTags.contains(tag.name);

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _TagChip(
              name: tag.name,
              count: tag.count,
              isSelected: isSelected,
              onTap: () {
                if (isSelected) {
                  ref.read(filesNotifierProvider.notifier).removeTag(tag.name);
                } else {
                  ref.read(filesNotifierProvider.notifier).addTag(tag.name);
                }
              },
            ),
          );
        },
      ),
    );
  }
}

/// 标签芯片组件
class _TagChip extends StatelessWidget {
  final String name;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;

  const _TagChip({
    required this.name,
    required this.count,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? ThemeConfig.primaryColor
              : ThemeConfig.surfaceContainerColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.borderColor,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 标签图标
            Icon(
              Icons.tag,
              size: 14,
              color: isSelected ? Colors.white : ThemeConfig.accentGray,
            ),
            const SizedBox(width: 4),
            // 标签名称
            Text(
              name,
              style: TextStyle(
                color: isSelected ? Colors.white : ThemeConfig.primaryBlack,
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            const SizedBox(width: 6),
            // 使用次数
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.2)
                    : ThemeConfig.backgroundColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: isSelected ? Colors.white : ThemeConfig.accentGray,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 已选标签显示组件
///
/// 显示当前已选择的标签，支持点击移除
class SelectedTagsBar extends ConsumerWidget {
  const SelectedTagsBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTags = ref.watch(currentTagsProvider);

    if (currentTags.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          // 标签标题
          Text(
            '已选标签:',
            style: TextStyle(
              color: ThemeConfig.accentGray,
              fontSize: 12,
            ),
          ),
          // 已选标签列表
          ...currentTags.map(
            (tag) => _SelectedTagChip(
              name: tag,
              onRemove: () {
                ref.read(filesNotifierProvider.notifier).removeTag(tag);
              },
            ),
          ),
          // 清除全部按钮
          if (currentTags.length > 1)
            GestureDetector(
              onTap: () {
                ref.read(filesNotifierProvider.notifier).setTags([]);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: ThemeConfig.errorColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: ThemeConfig.errorColor.withValues(alpha: 0.3)),
                ),
                child: Text(
                  '清除全部',
                  style: TextStyle(
                    color: ThemeConfig.errorColor,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 已选标签芯片
class _SelectedTagChip extends StatelessWidget {
  final String name;
  final VoidCallback onRemove;

  const _SelectedTagChip({
    required this.name,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: ThemeConfig.primaryColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ThemeConfig.primaryColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            name,
            style: TextStyle(
              color: ThemeConfig.primaryColor,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: onRemove,
            child: Icon(
              Icons.close,
              size: 14,
              color: ThemeConfig.primaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// 标签搜索对话框
///
/// 用于搜索和选择标签
class TagSearchDialog extends ConsumerStatefulWidget {
  final List<String> selectedTags;
  final void Function(List<String> tags) onConfirm;

  const TagSearchDialog({
    super.key,
    required this.selectedTags,
    required this.onConfirm,
  });

  @override
  ConsumerState<TagSearchDialog> createState() => _TagSearchDialogState();
}

class _TagSearchDialogState extends ConsumerState<TagSearchDialog> {
  late List<String> _selectedTags;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _selectedTags = List.from(widget.selectedTags);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filesState = ref.watch(filesNotifierProvider);
    final filteredTags = filesState.tags.where((tag) {
      if (_searchQuery.isEmpty) return true;
      return tag.name.toLowerCase().contains(_searchQuery.toLowerCase());
    }).toList();

    return AlertDialog(
      backgroundColor: ThemeConfig.surfaceColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        '选择标签',
        style: TextStyle(color: ThemeConfig.primaryBlack),
      ),
      content: SizedBox(
        width: double.maxFinite,
        height: 400,
        child: Column(
          children: [
            // 搜索框
            TextField(
              controller: _searchController,
              style: TextStyle(color: ThemeConfig.primaryBlack),
              decoration: InputDecoration(
                hintText: '搜索标签...',
                hintStyle: TextStyle(color: ThemeConfig.hintColor),
                prefixIcon: Icon(Icons.search, color: ThemeConfig.accentGray),
                filled: true,
                fillColor: ThemeConfig.surfaceContainerColor,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: ThemeConfig.borderColor),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: ThemeConfig.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: ThemeConfig.primaryColor, width: 2),
                ),
              ),
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
            ),
            const SizedBox(height: 16),
            // 标签列表
            Expanded(
              child: ListView.builder(
                itemCount: filteredTags.length,
                itemBuilder: (context, index) {
                  final tag = filteredTags[index];
                  final isSelected = _selectedTags.contains(tag.name);

                  return CheckboxListTile(
                    title: Text(
                      tag.name,
                      style: TextStyle(color: ThemeConfig.primaryBlack),
                    ),
                    subtitle: Text(
                      '${tag.count} 个文件',
                      style: TextStyle(color: ThemeConfig.accentGray),
                    ),
                    value: isSelected,
                    activeColor: ThemeConfig.primaryColor,
                    onChanged: (value) {
                      setState(() {
                        if (value == true) {
                          _selectedTags.add(tag.name);
                        } else {
                          _selectedTags.remove(tag.name);
                        }
                      });
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(
            '取消',
            style: TextStyle(color: ThemeConfig.accentGray),
          ),
        ),
        ElevatedButton(
          onPressed: () {
            widget.onConfirm(_selectedTags);
            Navigator.pop(context);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: ThemeConfig.primaryColor,
            foregroundColor: Colors.white,
          ),
          child: const Text('确定'),
        ),
      ],
    );
  }
}
