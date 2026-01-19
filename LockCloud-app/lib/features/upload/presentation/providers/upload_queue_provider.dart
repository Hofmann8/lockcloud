import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import '../../data/models/upload_queue_item.dart';
import '../../data/repositories/upload_repository.dart';

part 'upload_queue_provider.freezed.dart';
part 'upload_queue_provider.g.dart';

/// 上传队列状态
///
/// 管理上传队列的所有状态，包括：
/// - 队列项列表
/// - 是否正在处理队列
/// - 当前上传项 ID
///
/// **Validates: Requirements 3.5, 3.7, 3.8, 3.9**
@freezed
sealed class UploadQueueState with _$UploadQueueState {
  const factory UploadQueueState({
    /// 上传队列项列表
    @Default([]) List<UploadQueueItem> items,

    /// 是否正在处理队列
    @Default(false) bool isProcessing,

    /// 当前正在上传的项 ID
    String? currentUploadId,

    /// 全局错误信息
    String? error,
  }) = _UploadQueueState;
}

/// 上传队列状态管理器
///
/// 使用 Riverpod 管理上传队列状态，提供以下功能：
/// - 添加上传项
/// - 移除上传项
/// - 重试失败的上传
/// - 清除已完成的上传
/// - 处理上传队列
///
/// **Validates: Requirements 3.5, 3.7, 3.8, 3.9**
@Riverpod(keepAlive: true)
class UploadQueueNotifier extends _$UploadQueueNotifier {
  static const _uuid = Uuid();

  @override
  UploadQueueState build() {
    return const UploadQueueState();
  }

  /// 获取 UploadRepository 实例
  UploadRepository get _repository => ref.read(uploadRepositoryProvider);

  /// 添加上传项到队列
  ///
  /// [localPath] - 本地文件路径
  /// [originalFilename] - 原始文件名
  /// [size] - 文件大小（字节）
  /// [contentType] - 内容类型
  /// [metadata] - 上传元数据
  ///
  /// **Validates: Requirements 3.5**
  void addItem({
    required String localPath,
    required String originalFilename,
    required int size,
    required String contentType,
    required UploadMetadata metadata,
  }) {
    final item = UploadQueueItem(
      id: _uuid.v4(),
      localPath: localPath,
      originalFilename: originalFilename,
      size: size,
      contentType: contentType,
      metadata: metadata,
      createdAt: DateTime.now(),
    );

    state = state.copyWith(
      items: [...state.items, item],
    );

    // 自动开始处理队列
    if (!state.isProcessing) {
      processQueue();
    }
  }

  /// 批量添加上传项
  ///
  /// [files] - 文件信息列表
  /// [metadata] - 共享的上传元数据
  void addItems({
    required List<FileInfo> files,
    required UploadMetadata metadata,
  }) {
    final newItems = files.map((file) {
      return UploadQueueItem(
        id: _uuid.v4(),
        localPath: file.path,
        originalFilename: file.name,
        size: file.size,
        contentType: file.mimeType,
        metadata: metadata,
        createdAt: DateTime.now(),
      );
    }).toList();

    state = state.copyWith(
      items: [...state.items, ...newItems],
    );

    // 自动开始处理队列
    if (!state.isProcessing) {
      processQueue();
    }
  }

  /// 移除上传项
  ///
  /// [id] - 上传项 ID
  void removeItem(String id) {
    state = state.copyWith(
      items: state.items.where((item) => item.id != id).toList(),
    );
  }

  /// 重试失败的上传
  ///
  /// [id] - 上传项 ID
  ///
  /// **Validates: Requirements 3.8**
  Future<void> retryItem(String id) async {
    final index = state.items.indexWhere((item) => item.id == id);
    if (index == -1) return;

    final item = state.items[index];
    if (!item.canRetry) return;

    // 重置状态为 pending
    final updatedItem = item.copyWith(
      status: UploadStatus.pending,
      progress: 0.0,
      errorMessage: null,
      retryCount: item.retryCount + 1,
    );

    final newItems = [...state.items];
    newItems[index] = updatedItem;
    state = state.copyWith(items: newItems);

    // 如果队列没有在处理，开始处理
    if (!state.isProcessing) {
      processQueue();
    }
  }

  /// 清除已完成的上传
  ///
  /// **Validates: Requirements 3.9**
  void clearCompleted() {
    state = state.copyWith(
      items: state.items
          .where((item) => item.status != UploadStatus.success)
          .toList(),
    );
  }

  /// 清除所有上传项
  void clearAll() {
    state = state.copyWith(
      items: [],
      isProcessing: false,
      currentUploadId: null,
    );
  }

  /// 取消上传
  ///
  /// [id] - 上传项 ID
  void cancelItem(String id) {
    final index = state.items.indexWhere((item) => item.id == id);
    if (index == -1) return;

    final item = state.items[index];
    if (item.status != UploadStatus.pending &&
        item.status != UploadStatus.uploading) {
      return;
    }

    final updatedItem = item.copyWith(
      status: UploadStatus.cancelled,
    );

    final newItems = [...state.items];
    newItems[index] = updatedItem;
    state = state.copyWith(items: newItems);
  }

  /// 处理上传队列
  ///
  /// 依次处理队列中的待上传项
  ///
  /// **Validates: Requirements 3.6, 3.7**
  Future<void> processQueue() async {
    if (state.isProcessing) return;

    state = state.copyWith(isProcessing: true);

    while (true) {
      // 查找下一个待上传的项
      final pendingIndex = state.items.indexWhere(
        (item) => item.status == UploadStatus.pending,
      );

      if (pendingIndex == -1) {
        // 没有待上传的项了
        break;
      }

      final item = state.items[pendingIndex];
      await _uploadItem(item);
    }

    state = state.copyWith(
      isProcessing: false,
      currentUploadId: null,
    );
  }

  /// 上传单个文件
  ///
  /// 执行完整的上传流程：
  /// 1. 获取预签名 URL
  /// 2. 直传 S3
  /// 3. 确认上传
  ///
  /// **Validates: Requirements 3.6, 3.7**
  Future<void> _uploadItem(UploadQueueItem item) async {
    // 更新状态为上传中
    _updateItemStatus(item.id, UploadStatus.uploading);
    state = state.copyWith(currentUploadId: item.id);

    try {
      // 1. 获取预签名 URL
      final presignRequest = UploadUrlRequest(
        originalFilename: item.originalFilename,
        contentType: item.contentType,
        size: item.size,
        activityDate: item.metadata.activityDate,
        activityType: item.metadata.activityType,
        activityName: item.metadata.activityName,
        customFilename: item.metadata.customFilename,
      );

      final presignResponse = await _repository.getPresignedUrl(presignRequest);

      // 更新生成的文件名和 S3 Key
      _updateItemWithPresignInfo(
        item.id,
        s3Key: presignResponse.s3Key,
        generatedFilename: presignResponse.generatedFilename,
      );

      // 2. 直传 S3
      await _uploadToS3(
        item.id,
        item.localPath,
        presignResponse.uploadUrl,
        item.contentType,
      );

      // 3. 确认上传
      final confirmRequest = FileConfirmRequest(
        s3Key: presignResponse.s3Key,
        size: item.size,
        contentType: item.contentType,
        originalFilename: item.originalFilename,
        activityDate: item.metadata.activityDate,
        activityType: item.metadata.activityType,
        activityName: item.metadata.activityName,
      );

      await _repository.confirmUpload(confirmRequest);

      // 上传成功
      _updateItemStatus(item.id, UploadStatus.success, progress: 1.0);
    } catch (e) {
      // 上传失败
      _updateItemStatus(
        item.id,
        UploadStatus.failed,
        errorMessage: _getErrorMessage(e),
      );
    }
  }

  /// 上传文件到 S3
  ///
  /// 使用预签名 URL 直接上传文件到 S3
  ///
  /// **Validates: Requirements 3.7**
  Future<void> _uploadToS3(
    String itemId,
    String localPath,
    String uploadUrl,
    String contentType,
  ) async {
    final file = File(localPath);
    final fileBytes = await file.readAsBytes();

    final dio = Dio();

    await dio.put(
      uploadUrl,
      data: Stream.fromIterable([fileBytes]),
      options: Options(
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileBytes.length,
        },
      ),
      onSendProgress: (sent, total) {
        final progress = total > 0 ? sent / total : 0.0;
        _updateItemProgress(itemId, progress);
      },
    );
  }

  /// 更新上传项状态
  void _updateItemStatus(
    String id,
    UploadStatus status, {
    double? progress,
    String? errorMessage,
  }) {
    final index = state.items.indexWhere((item) => item.id == id);
    if (index == -1) return;

    final item = state.items[index];
    final updatedItem = item.copyWith(
      status: status,
      progress: progress ?? item.progress,
      errorMessage: errorMessage,
    );

    final newItems = [...state.items];
    newItems[index] = updatedItem;
    state = state.copyWith(items: newItems);
  }

  /// 更新上传项进度
  ///
  /// **Validates: Requirements 3.7**
  void _updateItemProgress(String id, double progress) {
    final index = state.items.indexWhere((item) => item.id == id);
    if (index == -1) return;

    final item = state.items[index];
    final updatedItem = item.copyWith(progress: progress);

    final newItems = [...state.items];
    newItems[index] = updatedItem;
    state = state.copyWith(items: newItems);
  }

  /// 更新上传项的预签名信息
  void _updateItemWithPresignInfo(
    String id, {
    required String s3Key,
    required String generatedFilename,
  }) {
    final index = state.items.indexWhere((item) => item.id == id);
    if (index == -1) return;

    final item = state.items[index];
    final updatedItem = item.copyWith(
      s3Key: s3Key,
      generatedFilename: generatedFilename,
    );

    final newItems = [...state.items];
    newItems[index] = updatedItem;
    state = state.copyWith(items: newItems);
  }

  /// 获取错误消息
  String _getErrorMessage(dynamic e) {
    if (e is DioException) {
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return '上传超时，请检查网络连接';
        case DioExceptionType.connectionError:
          return '网络连接失败';
        case DioExceptionType.badResponse:
          final response = e.response;
          if (response?.data is Map) {
            final error = response!.data['error'];
            if (error is Map) {
              return error['message'] ?? '上传失败';
            }
          }
          return '服务器错误';
        default:
          return '上传失败';
      }
    }
    if (e is Exception) {
      return e.toString().replaceFirst('Exception: ', '');
    }
    return '上传失败';
  }
}

/// 文件信息（用于批量添加）
class FileInfo {
  final String path;
  final String name;
  final int size;
  final String mimeType;

  const FileInfo({
    required this.path,
    required this.name,
    required this.size,
    required this.mimeType,
  });
}

/// 待上传数量 Provider
@riverpod
int pendingUploadCount(Ref ref) {
  final queueState = ref.watch(uploadQueueNotifierProvider);
  return queueState.items
      .where((item) => item.status == UploadStatus.pending)
      .length;
}

/// 上传中数量 Provider
@riverpod
int uploadingCount(Ref ref) {
  final queueState = ref.watch(uploadQueueNotifierProvider);
  return queueState.items
      .where((item) => item.status == UploadStatus.uploading)
      .length;
}

/// 已完成数量 Provider
@riverpod
int completedUploadCount(Ref ref) {
  final queueState = ref.watch(uploadQueueNotifierProvider);
  return queueState.items
      .where((item) => item.status == UploadStatus.success)
      .length;
}

/// 失败数量 Provider
@riverpod
int failedUploadCount(Ref ref) {
  final queueState = ref.watch(uploadQueueNotifierProvider);
  return queueState.items
      .where((item) => item.status == UploadStatus.failed)
      .length;
}

/// 是否有上传任务 Provider
@riverpod
bool hasUploadTasks(Ref ref) {
  final queueState = ref.watch(uploadQueueNotifierProvider);
  return queueState.items.isNotEmpty;
}

/// 总上传进度 Provider
@riverpod
double totalUploadProgress(Ref ref) {
  final queueState = ref.watch(uploadQueueNotifierProvider);
  if (queueState.items.isEmpty) return 0.0;

  final totalProgress = queueState.items.fold<double>(
    0.0,
    (sum, item) => sum + item.progress,
  );

  return totalProgress / queueState.items.length;
}
