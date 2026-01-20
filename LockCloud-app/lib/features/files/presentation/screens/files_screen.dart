import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../core/storage/image_cache_manager.dart';
import '../../../../core/storage/preferences_storage.dart';
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
  static const int _crossAxisCount = 2;
  static const double _gridPadding = 12;
  static const double _gridSpacing = 12;
  static const double _childAspectRatio = 0.75;

  final ScrollController _scrollController = ScrollController();
  final Set<int> _prefetchedFileIds = {};
  List<FileModel> _latestFiles = const [];
  FileFilters? _lastFilters;
  int _lastFileCount = 0;  // 追踪文件数量变化

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);

    // 初始化加载数据
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = ref.read(filesNotifierProvider);
      if (state.files.isEmpty && !state.isLoading) {
        ref.read(filesNotifierProvider.notifier).initialize();
      }
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

  void _resetPrefetchState({bool resetScroll = false}) {
    _prefetchedFileIds.clear();
    _lastFileCount = 0;

    if (resetScroll) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_scrollController.hasClients) return;
        _scrollController.jumpTo(0);
      });
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

  bool _isCompactLayout() {
    final shortestSide = MediaQuery.of(context).size.shortestSide;
    return shortestSide < 600;
  }

  StylePreset _imageThumbStyle() {
    // 直接用 preview，跳过 thumb，让 thumbhash 有展示机会
    return _isCompactLayout() ? StylePreset.previewmobile : StylePreset.previewdesktop;
  }

  StylePreset _videoThumbStyle() {
    // 视频也用 preview 尺寸
    return _isCompactLayout() ? StylePreset.previewmobile : StylePreset.previewdesktop;
  }

  String _thumbnailCacheKey(StylePreset style, int fileId) {
    return 'thumb:${style.value}:$fileId';
  }

  /// 加载更多并预取签名URL
  Future<void> _loadMoreWithPrefetch() async {
    final notifier = ref.read(filesNotifierProvider.notifier);
    final state = ref.read(filesNotifierProvider);
    
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
    
    final oldCount = state.files.length;
    await notifier.loadMore();
    
    // 只预取新增的文件
    final newState = ref.read(filesNotifierProvider);
    if (newState.files.length > oldCount) {
      final newFiles = newState.files.sublist(oldCount);
      unawaited(_prefetchSignedUrls(newFiles));
    }
  }

  /// 下拉刷新
  Future<void> _onRefresh() async {
    _resetPrefetchState();
    // 清除签名URL缓存
    ref.read(batchSignedUrlNotifierProvider.notifier).clear();
    await ref.read(filesNotifierProvider.notifier).refresh();
  }

  /// 批量预取签名URL（只预取 thumb）
  Future<void> _prefetchSignedUrls(List<FileModel> files) async {
    if (!mounted) return;
    final imageThumbStyle = _imageThumbStyle();
    final videoThumbStyle = _videoThumbStyle();

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
    }
    
    if (imageIds.isEmpty && videoIds.isEmpty) return;
    
    final notifier = ref.read(batchSignedUrlNotifierProvider.notifier);
    final imageCache = ref.read(imageCacheServiceProvider);

    Future<void> fetchAndWarmCache(List<int> ids, StylePreset style) async {
      if (ids.isEmpty) return;
      final urls = await notifier.fetchUrls(ids, style: style);
      if (urls.isEmpty) return;
      final urlsByCacheKey = <String, String>{};
      for (final entry in urls.entries) {
        urlsByCacheKey[_thumbnailCacheKey(style, entry.key)] = entry.value;
      }
      await imageCache.preloadImagesWithCacheKeys(urlsByCacheKey);
      _prefetchedFileIds.addAll(urls.keys);
    }

    // 只预取缩略图
    await Future.wait([
      fetchAndWarmCache(imageIds, imageThumbStyle),
      fetchAndWarmCache(videoIds, videoThumbStyle),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    // 只监听需要的状态，避免不必要的重建
    final files = ref.watch(filesNotifierProvider.select((s) => s.files));
    _latestFiles = files;
    final filters = ref.watch(filesNotifierProvider.select((s) => s.filters));
    final normalizedFilters = filters.copyWith(page: 1);
    if (_lastFilters != null && _lastFilters != normalizedFilters) {
      _resetPrefetchState(resetScroll: true);
    }
    _lastFilters = normalizedFilters;
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
    final imageThumbStyle = _imageThumbStyle();
    final videoThumbStyle = _videoThumbStyle();
    
    // 获取图片加载模式
    final prefs = ref.watch(preferencesStorageSyncProvider);
    final loadMode = prefs?.getImageLoadMode() ?? ImageLoadMode.dataSaver;
    
    // 根据模式设置 cacheExtent
    final cacheExtent = switch (loadMode) {
      ImageLoadMode.dataSaver => 0.0,  // 流畅：不预渲染
      ImageLoadMode.aggressive => MediaQuery.of(context).size.height,  // 极速：预渲染 1 屏
    };

    // 首次加载时预取签名URL（只在文件列表变化时触发一次）
    if (files.isNotEmpty && files.length != _lastFileCount) {
      _lastFileCount = files.length;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        // 只预取新增的文件，不遍历整个列表
        final newFiles = files.where((f) => !_prefetchedFileIds.contains(f.id)).toList();
        if (newFiles.isNotEmpty) {
          unawaited(_prefetchSignedUrls(newFiles));
        }
      });
    }

    return CustomScrollView(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      cacheExtent: cacheExtent,
      slivers: [
        // 文件网格
        SliverPadding(
          padding: const EdgeInsets.all(_gridPadding),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: _crossAxisCount, // 2 列布局
              mainAxisSpacing: _gridSpacing,
              crossAxisSpacing: _gridSpacing,
              childAspectRatio: _childAspectRatio, // 宽高比
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final file = files[index];
                return FileCard(
                  key: ValueKey(file.id),
                  file: file,
                  imageThumbStyle: imageThumbStyle,
                  videoThumbStyle: videoThumbStyle,
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
