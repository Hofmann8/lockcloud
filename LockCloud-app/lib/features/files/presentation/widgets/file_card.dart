import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_thumbhash/flutter_thumbhash.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../core/storage/image_cache_manager.dart';
import '../../../../core/storage/preferences_storage.dart';
import '../../data/models/file_model.dart';
import '../../data/services/signed_url_service.dart';
import '../models/file_detail_entry.dart';
import '../providers/batch_selection_provider.dart';
import '../providers/signed_url_provider.dart';

/// 文件卡片组件 - 与 Web 端 FileCardSimple 风格一致
///
/// 显示单个文件的卡片，包括：
/// - 缩略图（thumbhash → thumb）
/// - 文件名
/// - 元数据（大小、日期等）
/// - 选择状态指示器
class FileCard extends ConsumerWidget {
  final FileModel file;
  final StylePreset imageThumbStyle;
  final StylePreset videoThumbStyle;

  const FileCard({
    super.key,
    required this.file,
    required this.imageThumbStyle,
    required this.videoThumbStyle,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isSelectionMode = ref.watch(isInSelectionModeProvider);
    final isSelected = ref.watch(isFileSelectedProvider(file.id));
    final thumbnailStyle = file.isVideo ? videoThumbStyle : imageThumbStyle;
    final thumbnailCacheKey = _thumbnailCacheKey(thumbnailStyle);

    // 从批量签名URL缓存中获取URL（只读取，不触发请求）
    // 列表页只用 thumb，不用 preview
    final thumbnailUrl = ref.watch(
      batchSignedUrlNotifierProvider.select(
        (s) => s.getUrl(file.id, thumbnailStyle),
      ),
    );

    return GestureDetector(
      onTap: () => _onTap(
        context,
        ref,
        isSelectionMode,
        thumbnailUrl,
        thumbnailCacheKey,
      ),
      onLongPress: () => _onLongPress(ref),
      child: Container(
        decoration: BoxDecoration(
          color: ThemeConfig.surfaceColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.borderColor,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // 主内容
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 缩略图：thumbhash → preview
                Expanded(
                  child: _buildThumbnail(ref, thumbnailUrl, cacheKey: thumbnailCacheKey),
                ),

                // 文件信息
                _buildFileInfo(),
              ],
            ),

            // 选择指示器
            if (isSelectionMode)
              Positioned(
                top: 8,
                right: 8,
                child: _buildSelectionIndicator(isSelected),
              ),

            // 视频标识
            if (file.isVideo)
              Positioned(
                top: 8,
                left: 8,
                child: _buildVideoIndicator(),
              ),
          ],
        ),
      ),
    );
  }



  /// 构建缩略图：thumbhash → preview（带渐变效果）
  Widget _buildThumbnail(
    WidgetRef ref,
    String? thumbnailUrl, {
    required String cacheKey,
  }) {
    // 获取图片加载模式
    final prefs = ref.watch(preferencesStorageSyncProvider);
    final loadMode = prefs?.getImageLoadMode() ?? ImageLoadMode.dataSaver;
    
    // 根据模式设置动画时长
    final fadeInDuration = switch (loadMode) {
      ImageLoadMode.dataSaver => const Duration(milliseconds: 400),  // 流畅：丝滑渐变
      ImageLoadMode.aggressive => Duration.zero, // 极速：无动画
    };
    final fadeOutDuration = switch (loadMode) {
      ImageLoadMode.dataSaver => const Duration(milliseconds: 200),
      ImageLoadMode.aggressive => Duration.zero,
    };

    final imageWidget = Container(
      width: double.infinity,
      color: ThemeConfig.surfaceContainerColor,
      child: thumbnailUrl != null
          ? CachedNetworkImage(
              imageUrl: thumbnailUrl,
              fit: BoxFit.cover,
              cacheKey: cacheKey,
              cacheManager: LockCloudImageCacheManager.instance,
              placeholder: (context, url) => _buildPlaceholder(),
              errorWidget: (context, url, error) => _buildPlaceholder(),
              useOldImageOnUrlChange: true,
              fadeInDuration: fadeInDuration,
              fadeOutDuration: fadeOutDuration,
              placeholderFadeInDuration: Duration.zero,
            )
          : _buildPlaceholder(),
    );

    // 用 Hero 包裹实现页面转场动画
    return Hero(
      tag: 'file_image_${file.id}',
      child: imageWidget,
    );
  }

  String _thumbnailCacheKey(StylePreset style) {
    return 'thumb:${style.value}:${file.id}';
  }

  /// 构建占位图 - 使用 ThumbHash 生成模糊占位图
  Widget _buildPlaceholder() {
    // 如果有 thumbhash，使用 flutter_thumbhash 解码显示
    if (file.thumbhash != null && file.thumbhash!.isNotEmpty) {
      try {
        final hash = ThumbHash.fromBase64(file.thumbhash!);
        return Image(
          image: hash.toImage(),
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          gaplessPlayback: true, // 防止闪烁
          errorBuilder: (context, error, stackTrace) => _buildDefaultPlaceholder(),
        );
      } catch (e) {
        // 解码失败，使用默认占位图
      }
    }

    return _buildDefaultPlaceholder();
  }

  /// 构建默认占位图
  Widget _buildDefaultPlaceholder() {
    return Container(
      color: ThemeConfig.surfaceContainerColor,
      child: Center(
        child: Icon(
          file.isVideo ? Icons.videocam_outlined : Icons.image_outlined,
          size: 40,
          color: ThemeConfig.accentGray.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  /// 构建文件信息 - 与 Web 端风格一致
  Widget _buildFileInfo() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        border: Border(
          top: BorderSide(color: ThemeConfig.borderColor.withValues(alpha: 0.5)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 文件名（优先显示重命名后的文件名）
          Text(
            file.filename,
            style: TextStyle(
              color: ThemeConfig.primaryBlack,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          // 元数据
          Row(
            children: [
              // 文件大小
              Text(
                file.formattedSize,
                style: TextStyle(
                  color: ThemeConfig.accentGray,
                  fontSize: 11,
                ),
              ),
              const SizedBox(width: 8),
              // 活动日期
              if (file.activityDate != null)
                Expanded(
                  child: Text(
                    file.activityDate!,
                    style: TextStyle(
                      color: ThemeConfig.accentGray,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// 构建选择指示器
  Widget _buildSelectionIndicator(bool isSelected) {
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isSelected ? ThemeConfig.primaryColor : Colors.white.withValues(alpha: 0.9),
        border: Border.all(
          color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.borderColor,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 4,
          ),
        ],
      ),
      child: isSelected
          ? const Icon(
              Icons.check,
              size: 16,
              color: Colors.white,
            )
          : null,
    );
  }

  /// 构建视频标识
  Widget _buildVideoIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: ThemeConfig.primaryBlack.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.play_arrow,
            size: 14,
            color: Colors.white,
          ),
          const SizedBox(width: 2),
          Text(
            '视频',
            style: TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  /// 点击处理
  void _onTap(
    BuildContext context,
    WidgetRef ref,
    bool isSelectionMode,
    String? thumbnailUrl,
    String thumbnailCacheKey,
  ) {
    if (isSelectionMode) {
      // 选择模式下，切换选择状态
      ref.read(batchSelectionNotifierProvider.notifier).toggleSelection(file.id);
    } else {
      // 非选择模式，进入详情页
      final entry = FileDetailEntry(
        fileId: file.id,
        thumbhash: file.thumbhash,
        thumbnailUrl: thumbnailUrl,
        thumbnailCacheKey: thumbnailCacheKey,
        isVideo: file.isVideo,
        filename: file.filename,
      );
      context.push('/files/${file.id}', extra: entry);
    }
  }

  /// 长按处理
  void _onLongPress(WidgetRef ref) {
    final notifier = ref.read(batchSelectionNotifierProvider.notifier);
    notifier.enterSelectionMode();
    notifier.select(file.id);
  }
}
