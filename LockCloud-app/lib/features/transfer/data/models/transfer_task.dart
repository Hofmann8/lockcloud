import 'package:freezed_annotation/freezed_annotation.dart';

part 'transfer_task.freezed.dart';
part 'transfer_task.g.dart';

/// 传输类型
enum TransferType { upload, download }

/// 传输状态
enum TransferStatus { pending, processing, completed, failed, paused }

/// 传输文件项基类
@freezed
sealed class TransferFileItem with _$TransferFileItem {
  const TransferFileItem._();

  /// 上传文件项
  const factory TransferFileItem.upload({
    required String id,
    required String localPath,
    required String filename,
    String? customFilename,
    required int totalBytes,
    @Default(0) int transferredBytes,
    @Default(0.0) double progress,
    @Default(TransferStatus.pending) TransferStatus status,
    String? error,
    String? s3Key,
  }) = UploadFileItem;

  /// 下载文件项
  const factory TransferFileItem.download({
    required String id,
    required int fileId,
    required String filename,
    required int totalBytes,
    @Default(0) int transferredBytes,
    @Default(0.0) double progress,
    @Default(TransferStatus.pending) TransferStatus status,
    String? error,
    String? localPath,
    String? contentType,
  }) = DownloadFileItem;

  factory TransferFileItem.fromJson(Map<String, dynamic> json) =>
      _$TransferFileItemFromJson(json);

  String get displayFilename => map(
        upload: (u) => u.customFilename ?? u.filename,
        download: (d) => d.filename,
      );

  String get formattedSize {
    double size = totalBytes.toDouble();
    const units = ['B', 'KB', 'MB', 'GB'];
    int unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return '${size.toStringAsFixed(1)} ${units[unitIndex]}';
  }

  String get progressPercent => '${(progress * 100).toStringAsFixed(0)}%';
}

/// 传输任务
@freezed
sealed class TransferTask with _$TransferTask {
  const TransferTask._();

  /// 上传任务
  const factory TransferTask.upload({
    required String id,
    required List<UploadFileItem> files,
    required String activityDate,
    required String activityType,
    String? activityName,
    @Default(TransferStatus.pending) TransferStatus status,
    required DateTime createdAt,
    DateTime? completedAt,
    String? error,
  }) = UploadTask;

  /// 下载任务
  const factory TransferTask.download({
    required String id,
    required List<DownloadFileItem> files,
    @Default(TransferStatus.pending) TransferStatus status,
    required DateTime createdAt,
    DateTime? completedAt,
    String? error,
  }) = DownloadTask;

  factory TransferTask.fromJson(Map<String, dynamic> json) =>
      _$TransferTaskFromJson(json);

  TransferType get type => map(upload: (_) => TransferType.upload, download: (_) => TransferType.download);

  List<TransferFileItem> get fileItems => map(
        upload: (u) => u.files,
        download: (d) => d.files,
      );

  int get completedCount => fileItems.where((f) => f.status == TransferStatus.completed).length;
  int get totalCount => fileItems.length;

  double get overallProgress {
    if (fileItems.isEmpty) return 0.0;
    return fileItems.fold(0.0, (sum, f) => sum + f.progress) / fileItems.length;
  }

  bool get isActive => status == TransferStatus.processing || status == TransferStatus.pending;
}

/// 创建上传任务请求
@freezed
sealed class CreateUploadTaskRequest with _$CreateUploadTaskRequest {
  const factory CreateUploadTaskRequest({
    required List<UploadFileInfo> files,
    required String activityDate,
    required String activityType,
    String? activityName,
  }) = _CreateUploadTaskRequest;

  factory CreateUploadTaskRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateUploadTaskRequestFromJson(json);
}

/// 上传文件信息
@freezed
sealed class UploadFileInfo with _$UploadFileInfo {
  const factory UploadFileInfo({
    required String localPath,
    required String filename,
    required int size,
    required String contentType,
    String? customFilename,
  }) = _UploadFileInfo;

  factory UploadFileInfo.fromJson(Map<String, dynamic> json) =>
      _$UploadFileInfoFromJson(json);
}

/// 创建下载任务请求
@freezed
sealed class CreateDownloadTaskRequest with _$CreateDownloadTaskRequest {
  const factory CreateDownloadTaskRequest({
    required List<DownloadFileInfo> files,
  }) = _CreateDownloadTaskRequest;

  factory CreateDownloadTaskRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateDownloadTaskRequestFromJson(json);
}

/// 下载文件信息
@freezed
sealed class DownloadFileInfo with _$DownloadFileInfo {
  const factory DownloadFileInfo({
    required int fileId,
    required String filename,
    required int size,
    String? contentType,
  }) = _DownloadFileInfo;

  factory DownloadFileInfo.fromJson(Map<String, dynamic> json) =>
      _$DownloadFileInfoFromJson(json);
}
