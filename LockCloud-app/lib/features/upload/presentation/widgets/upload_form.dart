import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:mime/mime.dart';

import '../../../../core/config/theme_config.dart';
import '../../../files/data/repositories/tags_repository.dart';
import '../../data/models/upload_queue_item.dart';
import '../../data/repositories/upload_repository.dart';
import '../providers/upload_queue_provider.dart';

/// 带自定义文件名的文件项
class FileWithCustomName {
  final XFile file;
  String customFilename;

  FileWithCustomName({
    required this.file,
    this.customFilename = '',
  });

  /// 获取最终文件名（自定义名称 + 原扩展名，或原文件名）
  String get finalFilename {
    if (customFilename.trim().isEmpty) {
      return file.name;
    }
    final extension = file.name.contains('.')
        ? '.${file.name.split('.').last}'
        : '';
    return '${customFilename.trim()}$extension';
  }
}

/// 上传表单组件
///
/// 显示元数据填写表单，包括：
/// - 活动日期（必填）
/// - 活动名称（可选，支持选择已有活动或新建）
/// - 活动类型（必填，选择已有活动时自动填充）
/// - 每个文件的自定义文件名（可选）
///
/// 功能特性：
/// - 从 API 获取活动类型预设
/// - 根据日期获取已有活动名称建议
/// - 提交前检查文件名是否与数据库重复
/// - 支持多文件单独设置自定义文件名
class UploadFormWidget extends ConsumerStatefulWidget {
  final List<XFile> files;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  const UploadFormWidget({
    super.key,
    required this.files,
    required this.onCancel,
    required this.onSubmit,
  });

  @override
  ConsumerState<UploadFormWidget> createState() => _UploadFormWidgetState();
}

class _UploadFormWidgetState extends ConsumerState<UploadFormWidget> {
  final _formKey = GlobalKey<FormState>();
  final _activityNameController = TextEditingController();

  DateTime? _activityDate;
  String? _activityType;
  bool _isNewActivity = false;
  bool _isSubmitting = false;
  bool _isCheckingFilenames = false;
  Set<String> _existingFiles = {};

  late List<FileWithCustomName> _filesWithNames;
  late List<TextEditingController> _filenameControllers;

  @override
  void initState() {
    super.initState();
    _activityDate = DateTime.now();
    _filesWithNames = widget.files
        .map((f) => FileWithCustomName(file: f))
        .toList();
    _filenameControllers = widget.files
        .map((_) => TextEditingController())
        .toList();
  }

  @override
  void dispose() {
    _activityNameController.dispose();
    for (final controller in _filenameControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  String get _formattedDate =>
      _activityDate != null ? DateFormat('yyyy-MM-dd').format(_activityDate!) : '';

  /// 选择日期
  Future<void> _selectDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _activityDate ?? now,
      firstDate: DateTime(2020),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: ThemeConfig.primaryColor,
              onPrimary: Colors.white,
              surface: ThemeConfig.surfaceColor,
              onSurface: ThemeConfig.onBackgroundColor,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null && picked != _activityDate) {
      setState(() {
        _activityDate = picked;
        // 日期变化时清空活动名称和类型
        _activityNameController.clear();
        _activityType = null;
        _isNewActivity = false;
      });
    }
  }

  /// 选择已有活动名称
  void _selectExistingActivity(ActivityNameInfo activity) {
    setState(() {
      _activityNameController.text = activity.name;
      _activityType = activity.activityType;
      _isNewActivity = false;
    });
  }

  /// 输入新活动名称
  void _onNewActivityNameChanged(String value) {
    setState(() {
      _isNewActivity = value.isNotEmpty;
      if (_isNewActivity) {
        _activityType = null; // 新活动需要手动选择类型
      }
    });
  }

  /// 检查任务内文件名重复
  bool _checkInternalDuplicates() {
    final filenameMap = <String, int>{};
    for (int i = 0; i < _filesWithNames.length; i++) {
      _filesWithNames[i].customFilename = _filenameControllers[i].text;
      final finalName = _filesWithNames[i].finalFilename;
      filenameMap[finalName] = (filenameMap[finalName] ?? 0) + 1;
    }
    return filenameMap.values.any((count) => count > 1);
  }

  /// 验证表单
  bool _validateForm() {
    if (_activityDate == null) {
      _showErrorSnackBar('请选择活动日期');
      return false;
    }

    if (_activityType == null || _activityType!.isEmpty) {
      _showErrorSnackBar('请选择活动类型');
      return false;
    }

    return _formKey.currentState?.validate() ?? false;
  }

  /// 提交表单
  Future<void> _submitForm() async {
    if (!_validateForm()) return;

    // 检查任务内重复
    if (_checkInternalDuplicates()) {
      _showErrorSnackBar('检测到任务内重复的文件名，请修改后再提交');
      return;
    }

    setState(() {
      _isCheckingFilenames = true;
      _existingFiles = {};
    });

    // 检查数据库中是否存在重复文件名
    final filenames = _filesWithNames.map((f) => f.finalFilename).toList();
    
    final repository = ref.read(uploadRepositoryProvider);
    final checkResult = await repository.checkFilenames(
      filenames: filenames,
      activityDate: _formattedDate,
      activityType: _activityType!,
    );

    setState(() {
      _isCheckingFilenames = false;
    });

    if (checkResult.hasConflicts) {
      setState(() {
        _existingFiles = checkResult.existingFiles.toSet();
      });
      _showErrorSnackBar('检测到 ${checkResult.existingFiles.length} 个文件名已存在于数据库中');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final metadata = UploadMetadata(
      activityDate: _formattedDate,
      activityType: _activityType!,
      activityName: _activityNameController.text.isNotEmpty
          ? _activityNameController.text
          : null,
      customFilename: null, // 多文件时不使用统一的自定义文件名
    );

    // 获取文件信息并添加到队列
    final fileInfos = await Future.wait(
      _filesWithNames.map((item) async {
        final fileSize = await item.file.length();
        final mimeType = lookupMimeType(item.file.path) ?? 'application/octet-stream';

        return FileInfo(
          path: item.file.path,
          name: item.file.name,
          size: fileSize,
          mimeType: mimeType,
          customFilename: item.customFilename.trim().isNotEmpty
              ? item.customFilename.trim()
              : null,
        );
      }),
    );

    ref.read(uploadQueueNotifierProvider.notifier).addItems(
          files: fileInfos,
          metadata: metadata,
        );

    setState(() {
      _isSubmitting = false;
    });

    widget.onSubmit();
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ThemeConfig.errorColor,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activityTypesAsync = ref.watch(activityTypePresetsProvider);
    final activityNamesAsync = _formattedDate.isNotEmpty
        ? ref.watch(activityNamesByDateProvider(_formattedDate))
        : const AsyncValue<List<ActivityNameInfo>>.data([]);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildFilePreview(),
            const SizedBox(height: 24),
            _buildDateField(),
            const SizedBox(height: 16),
            _buildActivityNameField(activityNamesAsync),
            const SizedBox(height: 16),
            _buildActivityTypeField(activityTypesAsync),
            const SizedBox(height: 16),
            if (widget.files.length > 1) ...[
              _buildMultiFileCustomNames(),
              const SizedBox(height: 16),
            ] else ...[
              _buildSingleFileCustomName(),
              const SizedBox(height: 16),
            ],
            if (_existingFiles.isNotEmpty) ...[
              _buildExistingFilesWarning(),
              const SizedBox(height: 16),
            ],
            const SizedBox(height: 8),
            _buildSubmitButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildFilePreview() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.attach_file, color: ThemeConfig.primaryColor, size: 20),
              const SizedBox(width: 8),
              Text(
                '已选择 ${widget.files.length} 个文件',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: ThemeConfig.onBackgroundColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.files.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) => _buildFilePreviewItem(widget.files[index]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilePreviewItem(XFile file) {
    final isVideo = _isVideoFile(file.path);
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (!isVideo)
              Image.file(
                File(file.path),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildFilePlaceholder(isVideo),
              )
            else
              _buildFilePlaceholder(isVideo),
            if (isVideo)
              const Center(
                child: Icon(Icons.play_circle_outline, color: Colors.white, size: 32),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilePlaceholder(bool isVideo) {
    return Container(
      color: ThemeConfig.surfaceContainerColor,
      child: Center(
        child: Icon(
          isVideo ? Icons.videocam : Icons.image,
          color: ThemeConfig.onSurfaceVariantColor,
          size: 32,
        ),
      ),
    );
  }

  bool _isVideoFile(String path) {
    final mimeType = lookupMimeType(path);
    return mimeType?.startsWith('video/') ?? false;
  }

  Widget _buildDateField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text('活动日期', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ThemeConfig.onBackgroundColor)),
            SizedBox(width: 4),
            Text('*', style: TextStyle(color: ThemeConfig.errorColor, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: _selectDate,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: ThemeConfig.surfaceContainerColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.calendar_today,
                  size: 20,
                  color: _activityDate != null ? ThemeConfig.primaryColor : ThemeConfig.onSurfaceVariantColor,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _activityDate != null ? _formattedDate : '请选择活动日期',
                    style: TextStyle(
                      fontSize: 16,
                      color: _activityDate != null ? ThemeConfig.onBackgroundColor : ThemeConfig.onSurfaceVariantColor,
                    ),
                  ),
                ),
                const Icon(Icons.arrow_drop_down, color: ThemeConfig.onSurfaceVariantColor),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActivityNameField(AsyncValue<List<ActivityNameInfo>> activityNamesAsync) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text('活动名称', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ThemeConfig.onBackgroundColor)),
            SizedBox(width: 8),
            Text('(可选)', style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor)),
          ],
        ),
        const SizedBox(height: 8),
        activityNamesAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                SizedBox(width: 8),
                Text('加载当日活动...', style: TextStyle(fontSize: 14, color: ThemeConfig.onSurfaceVariantColor)),
              ],
            ),
          ),
          error: (_, __) => _buildActivityNameInput(null),
          data: (activities) => _buildActivityNameInput(activities),
        ),
        const SizedBox(height: 4),
        const Text(
          '选择已有活动将自动使用其活动类型',
          style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor),
        ),
      ],
    );
  }

  Widget _buildActivityNameInput(List<ActivityNameInfo>? activities) {
    if (activities != null && activities.isNotEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: activities.map((activity) {
              final isSelected = _activityNameController.text == activity.name && !_isNewActivity;
              return InkWell(
                onTap: () => _selectExistingActivity(activity),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.surfaceContainerColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected ? ThemeConfig.primaryColor : ThemeConfig.borderColor,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        activity.name,
                        style: TextStyle(
                          fontSize: 14,
                          color: isSelected ? Colors.white : ThemeConfig.onBackgroundColor,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '(${activity.activityTypeDisplay})',
                        style: TextStyle(
                          fontSize: 12,
                          color: isSelected ? Colors.white70 : ThemeConfig.onSurfaceVariantColor,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('或', style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor)),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _activityNameController,
                  decoration: const InputDecoration(
                    hintText: '输入新活动名称',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  style: const TextStyle(fontSize: 14, color: ThemeConfig.onBackgroundColor),
                  onChanged: _onNewActivityNameChanged,
                ),
              ),
            ],
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('当日暂无已上传的活动', style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor)),
        const SizedBox(height: 8),
        TextFormField(
          controller: _activityNameController,
          decoration: const InputDecoration(
            hintText: '输入活动名称（如：周末团建、新年晚会）',
            prefixIcon: Icon(Icons.event, size: 20),
          ),
          style: const TextStyle(fontSize: 16, color: ThemeConfig.onBackgroundColor),
          onChanged: _onNewActivityNameChanged,
        ),
      ],
    );
  }

  Widget _buildActivityTypeField(AsyncValue<List<TagPresetModel>> activityTypesAsync) {
    final isDisabled = !_isNewActivity && _activityNameController.text.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text('活动类型', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ThemeConfig.onBackgroundColor)),
            SizedBox(width: 4),
            Text('*', style: TextStyle(color: ThemeConfig.errorColor, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 8),
        activityTypesAsync.when(
          loading: () => Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: ThemeConfig.surfaceContainerColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                SizedBox(width: 12),
                Text('加载活动类型...', style: TextStyle(fontSize: 16, color: ThemeConfig.onSurfaceVariantColor)),
              ],
            ),
          ),
          error: (error, _) => Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: ThemeConfig.errorColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text('加载活动类型失败: $error', style: const TextStyle(color: ThemeConfig.errorColor)),
          ),
          data: (types) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: isDisabled ? ThemeConfig.surfaceContainerColor.withOpacity(0.5) : ThemeConfig.surfaceContainerColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _activityType,
                hint: Text(
                  isDisabled ? '已自动选择该活动的类型' : '请选择活动类型',
                  style: const TextStyle(color: ThemeConfig.onSurfaceVariantColor, fontSize: 16),
                ),
                isExpanded: true,
                dropdownColor: ThemeConfig.surfaceColor,
                icon: const Icon(Icons.arrow_drop_down, color: ThemeConfig.onSurfaceVariantColor),
                items: types.map((type) {
                  return DropdownMenuItem<String>(
                    value: type.value,
                    child: Text(type.displayName, style: const TextStyle(color: ThemeConfig.onBackgroundColor, fontSize: 16)),
                  );
                }).toList(),
                onChanged: isDisabled ? null : (value) {
                  setState(() {
                    _activityType = value;
                  });
                },
              ),
            ),
          ),
        ),
        if (isDisabled)
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('已自动选择该活动的类型', style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor)),
          ),
      ],
    );
  }

  Widget _buildSingleFileCustomName() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('自定义文件名', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ThemeConfig.onBackgroundColor)),
        const SizedBox(height: 4),
        const Text('可选，留空则使用原文件名', style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor)),
        const SizedBox(height: 8),
        TextFormField(
          controller: _filenameControllers[0],
          decoration: InputDecoration(
            hintText: widget.files[0].name,
            prefixIcon: const Icon(Icons.edit, size: 20),
          ),
          style: const TextStyle(color: ThemeConfig.onBackgroundColor, fontSize: 16),
        ),
      ],
    );
  }

  Widget _buildMultiFileCustomNames() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('自定义文件名', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ThemeConfig.onBackgroundColor)),
        const SizedBox(height: 4),
        const Text('可选，为每个文件设置自定义名称', style: TextStyle(fontSize: 12, color: ThemeConfig.onSurfaceVariantColor)),
        const SizedBox(height: 12),
        ...List.generate(widget.files.length, (index) {
          final file = widget.files[index];
          final isExisting = _existingFiles.contains(_filesWithNames[index].finalFilename);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: ThemeConfig.surfaceContainerColor,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: _isVideoFile(file.path)
                        ? const Icon(Icons.videocam, size: 20, color: ThemeConfig.onSurfaceVariantColor)
                        : Image.file(File(file.path), fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image, size: 20)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _filenameControllers[index],
                    decoration: InputDecoration(
                      hintText: file.name,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: isExisting ? ThemeConfig.errorColor : ThemeConfig.borderColor),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: isExisting ? ThemeConfig.errorColor : ThemeConfig.borderColor),
                      ),
                    ),
                    style: const TextStyle(fontSize: 14, color: ThemeConfig.onBackgroundColor),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildExistingFilesWarning() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ThemeConfig.errorColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ThemeConfig.errorColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: ThemeConfig.errorColor, size: 20),
              SizedBox(width: 8),
              Text('以下文件名已存在于数据库中', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: ThemeConfig.errorColor)),
            ],
          ),
          const SizedBox(height: 8),
          ..._existingFiles.map((filename) => Padding(
            padding: const EdgeInsets.only(left: 28, bottom: 4),
            child: Text('• $filename', style: const TextStyle(fontSize: 12, color: ThemeConfig.errorColor)),
          )),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.only(left: 28),
            child: Text('请修改这些文件的自定义名称后再提交', style: TextStyle(fontSize: 12, color: ThemeConfig.errorColor)),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButtons() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: _isSubmitting || _isCheckingFilenames ? null : widget.onCancel,
            style: OutlinedButton.styleFrom(
              foregroundColor: ThemeConfig.onSurfaceVariantColor,
              side: const BorderSide(color: ThemeConfig.borderColor),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: const Text('取消'),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          flex: 2,
          child: ElevatedButton(
            onPressed: _isSubmitting || _isCheckingFilenames ? null : _submitForm,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _isSubmitting || _isCheckingFilenames
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      ),
                      const SizedBox(width: 8),
                      Text(_isCheckingFilenames ? '检查中...' : '添加中...'),
                    ],
                  )
                : Text('添加到队列 (${widget.files.length})'),
          ),
        ),
      ],
    );
  }
}
