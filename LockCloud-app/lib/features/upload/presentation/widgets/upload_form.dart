import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:mime/mime.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/upload_queue_item.dart';
import '../../data/repositories/upload_repository.dart';
import '../providers/upload_queue_provider.dart';

/// 上传表单组件
///
/// 显示元数据填写表单，包括：
/// - 活动日期（必填）
/// - 活动类型（必填）
/// - 活动名称（可选）
/// - 自定义文件名（可选）
///
/// **Validates: Requirements 3.2, 3.3, 3.4**
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
  final _customFilenameController = TextEditingController();

  DateTime? _activityDate;
  String? _activityType;
  bool _isSubmitting = false;

  /// 活动类型选项
  static const List<ActivityType> _activityTypes = [
    ActivityType(value: 'routine', display: '日常训练'),
    ActivityType(value: 'performance', display: '演出'),
    ActivityType(value: 'competition', display: '比赛'),
    ActivityType(value: 'workshop', display: '工作坊'),
    ActivityType(value: 'other', display: '其他'),
  ];

  @override
  void dispose() {
    _activityNameController.dispose();
    _customFilenameController.dispose();
    super.dispose();
  }

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

    if (picked != null) {
      setState(() {
        _activityDate = picked;
      });
    }
  }

  /// 验证表单
  ///
  /// **Validates: Requirements 3.3, 3.4**
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
  ///
  /// **Validates: Requirements 3.2, 3.5**
  Future<void> _submitForm() async {
    if (!_validateForm()) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final metadata = UploadMetadata(
        activityDate: DateFormat('yyyy-MM-dd').format(_activityDate!),
        activityType: _activityType!,
        activityName: _activityNameController.text.isNotEmpty
            ? _activityNameController.text
            : null,
        customFilename: _customFilenameController.text.isNotEmpty
            ? _customFilenameController.text
            : null,
      );

      // 获取文件信息并添加到队列
      final fileInfos = await Future.wait(
        widget.files.map((file) async {
          final fileSize = await file.length();
          final mimeType = lookupMimeType(file.path) ?? 'application/octet-stream';

          return FileInfo(
            path: file.path,
            name: file.name,
            size: fileSize,
            mimeType: mimeType,
          );
        }),
      );

      ref.read(uploadQueueNotifierProvider.notifier).addItems(
            files: fileInfos,
            metadata: metadata,
          );

      widget.onSubmit();
    } catch (e) {
      _showErrorSnackBar('添加上传任务失败: $e');
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  /// 显示错误提示
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 文件预览
            _buildFilePreview(),
            const SizedBox(height: 24),

            // 活动日期（必填）
            _buildDateField(),
            const SizedBox(height: 16),

            // 活动类型（必填）
            _buildActivityTypeField(),
            const SizedBox(height: 16),

            // 活动名称（可选）
            _buildActivityNameField(),
            const SizedBox(height: 16),

            // 自定义文件名（可选，仅单文件时显示）
            if (widget.files.length == 1) ...[
              _buildCustomFilenameField(),
              const SizedBox(height: 16),
            ],

            // 提交按钮
            const SizedBox(height: 8),
            _buildSubmitButtons(),
          ],
        ),
      ),
    );
  }

  /// 构建文件预览
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
              const Icon(
                Icons.attach_file,
                color: ThemeConfig.primaryColor,
                size: 20,
              ),
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
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                return _buildFilePreviewItem(widget.files[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 构建单个文件预览项
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
                errorBuilder: (_, _, _) => _buildFilePlaceholder(isVideo),
              )
            else
              _buildFilePlaceholder(isVideo),
            if (isVideo)
              const Center(
                child: Icon(
                  Icons.play_circle_outline,
                  color: Colors.white,
                  size: 32,
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// 构建文件占位符
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

  /// 判断是否为视频文件
  bool _isVideoFile(String path) {
    final mimeType = lookupMimeType(path);
    return mimeType?.startsWith('video/') ?? false;
  }

  /// 构建日期选择字段
  ///
  /// **Validates: Requirements 3.3**
  Widget _buildDateField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text(
              '活动日期',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: ThemeConfig.onBackgroundColor,
              ),
            ),
            SizedBox(width: 4),
            Text(
              '*',
              style: TextStyle(
                color: ThemeConfig.errorColor,
                fontWeight: FontWeight.bold,
              ),
            ),
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
                  color: _activityDate != null
                      ? ThemeConfig.primaryColor
                      : ThemeConfig.onSurfaceVariantColor,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _activityDate != null
                        ? DateFormat('yyyy-MM-dd').format(_activityDate!)
                        : '请选择活动日期',
                    style: TextStyle(
                      fontSize: 16,
                      color: _activityDate != null
                          ? ThemeConfig.onBackgroundColor
                          : ThemeConfig.onSurfaceVariantColor,
                    ),
                  ),
                ),
                const Icon(
                  Icons.arrow_drop_down,
                  color: ThemeConfig.onSurfaceVariantColor,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// 构建活动类型选择字段
  ///
  /// **Validates: Requirements 3.3**
  Widget _buildActivityTypeField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text(
              '活动类型',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: ThemeConfig.onBackgroundColor,
              ),
            ),
            SizedBox(width: 4),
            Text(
              '*',
              style: TextStyle(
                color: ThemeConfig.errorColor,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: ThemeConfig.surfaceContainerColor,
            borderRadius: BorderRadius.circular(8),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _activityType,
              hint: const Text(
                '请选择活动类型',
                style: TextStyle(
                  color: ThemeConfig.onSurfaceVariantColor,
                  fontSize: 16,
                ),
              ),
              isExpanded: true,
              dropdownColor: ThemeConfig.surfaceColor,
              icon: const Icon(
                Icons.arrow_drop_down,
                color: ThemeConfig.onSurfaceVariantColor,
              ),
              items: _activityTypes.map((type) {
                return DropdownMenuItem<String>(
                  value: type.value,
                  child: Text(
                    type.display,
                    style: const TextStyle(
                      color: ThemeConfig.onBackgroundColor,
                      fontSize: 16,
                    ),
                  ),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _activityType = value;
                });
              },
            ),
          ),
        ),
      ],
    );
  }

  /// 构建活动名称输入字段
  Widget _buildActivityNameField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '活动名称',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: ThemeConfig.onBackgroundColor,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          '可选，用于标识具体活动',
          style: TextStyle(
            fontSize: 12,
            color: ThemeConfig.onSurfaceVariantColor,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _activityNameController,
          decoration: const InputDecoration(
            hintText: '例如：周年庆演出、新生培训',
            prefixIcon: Icon(Icons.event, size: 20),
          ),
          style: const TextStyle(
            color: ThemeConfig.onBackgroundColor,
            fontSize: 16,
          ),
        ),
      ],
    );
  }

  /// 构建自定义文件名输入字段
  Widget _buildCustomFilenameField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '自定义文件名',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: ThemeConfig.onBackgroundColor,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          '可选，留空则自动生成',
          style: TextStyle(
            fontSize: 12,
            color: ThemeConfig.onSurfaceVariantColor,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _customFilenameController,
          decoration: const InputDecoration(
            hintText: '输入自定义文件名',
            prefixIcon: Icon(Icons.edit, size: 20),
          ),
          style: const TextStyle(
            color: ThemeConfig.onBackgroundColor,
            fontSize: 16,
          ),
        ),
      ],
    );
  }

  /// 构建提交按钮
  Widget _buildSubmitButtons() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: _isSubmitting ? null : widget.onCancel,
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
            onPressed: _isSubmitting ? null : _submitForm,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text('开始上传 (${widget.files.length})'),
          ),
        ),
      ],
    );
  }
}
