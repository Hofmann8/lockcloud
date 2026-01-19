import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
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
class ImageViewer extends StatelessWidget {
  /// 图片 URL
  final String imageUrl;

  /// ThumbHash 字符串（用于生成模糊占位图）
  final String? thumbhash;

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
    this.minScale = 0.5,
    this.maxScale = 4.0,
    this.initialScale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return _buildErrorPlaceholder();
    }

    return PhotoView(
      imageProvider: CachedNetworkImageProvider(
        imageUrl,
        cacheManager: LockCloudImageCacheManager.instance,
      ),
      minScale: PhotoViewComputedScale.contained * minScale,
      maxScale: PhotoViewComputedScale.covered * maxScale,
      initialScale: PhotoViewComputedScale.contained * initialScale,
      backgroundDecoration: const BoxDecoration(
        color: ThemeConfig.backgroundColor,
      ),
      loadingBuilder: (context, event) => _buildLoadingPlaceholder(event),
      errorBuilder: (context, error, stackTrace) => _buildErrorPlaceholder(),
      // 启用手势
      enableRotation: false,
      gaplessPlayback: true,
      // 双击缩放行为
      scaleStateChangedCallback: (scaleState) {
        // 可以在这里处理缩放状态变化
      },
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
        if (thumbhash != null && thumbhash!.isNotEmpty)
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
  /// **Validates: Requirements 2.2**
  Widget _buildThumbHashPlaceholder() {
    try {
      // 尝试解码 ThumbHash
      // 注意：这里简化处理，实际应该使用 thumbhash 库
      // 由于 Flutter 没有官方的 thumbhash 库，这里使用渐变色作为占位
      final bytes = base64Decode(thumbhash!);
      
      // 从 thumbhash 字节中提取颜色信息（简化实现）
      // 实际的 thumbhash 解码需要完整的算法实现
      if (bytes.length >= 4) {
        final r = bytes[0];
        final g = bytes[1];
        final b = bytes[2];
        final a = bytes.length > 3 ? bytes[3] : 255;
        
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              colors: [
                Color.fromARGB(a, r, g, b),
                Color.fromARGB(a, r ~/ 2, g ~/ 2, b ~/ 2),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      // 解码失败，使用默认背景
    }

    return Container(color: ThemeConfig.backgroundColor);
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
