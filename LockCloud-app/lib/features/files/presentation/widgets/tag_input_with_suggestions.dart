import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/repositories/tags_repository.dart';

/// 带搜索建议的标签输入组件
///
/// 支持：
/// - 输入时显示标签搜索建议
/// - 回车添加标签
/// - 点击建议添加标签
/// - 显示已添加的标签列表
/// - 删除已添加的标签
class TagInputWithSuggestions extends ConsumerStatefulWidget {
  /// 当前已添加的标签列表
  final List<String> tags;

  /// 标签变化回调
  final void Function(List<String> tags) onTagsChanged;

  /// 占位文本
  final String? hintText;

  const TagInputWithSuggestions({
    super.key,
    required this.tags,
    required this.onTagsChanged,
    this.hintText,
  });

  @override
  ConsumerState<TagInputWithSuggestions> createState() =>
      _TagInputWithSuggestionsState();
}

class _TagInputWithSuggestionsState
    extends ConsumerState<TagInputWithSuggestions> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final LayerLink _layerLink = LayerLink();

  List<TagModel> _suggestions = [];
  bool _isLoadingSuggestions = false;
  bool _showSuggestions = false;
  Timer? _debounceTimer;
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
    _focusNode.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    _removeOverlay();
    super.dispose();
  }

  void _onTextChanged() {
    final text = _controller.text.trim();
    
    _debounceTimer?.cancel();
    
    if (text.isEmpty) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
      _removeOverlay();
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      _searchTags(text);
    });
  }

  void _onFocusChanged() {
    if (!_focusNode.hasFocus) {
      // 延迟隐藏，以便点击建议时能够触发
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted && !_focusNode.hasFocus) {
          _removeOverlay();
        }
      });
    }
  }

  Future<void> _searchTags(String query) async {
    if (!mounted) return;

    setState(() {
      _isLoadingSuggestions = true;
    });

    try {
      final repository = ref.read(tagsRepositoryProvider);
      final results = await repository.searchTags(query, limit: 5);

      if (mounted) {
        setState(() {
          _suggestions = results
              .where((tag) => !widget.tags
                  .any((t) => t.toLowerCase() == tag.name.toLowerCase()))
              .toList();
          _isLoadingSuggestions = false;
          _showSuggestions = _suggestions.isNotEmpty;
        });

        if (_showSuggestions) {
          _showOverlay();
        } else {
          _removeOverlay();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingSuggestions = false;
          _suggestions = [];
          _showSuggestions = false;
        });
        _removeOverlay();
      }
    }
  }

  void _addTag(String tagName) {
    final trimmed = tagName.trim();
    if (trimmed.isEmpty) return;

    if (widget.tags.any((t) => t.toLowerCase() == trimmed.toLowerCase())) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('该标签已存在')),
      );
      return;
    }

    final newTags = [...widget.tags, trimmed];
    widget.onTagsChanged(newTags);
    _controller.clear();
    _removeOverlay();
  }

  void _removeTag(String tagName) {
    final newTags = widget.tags.where((t) => t != tagName).toList();
    widget.onTagsChanged(newTags);
  }

  void _showOverlay() {
    _removeOverlay();

    _overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        width: context.findRenderObject() != null
            ? (context.findRenderObject() as RenderBox).size.width
            : 200,
        child: CompositedTransformFollower(
          link: _layerLink,
          showWhenUnlinked: false,
          offset: const Offset(0, 48),
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            color: ThemeConfig.surfaceColor,
            child: Container(
              constraints: const BoxConstraints(maxHeight: 200),
              decoration: BoxDecoration(
                border: Border.all(color: ThemeConfig.borderColor),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView.builder(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: _suggestions.length,
                itemBuilder: (context, index) {
                  final tag = _suggestions[index];
                  return InkWell(
                    onTap: () => _addTag(tag.name),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
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
                            '${tag.count}',
                            style: const TextStyle(
                              color: ThemeConfig.onSurfaceVariantColor,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );

    Overlay.of(context).insert(_overlayEntry!);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 已有标签
          if (widget.tags.isNotEmpty)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.tags.map((tag) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: ThemeConfig.primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: ThemeConfig.primaryColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        tag,
                        style: const TextStyle(
                          color: ThemeConfig.primaryColor,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: () => _removeTag(tag),
                        child: const Icon(
                          Icons.close,
                          size: 16,
                          color: ThemeConfig.primaryColor,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),

          if (widget.tags.isNotEmpty) const SizedBox(height: 8),

          // 添加标签输入框
          CompositedTransformTarget(
            link: _layerLink,
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              style: const TextStyle(fontSize: 14, color: ThemeConfig.onBackgroundColor),
              decoration: InputDecoration(
                hintText: widget.hintText ??
                    (widget.tags.isEmpty ? '输入标签后按回车添加' : '添加更多标签...'),
                hintStyle: const TextStyle(color: ThemeConfig.onSurfaceVariantColor),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: ThemeConfig.borderColor),
                ),
                suffixIcon: _isLoadingSuggestions
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: ThemeConfig.primaryColor,
                          ),
                        ),
                      )
                    : null,
              ),
              onSubmitted: _addTag,
            ),
          ),
        ],
      ),
    );
  }
}
