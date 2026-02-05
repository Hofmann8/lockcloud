import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import '../../../files/data/services/signed_url_service.dart';
import '../../../upload/data/models/upload_queue_item.dart';
import '../../../upload/data/repositories/upload_repository.dart';
import '../../data/models/transfer_task.dart';

part 'transfer_queue_provider.g.dart';

/// 传输队列状态
class TransferQueueState {
  final List<TransferTask> tasks;
  final bool isProcessing;
  final Set<String> pausedTasks;

  const TransferQueueState({
    this.tasks = const [],
    this.isProcessing = false,
    this.pausedTasks = const {},
  });

  TransferQueueState copyWith({
    List<TransferTask>? tasks,
    bool? isProcessing,
    Set<String>? pausedTasks,
  }) {
    return TransferQueueState(
      tasks: tasks ?? this.tasks,
      isProcessing: isProcessing ?? this.isProcessing,
      pausedTasks: pausedTasks ?? this.pausedTasks,
    );
  }
}

/// 传输队列管理器
@Riverpod(keepAlive: true)
class TransferQueueNotifier extends _$TransferQueueNotifier {
  static const _uuid = Uuid();
  final Map<String, CancelToken> _cancelTokens = {};

  @override
  TransferQueueState build() => const TransferQueueState();

  /// 添加上传任务
  String addUploadTask(CreateUploadTaskRequest request) {
    final taskId = _uuid.v4();
    final files = request.files.map((f) => UploadFileItem(
      id: _uuid.v4(),
      localPath: f.localPath,
      filename: f.filename,
      customFilename: f.customFilename,
      totalBytes: f.size,
    )).toList();

    final task = UploadTask(
      id: taskId,
      files: files,
      activityDate: request.activityDate,
      activityType: request.activityType,
      activityName: request.activityName,
      createdAt: DateTime.now(),
    );

    state = state.copyWith(tasks: [...state.tasks, task]);
    if (!state.isProcessing) _startProcessing();
    return taskId;
  }

  /// 添加下载任务
  String addDownloadTask(CreateDownloadTaskRequest request) {
    final taskId = _uuid.v4();
    final files = request.files.map((f) => DownloadFileItem(
      id: _uuid.v4(),
      fileId: f.fileId,
      filename: f.filename,
      totalBytes: f.size,
      contentType: f.contentType,
    )).toList();

    final task = DownloadTask(
      id: taskId,
      files: files,
      createdAt: DateTime.now(),
    );

    state = state.copyWith(tasks: [...state.tasks, task]);
    if (!state.isProcessing) _startProcessing();
    return taskId;
  }

  /// 移除任务
  void removeTask(String taskId) {
    _cancelTokens[taskId]?.cancel();
    _cancelTokens.remove(taskId);
    state = state.copyWith(
      tasks: state.tasks.where((t) => t.id != taskId).toList(),
      pausedTasks: Set.from(state.pausedTasks)..remove(taskId),
    );
  }

  /// 取消任务
  void cancelTask(String taskId) {
    _cancelTokens[taskId]?.cancel();
    _cancelTokens.remove(taskId);
    _updateTaskStatus(taskId, TransferStatus.failed, error: '已取消');
  }

  /// 暂停任务
  void pauseTask(String taskId) {
    _cancelTokens[taskId]?.cancel();
    _cancelTokens.remove(taskId);
    state = state.copyWith(
      pausedTasks: Set.from(state.pausedTasks)..add(taskId),
    );
    _updateTaskStatus(taskId, TransferStatus.pending);
  }

  /// 恢复任务
  void resumeTask(String taskId) {
    state = state.copyWith(
      pausedTasks: Set.from(state.pausedTasks)..remove(taskId),
    );
    if (!state.isProcessing) _startProcessing();
  }

  /// 清除已完成
  void clearCompleted() {
    state = state.copyWith(
      tasks: state.tasks.where((t) => t.status != TransferStatus.completed).toList(),
    );
  }

  /// 开始处理队列
  Future<void> _startProcessing() async {
    if (state.isProcessing) return;
    state = state.copyWith(isProcessing: true);

    while (true) {
      final nextTask = state.tasks.firstWhere(
        (t) => t.status == TransferStatus.pending && !state.pausedTasks.contains(t.id),
        orElse: () => DownloadTask(id: '', files: [], createdAt: DateTime.now()),
      );
      if (nextTask.id.isEmpty) break;

      final cancelToken = CancelToken();
      _cancelTokens[nextTask.id] = cancelToken;
      _updateTaskStatus(nextTask.id, TransferStatus.processing);

      if (nextTask is UploadTask) {
        await _processUploadTask(nextTask, cancelToken);
      } else if (nextTask is DownloadTask) {
        await _processDownloadTask(nextTask, cancelToken);
      }

      _cancelTokens.remove(nextTask.id);
    }

    state = state.copyWith(isProcessing: false);
  }

  /// 处理上传任务
  Future<void> _processUploadTask(UploadTask task, CancelToken cancelToken) async {
    final repository = ref.read(uploadRepositoryProvider);

    for (final fileItem in task.files) {
      if (fileItem.status != TransferStatus.pending) continue;
      if (cancelToken.isCancelled) return;

      _updateFileStatus(task.id, fileItem.id, TransferStatus.processing);

      try {
        // 1. 获取预签名URL
        final presignRequest = UploadUrlRequest(
          originalFilename: fileItem.filename,
          contentType: _getMimeType(fileItem.filename),
          size: fileItem.totalBytes,
          activityDate: task.activityDate,
          activityType: task.activityType,
          activityName: task.activityName,
          customFilename: fileItem.customFilename,
        );
        final presignResponse = await repository.getPresignedUrl(presignRequest);

        if (cancelToken.isCancelled) return;

        // 2. 上传到S3
        final file = File(fileItem.localPath);
        final fileBytes = await file.readAsBytes();
        final dio = Dio();

        await dio.put(
          presignResponse.uploadUrl,
          data: Stream.fromIterable([fileBytes]),
          options: Options(headers: {
            'Content-Type': _getMimeType(fileItem.filename),
            'Content-Length': fileBytes.length,
          }),
          cancelToken: cancelToken,
          onSendProgress: (sent, total) {
            if (total > 0) {
              _updateFileProgress(task.id, fileItem.id, sent / total, sent);
            }
          },
        );

        if (cancelToken.isCancelled) return;

        // 3. 确认上传
        final confirmRequest = FileConfirmRequest(
          s3Key: presignResponse.s3Key,
          size: fileItem.totalBytes,
          contentType: _getMimeType(fileItem.filename),
          originalFilename: fileItem.filename,
          activityDate: task.activityDate,
          activityType: task.activityType,
          activityName: task.activityName,
        );
        await repository.confirmUpload(confirmRequest);

        _updateFileStatus(task.id, fileItem.id, TransferStatus.completed, progress: 1.0, s3Key: presignResponse.s3Key);
      } catch (e) {
        if (cancelToken.isCancelled) return;
        _updateFileStatus(task.id, fileItem.id, TransferStatus.failed, error: _getErrorMessage(e));
      }
    }

    _checkTaskCompletion(task.id);
  }

  /// 处理下载任务
  Future<void> _processDownloadTask(DownloadTask task, CancelToken cancelToken) async {
    final signedUrlService = ref.read(signedUrlServiceProvider);
    final dio = Dio();

    for (final fileItem in task.files) {
      if (fileItem.status != TransferStatus.pending) continue;
      if (cancelToken.isCancelled) return;

      _updateFileStatus(task.id, fileItem.id, TransferStatus.processing);

      try {
        // 1. 获取签名URL
        final signedUrl = await signedUrlService.getSignedUrl(fileItem.fileId, style: StylePreset.original);

        if (cancelToken.isCancelled) return;

        // 2. 下载文件
        final dir = await getApplicationDocumentsDirectory();
        final savePath = '${dir.path}/downloads/${fileItem.filename}';
        await Directory('${dir.path}/downloads').create(recursive: true);

        await dio.download(
          signedUrl,
          savePath,
          cancelToken: cancelToken,
          onReceiveProgress: (received, total) {
            if (total > 0) {
              _updateFileProgress(task.id, fileItem.id, received / total, received);
            }
          },
        );

        _updateFileStatus(task.id, fileItem.id, TransferStatus.completed, progress: 1.0, localPath: savePath);
      } catch (e) {
        if (cancelToken.isCancelled) return;
        _updateFileStatus(task.id, fileItem.id, TransferStatus.failed, error: _getErrorMessage(e));
      }
    }

    _checkTaskCompletion(task.id);
  }

  void _updateTaskStatus(String taskId, TransferStatus status, {String? error}) {
    state = state.copyWith(
      tasks: state.tasks.map((t) {
        if (t.id != taskId) return t;
        return t.map(
          upload: (u) => u.copyWith(status: status, error: error, completedAt: status == TransferStatus.completed || status == TransferStatus.failed ? DateTime.now() : null),
          download: (d) => d.copyWith(status: status, error: error, completedAt: status == TransferStatus.completed || status == TransferStatus.failed ? DateTime.now() : null),
        );
      }).toList(),
    );
  }

  void _updateFileStatus(String taskId, String fileId, TransferStatus status, {double? progress, String? error, String? s3Key, String? localPath}) {
    state = state.copyWith(
      tasks: state.tasks.map((t) {
        if (t.id != taskId) return t;
        return t.map(
          upload: (u) => u.copyWith(
            files: u.files.map((f) => f.id == fileId ? f.copyWith(status: status, progress: progress ?? f.progress, error: error, s3Key: s3Key ?? f.s3Key) : f).toList(),
          ),
          download: (d) => d.copyWith(
            files: d.files.map((f) => f.id == fileId ? f.copyWith(status: status, progress: progress ?? f.progress, error: error, localPath: localPath ?? f.localPath) : f).toList(),
          ),
        );
      }).toList(),
    );
  }

  void _updateFileProgress(String taskId, String fileId, double progress, int transferred) {
    state = state.copyWith(
      tasks: state.tasks.map((t) {
        if (t.id != taskId) return t;
        return t.map(
          upload: (u) => u.copyWith(
            files: u.files.map((f) => f.id == fileId ? f.copyWith(progress: progress, transferredBytes: transferred) : f).toList(),
          ),
          download: (d) => d.copyWith(
            files: d.files.map((f) => f.id == fileId ? f.copyWith(progress: progress, transferredBytes: transferred) : f).toList(),
          ),
        );
      }).toList(),
    );
  }

  void _checkTaskCompletion(String taskId) {
    final task = state.tasks.firstWhere((t) => t.id == taskId);
    final allCompleted = task.fileItems.every((f) => f.status == TransferStatus.completed);
    final anyFailed = task.fileItems.any((f) => f.status == TransferStatus.failed);

    if (allCompleted) {
      _updateTaskStatus(taskId, TransferStatus.completed);
    } else if (anyFailed) {
      _updateTaskStatus(taskId, TransferStatus.failed);
    }
  }

  String _getMimeType(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
      'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
    };
    return mimeTypes[ext] ?? 'application/octet-stream';
  }

  String _getErrorMessage(dynamic e) {
    if (e is DioException) {
      if (e.type == DioExceptionType.cancel) return '已取消';
      if (e.type == DioExceptionType.connectionTimeout) return '连接超时';
      if (e.type == DioExceptionType.connectionError) return '网络错误';
      return '传输失败';
    }
    return e.toString();
  }
}

// 便捷 Providers
@riverpod
int pendingTransferCount(Ref ref) {
  final state = ref.watch(transferQueueNotifierProvider);
  return state.tasks.where((t) => t.status == TransferStatus.pending).length;
}

@riverpod
int processingTransferCount(Ref ref) {
  final state = ref.watch(transferQueueNotifierProvider);
  return state.tasks.where((t) => t.status == TransferStatus.processing).length;
}

@riverpod
bool hasTransferTasks(Ref ref) {
  final state = ref.watch(transferQueueNotifierProvider);
  return state.tasks.isNotEmpty;
}
