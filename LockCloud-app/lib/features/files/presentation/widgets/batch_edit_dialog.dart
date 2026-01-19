import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/repositories/batch_repository.dart';
import '../providers/batch_selection_provider.dart';
import '../providers/files_provider.dart';

/// 活动类型
class ActivityType {
  final String value;
  final String display;

  const ActivityType({required this.value, required this.display});
}

/// 批量修改对话框
///
/// 显示批量修改表单，支持修改：
/// - 活动日期
/// - 活动类型
/// - 活动名称
///
/// **Validates: Requirements 7.4**
class BatchEditDialog extends ConsumerStatefulWidget {
  final List<int> selectedFileIds;

  const BatchEditDialog({
    super.key,
    required this.selectedFileIds,
  });

  @override
  ConsumerState<BatchEditDialog> createState() => _BatchEditDialogState();
}

class _BatchEditDialogState extends ConsumerState<BatchEditDialog> {
  final _activityNameController = TextEditingController();

  DateTime? _activityDate;
  String? _activityType;
  bool _isSubmitting = false;
  String? _error;

  // 跟踪哪些字段被修改
  bool _dateChanged = false;
  bool _typeChanged = false;
  bool _nameChanged = false;

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
        _dateChanged = true;
      });
    }
  }

  /// 检查是否有任何修改
  bool get _hasChanges => _dateChanged || _typeChanged || _nameChanged;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: ThemeConfig.surfaceColor,
      title: Text(
        '批量修改 ${widget.selectedFileIds.length} 个文件',
        style: const TextStyle(color: ThemeConfig.onBackgroundColor, fontSize: 16),
      ),
      content: _buildContent(),
      actions: _buildActions(),
    );
  }

  Widget _buildContent() {
    if (_isSubmitting) {
      return const SizedBox(
        height: 100,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: ThemeConfig.primaryColor,
              ),
              SizedBox(height: 16),
              Text(
                '正在修改...',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      width: double.maxFinite,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 错误提示
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // 提示信息
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: ThemeConfig.primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline,
                    color: ThemeConfig.primaryColor,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '只有修改的字段会被更新，留空的字段保持不变',
                      style: const TextStyle(
                        color: ThemeConfig.onSurfaceVariantColor,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 活动日期
            _buildDateField(),
            const SizedBox(height: 16),

            // 活动类型
            _buildActivityTypeField(),
            const SizedBox(height: 16),

            // 活动名称
            _buildActivityNameField(),
          ],
        ),
      ),
    );
  }

  /// 构建日期选择字段
  Widget _buildDateField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              '活动日期',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: ThemeConfig.onBackgroundColor,
              ),
            ),
            if (_dateChanged) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ThemeConfig.primaryColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '已修改',
                  style: TextStyle(
                    color: ThemeConfig.primaryColor,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: _selectDate,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: ThemeConfig.backgroundColor,
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
                        : '点击选择日期',
                    style: TextStyle(
                      fontSize: 14,
                      color: _activityDate != null
                          ? ThemeConfig.onBackgroundColor
                          : ThemeConfig.onSurfaceVariantColor,
                    ),
                  ),
                ),
                if (_dateChanged)
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    color: ThemeConfig.onSurfaceVariantColor,
                    onPressed: () {
                      setState(() {
                        _activityDate = null;
                        _dateChanged = false;
                      });
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  )
                else
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
  Widget _buildActivityTypeField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              '活动类型',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: ThemeConfig.onBackgroundColor,
              ),
            ),
            if (_typeChanged) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ThemeConfig.primaryColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '已修改',
                  style: TextStyle(
                    color: ThemeConfig.primaryColor,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: ThemeConfig.backgroundColor,
            borderRadius: BorderRadius.circular(8),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _activityType,
              hint: const Text(
                '点击选择类型',
                style: TextStyle(
                  color: ThemeConfig.onSurfaceVariantColor,
                  fontSize: 14,
                ),
              ),
              isExpanded: true,
              dropdownColor: ThemeConfig.surfaceColor,
              icon: _typeChanged
                  ? IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      color: ThemeConfig.onSurfaceVariantColor,
                      onPressed: () {
                        setState(() {
                          _activityType = null;
                          _typeChanged = false;
                        });
                      },
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    )
                  : const Icon(
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
                      fontSize: 14,
                    ),
                  ),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _activityType = value;
                  _typeChanged = value != null;
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
        Row(
          children: [
            const Text(
              '活动名称',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: ThemeConfig.onBackgroundColor,
              ),
            ),
            if (_nameChanged) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ThemeConfig.primaryColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '已修改',
                  style: TextStyle(
                    color: ThemeConfig.primaryColor,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _activityNameController,
          style: const TextStyle(
            color: ThemeConfig.onBackgroundColor,
            fontSize: 14,
          ),
          decoration: InputDecoration(
            hintText: '输入活动名称',
            hintStyle: const TextStyle(color: ThemeConfig.onSurfaceVariantColor),
            filled: true,
            fillColor: ThemeConfig.surfaceContainerColor,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
            suffixIcon: _nameChanged
                ? IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    color: ThemeConfig.onSurfaceVariantColor,
                    onPressed: () {
                      setState(() {
                        _activityNameController.clear();
                        _nameChanged = false;
                      });
                    },
                  )
                : null,
          ),
          onChanged: (value) {
            setState(() {
              _nameChanged = value.isNotEmpty;
            });
          },
        ),
      ],
    );
  }

  List<Widget> _buildActions() {
    if (_isSubmitting) {
      return [];
    }

    return [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text(
          '取消',
          style: TextStyle(color: ThemeConfig.onSurfaceVariantColor),
        ),
      ),
      ElevatedButton(
        onPressed: _hasChanges ? _submitChanges : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeConfig.primaryColor,
        ),
        child: const Text('确定'),
      ),
    ];
  }

  /// 提交修改
  ///
  /// **Validates: Requirements 7.4**
  Future<void> _submitChanges() async {
    if (!_hasChanges) return;

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final batchRepo = ref.read(batchRepositoryProvider);

      final updates = BatchUpdateData(
        activityDate: _dateChanged && _activityDate != null
            ? DateFormat('yyyy-MM-dd').format(_activityDate!)
            : null,
        activityType: _typeChanged ? _activityType : null,
        activityName: _nameChanged ? _activityNameController.text : null,
      );

      final result = await batchRepo.batchUpdate(
        widget.selectedFileIds,
        updates,
      );

      if (!mounted) return;

      if (result.isAllSuccess) {
        _showSuccessAndClose(
          '成功修改 ${result.succeeded.length} 个文件',
        );
      } else if (result.isPartialSuccess) {
        _showPartialSuccessAndClose(result);
      } else {
        setState(() {
          _isSubmitting = false;
          _error = result.message.isNotEmpty
              ? result.message
              : '修改失败，请稍后重试';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _error = '修改失败: ${e.toString()}';
      });
    }
  }

  void _showSuccessAndClose(String message) {
    // 刷新文件列表
    ref.read(filesNotifierProvider.notifier).loadFiles(refresh: true);

    // 退出选择模式
    ref.read(batchSelectionNotifierProvider.notifier).exitSelectionMode();

    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _showPartialSuccessAndClose(BatchOperationResult result) {
    // 刷新文件列表
    ref.read(filesNotifierProvider.notifier).loadFiles(refresh: true);

    // 退出选择模式
    ref.read(batchSelectionNotifierProvider.notifier).exitSelectionMode();

    Navigator.pop(context);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '部分修改成功: ${result.succeeded.length} 成功, ${result.failed.length} 失败',
        ),
        backgroundColor: Colors.orange,
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
