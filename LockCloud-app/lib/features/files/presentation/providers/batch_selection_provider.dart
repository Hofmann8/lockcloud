import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'files_provider.dart';

part 'batch_selection_provider.freezed.dart';
part 'batch_selection_provider.g.dart';

/// 批量选择状态
///
/// 管理文件批量选择的所有状态，包括：
/// - 选中的文件 ID 集合
/// - 是否处于选择模式
/// - 是否全选模式
///
/// **Validates: Requirements 2.8, 2.9, 2.10**
@freezed
sealed class BatchSelectionState with _$BatchSelectionState {
  const factory BatchSelectionState({
    /// 选中的文件 ID 集合
    @Default({}) Set<int> selectedIds,

    /// 是否处于选择模式
    @Default(false) bool isSelectionMode,

    /// 是否全选模式
    @Default(false) bool isSelectAllMode,
  }) = _BatchSelectionState;
}

/// 批量选择状态管理器
///
/// 使用 Riverpod 管理批量选择状态，提供以下功能：
/// - 进入/退出选择模式
/// - 切换单个文件选择
/// - 全选/取消全选
/// - 清除选择
///
/// **Validates: Requirements 2.8, 2.9, 2.10**
@Riverpod(keepAlive: true)
class BatchSelectionNotifier extends _$BatchSelectionNotifier {
  @override
  BatchSelectionState build() {
    return const BatchSelectionState();
  }

  /// 进入选择模式
  ///
  /// 长按文件卡片时调用
  ///
  /// **Validates: Requirements 2.8**
  void enterSelectionMode() {
    state = state.copyWith(isSelectionMode: true);
  }

  /// 退出选择模式
  ///
  /// 清除所有选择并退出选择模式
  void exitSelectionMode() {
    state = const BatchSelectionState();
  }

  /// 切换文件选择状态
  ///
  /// [id] - 文件 ID
  ///
  /// **Validates: Requirements 2.8**
  void toggleSelection(int id) {
    final newSelectedIds = Set<int>.from(state.selectedIds);

    if (newSelectedIds.contains(id)) {
      newSelectedIds.remove(id);
    } else {
      newSelectedIds.add(id);
    }

    // 如果取消选择后没有选中的文件，退出选择模式
    if (newSelectedIds.isEmpty) {
      state = const BatchSelectionState();
    } else {
      state = state.copyWith(
        selectedIds: newSelectedIds,
        isSelectAllMode: false,
      );
    }
  }

  /// 选择文件
  ///
  /// [id] - 文件 ID
  void select(int id) {
    if (state.selectedIds.contains(id)) return;

    final newSelectedIds = Set<int>.from(state.selectedIds)..add(id);
    state = state.copyWith(
      selectedIds: newSelectedIds,
      isSelectionMode: true,
    );
  }

  /// 取消选择文件
  ///
  /// [id] - 文件 ID
  void deselect(int id) {
    if (!state.selectedIds.contains(id)) return;

    final newSelectedIds = Set<int>.from(state.selectedIds)..remove(id);

    if (newSelectedIds.isEmpty) {
      state = const BatchSelectionState();
    } else {
      state = state.copyWith(
        selectedIds: newSelectedIds,
        isSelectAllMode: false,
      );
    }
  }

  /// 全选
  ///
  /// 选中当前筛选条件下的所有文件
  ///
  /// [ids] - 所有文件 ID 列表
  ///
  /// **Validates: Requirements 2.10**
  void selectAll(List<int> ids) {
    state = state.copyWith(
      selectedIds: ids.toSet(),
      isSelectionMode: true,
      isSelectAllMode: true,
    );
  }

  /// 取消全选
  ///
  /// 清除所有选择但保持选择模式
  void deselectAll() {
    state = state.copyWith(
      selectedIds: {},
      isSelectAllMode: false,
    );
  }

  /// 清除选择
  ///
  /// 清除所有选择并退出选择模式
  void clearSelection() {
    state = const BatchSelectionState();
  }

  /// 检查文件是否被选中
  ///
  /// [id] - 文件 ID
  bool isSelected(int id) {
    return state.selectedIds.contains(id);
  }

  /// 从选择中移除已删除的文件
  ///
  /// [deletedIds] - 已删除的文件 ID 列表
  void removeDeletedFiles(List<int> deletedIds) {
    final newSelectedIds = Set<int>.from(state.selectedIds)
      ..removeAll(deletedIds);

    if (newSelectedIds.isEmpty) {
      state = const BatchSelectionState();
    } else {
      state = state.copyWith(
        selectedIds: newSelectedIds,
        isSelectAllMode: false,
      );
    }
  }
}

/// 选中文件数量 Provider
///
/// 便捷 Provider，用于获取当前选中的文件数量
///
/// **Validates: Requirements 2.9**
@riverpod
int selectedCount(Ref ref) {
  final selectionState = ref.watch(batchSelectionNotifierProvider);
  return selectionState.selectedIds.length;
}

/// 是否处于选择模式 Provider
///
/// 便捷 Provider，用于判断是否处于选择模式
@riverpod
bool isInSelectionMode(Ref ref) {
  final selectionState = ref.watch(batchSelectionNotifierProvider);
  return selectionState.isSelectionMode;
}

/// 是否全选 Provider
///
/// 便捷 Provider，用于判断是否全选
@riverpod
bool isAllSelected(Ref ref) {
  final selectionState = ref.watch(batchSelectionNotifierProvider);
  final filesState = ref.watch(filesNotifierProvider);

  if (!selectionState.isSelectionMode) return false;
  if (filesState.files.isEmpty) return false;

  return selectionState.selectedIds.length == filesState.files.length;
}

/// 选中的文件 ID 列表 Provider
///
/// 便捷 Provider，用于获取选中的文件 ID 列表
@riverpod
List<int> selectedFileIds(Ref ref) {
  final selectionState = ref.watch(batchSelectionNotifierProvider);
  return selectionState.selectedIds.toList();
}

/// 检查文件是否被选中 Provider
///
/// 便捷 Provider，用于检查特定文件是否被选中
@riverpod
bool isFileSelected(Ref ref, int fileId) {
  final selectionState = ref.watch(batchSelectionNotifierProvider);
  return selectionState.selectedIds.contains(fileId);
}
