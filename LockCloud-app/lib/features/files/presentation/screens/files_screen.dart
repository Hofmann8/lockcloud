import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/file_model.dart';
import '../../data/services/signed_url_service.dart';
import '../providers/batch_selection_provider.dart';
import '../providers/files_provider.dart';
import '../providers/signed_url_provider.dart';
import '../widgets/batch_action_bar.dart';
import '../widgets/file_card.dart';
import '../widgets/filter_bar.dart';

/// 文件列表页面
///
/// 显示文件列表，支持：
/// - 2 列网格布局
/// - 无限滚动加载更多
/// - 下拉刷新
/// - 筛选功能
/// - 批量选择模式
class FilesScreen extends ConsumerStatefulWidget {
  const FilesScreen({super.key});

  @override
  ConsumerState<FilesScreen> createState() => _FilesScreenState();
}

class _FilesScreenState extends ConsumerState<FilesScreen> {
  final ScrollController _scrollController = ScrollController();
  Set<int> _prefetchedFileIds = {};

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);

    // 初始化加载数据
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(filesNotifierProvider.notifier).initialize();
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// 滚动监听 - 无限滚动
  void _onScroll() {
    if (_shouldPreload) {
      _loadMoreWithPrefetch();
    }
  }

  /// 判断是否应该预加载（提前加载，距离底部还有30%时就开始）
  bool get _shouldPreload {
    if (!_scrollController.hasClients) return false;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    // 距离底部 30% 时开始预加载下一页
    return currentScroll >= (maxScroll * 0.7);
  }

  /// 加载更多并预取签名URL
  Future<void> _loadMoreWithPrefetch() async {
    final notifier = ref.read(filesNotifierProvider.notifier);
    final state = ref.read(filesNotifierProvider);
    
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
    
    await notifier.loadMore();
    
    // 加载完成后预取新文件的签名URL
    final newFiles = ref.read(filesNotifierProvider).files;
    _prefetchSignedUrls(newFiles);
  }

  /// 下拉刷新
  Future<void> _onRefresh() async {
    _prefetchedFileIds.clear();
    await ref.read(filesNotifierProvider.notifier).refresh();
  }

  /// 批量预取签名URL
  void _prefetchSignedUrls(List<FileModel> files) {
    // 根据文件类型分组，只处理未预取过的文件
    final imageIds = <int>[];
    final videoIds = <int>[];
    
    for (final file in files) {
      if (_prefetchedFileIds.contains(file.id)) continue;
      
      if (file.isVideo) {
        videoIds.add(file.id);
      } else if (file.isImage) {
        imageIds.add(file.id);
      }
      _prefetchedFileIds.add(file.id);
    }
    
    if (imageIds.isEmpty && videoIds.isEmpty) return;
    
    final notifier = ref.read(batchSignedUrlNotifierProvider.notifier);
    
    // 分别获取图片和视频的签名URL
    if (imageIds.isNotEmpty) {
      notifier.fetchUrls(imageIds, style: StylePreset.thumbdesktop);
    }
    if (videoIds.isNotEmpty) {
      notifier.fetchUrls(videoIds, style: StylePreset.videothumbdesktop);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 只监听需要的状态，避免不必要的重建
    final files = ref.watch(filesNotifierProvider.select((s) => s.files));
    final isLoading = ref.watch(filesNotifierProvider.select((s) => s.isLoading));
    final isLoadingMore = ref.watch(filesNotifierProvider.select((s) => s.isLoadingMore));
    final hasMore = ref.watch(filesNotifierProvider.select((s) => s.hasMore));
    final error = ref.watch(filesNotifierProvider.select((s) => s.error));
    final isSelectionMode = ref.watch(isInSelectionModeProvider);

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // 筛选栏
            const FilterBar(),

            // 文件列表
            Expanded(
              child: _buildContent(
                files: files,
                isLoading: isLoading,
                isLoadingMore: isLoadingMore,
                hasMore: hasMore,
                error: error,
              ),
            ),

            // 批量操作栏（选择模式下显示）
            if (isSelectionMode) const BatchActionBar(),
          ],
        ),
      ),
    );
  }

  /// 构建内容区域
  Widget _buildContent({
    required List<FileModel> files,
    required bool isLoading,
    required bool isLoadingMore,
    required bool hasMore,
    required String? error,
  }) {
    // 加载中状态
    if (isLoading && files.isEmpty) {
      return Center(
        child: CircularProgressIndicator(
          color: ThemeConfig.primaryColor,
        ),
      );
    }

    // 错误状态
    if (error != null && files.isEmpty) {
      return _buildErrorState(error);
    }

    // 空状态
    if (files.isEmpty) {
      return _buildEmptyState();
    }

    // 文件列表
    return RefreshIndicator(
      onRefresh: _onRefresh,
      color: ThemeConfig.primaryColor,
      backgroundColor: ThemeConfig.surfaceColor,
      child: _buildFileGrid(
        files: files,
        isLoadingMore: isLoadingMore,
        hasMore: hasMore,
      ),
    );
  }

  /// 构建文件网格
  Widget _buildFileGrid({
    required List<FileModel> files,
    required bool isLoadingMore,
    required bool hasMore,
  }) {
    // 首次加载时预取签名URL
    if (_prefetchedFileIds.isEmpty && files.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _prefetchSignedUrls(files);
      });
    }

    return CustomScrollView(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        // 文件网格
        SliverPadding(
          padding: const EdgeInsets.all(12),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, // 2 列布局
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.75, // 宽高比
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final file = files[index];
                return FileCard(
                  key: ValueKey(file.id),
                  file: file,
                );
              },
              childCount: files.length,
              addAutomaticKeepAlives: true,
              addRepaintBoundaries: true,
            ),
          ),
        ),

        // 加载更多指示器
        if (isLoadingMore)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: CircularProgressIndicator(
                  color: ThemeConfig.primaryColor,
                  strokeWidth: 2,
                ),
              ),
            ),
          ),

        // 没有更多数据提示
        if (!hasMore && files.isNotEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: Text(
                  '没有更多了',
                  style: TextStyle(
                    color: ThemeConfig.accentGray,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),

        // 底部安全区域
        const SliverToBoxAdapter(
          child: SizedBox(height: 16),
        ),
      ],
    );
  }

  /// 构建空状态
  Widget _buildEmptyState() {
    final hasFilters = ref.watch(hasFiltersProvider);

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.folder_open_outlined,
            size: 80,
            color: ThemeConfig.accentGray.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            hasFilters ? '没有找到匹配的文件' : '暂无文件',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
          ),
          if (hasFilters) ...[
            const SizedBox(height: 16),
            TextButton(
              onPressed: () {
                ref.read(filesNotifierProvider.notifier).resetFilters();
              },
              child: Text(
                '清除筛选条件',
                style: TextStyle(color: ThemeConfig.primaryColor),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// 构建错误状态
  Widget _buildErrorState(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            size: 80,
            color: ThemeConfig.errorColor.withValues(alpha: 0.7),
          ),
          const SizedBox(height: 16),
          Text(
            error,
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _onRefresh,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }
}
