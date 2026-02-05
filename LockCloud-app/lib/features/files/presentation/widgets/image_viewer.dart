import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_thumbhash/flutter_thumbhash.dart';
import 'package:photo_view/photo_view.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../core/storage/image_cache_manager.dart';

/// 图片预览组件
///
/// 使用 photo_view 实现可缩放的图片预览。
/// 使用 cached_network_image 缓存图片。
/// 支持：
/// - 双指缩放
/// - 双击缩放
/// - 拖动平移
/// - ThumbHash 占位图
/// - 图片缓存
///
/// **Validates: Requirements 4.2, 10.4**
class ImageViewer extends StatefulWidget {
  /// 图片 URL
  final String imageUrl;

  /// ThumbHash 字符串（用于生成模糊占位图）
  final String? thumbhash;

  /// 缓存 Key（用于复用列表页已缓存的图片）
  final String? cacheKey;

  /// 最小缩放比例
  final double minScale;

  /// 最大缩放比例
  final double maxScale;

  /// 初始缩放比例
  final double initialScale;

  const ImageViewer({
    super.key,
    required this.imageUrl,
    this.thumbhash,
    this.cacheKey,
    this.minScale = 0.5,
    this.maxScale = 4.0,
    this.initialScale = 1.0,
  });

  @override
  State<ImageViewer> createState() => _ImageViewerState();
}

class _ImageViewerState extends State<ImageViewer> {
  ImageProvider? _imageProvider;
  ImageStream? _imageStream;
  ImageStreamListener? _imageStreamListener;
  bool _isLoaded = false;
  bool _hasDependencies = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  void didUpdateWidget(covariant ImageViewer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl ||
        oldWidget.cacheKey != widget.cacheKey) {
      if (_hasDependencies) {
        _resolveImage();
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _hasDependencies = true;
    _resolveImage();
  }

  @override
  void dispose() {
    _clearImageStream();
    super.dispose();
  }

  void _clearImageStream() {
    if (_imageStream != null && _imageStreamListener != null) {
      _imageStream!.removeListener(_imageStreamListener!);
    }
    _imageStream = null;
    _imageStreamListener = null;
  }

  void _resolveImage() {
    if (widget.imageUrl.isEmpty) {
      // URL 为空，清理状态，显示 thumbhash
      _clearImageStream();
      if (_imageProvider != null || _isLoaded) {
        _imageProvider = null;
        _isLoaded = false;
        if (mounted) setState(() {});
      }
      return;
    }

    // 检查 URL 是否真的变了
    final currentUrl = (_imageProvider as CachedNetworkImageProvider?)?.url;
    if (currentUrl == widget.imageUrl) {
      // URL 没变，不需要重新加载
      return;
    }

    _clearImageStream();
    
    final newProvider = CachedNetworkImageProvider(
      widget.imageUrl,
      cacheManager: LockCloudImageCacheManager.instance,
      cacheKey: widget.cacheKey,
    );
    _imageProvider = newProvider;
    
    _imageStream = newProvider.resolve(
      createLocalImageConfiguration(context),
    );
    
    // 用一个标记来判断回调是否同步触发
    bool syncLoaded = false;
    
    _imageStreamListener = ImageStreamListener(
      (image, sync) {
        syncLoaded = true;
        if (mounted && !_isLoaded) {
          setState(() => _isLoaded = true);
        }
      },
      onError: (error, stackTrace) {
        if (mounted && _isLoaded) {
          setState(() => _isLoaded = false);
        }
      },
    );
    _imageStream!.addListener(_imageStreamListener!);
    
    // 如果回调没有同步触发（图片不在缓存），才重置 _isLoaded
    if (!syncLoaded && _isLoaded) {
      _isLoaded = false;
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    // 如果 URL 为空，显示 thumbhash 占位图（而不是错误状态）
    if (widget.imageUrl.isEmpty) {
      return _buildThumbhashOnlyPlaceholder();
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        PhotoView(
          imageProvider: _imageProvider,
          minScale: PhotoViewComputedScale.contained * widget.minScale,
          maxScale: PhotoViewComputedScale.covered * widget.maxScale,
          initialScale: PhotoViewComputedScale.contained * widget.initialScale,
          backgroundDecoration: const BoxDecoration(
            color: ThemeConfig.backgroundColor,
          ),
          loadingBuilder: (context, event) => const SizedBox.shrink(),
          errorBuilder: (context, error, stackTrace) => _buildErrorPlaceholder(),
          // 启用手势
          enableRotation: false,
          gaplessPlayback: true,
          // 双击缩放行为
          scaleStateChangedCallback: (scaleState) {
            // 可以在这里处理缩放状态变化
          },
        ),
        IgnorePointer(
          child: AnimatedOpacity(
            opacity: _isLoaded ? 0.0 : 1.0,
            duration: const Duration(milliseconds: 220),
            child: _buildThumbhashOnlyPlaceholder(),
          ),
        ),
      ],
    );
  }

  /// 构建加载占位图
  Widget _buildLoadingPlaceholder(ImageChunkEvent? event) {
    // 计算加载进度
    double? progress;
    if (event != null && event.expectedTotalBytes != null) {
      progress = event.cumulativeBytesLoaded / event.expectedTotalBytes!;
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        // ThumbHash 模糊占位图
        if (widget.thumbhash != null && widget.thumbhash!.isNotEmpty)
          _buildThumbHashPlaceholder()
        else
          Container(color: ThemeConfig.backgroundColor),

        // 加载指示器
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (progress != null)
                SizedBox(
                  width: 48,
                  height: 48,
                  child: CircularProgressIndicator(
                    value: progress,
                    color: ThemeConfig.primaryColor,
                    strokeWidth: 3,
                  ),
                )
              else
                const SizedBox(
                  width: 48,
                  height: 48,
                  child: CircularProgressIndicator(
                    color: ThemeConfig.primaryColor,
                    strokeWidth: 3,
                  ),
                ),
              if (progress != null) ...[
                const SizedBox(height: 8),
                const Text(
                  '',
                  style: TextStyle(
                    color: ThemeConfig.onSurfaceVariantColor,
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// 构建 ThumbHash 占位图
  ///
  /// 作为模糊背景层，使用 cover 填满整个容器
  /// **Validates: Requirements 2.2**
  Widget _buildThumbHashPlaceholder() {
    if (widget.thumbhash == null || widget.thumbhash!.isEmpty) {
      return Container(color: ThemeConfig.backgroundColor);
    }

    try {
      final hash = ThumbHash.fromBase64(widget.thumbhash!);
      // 使用 cover 填满容器作为模糊背景
      // thumbhash 本身就是模糊的，cover 裁剪不影响视觉效果
      return Container(
        color: ThemeConfig.backgroundColor,
        child: Image(
          image: hash.toImage(),
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          gaplessPlayback: true,
        ),
      );
    } catch (e) {
      return Container(color: ThemeConfig.backgroundColor);
    }
  }

  /// 构建错误占位图
  Widget _buildErrorPlaceholder() {
    return Container(
      color: ThemeConfig.backgroundColor,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.broken_image,
              size: 64,
              color: ThemeConfig.onSurfaceVariantColor,
            ),
            const SizedBox(height: 16),
            const Text(
              '图片加载失败',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建仅 thumbhash 的占位图（URL 为空时使用）
  /// 显示 thumbhash 模糊图 + 加载指示器
  Widget _buildThumbhashOnlyPlaceholder() {
    return Stack(
      fit: StackFit.expand,
      children: [
        // ThumbHash 模糊占位图
        if (widget.thumbhash != null && widget.thumbhash!.isNotEmpty)
          _buildThumbHashPlaceholder()
        else
          Container(color: ThemeConfig.backgroundColor),

        // 加载指示器
        const Center(
          child: SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              color: ThemeConfig.primaryColor,
              strokeWidth: 3,
            ),
          ),
        ),
      ],
    );
  }
}

/// 图片预览画廊组件
///
/// 支持多张图片的滑动预览
class ImageGalleryViewer extends StatefulWidget {
  /// 图片 URL 列表
  final List<String> imageUrls;

  /// ThumbHash 列表（与 imageUrls 对应）
  final List<String?>? thumbhashes;

  /// 初始显示的图片索引
  final int initialIndex;

  /// 页面切换回调
  final void Function(int index)? onPageChanged;

  const ImageGalleryViewer({
    super.key,
    required this.imageUrls,
    this.thumbhashes,
    this.initialIndex = 0,
    this.onPageChanged,
  });

  @override
  State<ImageGalleryViewer> createState() => _ImageGalleryViewerState();
}

class _ImageGalleryViewerState extends State<ImageGalleryViewer> {
  late PageController _pageController;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // 图片页面
        PageView.builder(
          controller: _pageController,
          itemCount: widget.imageUrls.length,
          onPageChanged: (index) {
            setState(() {
              _currentIndex = index;
            });
            widget.onPageChanged?.call(index);
          },
          itemBuilder: (context, index) {
            final thumbhash = widget.thumbhashes != null && 
                index < widget.thumbhashes!.length
                ? widget.thumbhashes![index]
                : null;

            return ImageViewer(
              imageUrl: widget.imageUrls[index],
              thumbhash: thumbhash,
            );
          },
        ),

        // 页面指示器
        if (widget.imageUrls.length > 1)
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: _buildPageIndicator(),
          ),
      ],
    );
  }

  Widget _buildPageIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black54,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            '${_currentIndex + 1} / ${widget.imageUrls.length}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }
}
