import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/theme_config.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/models/file_model.dart';
import '../../data/repositories/files_repository.dart';
import '../../data/repositories/tags_repository.dart';
import '../../data/services/signed_url_service.dart';
import '../providers/files_provider.dart';
import '../widgets/image_viewer.dart';
import '../widgets/request_edit_dialog.dart';
import '../widgets/tag_input_with_suggestions.dart';
import '../widgets/video_player_widget.dart';

/// 文件详情页面
///
/// 根据文件类型显示图片预览或视频播放器，并显示文件元数据。
/// 支持：
/// - 图片预览（可缩放）
/// - 视频播放（HLS 流媒体）
/// - 文件元数据展示
/// - 相邻文件导航（左右滑动）
/// - 文件操作（编辑/删除/请求编辑）
///
/// **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
class FileDetailScreen extends ConsumerStatefulWidget {
  final int fileId;

  const FileDetailScreen({
    super.key,
    required this.fileId,
  });

  @override
  ConsumerState<FileDetailScreen> createState() => _FileDetailScreenState();
}

class _FileDetailScreenState extends ConsumerState<FileDetailScreen> {
  FileModel? _file;
  AdjacentFiles? _adjacentFiles;
  bool _isLoading = true;
  String? _error;
  bool _showMetadata = true;
  String? _imageSignedUrl; // 图片签名URL

  @override
  void initState() {
    super.initState();
    _loadFileDetail();
  }

  Future<void> _loadFileDetail() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _imageSignedUrl = null;
    });

    try {
      final repository = ref.read(filesRepositoryProvider);
      final filesState = ref.read(filesNotifierProvider);

      // 并行加载文件详情和相邻文件
      final results = await Future.wait([
        repository.getFileDetail(widget.fileId),
        repository.getAdjacentFiles(widget.fileId, filesState.filters),
      ]);

      final file = results[0] as FileModel;
      
      // 如果是图片，获取签名URL
      String? signedUrl;
      if (file.isImage) {
        try {
          final signedUrlService = ref.read(signedUrlServiceProvider);
          signedUrl = await signedUrlService.getSignedUrl(
            file.id,
            style: StylePreset.original, // 原图用于预览
          );
        } catch (e) {
          // 签名URL获取失败，继续显示页面
        }
      }

      if (mounted) {
        setState(() {
          _file = file;
          _adjacentFiles = results[1] as AdjacentFiles;
          _imageSignedUrl = signedUrl;
          _isLoading = false;
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


  /// 导航到相邻文件
  ///
  /// **Validates: Requirements 4.5**
  void _navigateToFile(int fileId) {
    context.pushReplacement('/files/$fileId');
  }

  /// 切换元数据显示
  void _toggleMetadata() {
    setState(() {
      _showMetadata = !_showMetadata;
    });
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
      backgroundColor: ThemeConfig.backgroundColor,
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(),
      body: _buildBody(),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.black54,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
        ),
        onPressed: () => context.pop(),
      ),
      actions: [
        if (_file != null) ...[
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                _showMetadata ? Icons.info : Icons.info_outline,
                color: Colors.white,
                size: 20,
              ),
            ),
            onPressed: _toggleMetadata,
          ),
        ],
      ],
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          color: ThemeConfig.primaryColor,
        ),
      );
    }

    if (_error != null) {
      return _buildErrorState();
    }

    if (_file == null) {
      return _buildNotFoundState();
    }

    return GestureDetector(
      onHorizontalDragEnd: _onHorizontalDragEnd,
      child: Stack(
        children: [
          // 媒体预览
          _buildMediaPreview(),

          // 元数据面板
          if (_showMetadata)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _buildMetadataPanel(),
            ),

          // 相邻文件导航指示器
          _buildNavigationIndicators(),
        ],
      ),
    );
  }

  /// 处理水平滑动
  ///
  /// **Validates: Requirements 4.5**
  void _onHorizontalDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;

    if (velocity > 300 && _adjacentFiles?.previous != null) {
      // 向右滑动，显示上一个文件
      _navigateToFile(_adjacentFiles!.previous!.id);
    } else if (velocity < -300 && _adjacentFiles?.next != null) {
      // 向左滑动，显示下一个文件
      _navigateToFile(_adjacentFiles!.next!.id);
    }
  }

  /// 构建媒体预览
  ///
  /// **Validates: Requirements 4.2, 4.3**
  Widget _buildMediaPreview() {
    final file = _file!;

    if (file.isImage) {
      return ImageViewer(
        imageUrl: _imageSignedUrl ?? '',
        thumbhash: file.thumbhash,
      );
    } else if (file.isVideo) {
      return VideoPlayerWidget(
        fileId: file.id,
        filename: file.originalFilename ?? file.filename,
        thumbhash: file.thumbhash,
        onFullscreenChanged: (isFullscreen) {
          // 全屏状态变化时可以隐藏/显示 AppBar
          setState(() {
            _showMetadata = !isFullscreen;
          });
        },
      );
    } else {
      return _buildUnsupportedPreview();
    }
  }

  /// 不支持的文件类型预览
  Widget _buildUnsupportedPreview() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.insert_drive_file,
            size: 80,
            color: ThemeConfig.onSurfaceVariantColor,
          ),
          const SizedBox(height: 16),
          const Text(
            '不支持预览此文件类型',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }


  /// 构建元数据面板
  ///
  /// **Validates: Requirements 4.4**
  Widget _buildMetadataPanel() {
    final file = _file!;
    final currentUser = ref.watch(currentUserProvider);
    final isOwner = currentUser?.id == file.uploaderId;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            Colors.black.withValues(alpha: 0.8),
          ],
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // 文件名
              Text(
                file.originalFilename ?? file.filename,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),

              // 元数据行
              _buildMetadataRow(Icons.storage, '大小', file.formattedSize),
              if (file.uploader != null)
                _buildMetadataRow(Icons.person, '上传者', file.uploader!.name),
              _buildMetadataRow(Icons.access_time, '上传时间', _formatDateTime(file.uploadedAt)),
              if (file.activityDate != null)
                _buildMetadataRow(Icons.event, '活动日期', file.activityDate!),
              if (file.activityTypeDisplay != null)
                _buildMetadataRow(Icons.category, '活动类型', file.activityTypeDisplay!),
              if (file.activityName != null)
                _buildMetadataRow(Icons.label, '活动名称', file.activityName!),

              // 标签
              if (file.freeTags.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: file.freeTags.map((tag) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: ThemeConfig.primaryColor.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        tag.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],

              const SizedBox(height: 16),

              // 操作按钮
              _buildActionButtons(isOwner),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetadataRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.grey[400]),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              color: Colors.grey[400],
              fontSize: 14,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
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

  /// 构建操作按钮
  ///
  /// **Validates: Requirements 4.6, 4.7**
  Widget _buildActionButtons(bool isOwner) {
    if (isOwner) {
      // 文件所有者：显示编辑和删除按钮
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _showEditDialog,
              icon: const Icon(Icons.edit, size: 18),
              label: const Text('编辑'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white54),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _showDeleteConfirmDialog,
              icon: const Icon(Icons.delete, size: 18),
              label: const Text('删除'),
              style: OutlinedButton.styleFrom(
                foregroundColor: ThemeConfig.errorColor,
                side: BorderSide(color: ThemeConfig.errorColor.withValues(alpha: 0.5)),
              ),
            ),
          ),
        ],
      );
    } else {
      // 非所有者：显示请求编辑按钮
      return SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _showRequestEditDialog,
          icon: const Icon(Icons.edit_note, size: 18),
          label: const Text('请求编辑'),
          style: OutlinedButton.styleFrom(
            foregroundColor: ThemeConfig.primaryColor,
            side: BorderSide(color: ThemeConfig.primaryColor.withValues(alpha: 0.5)),
          ),
        ),
      );
    }
  }

  /// 构建导航指示器
  ///
  /// **Validates: Requirements 4.5**
  Widget _buildNavigationIndicators() {
    return Positioned.fill(
      child: Row(
        children: [
          // 左侧指示器（上一个文件）
          if (_adjacentFiles?.previous != null)
            GestureDetector(
              onTap: () => _navigateToFile(_adjacentFiles!.previous!.id),
              child: Container(
                width: 60,
                color: Colors.transparent,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black38,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.chevron_left,
                      color: Colors.white70,
                      size: 24,
                    ),
                  ),
                ),
              ),
            )
          else
            const SizedBox(width: 60),

          const Spacer(),

          // 右侧指示器（下一个文件）
          if (_adjacentFiles?.next != null)
            GestureDetector(
              onTap: () => _navigateToFile(_adjacentFiles!.next!.id),
              child: Container(
                width: 60,
                color: Colors.transparent,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black38,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.chevron_right,
                      color: Colors.white70,
                      size: 24,
                    ),
                  ),
                ),
              ),
            )
          else
            const SizedBox(width: 60),
        ],
      ),
    );
  }


  /// 显示编辑对话框
  ///
  /// **Validates: Requirements 4.8**
  void _showEditDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _EditFileBottomSheet(
        file: _file!,
        onSaved: (updatedFile) {
          setState(() {
            _file = updatedFile;
          });
          // 更新文件列表中的文件
          ref.read(filesNotifierProvider.notifier).updateFile(updatedFile);
        },
      ),
    );
  }

  /// 显示删除确认对话框
  ///
  /// **Validates: Requirements 4.9**
  void _showDeleteConfirmDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        title: const Text('确认删除'),
        content: Text('确定要删除文件 "${_file!.originalFilename ?? _file!.filename}" 吗？此操作不可撤销。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _deleteFile();
            },
            style: TextButton.styleFrom(
              foregroundColor: ThemeConfig.errorColor,
            ),
            child: const Text('删除'),
          ),
        ],
      ),
    );
  }

  /// 删除文件
  Future<void> _deleteFile() async {
    try {
      final repository = ref.read(filesRepositoryProvider);
      await repository.deleteFile(widget.fileId);

      // 从文件列表中移除
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

  /// 显示请求编辑对话框
  ///
  /// **Validates: Requirements 6.2**
  void _showRequestEditDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RequestEditDialog(
        file: _file!,
        onSuccess: () {
          // 刷新请求列表
        },
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            size: 64,
            color: ThemeConfig.errorColor,
          ),
          const SizedBox(height: 16),
          Text(
            _error!,
            style: const TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
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
          Icon(
            Icons.search_off,
            size: 64,
            color: ThemeConfig.onSurfaceVariantColor,
          ),
          const SizedBox(height: 16),
          const Text(
            '文件不存在',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 16,
            ),
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
///
/// **Validates: Requirements 4.8**
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
        setState(() {
          _isLoadingPresets = false;
        });
      }
    }
  }

  Future<void> _saveChanges() async {
    if (_isSaving) return;

    setState(() {
      _isSaving = true;
    });

    try {
      final repository = ref.read(filesRepositoryProvider);
      
      // 构建更新数据
      final updateData = <String, dynamic>{
        'activity_date': _activityDateController.text.isEmpty ? null : _activityDateController.text,
        'activity_type': _selectedActivityType,
        'activity_name': _activityNameController.text.isEmpty ? null : _activityNameController.text,
      };
      
      // 如果文件名有变化，也更新
      if (_filenameController.text != widget.file.filename) {
        updateData['filename'] = _filenameController.text;
      }
      
      // 检查标签是否有变化
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
        setState(() {
          _isSaving = false;
        });
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
            color: ThemeConfig.surfaceColor,
            borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: Column(
            children: [
              // 拖动指示器
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: ThemeConfig.dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              // 标题栏
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '编辑文件信息',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: ThemeConfig.onBackgroundColor,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close, color: ThemeConfig.onSurfaceVariantColor),
                    ),
                  ],
                ),
              ),
              
              // 表单内容
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 文件名
                      TextField(
                        controller: _filenameController,
                        decoration: const InputDecoration(
                          labelText: '文件名',
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // 活动日期
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

                      // 活动类型
                      DropdownButtonFormField<String>(
                        value: _selectedActivityType,
                        decoration: const InputDecoration(
                          labelText: '活动类型',
                        ),
                        dropdownColor: ThemeConfig.surfaceColor,
                        items: _isLoadingPresets
                            ? []
                            : _activityTypePresets.map((preset) {
                                return DropdownMenuItem(
                                  value: preset.value,
                                  child: Text(preset.displayName),
                                );
                              }).toList(),
                        onChanged: (value) {
                          setState(() {
                            _selectedActivityType = value;
                          });
                        },
                      ),
                      const SizedBox(height: 16),

                      // 活动名称
                      TextField(
                        controller: _activityNameController,
                        decoration: const InputDecoration(
                          labelText: '活动名称',
                          hintText: '例如：周末团建、新年晚会',
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // 自由标签
                      const Text(
                        '自由标签',
                        style: TextStyle(
                          color: ThemeConfig.onSurfaceVariantColor,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TagInputWithSuggestions(
                        tags: _freeTags,
                        onTagsChanged: (tags) {
                          setState(() {
                            _freeTags = tags;
                          });
                        },
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              
              // 底部按钮
              Container(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 16,
                  bottom: MediaQuery.of(context).padding.bottom + 16,
                ),
                decoration: const BoxDecoration(
                  color: ThemeConfig.surfaceColor,
                  border: Border(
                    top: BorderSide(color: ThemeConfig.dividerColor),
                  ),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveChanges,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ThemeConfig.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
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
