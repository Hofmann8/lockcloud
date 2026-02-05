import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_thumbhash/flutter_thumbhash.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../core/storage/image_cache_manager.dart';
import '../../../../core/storage/preferences_storage.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/models/file_model.dart';
import '../../data/repositories/files_repository.dart';
import '../../data/repositories/tags_repository.dart';
import '../../data/services/signed_url_service.dart';
import '../models/file_detail_entry.dart';
import '../providers/files_provider.dart';
import '../widgets/image_viewer.dart';
import '../widgets/request_edit_dialog.dart';
import '../widgets/tag_input_with_suggestions.dart';
import '../widgets/video_player_widget.dart';

/// 文件详情页面
///
/// 新版UI设计：
/// - 全屏图片/视频预览
/// - 浮动信息栏（上滑呼出，点击图片或下滑隐藏）
/// - 左右滑动切换文件（带平滑动画）
/// - 预加载相邻文件详情信息
class FileDetailScreen extends ConsumerStatefulWidget {
  final int fileId;
  final FileDetailEntry? entry;

  const FileDetailScreen({
    super.key,
    required this.fileId,
    this.entry,
  });

  @override
  ConsumerState<FileDetailScreen> createState() => _FileDetailScreenState();
}

class _FileDetailScreenState extends ConsumerState<FileDetailScreen>
    with SingleTickerProviderStateMixin {
  // 当前显示的文件
  FileModel? _file;
  bool _isLoading = true;
  String? _error;
  String? _imageSignedUrl;
  String? _originalImageUrl;
  bool _isLoadingOriginal = false;
  bool _showOriginal = false;
  String? _displayThumbhash;
  
  // 记录进入时的文件信息，用于 Hero 动画
  late FileDetailEntry _entry;
  late int _entryFileId;
  
  // 信息栏显示状态
  bool _showInfoPanel = false;
  bool _isReady = false;
  late AnimationController _infoPanelController;
  late Animation<Offset> _infoPanelSlideAnimation;
  late Animation<double> _imageOffsetAnimation;
  
  // 信息栏高度
  static const double _infoPanelHeight = 380;

  @override
  void initState() {
    super.initState();
    _entry = widget.entry ?? FileDetailEntry(fileId: widget.fileId);
    _entryFileId = _entry.fileId;
    _displayThumbhash = _entry.thumbhash;
    
    _infoPanelController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _infoPanelSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _infoPanelController,
      curve: Curves.easeOutCubic,
    ));
    _imageOffsetAnimation = Tween<double>(
      begin: 0,
      end: -_infoPanelHeight / 2,
    ).animate(CurvedAnimation(
      parent: _infoPanelController,
      curve: Curves.easeOutCubic,
    ));
    
    _loadFileDetail();
  }

  @override
  void didUpdateWidget(covariant FileDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 如果 fileId 变了，重新加载
    if (oldWidget.fileId != widget.fileId) {
      _entry = widget.entry ?? FileDetailEntry(fileId: widget.fileId);
      _entryFileId = _entry.fileId;
      _displayThumbhash = _entry.thumbhash;
      _isReady = false;
      _showInfoPanel = false;
      _infoPanelController.reset();
      _loadFileDetail();
    }
  }

  @override
  void dispose() {
    _infoPanelController.dispose();
    super.dispose();
  }

  void _toggleInfoPanel() {
    setState(() {
      _showInfoPanel = !_showInfoPanel;
      if (_showInfoPanel) {
        _infoPanelController.forward();
      } else {
        _infoPanelController.reverse();
      }
    });
  }

  void _hideInfoPanel() {
    if (_showInfoPanel) {
      setState(() => _showInfoPanel = false);
      _infoPanelController.reverse();
    }
  }

  void _showInfoPanelIfHidden() {
    if (!_showInfoPanel) {
      setState(() => _showInfoPanel = true);
      _infoPanelController.forward();
    }
  }

  Future<void> _loadFileDetail() async {
    final useEntryPreview = widget.fileId == _entryFileId &&
        _entry.thumbnailUrl != null &&
        _entry.thumbnailUrl!.isNotEmpty;
    setState(() {
      _isLoading = true;
      _error = null;
      _imageSignedUrl = useEntryPreview ? _entry.thumbnailUrl : null;
      _originalImageUrl = null;
      _showOriginal = false;
    });

    try {
      final repository = ref.read(filesRepositoryProvider);
      final file = await repository.getFileDetail(widget.fileId);
      final mergedFile = _mergeThumbhash(file, _entry.thumbhash);

      if (mounted) {
        setState(() {
          _file = mergedFile;
          _isLoading = false;
        });
        
        if (mergedFile.isImage) {
          if (!useEntryPreview) {
            _requestAndApplyPreviewUrl(mergedFile.id);
          }
          _checkAutoLoadOriginal();
        }
        
        // 数据加载完成，延迟后显示UI并呼出信息栏
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            setState(() {
              _isReady = true;
              _showInfoPanel = true;
            });
            _infoPanelController.forward();
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _getErrorMessage(e);
          _isLoading = false;
        });
      }
    }
  }

  FileModel _mergeThumbhash(FileModel file, String? fallbackThumbhash) {
    final hasThumbhash = file.thumbhash != null && file.thumbhash!.isNotEmpty;
    final hasFallback = fallbackThumbhash != null && fallbackThumbhash.isNotEmpty;
    if (!hasThumbhash && hasFallback) {
      return file.copyWith(thumbhash: fallbackThumbhash);
    }
    return file;
  }

  Future<void> _requestAndApplyPreviewUrl(int fileId) async {
    try {
      final signedUrlService = ref.read(signedUrlServiceProvider);
      final url = await signedUrlService.getSignedUrl(
        fileId,
        style: StylePreset.previewdesktop,
      );
      if (mounted && url.isNotEmpty) {
        setState(() {
          _imageSignedUrl = url;
        });
      }
    } catch (e) {
      // 忽略错误
    }
  }

  void _checkAutoLoadOriginal() {
    final prefs = ref.read(preferencesStorageSyncProvider);
    if (prefs?.isAutoLoadOriginalEnabled() == true) {
      _loadOriginalImage();
    }
  }

  Future<void> _loadOriginalImage() async {
    if (_file == null || !_file!.isImage || _isLoadingOriginal) return;
    
    setState(() => _isLoadingOriginal = true);
    
    try {
      final signedUrlService = ref.read(signedUrlServiceProvider);
      final originalUrl = await signedUrlService.getSignedUrl(
        _file!.id,
        style: StylePreset.original,
      );
      
      if (mounted) {
        setState(() {
          _originalImageUrl = originalUrl;
          _showOriginal = true;
          _isLoadingOriginal = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingOriginal = false);
      }
    }
  }

  String _getErrorMessage(dynamic e) {
    if (e is Exception) {
      return e.toString().replaceFirst('Exception: ', '');
    }
    return '加载失败，请稍后重试';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return _buildLoadingState();
    }

    if (_error != null) {
      return _buildErrorState();
    }

    if (_file == null) {
      return _buildNotFoundState();
    }

    return GestureDetector(
      onTap: _toggleInfoPanel,
      onVerticalDragEnd: _onVerticalDragEnd,
      child: SizedBox.expand(
        child: Stack(
          children: [
            // 全屏媒体预览（带偏移动画）
            AnimatedBuilder(
              animation: _imageOffsetAnimation,
              builder: (context, child) {
                return Positioned.fill(
                  child: Transform.translate(
                    offset: Offset(0, _imageOffsetAnimation.value),
                    child: _buildMediaContent(),
                  ),
                );
              },
            ),
            // 顶部导航栏
            _buildTopBar(),
            // 浮动信息栏
            _buildFloatingInfoPanel(),
          ],
        ),
      ),
    );
  }

  /// 构建媒体内容
  Widget _buildMediaContent() {
    final file = _file!;
    final imageUrl = _showOriginal && _originalImageUrl != null 
        ? _originalImageUrl! 
        : (_imageSignedUrl ?? '');
    final thumbhash = _displayThumbhash ?? file.thumbhash;
    
    Widget content;
    
    if (file.isImage) {
      final cacheKey = widget.fileId == _entryFileId &&
              _entry.thumbnailUrl != null &&
              imageUrl == _entry.thumbnailUrl
          ? _entry.thumbnailCacheKey
          : null;
      
      content = ImageViewer(
        imageUrl: imageUrl,
        thumbhash: thumbhash,
        cacheKey: cacheKey,
      );
    } else if (file.isVideo) {
      content = VideoPlayerWidget(
        fileId: file.id,
        filename: file.filename,
        thumbhash: thumbhash,
        onFullscreenChanged: (_) {},
      );
    } else {
      content = _buildUnsupportedPreview();
    }
    
    return Hero(
      tag: 'file_image_$_entryFileId',
      child: content,
    );
  }

  Widget _buildLoadingState() {
    return Stack(
      children: [
        Positioned.fill(child: _buildEntryHeroPreview()),
        const Center(
          child: CircularProgressIndicator(color: ThemeConfig.primaryColor),
        ),
        _buildTopBar(showMore: false),
      ],
    );
  }

  Widget _buildEntryHeroPreview() {
    return Hero(
      tag: 'file_image_$_entryFileId',
      child: _buildEntryPreviewContent(),
    );
  }

  Widget _buildEntryPreviewContent() {
    if (widget.fileId != _entryFileId) {
      return Container(color: ThemeConfig.backgroundColor);
    }

    final url = _entry.thumbnailUrl;
    if (url != null && url.isNotEmpty) {
      return Container(
        color: ThemeConfig.backgroundColor,
        alignment: Alignment.center,
        child: CachedNetworkImage(
          imageUrl: url,
          fit: BoxFit.contain,
          cacheManager: LockCloudImageCacheManager.instance,
          cacheKey: _entry.thumbnailCacheKey,
          placeholder: (context, _) => _buildEntryPlaceholder(),
          errorWidget: (context, _, __) => _buildEntryPlaceholder(),
        ),
      );
    }

    return _buildEntryPlaceholder();
  }

  Widget _buildEntryPlaceholder() {
    final thumbhash = _entry.thumbhash;
    if (thumbhash != null && thumbhash.isNotEmpty) {
      try {
        final hash = ThumbHash.fromBase64(thumbhash);
        return Image(
          image: hash.toImage(),
          fit: BoxFit.contain,
          width: double.infinity,
          height: double.infinity,
          gaplessPlayback: true,
        );
      } catch (e) {
        // Ignore thumbhash decode failures.
      }
    }

    return Container(
      color: ThemeConfig.surfaceContainerColor,
      child: Center(
        child: Icon(
          _entry.isVideo ? Icons.videocam_outlined : Icons.image_outlined,
          size: 48,
          color: ThemeConfig.accentGray.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  /// 顶部导航栏
  Widget _buildTopBar({bool showMore = true}) {
    return SafeArea(
      child: AnimatedOpacity(
        opacity: _isReady ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 200),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: _isReady ? () => context.pop() : null,
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.3),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                ),
              ),
              if (showMore)
                IconButton(
                  onPressed: _isReady ? _showMoreOptions : null,
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.3),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.more_horiz, color: Colors.white, size: 20),
                  ),
                )
              else
                const SizedBox(width: 40, height: 40),
            ],
          ),
        ),
      ),
    );
  }

  /// 处理垂直滑动显示/隐藏信息栏
  void _onVerticalDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;

    if (velocity < -300) {
      _showInfoPanelIfHidden();
    } else if (velocity > 300) {
      _hideInfoPanel();
    }
  }

  Widget _buildUnsupportedPreview() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.insert_drive_file, size: 80, color: ThemeConfig.accentGray),
          const SizedBox(height: 16),
          Text(
            '不支持预览此文件类型',
            style: TextStyle(color: ThemeConfig.accentGray, fontSize: 16),
          ),
        ],
      ),
    );
  }

  /// 浮动信息栏
  Widget _buildFloatingInfoPanel() {
    final file = _file!;
    final currentUser = ref.watch(currentUserProvider);
    final isOwner = currentUser?.id == file.uploaderId;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: SlideTransition(
        position: _infoPanelSlideAnimation,
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // 拖动指示器
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: ThemeConfig.borderColor,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  
                  // 文件名（命名后的）
                  Text(
                    file.filename,
                    style: TextStyle(
                      color: ThemeConfig.primaryBlack,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  
                  const SizedBox(height: 12),
                  
                  // 上传者和时间
                  _buildUploaderInfo(file),
                  
                  const SizedBox(height: 16),
                  
                  // 详情信息
                  if (file.activityName != null && file.activityName!.isNotEmpty)
                    _buildInfoItem(
                      icon: Icons.event_outlined,
                      label: '活动名称：',
                      value: file.activityName!,
                    ),
                  
                  if (file.activityName != null && file.activityName!.isNotEmpty)
                    const SizedBox(height: 8),
                  
                  _buildInfoItem(
                    icon: Icons.category_outlined,
                    label: '活动类型：',
                    value: file.activityTypeDisplay ?? '-',
                  ),
                  
                  const SizedBox(height: 8),
                  
                  _buildInfoItem(
                    icon: Icons.calendar_today_outlined,
                    label: '活动日期：',
                    value: file.activityDate ?? '-',
                  ),
                  
                  const SizedBox(height: 8),
                  
                  _buildInfoItem(
                    icon: Icons.insert_drive_file_outlined,
                    label: '原始文件名：',
                    value: file.originalFilename ?? file.filename,
                  ),
                  
                  const SizedBox(height: 8),
                  
                  _buildInfoItem(
                    icon: Icons.data_usage_outlined,
                    label: '大小：',
                    value: file.formattedSize,
                  ),
                  
                  // 标签
                  if (file.freeTags.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: file.freeTags.map((tag) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: ThemeConfig.surfaceContainerColor,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '#${tag.name}',
                          style: TextStyle(
                            color: ThemeConfig.primaryBlack,
                            fontSize: 12,
                          ),
                        ),
                      )).toList(),
                    ),
                  ],
                  
                  const SizedBox(height: 20),
                  
                  // 底部操作按钮
                  _buildActionButtons(isOwner),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 构建上传者信息
  Widget _buildUploaderInfo(FileModel file) {
    return Row(
      children: [
        Icon(Icons.person_outline, size: 16, color: ThemeConfig.accentGray),
        const SizedBox(width: 4),
        Text(
          file.uploader?.name ?? '未知',
          style: TextStyle(color: ThemeConfig.accentGray, fontSize: 13),
        ),
        const SizedBox(width: 16),
        Icon(Icons.access_time, size: 16, color: ThemeConfig.accentGray),
        const SizedBox(width: 4),
        Text(
          _formatDateTime(file.uploadedAt),
          style: TextStyle(color: ThemeConfig.accentGray, fontSize: 13),
        ),
      ],
    );
  }
  
  String _formatDateTime(String dateTimeStr) {
    try {
      final dateTime = DateTime.parse(dateTimeStr);
      return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
          '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return dateTimeStr;
    }
  }

  /// 构建信息项
  Widget _buildInfoItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: ThemeConfig.accentGray),
        const SizedBox(width: 4),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: TextStyle(color: ThemeConfig.accentGray, fontSize: 13),
              children: [
                TextSpan(text: label),
                TextSpan(
                  text: value,
                  style: TextStyle(color: ThemeConfig.primaryBlack),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  /// 构建操作按钮
  Widget _buildActionButtons(bool isOwner) {
    final prefs = ref.watch(preferencesStorageSyncProvider);
    final autoLoadOriginal = prefs?.isAutoLoadOriginalEnabled() ?? false;
    
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: isOwner ? _showEditDialog : _showRequestEditDialog,
            style: OutlinedButton.styleFrom(
              foregroundColor: ThemeConfig.accentGray,
              side: BorderSide(color: ThemeConfig.borderColor),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(25),
              ),
            ),
            child: Text(isOwner ? '编辑' : '请求编辑'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton(
            onPressed: _showOriginal ? null : (_isLoadingOriginal ? null : _loadOriginalImage),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
              disabledBackgroundColor: ThemeConfig.primaryColor.withValues(alpha: 0.5),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(25),
              ),
              elevation: 0,
            ),
            child: _isLoadingOriginal
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(_showOriginal ? '已加载原图' : '下载原图'),
          ),
        ),
      ],
    );
  }

  /// 显示更多操作菜单
  void _showMoreOptions() {
    final currentUser = ref.read(currentUserProvider);
    final isOwner = currentUser?.id == _file?.uploaderId;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: ThemeConfig.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (isOwner) ...[
                ListTile(
                  leading: Icon(Icons.edit_outlined, color: ThemeConfig.primaryBlack),
                  title: Text('编辑信息', style: TextStyle(color: ThemeConfig.primaryBlack)),
                  onTap: () {
                    Navigator.pop(context);
                    _showEditDialog();
                  },
                ),
                ListTile(
                  leading: Icon(Icons.delete_outline, color: ThemeConfig.errorColor),
                  title: Text('删除文件', style: TextStyle(color: ThemeConfig.errorColor)),
                  onTap: () {
                    Navigator.pop(context);
                    _showDeleteConfirmDialog();
                  },
                ),
              ] else ...[
                ListTile(
                  leading: Icon(Icons.edit_note_outlined, color: ThemeConfig.primaryBlack),
                  title: Text('请求编辑', style: TextStyle(color: ThemeConfig.primaryBlack)),
                  onTap: () {
                    Navigator.pop(context);
                    _showRequestEditDialog();
                  },
                ),
              ],
              ListTile(
                leading: Icon(Icons.close, color: ThemeConfig.accentGray),
                title: Text('取消', style: TextStyle(color: ThemeConfig.accentGray)),
                onTap: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEditDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _EditFileBottomSheet(
        file: _file!,
        onSaved: (updatedFile) {
          setState(() => _file = updatedFile);
          ref.read(filesNotifierProvider.notifier).updateFile(updatedFile);
        },
      ),
    );
  }

  void _showDeleteConfirmDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('确认删除', style: TextStyle(color: ThemeConfig.primaryBlack)),
        content: Text(
          '确定要删除文件 "${_file!.filename}" 吗？此操作不可撤销。',
          style: TextStyle(color: ThemeConfig.accentGray),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('取消', style: TextStyle(color: ThemeConfig.accentGray)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteFile();
            },
            child: Text('删除', style: TextStyle(color: ThemeConfig.errorColor)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteFile() async {
    try {
      final repository = ref.read(filesRepositoryProvider);
      await repository.deleteFile(widget.fileId);
      ref.read(filesNotifierProvider.notifier).removeFile(widget.fileId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('文件已删除')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('删除失败: ${_getErrorMessage(e)}')),
        );
      }
    }
  }

  void _showRequestEditDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RequestEditDialog(
        file: _file!,
        onSuccess: () {},
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: ThemeConfig.errorColor),
          const SizedBox(height: 16),
          Text(
            _error!,
            style: TextStyle(color: ThemeConfig.accentGray, fontSize: 16),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadFileDetail,
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

  Widget _buildNotFoundState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off, size: 64, color: ThemeConfig.accentGray),
          const SizedBox(height: 16),
          Text(
            '文件不存在',
            style: TextStyle(color: ThemeConfig.accentGray, fontSize: 16),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => context.pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('返回'),
          ),
        ],
      ),
    );
  }
}


/// 编辑文件底部弹窗
class _EditFileBottomSheet extends ConsumerStatefulWidget {
  final FileModel file;
  final void Function(FileModel) onSaved;

  const _EditFileBottomSheet({
    required this.file,
    required this.onSaved,
  });

  @override
  ConsumerState<_EditFileBottomSheet> createState() => _EditFileBottomSheetState();
}

class _EditFileBottomSheetState extends ConsumerState<_EditFileBottomSheet> {
  late TextEditingController _activityDateController;
  late TextEditingController _activityNameController;
  late TextEditingController _filenameController;
  String? _selectedActivityType;
  List<String> _freeTags = [];
  bool _isSaving = false;
  List<TagPresetModel> _activityTypePresets = [];
  bool _isLoadingPresets = true;

  @override
  void initState() {
    super.initState();
    _activityDateController = TextEditingController(text: widget.file.activityDate);
    _activityNameController = TextEditingController(text: widget.file.activityName);
    _filenameController = TextEditingController(text: widget.file.filename);
    _selectedActivityType = widget.file.activityType;
    _freeTags = widget.file.freeTags.map((t) => t.name).toList();
    
    _loadActivityTypePresets();
  }

  @override
  void dispose() {
    _activityDateController.dispose();
    _activityNameController.dispose();
    _filenameController.dispose();
    super.dispose();
  }

  Future<void> _loadActivityTypePresets() async {
    try {
      final repository = ref.read(tagsRepositoryProvider);
      final presets = await repository.getActivityTypePresets();
      if (mounted) {
        setState(() {
          _activityTypePresets = presets.where((p) => p.isActive).toList();
          _isLoadingPresets = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingPresets = false);
      }
    }
  }

  Future<void> _saveChanges() async {
    if (_isSaving) return;

    setState(() => _isSaving = true);

    try {
      final repository = ref.read(filesRepositoryProvider);
      
      final updateData = <String, dynamic>{
        'activity_date': _activityDateController.text.isEmpty ? null : _activityDateController.text,
        'activity_type': _selectedActivityType,
        'activity_name': _activityNameController.text.isEmpty ? null : _activityNameController.text,
      };
      
      if (_filenameController.text != widget.file.filename) {
        updateData['filename'] = _filenameController.text;
      }
      
      final originalTags = widget.file.freeTags.map((t) => t.name).toSet();
      final currentTags = _freeTags.toSet();
      if (!originalTags.containsAll(currentTags) || !currentTags.containsAll(originalTags)) {
        updateData['free_tags'] = _freeTags;
      }
      
      final updatedFile = await repository.updateFile(widget.file.id, updateData);

      if (mounted) {
        widget.onSaved(updatedFile);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('保存成功')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('保存失败: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _selectDate() async {
    final initialDate = _activityDateController.text.isNotEmpty
        ? DateTime.tryParse(_activityDateController.text) ?? DateTime.now()
        : DateTime.now();

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: ThemeConfig.lightTheme.copyWith(
            colorScheme: ThemeConfig.lightTheme.colorScheme.copyWith(
              primary: ThemeConfig.primaryColor,
              surface: ThemeConfig.surfaceColor,
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedDate != null) {
      _activityDateController.text =
          '${pickedDate.year}-${pickedDate.month.toString().padLeft(2, '0')}-${pickedDate.day.toString().padLeft(2, '0')}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: ThemeConfig.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '编辑文件信息',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: ThemeConfig.primaryBlack,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.close, color: ThemeConfig.accentGray),
                    ),
                  ],
                ),
              ),
              
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _filenameController,
                        decoration: const InputDecoration(labelText: '文件名'),
                      ),
                      const SizedBox(height: 16),
                      
                      TextField(
                        controller: _activityDateController,
                        readOnly: true,
                        onTap: _selectDate,
                        decoration: const InputDecoration(
                          labelText: '活动日期',
                          suffixIcon: Icon(Icons.calendar_today),
                        ),
                      ),
                      const SizedBox(height: 16),

                      DropdownButtonFormField<String>(
                        value: _selectedActivityType,
                        decoration: const InputDecoration(labelText: '活动类型'),
                        dropdownColor: Colors.white,
                        items: _isLoadingPresets
                            ? []
                            : _activityTypePresets.map((preset) {
                                return DropdownMenuItem(
                                  value: preset.value,
                                  child: Text(preset.displayName),
                                );
                              }).toList(),
                        onChanged: (value) => setState(() => _selectedActivityType = value),
                      ),
                      const SizedBox(height: 16),

                      TextField(
                        controller: _activityNameController,
                        decoration: const InputDecoration(
                          labelText: '活动名称',
                          hintText: '例如：周末团建、新年晚会',
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      Text(
                        '自由标签',
                        style: TextStyle(
                          color: ThemeConfig.accentGray,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TagInputWithSuggestions(
                        tags: _freeTags,
                        onTagsChanged: (tags) => setState(() => _freeTags = tags),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              
              Container(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 16,
                  bottom: MediaQuery.of(context).padding.bottom + 16,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: ThemeConfig.borderColor)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveChanges,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ThemeConfig.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(25),
                      ),
                      elevation: 0,
                    ),
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('保存'),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
