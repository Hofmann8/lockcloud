import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_thumbhash/flutter_thumbhash.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/theme_config.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/models/file_model.dart';
import '../../data/repositories/files_repository.dart';
import '../../data/repositories/tags_repository.dart';
import '../models/file_detail_entry.dart';
import '../providers/files_provider.dart';
import '../widgets/request_edit_dialog.dart';
import '../widgets/tag_input_with_suggestions.dart';
import '../widgets/video_player_widget.dart';

/// 视频详情页面 - 与图片详情页一致的交互
class VideoDetailScreen extends ConsumerStatefulWidget {
  final int fileId;
  final FileDetailEntry? entry;

  const VideoDetailScreen({
    super.key,
    required this.fileId,
    this.entry,
  });

  @override
  ConsumerState<VideoDetailScreen> createState() => _VideoDetailScreenState();
}

class _VideoDetailScreenState extends ConsumerState<VideoDetailScreen>
    with SingleTickerProviderStateMixin {
  FileModel? _file;
  bool _isLoading = true;
  String? _error;
  bool _isFullscreen = false;
  bool _isReady = false;
  
  bool _showInfoPanel = false;
  late AnimationController _infoPanelController;
  late Animation<Offset> _infoPanelSlideAnimation;
  late Animation<double> _videoOffsetAnimation;
  
  static const double _infoPanelHeight = 380;
  
  late FileDetailEntry _entry;
  late int _entryFileId;
  
  // 视频播放器状态
  final GlobalKey<VideoPlayerWidgetState> _playerKey = GlobalKey();
  VideoPlayerState _playerState = const VideoPlayerState();

  @override
  void initState() {
    super.initState();
    _entry = widget.entry ?? FileDetailEntry(fileId: widget.fileId);
    _entryFileId = _entry.fileId;
    
    _infoPanelController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _infoPanelSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _infoPanelController, curve: Curves.easeOutCubic));
    _videoOffsetAnimation = Tween<double>(
      begin: 0,
      end: -_infoPanelHeight / 2,
    ).animate(CurvedAnimation(parent: _infoPanelController, curve: Curves.easeOutCubic));
    
    _loadFileDetail();
  }

  @override
  void didUpdateWidget(covariant VideoDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.fileId != widget.fileId) {
      _entry = widget.entry ?? FileDetailEntry(fileId: widget.fileId);
      _entryFileId = _entry.fileId;
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

  void _onVerticalDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity < -300) _showInfoPanelIfHidden();
    else if (velocity > 300) _hideInfoPanel();
  }

  Future<void> _loadFileDetail() async {
    setState(() { _isLoading = true; _error = null; });

    try {
      final file = await ref.read(filesRepositoryProvider).getFileDetail(widget.fileId);
      final mergedFile = _mergeThumbhash(file, _entry.thumbhash);

      if (mounted) {
        setState(() { _file = mergedFile; _isLoading = false; });
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            setState(() { _isReady = true; _showInfoPanel = true; });
            _infoPanelController.forward();
          }
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = _getErrorMessage(e); _isLoading = false; });
    }
  }

  FileModel _mergeThumbhash(FileModel file, String? fallback) {
    if ((file.thumbhash == null || file.thumbhash!.isEmpty) && fallback != null && fallback.isNotEmpty) {
      return file.copyWith(thumbhash: fallback);
    }
    return file;
  }

  String _getErrorMessage(dynamic e) => e is Exception ? e.toString().replaceFirst('Exception: ', '') : '加载失败';

  void _onFullscreenChanged(bool isFullscreen) => setState(() => _isFullscreen = isFullscreen);

  void _onPlayerStateChanged(VideoPlayerState state) {
    setState(() => _playerState = state);
  }

  void _seekTo(Duration position) {
    _playerKey.currentState?.seekTo(position);
  }

  @override
  Widget build(BuildContext context) {
    if (_isFullscreen) {
      return VideoPlayerWidget(
        fileId: _file!.id,
        filename: _file!.filename,
        thumbhash: _file!.thumbhash ?? _entry.thumbhash,
        initialFullscreen: true,
        onFullscreenChanged: _onFullscreenChanged,
      );
    }
    return Scaffold(backgroundColor: Colors.black, body: _buildBody());
  }

  Widget _buildBody() {
    if (_isLoading) return _buildLoadingState();
    if (_error != null) return _buildErrorState();
    if (_file == null) return _buildNotFoundState();

    return GestureDetector(
      onTap: _toggleInfoPanel,
      onVerticalDragEnd: _onVerticalDragEnd,
      child: SizedBox.expand(
        child: Stack(
          children: [
            AnimatedBuilder(
              animation: _videoOffsetAnimation,
              builder: (context, child) => Positioned.fill(
                child: Transform.translate(
                  offset: Offset(0, _videoOffsetAnimation.value),
                  child: _buildVideoContent(),
                ),
              ),
            ),
            _buildTopBar(),
            _buildFloatingInfoPanel(),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoContent() {
    final file = _file!;
    return Hero(
      tag: 'file_image_$_entryFileId',
      child: VideoPlayerWidget(
        key: _playerKey,
        fileId: file.id,
        filename: file.filename,
        thumbhash: file.thumbhash ?? _entry.thumbhash,
        onFullscreenChanged: _onFullscreenChanged,
        onStateChanged: _onPlayerStateChanged,
      ),
    );
  }

  Widget _buildLoadingState() {
    return Stack(
      children: [
        Positioned.fill(child: Hero(tag: 'file_image_$_entryFileId', child: _buildPlaceholder())),
        const Center(child: CircularProgressIndicator(color: ThemeConfig.primaryColor)),
        _buildTopBar(showMore: false),
      ],
    );
  }

  Widget _buildPlaceholder() {
    final thumbhash = _entry.thumbhash;
    if (thumbhash != null && thumbhash.isNotEmpty) {
      try {
        return Container(
          color: Colors.black,
          child: Center(
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Image(image: ThumbHash.fromBase64(thumbhash).toImage(), fit: BoxFit.contain, gaplessPlayback: true),
            ),
          ),
        );
      } catch (_) {}
    }
    return Container(
      color: Colors.black,
      child: Center(child: Icon(Icons.videocam_outlined, size: 48, color: ThemeConfig.accentGray.withValues(alpha: 0.5))),
    );
  }

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
                  decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.3), shape: BoxShape.circle),
                  child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                ),
              ),
              if (showMore)
                IconButton(
                  onPressed: _isReady ? _showMoreOptions : null,
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.3), shape: BoxShape.circle),
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 进度条（在信息栏上方）
            _buildProgressBar(),
            // 信息栏
            Container(
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
                      _buildUploaderInfo(file),
                      const SizedBox(height: 16),
                      if (file.activityName != null && file.activityName!.isNotEmpty)
                        _buildInfoItem(icon: Icons.event_outlined, label: '活动名称：', value: file.activityName!),
                      if (file.activityName != null && file.activityName!.isNotEmpty)
                        const SizedBox(height: 8),
                      _buildInfoItem(icon: Icons.category_outlined, label: '活动类型：', value: file.activityTypeDisplay ?? '-'),
                      const SizedBox(height: 8),
                      _buildInfoItem(icon: Icons.calendar_today_outlined, label: '活动日期：', value: file.activityDate ?? '-'),
                      const SizedBox(height: 8),
                      _buildInfoItem(icon: Icons.insert_drive_file_outlined, label: '原始文件名：', value: file.originalFilename ?? file.filename),
                      const SizedBox(height: 8),
                      _buildInfoItem(icon: Icons.data_usage_outlined, label: '大小：', value: file.formattedSize),
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
                            child: Text('#${tag.name}', style: TextStyle(color: ThemeConfig.primaryBlack, fontSize: 12)),
                          )).toList(),
                        ),
                      ],
                      const SizedBox(height: 20),
                      _buildActionButtons(isOwner),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _enterFullscreen() {
    _playerKey.currentState?.enterFullscreen();
  }

  Widget _buildProgressBar() {
    final progress = _playerState.duration.inMilliseconds > 0
        ? _playerState.position.inMilliseconds / _playerState.duration.inMilliseconds
        : 0.0;
    final buffered = _playerState.duration.inMilliseconds > 0
        ? _playerState.buffered.inMilliseconds / _playerState.duration.inMilliseconds
        : 0.0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // 时间
          Text(
            _formatDuration(_playerState.position),
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
          const SizedBox(width: 8),
          // 进度条
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final barWidth = constraints.maxWidth;
                return GestureDetector(
                  onTapUp: (details) {
                    final percent = (details.localPosition.dx / barWidth).clamp(0.0, 1.0);
                    final newPosition = Duration(
                      milliseconds: (percent * _playerState.duration.inMilliseconds).round(),
                    );
                    _seekTo(newPosition);
                  },
                  onHorizontalDragUpdate: (details) {
                    final percent = (details.localPosition.dx / barWidth).clamp(0.0, 1.0);
                    final newPosition = Duration(
                      milliseconds: (percent * _playerState.duration.inMilliseconds).round(),
                    );
                    _seekTo(newPosition);
                  },
                  child: Container(
                    height: 24,
                    color: Colors.transparent,
                    alignment: Alignment.center,
                    child: Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        // 背景
                        Container(
                          height: 4,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        // 缓冲
                        Container(
                          height: 4,
                          width: barWidth * buffered.clamp(0.0, 1.0),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        // 进度
                        Container(
                          height: 4,
                          width: barWidth * progress.clamp(0.0, 1.0),
                          decoration: BoxDecoration(
                            color: ThemeConfig.primaryColor,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        // 拖动手柄
                        Positioned(
                          left: (barWidth * progress.clamp(0.0, 1.0)) - 6,
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: ThemeConfig.primaryColor,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.3),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(width: 8),
          // 时长
          Text(
            _formatDuration(_playerState.duration),
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
          const SizedBox(width: 12),
          // 全屏按钮
          GestureDetector(
            onTap: _enterFullscreen,
            child: Container(
              padding: const EdgeInsets.all(4),
              child: const Icon(Icons.fullscreen, color: Colors.white, size: 24),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  Widget _buildUploaderInfo(FileModel file) {
    return Row(
      children: [
        Icon(Icons.person_outline, size: 16, color: ThemeConfig.accentGray),
        const SizedBox(width: 4),
        Text(file.uploader?.name ?? '未知', style: TextStyle(color: ThemeConfig.accentGray, fontSize: 13)),
        const SizedBox(width: 16),
        Icon(Icons.access_time, size: 16, color: ThemeConfig.accentGray),
        const SizedBox(width: 4),
        Text(_formatDateTime(file.uploadedAt), style: TextStyle(color: ThemeConfig.accentGray, fontSize: 13)),
      ],
    );
  }

  Widget _buildInfoItem({required IconData icon, required String label, required String value}) {
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
                TextSpan(text: value, style: TextStyle(color: ThemeConfig.primaryBlack)),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildActionButtons(bool isOwner) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: isOwner ? _showEditDialog : _showRequestEditDialog,
            style: OutlinedButton.styleFrom(
              foregroundColor: ThemeConfig.accentGray,
              side: BorderSide(color: ThemeConfig.borderColor),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
            ),
            child: Text(isOwner ? '编辑' : '请求编辑'),
          ),
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

  void _showMoreOptions() {
    final currentUser = ref.read(currentUserProvider);
    final isOwner = currentUser?.id == _file?.uploaderId;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
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
                decoration: BoxDecoration(color: ThemeConfig.borderColor, borderRadius: BorderRadius.circular(2)),
              ),
              if (isOwner) ...[
                ListTile(
                  leading: Icon(Icons.edit_outlined, color: ThemeConfig.primaryBlack),
                  title: Text('编辑信息', style: TextStyle(color: ThemeConfig.primaryBlack)),
                  onTap: () { Navigator.pop(context); _showEditDialog(); },
                ),
                ListTile(
                  leading: Icon(Icons.delete_outline, color: ThemeConfig.errorColor),
                  title: Text('删除文件', style: TextStyle(color: ThemeConfig.errorColor)),
                  onTap: () { Navigator.pop(context); _showDeleteConfirmDialog(); },
                ),
              ] else ...[
                ListTile(
                  leading: Icon(Icons.edit_note_outlined, color: ThemeConfig.primaryBlack),
                  title: Text('请求编辑', style: TextStyle(color: ThemeConfig.primaryBlack)),
                  onTap: () { Navigator.pop(context); _showRequestEditDialog(); },
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
      builder: (context) => _VideoEditBottomSheet(
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
        content: Text('确定要删除文件 "${_file!.filename}" 吗？此操作不可撤销。', style: TextStyle(color: ThemeConfig.accentGray)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text('取消', style: TextStyle(color: ThemeConfig.accentGray))),
          TextButton(onPressed: () { Navigator.pop(context); _deleteFile(); }, child: Text('删除', style: TextStyle(color: ThemeConfig.errorColor))),
        ],
      ),
    );
  }

  Future<void> _deleteFile() async {
    try {
      await ref.read(filesRepositoryProvider).deleteFile(widget.fileId);
      ref.read(filesNotifierProvider.notifier).removeFile(widget.fileId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('文件已删除')));
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('删除失败: ${_getErrorMessage(e)}')));
      }
    }
  }

  void _showRequestEditDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RequestEditDialog(file: _file!, onSuccess: () {}),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: ThemeConfig.errorColor),
          const SizedBox(height: 16),
          Text(_error!, style: TextStyle(color: ThemeConfig.accentGray, fontSize: 16), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadFileDetail,
            style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.primaryColor, foregroundColor: Colors.white),
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
          Text('文件不存在', style: TextStyle(color: ThemeConfig.accentGray, fontSize: 16)),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => context.pop(),
            style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.primaryColor, foregroundColor: Colors.white),
            child: const Text('返回'),
          ),
        ],
      ),
    );
  }
}


/// 视频编辑底部弹窗
class _VideoEditBottomSheet extends ConsumerStatefulWidget {
  final FileModel file;
  final void Function(FileModel) onSaved;

  const _VideoEditBottomSheet({required this.file, required this.onSaved});

  @override
  ConsumerState<_VideoEditBottomSheet> createState() => _VideoEditBottomSheetState();
}

class _VideoEditBottomSheetState extends ConsumerState<_VideoEditBottomSheet> {
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
      final presets = await ref.read(tagsRepositoryProvider).getActivityTypePresets();
      if (mounted) setState(() { _activityTypePresets = presets.where((p) => p.isActive).toList(); _isLoadingPresets = false; });
    } catch (e) {
      if (mounted) setState(() => _isLoadingPresets = false);
    }
  }

  Future<void> _saveChanges() async {
    if (_isSaving) return;
    setState(() => _isSaving = true);

    try {
      final updateData = <String, dynamic>{
        'activity_date': _activityDateController.text.isEmpty ? null : _activityDateController.text,
        'activity_type': _selectedActivityType,
        'activity_name': _activityNameController.text.isEmpty ? null : _activityNameController.text,
      };
      if (_filenameController.text != widget.file.filename) updateData['filename'] = _filenameController.text;
      final originalTags = widget.file.freeTags.map((t) => t.name).toSet();
      final currentTags = _freeTags.toSet();
      if (!originalTags.containsAll(currentTags) || !currentTags.containsAll(originalTags)) updateData['free_tags'] = _freeTags;

      final updatedFile = await ref.read(filesRepositoryProvider).updateFile(widget.file.id, updateData);
      if (mounted) {
        widget.onSaved(updatedFile);
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('保存成功')));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('保存失败: ${e.toString()}')));
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
      builder: (context, child) => Theme(
        data: ThemeConfig.lightTheme.copyWith(colorScheme: ThemeConfig.lightTheme.colorScheme.copyWith(primary: ThemeConfig.primaryColor, surface: ThemeConfig.surfaceColor)),
        child: child!,
      ),
    );
    if (pickedDate != null) {
      _activityDateController.text = '${pickedDate.year}-${pickedDate.month.toString().padLeft(2, '0')}-${pickedDate.day.toString().padLeft(2, '0')}';
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
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          child: Column(
            children: [
              Container(margin: const EdgeInsets.only(top: 12), width: 40, height: 4, decoration: BoxDecoration(color: ThemeConfig.borderColor, borderRadius: BorderRadius.circular(2))),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('编辑文件信息', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: ThemeConfig.primaryBlack)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Icons.close, color: ThemeConfig.accentGray)),
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
                      TextField(controller: _filenameController, decoration: const InputDecoration(labelText: '文件名')),
                      const SizedBox(height: 16),
                      TextField(controller: _activityDateController, readOnly: true, onTap: _selectDate, decoration: const InputDecoration(labelText: '活动日期', suffixIcon: Icon(Icons.calendar_today))),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        value: _selectedActivityType,
                        decoration: const InputDecoration(labelText: '活动类型'),
                        dropdownColor: Colors.white,
                        items: _isLoadingPresets ? [] : _activityTypePresets.map((preset) => DropdownMenuItem(value: preset.value, child: Text(preset.displayName))).toList(),
                        onChanged: (value) => setState(() => _selectedActivityType = value),
                      ),
                      const SizedBox(height: 16),
                      TextField(controller: _activityNameController, decoration: const InputDecoration(labelText: '活动名称', hintText: '例如：周末团建、新年晚会')),
                      const SizedBox(height: 16),
                      Text('自由标签', style: TextStyle(color: ThemeConfig.accentGray, fontSize: 14)),
                      const SizedBox(height: 8),
                      TagInputWithSuggestions(tags: _freeTags, onTagsChanged: (tags) => setState(() => _freeTags = tags)),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              Container(
                padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).padding.bottom + 16),
                decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: ThemeConfig.borderColor))),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveChanges,
                    style: ElevatedButton.styleFrom(backgroundColor: ThemeConfig.primaryColor, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)), elevation: 0),
                    child: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('保存'),
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
