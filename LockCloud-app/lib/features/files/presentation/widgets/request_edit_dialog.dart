import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../../requests/data/models/file_request_model.dart';
import '../../../requests/data/repositories/requests_repository.dart';
import '../../data/models/file_model.dart';
import '../../data/repositories/tags_repository.dart';
import 'tag_input_with_suggestions.dart';

/// 请求编辑对话框
///
/// 非文件所有者可以通过此对话框发起编辑请求。
/// 支持修改：
/// - 活动日期
/// - 活动类型
/// - 活动名称
/// - 文件名
/// - 自由标签
///
/// **Validates: Requirements 6.2**
class RequestEditDialog extends ConsumerStatefulWidget {
  final FileModel file;
  final VoidCallback? onSuccess;

  const RequestEditDialog({
    super.key,
    required this.file,
    this.onSuccess,
  });

  @override
  ConsumerState<RequestEditDialog> createState() => _RequestEditDialogState();
}

class _RequestEditDialogState extends ConsumerState<RequestEditDialog> {
  late TextEditingController _filenameController;
  late TextEditingController _activityDateController;
  late TextEditingController _activityNameController;
  late TextEditingController _messageController;
  String? _selectedActivityType;
  List<String> _freeTags = [];
  
  bool _isSubmitting = false;
  List<TagPresetModel> _activityTypePresets = [];
  bool _isLoadingPresets = true;

  @override
  void initState() {
    super.initState();
    _filenameController = TextEditingController(text: widget.file.filename);
    _activityDateController = TextEditingController(text: widget.file.activityDate ?? '');
    _activityNameController = TextEditingController(text: widget.file.activityName ?? '');
    _messageController = TextEditingController();
    _selectedActivityType = widget.file.activityType;
    _freeTags = widget.file.freeTags.map((t) => t.name).toList();
    
    _loadActivityTypePresets();
  }

  @override
  void dispose() {
    _filenameController.dispose();
    _activityDateController.dispose();
    _activityNameController.dispose();
    _messageController.dispose();
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

  bool _hasChanges() {
    final originalTags = widget.file.freeTags.map((t) => t.name).toSet();
    final currentTags = _freeTags.toSet();
    
    return _filenameController.text != widget.file.filename ||
        _activityDateController.text != (widget.file.activityDate ?? '') ||
        _activityNameController.text != (widget.file.activityName ?? '') ||
        _selectedActivityType != widget.file.activityType ||
        !originalTags.containsAll(currentTags) ||
        !currentTags.containsAll(originalTags);
  }

  Map<String, dynamic> _buildProposedChanges() {
    final changes = <String, dynamic>{};
    
    if (_filenameController.text != widget.file.filename) {
      changes['filename'] = _filenameController.text;
    }
    if (_activityDateController.text != (widget.file.activityDate ?? '')) {
      changes['activity_date'] = _activityDateController.text.isEmpty 
          ? null 
          : _activityDateController.text;
    }
    if (_activityNameController.text != (widget.file.activityName ?? '')) {
      changes['activity_name'] = _activityNameController.text.isEmpty 
          ? null 
          : _activityNameController.text;
    }
    if (_selectedActivityType != widget.file.activityType) {
      changes['activity_type'] = _selectedActivityType;
    }
    
    final originalTags = widget.file.freeTags.map((t) => t.name).toSet();
    final currentTags = _freeTags.toSet();
    if (!originalTags.containsAll(currentTags) || !currentTags.containsAll(originalTags)) {
      changes['free_tags'] = _freeTags;
    }
    
    return changes;
  }

  Future<void> _submitRequest() async {
    if (!_hasChanges()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('没有修改内容')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final repository = ref.read(requestsRepositoryProvider);
      await repository.createRequest(
        CreateRequestParams(
          fileId: widget.file.id,
          requestType: 'edit',
          proposedChanges: _buildProposedChanges(),
          message: _messageController.text.trim().isEmpty 
              ? null 
              : _messageController.text.trim(),
        ),
      );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('修改请求已发送给文件上传者'),
            backgroundColor: ThemeConfig.primaryColor,
          ),
        );
        widget.onSuccess?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('发送请求失败: $e'),
            backgroundColor: ThemeConfig.errorColor,
          ),
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
      initialChildSize: 0.9,
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
                      '请求修改',
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
              
              // 提示信息
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ThemeConfig.warningColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: ThemeConfig.warningColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: ThemeConfig.warningColor, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '您不是此文件的上传者，修改将发送给上传者审批',
                        style: TextStyle(
                          color: ThemeConfig.warningColor,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 16),
              
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
                      const SizedBox(height: 16),
                      
                      // 留言
                      TextField(
                        controller: _messageController,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: '留言（可选）',
                          hintText: '向文件上传者说明修改原因...',
                          alignLabelWithHint: true,
                        ),
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
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: ThemeConfig.onSurfaceVariantColor,
                          side: const BorderSide(color: ThemeConfig.borderColor),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('取消'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _submitRequest,
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
                            : const Text('发送请求'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
