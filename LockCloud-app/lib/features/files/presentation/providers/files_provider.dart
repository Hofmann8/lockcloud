import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/models/file_model.dart';
import '../../data/repositories/files_repository.dart';

part 'files_provider.freezed.dart';
part 'files_provider.g.dart';

/// 文件列表状态
///
/// 管理文件列表的所有状态，包括：
/// - 文件列表数据
/// - 加载状态
/// - 分页信息
/// - 筛选条件
/// - 时间线数据
///
/// **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.7**
@freezed
sealed class FilesState with _$FilesState {
  const factory FilesState({
    /// 文件列表
    @Default([]) List<FileModel> files,

    /// 是否正在加载（首次加载或刷新）
    @Default(false) bool isLoading,

    /// 是否正在加载更多
    @Default(false) bool isLoadingMore,

    /// 是否还有更多数据
    @Default(true) bool hasMore,

    /// 当前筛选条件
    @Default(FileFilters()) FileFilters filters,

    /// 分页信息
    PaginationInfo? pagination,

    /// 时间线数据
    Map<String, Map<String, TimelineMonth>>? timeline,

    /// 目录树
    @Default([]) List<DirectoryNode> directoryTree,

    /// 标签列表
    @Default([]) List<TagWithCount> tags,

    /// 错误信息
    String? error,
  }) = _FilesState;
}

/// 文件列表状态管理器
///
/// 使用 Riverpod 管理文件列表状态，提供以下功能：
/// - 加载文件列表
/// - 加载更多（无限滚动）
/// - 刷新列表
/// - 更新筛选条件
/// - 加载目录树
/// - 加载标签列表
///
/// **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.7**
@Riverpod(keepAlive: true)
class FilesNotifier extends _$FilesNotifier {
  @override
  FilesState build() {
    return const FilesState();
  }

  /// 获取 FilesRepository 实例
  FilesRepository get _repository => ref.read(filesRepositoryProvider);

  /// 加载文件列表
  ///
  /// [refresh] - 是否刷新（重置分页）
  ///
  /// **Validates: Requirements 2.1, 2.4**
  Future<void> loadFiles({bool refresh = false}) async {
    if (state.isLoading) return;

    final currentFilters = refresh
        ? state.filters.copyWith(page: 1)
        : state.filters;

    state = state.copyWith(
      isLoading: true,
      error: null,
      filters: currentFilters,
    );

    try {
      final response = await _repository.getFiles(currentFilters);

      state = state.copyWith(
        files: response.files,
        pagination: response.pagination,
        timeline: response.timeline,
        hasMore: response.pagination.hasNext,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
    }
  }

  /// 加载更多文件
  ///
  /// 无限滚动时调用，加载下一页数据
  ///
  /// **Validates: Requirements 2.3**
  Future<void> loadMore() async {
    if (state.isLoading || state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);

    final nextPage = state.filters.page + 1;
    final newFilters = state.filters.copyWith(page: nextPage);

    try {
      final response = await _repository.getFiles(newFilters);

      state = state.copyWith(
        files: [...state.files, ...response.files],
        pagination: response.pagination,
        filters: newFilters,
        hasMore: response.pagination.hasNext,
        isLoadingMore: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoadingMore: false,
        error: _getErrorMessage(e),
      );
    }
  }

  /// 更新筛选条件
  ///
  /// 更新筛选条件并重新加载文件列表
  ///
  /// **Validates: Requirements 2.5, 2.6, 2.7**
  Future<void> updateFilters(FileFilters filters) async {
    // 重置分页
    final newFilters = filters.copyWith(page: 1);
    state = state.copyWith(filters: newFilters);
    await loadFiles(refresh: true);
  }

  /// 设置媒体类型筛选
  ///
  /// [mediaType] - 媒体类型 (all, image, video)
  ///
  /// **Validates: Requirements 2.5**
  Future<void> setMediaType(String mediaType) async {
    final newFilters = state.filters.copyWith(
      mediaType: mediaType,
      page: 1,
    );
    await updateFilters(newFilters);
  }

  /// 设置目录筛选
  ///
  /// [directory] - 目录路径
  ///
  /// **Validates: Requirements 2.6**
  Future<void> setDirectory(String? directory) async {
    final newFilters = state.filters.copyWith(
      directory: directory,
      page: 1,
    );
    await updateFilters(newFilters);
  }

  /// 设置标签筛选
  ///
  /// [tags] - 标签列表
  ///
  /// **Validates: Requirements 2.7**
  Future<void> setTags(List<String> tags) async {
    final newFilters = state.filters.copyWith(
      tags: tags,
      page: 1,
    );
    await updateFilters(newFilters);
  }

  /// 添加标签筛选
  ///
  /// [tag] - 要添加的标签
  Future<void> addTag(String tag) async {
    if (state.filters.tags.contains(tag)) return;
    final newTags = [...state.filters.tags, tag];
    await setTags(newTags);
  }

  /// 移除标签筛选
  ///
  /// [tag] - 要移除的标签
  Future<void> removeTag(String tag) async {
    final newTags = state.filters.tags.where((t) => t != tag).toList();
    await setTags(newTags);
  }

  /// 设置搜索关键词
  ///
  /// [search] - 搜索关键词
  Future<void> setSearch(String? search) async {
    final newFilters = state.filters.copyWith(
      search: search,
      page: 1,
    );
    await updateFilters(newFilters);
  }

  /// 重置所有筛选条件
  Future<void> resetFilters() async {
    await updateFilters(const FileFilters());
  }

  /// 加载目录树
  ///
  /// **Validates: Requirements 2.6**
  Future<void> loadDirectoryTree() async {
    try {
      final directories = await _repository.getDirectoryTree();
      state = state.copyWith(directoryTree: directories);
    } catch (e) {
      // 目录树加载失败不影响主要功能
    }
  }

  /// 加载标签列表
  ///
  /// **Validates: Requirements 2.7**
  Future<void> loadTags() async {
    try {
      final tags = await _repository.getTags();
      state = state.copyWith(tags: tags);
    } catch (e) {
      // 标签加载失败不影响主要功能
    }
  }

  /// 初始化数据
  ///
  /// 加载文件列表、目录树和标签
  Future<void> initialize() async {
    await Future.wait([
      loadFiles(refresh: true),
      loadDirectoryTree(),
      loadTags(),
    ]);
  }

  /// 刷新数据
  ///
  /// 重新加载所有数据
  Future<void> refresh() async {
    await Future.wait([
      loadFiles(refresh: true),
      loadDirectoryTree(),
      loadTags(),
    ]);
  }

  /// 从列表中移除文件
  ///
  /// 用于删除文件后更新列表
  void removeFile(int fileId) {
    final newFiles = state.files.where((f) => f.id != fileId).toList();
    state = state.copyWith(files: newFiles);
  }

  /// 更新列表中的文件
  ///
  /// 用于编辑文件后更新列表
  void updateFile(FileModel file) {
    final newFiles = state.files.map((f) {
      if (f.id == file.id) return file;
      return f;
    }).toList();
    state = state.copyWith(files: newFiles);
  }

  /// 获取错误消息
  String _getErrorMessage(dynamic e) {
    if (e is Exception) {
      return e.toString().replaceFirst('Exception: ', '');
    }
    return '加载失败，请稍后重试';
  }
}

/// 文件总数 Provider
///
/// 便捷 Provider，用于获取当前筛选条件下的文件总数
///
/// **Validates: Requirements 2.11**
@riverpod
int fileCount(Ref ref) {
  final filesState = ref.watch(filesNotifierProvider);
  return filesState.pagination?.total ?? 0;
}

/// 当前媒体类型 Provider
///
/// 便捷 Provider，用于获取当前媒体类型筛选
@riverpod
String currentMediaType(Ref ref) {
  final filesState = ref.watch(filesNotifierProvider);
  return filesState.filters.mediaType;
}

/// 当前目录 Provider
///
/// 便捷 Provider，用于获取当前目录筛选
@riverpod
String? currentDirectory(Ref ref) {
  final filesState = ref.watch(filesNotifierProvider);
  return filesState.filters.directory;
}

/// 当前标签 Provider
///
/// 便捷 Provider，用于获取当前标签筛选
@riverpod
List<String> currentTags(Ref ref) {
  final filesState = ref.watch(filesNotifierProvider);
  return filesState.filters.tags;
}

/// 是否有筛选条件 Provider
///
/// 便捷 Provider，用于判断是否有任何筛选条件
@riverpod
bool hasFilters(Ref ref) {
  final filesState = ref.watch(filesNotifierProvider);
  final filters = filesState.filters;
  return filters.directory != null ||
      filters.mediaType != 'all' ||
      filters.tags.isNotEmpty ||
      filters.search != null;
}
