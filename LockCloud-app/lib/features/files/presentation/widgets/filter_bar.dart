import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../shared/providers/splash_state_provider.dart';
import '../providers/files_provider.dart';
import 'directory_tree.dart';
import 'tag_filter.dart';

/// 筛选栏折叠状态 Provider
final filterBarCollapsedProvider = StateProvider<bool>((ref) => false);

/// navbar 高度 Provider（动态测量）
final navbarHeightProvider = StateProvider<double>((ref) => 150.0);

/// 筛选栏组件 - 支持平滑折叠
class FilterBar extends ConsumerStatefulWidget {
  const FilterBar({super.key});

  @override
  ConsumerState<FilterBar> createState() => _FilterBarState();
}

class _FilterBarState extends ConsumerState<FilterBar> {
  final GlobalKey _navKey = GlobalKey();
  
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final isCollapsed = ref.watch(filterBarCollapsedProvider);
    final currentDirectory = ref.watch(currentDirectoryProvider);
    final fileCount = ref.watch(fileCountProvider);
    final logoKey = ref.watch(homeLogoKeyProvider);
    final currentMediaType = ref.watch(currentMediaTypeProvider);
    
    return NotificationListener<SizeChangedLayoutNotification>(
      onNotification: (notification) {
        // 只在展开状态下更新高度
        if (!isCollapsed) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            final renderBox = _navKey.currentContext?.findRenderObject() as RenderBox?;
            if (renderBox != null && renderBox.hasSize) {
              final height = renderBox.size.height;
              final currentHeight = ref.read(navbarHeightProvider);
              if (height > currentHeight) {
                ref.read(navbarHeightProvider.notifier).state = height;
              }
            }
          });
        }
        return false;
      },
      child: SizeChangedLayoutNotifier(
        child: Container(
          key: _navKey,
          decoration: BoxDecoration(
            color: ThemeConfig.surfaceColor,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 顶部标题栏（始终显示 logo + 标题，其他元素可折叠）
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    // Logo 和标题（始终显示）
                    Row(
                      children: [
                        Image.asset(
                          key: logoKey,
                          'assets/images/icon.png',
                          width: 32,
                          height: 32,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Funk&Love',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: ThemeConfig.primaryBlack,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    // 文件计数（可折叠）
                    AnimatedOpacity(
                      opacity: isCollapsed ? 0.0 : 1.0,
                      duration: const Duration(milliseconds: 200),
                      child: IgnorePointer(
                        ignoring: isCollapsed,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: ThemeConfig.surfaceContainerColor,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '$fileCount 个',
                            style: TextStyle(
                              color: ThemeConfig.accentGray,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // 目录筛选按钮（可折叠）
                    AnimatedOpacity(
                      opacity: isCollapsed ? 0.0 : 1.0,
                      duration: const Duration(milliseconds: 200),
                      child: IgnorePointer(
                        ignoring: isCollapsed,
                        child: _buildDirectoryButton(context, ref, currentDirectory),
                      ),
                    ),
                  ],
                ),
              ),
              
              // 媒体类型 Tab（可折叠）
              ClipRect(
                child: AnimatedAlign(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  alignment: Alignment.topCenter,
                  heightFactor: isCollapsed ? 0.0 : 1.0,
                  child: AnimatedOpacity(
                    opacity: isCollapsed ? 0.0 : 1.0,
                    duration: const Duration(milliseconds: 150),
                    child: _buildMediaTypeTabs(ref, currentMediaType),
                  ),
                ),
              ),

              // 标签筛选（可折叠）
              ClipRect(
                child: AnimatedAlign(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  alignment: Alignment.topCenter,
                  heightFactor: isCollapsed ? 0.0 : 1.0,
                  child: AnimatedOpacity(
                    opacity: isCollapsed ? 0.0 : 1.0,
                    duration: const Duration(milliseconds: 150),
                    child: const TagFilter(),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDirectoryButton(BuildContext context, WidgetRef ref, String? currentDirectory) {
    final hasDirectory = currentDirectory != null;
    
    return InkWell(
      onTap: () => _showDirectoryPicker(context, ref),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: hasDirectory
              ? ThemeConfig.primaryColor.withValues(alpha: 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.folder_outlined,
              size: 22,
              color: hasDirectory ? ThemeConfig.primaryColor : ThemeConfig.accentGray,
            ),
            if (hasDirectory) ...[
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () => ref.read(filesNotifierProvider.notifier).setDirectory(null),
                child: Icon(Icons.close, size: 16, color: ThemeConfig.primaryColor),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMediaTypeTabs(WidgetRef ref, String currentMediaType) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _buildMediaTypeTab(ref, '全部', 'all', currentMediaType == 'all'),
          const SizedBox(width: 24),
          _buildMediaTypeTab(ref, '图片', 'image', currentMediaType == 'image'),
          const SizedBox(width: 24),
          _buildMediaTypeTab(ref, '视频', 'video', currentMediaType == 'video'),
        ],
      ),
    );
  }

  Widget _buildMediaTypeTab(WidgetRef ref, String label, String value, bool isSelected) {
    return GestureDetector(
      onTap: () => ref.read(filesNotifierProvider.notifier).setMediaType(value),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.accentGray,
              fontSize: 15,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            height: 3,
            width: 24,
            decoration: BoxDecoration(
              color: isSelected ? ThemeConfig.primaryColor : Colors.transparent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
    );
  }

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
