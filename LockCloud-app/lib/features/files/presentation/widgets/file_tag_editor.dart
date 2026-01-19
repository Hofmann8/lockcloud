import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/file_model.dart';
import '../../data/repositories/tags_repository.dart';

/// 文件标签编辑器
///
/// 显示和编辑文件的自由标签，支持：
/// - 显示当前标签
/// - 添加新标签（支持搜索建议）
/// - 删除标签
///
/// **Validates: Requirements 7.1, 7.2, 7.3**
class FileTagEditor extends ConsumerStatefulWidget {
  final int fileId;
  final List<FreeTag> initialTags;
  final void Function(List<FreeTag> tags)? onTagsChanged;
  final bool readOnly;
  final bool compact;

  const FileTagEditor({
    super.key,
    required this.fileId,
    required this.initialTags,
    this.onTagsChanged,
    this.readOnly = false,
    this.compact = false,
  });

  @override
  ConsumerState<FileTagEditor> createState() => _FileTagEditorState();
}

class _FileTagEditorState extends ConsumerState<FileTagEditor> {
  late List<FreeTag> _tags;
  final TextEditingController _inputController = TextEditingController();
  final FocusNode _inputFocusNode = FocusNode();
  bool _isAdding = false;
  bool _isLoading = false;
  List<TagModel> _suggestions = [];

  @override
  void initState() {
    super.initState();
    _tags = List.from(widget.initialTags);
    _inputController.addListener(_onInputChanged);
  }

  @override
  void dispose() {
    _inputController.removeListener(_onInputChanged);
    _inputController.dispose();
    _inputFocusNode.dispose();
    super.dispose();
  }

  void _onInputChanged() {
    final query = _inputController.text.trim();
    if (query.isNotEmpty) {
      _searchTags(query);
    } else {
      setState(() {
        _suggestions = [];
      });
    }
  }

  Future<void> _searchTags(String query) async {
    try {
      final repository = ref.read(tagsRepositoryProvider);
      final results = await repository.searchTags(query, limit: 5);
      
      // 过滤掉已添加的标签
      final existingNames = _tags.map((t) => t.name.toLowerCase()).toSet();
      final filtered = results
          .where((t) => !existingNames.contains(t.name.toLowerCase()))
          .toList();
      
      if (mounted) {
        setState(() {
          _suggestions = filtered;
        });
      }
    } catch (e) {
      // 搜索失败时静默处理
    }
  }

  Future<void> _addTag(String tagName) async {
    final trimmed = tagName.trim();
    if (trimmed.isEmpty) return;

    // 检查是否已存在
    if (_tags.any((t) => t.name.toLowerCase() == trimmed.toLowerCase())) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('该标签已存在')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final repository = ref.read(tagsRepositoryProvider);
      final newTag = await repository.addTagToFile(widget.fileId, trimmed);
      
      if (mounted) {
        setState(() {
          _tags.add(FreeTag(id: newTag.id, name: newTag.name));
          _inputController.clear();
          _suggestions = [];
          _isLoading = false;
        });
        widget.onTagsChanged?.call(_tags);
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已添加标签 "$trimmed"')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('添加标签失败: $e')),
        );
      }
    }
  }

  Future<void> _removeTag(FreeTag tag) async {
    setState(() {
      _isLoading = true;
    });

    try {
      final repository = ref.read(tagsRepositoryProvider);
      await repository.removeTagFromFile(widget.fileId, tag.id);
      
      if (mounted) {
        setState(() {
          _tags.removeWhere((t) => t.id == tag.id);
          _isLoading = false;
        });
        widget.onTagsChanged?.call(_tags);
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已移除标签 "${tag.name}"')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('移除标签失败: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // 标签标题
        if (!widget.compact)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text(
              '自由标签',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),

        // 当前标签列表
        if (_tags.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _tags.map((tag) => _buildTagChip(tag)).toList(),
          ),

        // 空状态
        if (_tags.isEmpty && !_isAdding && widget.readOnly)
          const Text(
            '暂无标签',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 13,
              fontStyle: FontStyle.italic,
            ),
          ),

        // 添加标签区域
        if (!widget.readOnly) ...[
          const SizedBox(height: 12),
          if (_isAdding)
            _buildTagInput()
          else
            _buildAddButton(),
        ],
      ],
    );
  }

  Widget _buildTagChip(FreeTag tag) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: widget.compact ? 8 : 10,
        vertical: widget.compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: ThemeConfig.primaryColor.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: ThemeConfig.primaryColor.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            tag.name,
            style: TextStyle(
              color: ThemeConfig.primaryColor,
              fontSize: widget.compact ? 12 : 13,
            ),
          ),
          if (!widget.readOnly) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: _isLoading ? null : () => _removeTag(tag),
              child: Icon(
                Icons.close,
                size: widget.compact ? 14 : 16,
                color: ThemeConfig.primaryColor,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAddButton() {
    return GestureDetector(
      onTap: () {
        setState(() {
          _isAdding = true;
        });
        _inputFocusNode.requestFocus();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: ThemeConfig.surfaceContainerColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ThemeConfig.borderColor),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.add,
              size: 16,
              color: ThemeConfig.onSurfaceVariantColor,
            ),
            SizedBox(width: 4),
            Text(
              '添加标签',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTagInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputController,
                focusNode: _inputFocusNode,
                style: const TextStyle(color: ThemeConfig.onBackgroundColor, fontSize: 14),
                decoration: InputDecoration(
                  hintText: '输入标签名称...',
                  hintStyle: const TextStyle(color: ThemeConfig.onSurfaceVariantColor),
                  filled: true,
                  fillColor: ThemeConfig.surfaceContainerColor,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: ThemeConfig.borderColor),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: ThemeConfig.borderColor),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: ThemeConfig.primaryColor),
                  ),
                ),
                onSubmitted: (value) {
                  if (value.trim().isNotEmpty) {
                    _addTag(value);
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: () {
                setState(() {
                  _isAdding = false;
                  _inputController.clear();
                  _suggestions = [];
                });
              },
              child: const Text(
                '取消',
                style: TextStyle(color: ThemeConfig.onSurfaceVariantColor),
              ),
            ),
          ],
        ),

        // 搜索建议
        if (_suggestions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: ThemeConfig.surfaceColor,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: ThemeConfig.borderColor),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _suggestions.map((tag) {
                return InkWell(
                  onTap: () => _addTag(tag.name),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            tag.name,
                            style: const TextStyle(
                              color: ThemeConfig.onBackgroundColor,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Text(
                          '${tag.count} 个文件',
                          style: const TextStyle(
                            color: ThemeConfig.onSurfaceVariantColor,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

        // 加载指示器
        if (_isLoading)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: ThemeConfig.primaryColor,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
