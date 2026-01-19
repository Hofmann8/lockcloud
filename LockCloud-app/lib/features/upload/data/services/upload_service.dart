import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../models/upload_queue_item.dart';
import '../repositories/upload_repository.dart';

part 'upload_service.g.dart';

/// 上传进度回调
typedef UploadProgressCallback = void Function(double progress);

/// 上传完成回调
typedef UploadCompleteCallback = void Function(Map<String, dynamic> fileData);

/// 上传错误回调
typedef UploadErrorCallback = void Function(String error);

/// 上传服务
///
/// 实现完整的上传流程：
/// 1. 获取预签名 URL
/// 2. 直传 S3
/// 3. 确认上传
///
/// **Validates: Requirements 3.6, 3.7**
class UploadService {
  final UploadRepository _repository;
  final Dio _s3Dio;

  UploadService({
    required UploadRepository repository,
  })  : _repository = repository,
        _s3Dio = Dio(
          BaseOptions(
            connectTimeout: const Duration(minutes: 5),
            receiveTimeout: const Duration(minutes: 5),
            sendTimeout: const Duration(minutes: 10),
          ),
        );

  /// 上传单个文件
  ///
  /// 执行完整的上传流程：预签名 URL → S3 直传 → 确认上传
  ///
  /// [localPath] - 本地文件路径
  /// [originalFilename] - 原始文件名
  /// [contentType] - 内容类型
  /// [size] - 文件大小
  /// [metadata] - 上传元数据
  /// [onProgress] - 进度回调
  /// [onComplete] - 完成回调
  /// [onError] - 错误回调
  /// [cancelToken] - 取消令牌
  ///
  /// **Validates: Requirements 3.6, 3.7**
  Future<UploadResult> uploadFile({
    required String localPath,
    required String originalFilename,
    required String contentType,
    required int size,
    required UploadMetadata metadata,
    UploadProgressCallback? onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      // 1. 获取预签名 URL
      final presignRequest = UploadUrlRequest(
        originalFilename: originalFilename,
        contentType: contentType,
        size: size,
        activityDate: metadata.activityDate,
        activityType: metadata.activityType,
        activityName: metadata.activityName,
        customFilename: metadata.customFilename,
      );

      final presignResponse = await _repository.getPresignedUrl(presignRequest);

      // 2. 直传 S3
      await _uploadToS3(
        localPath: localPath,
        uploadUrl: presignResponse.uploadUrl,
        contentType: contentType,
        onProgress: onProgress,
        cancelToken: cancelToken,
      );

      // 3. 确认上传
      final confirmRequest = FileConfirmRequest(
        s3Key: presignResponse.s3Key,
        size: size,
        contentType: contentType,
        originalFilename: originalFilename,
        activityDate: metadata.activityDate,
        activityType: metadata.activityType,
        activityName: metadata.activityName,
      );

      final fileData = await _repository.confirmUpload(confirmRequest);

      return UploadResult.success(
        s3Key: presignResponse.s3Key,
        generatedFilename: presignResponse.generatedFilename,
        fileData: fileData,
      );
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel) {
        return const UploadResult.cancelled();
      }
      return UploadResult.error(_getDioErrorMessage(e));
    } catch (e) {
      return UploadResult.error(e.toString());
    }
  }

  /// 上传文件到 S3
  ///
  /// 使用预签名 URL 直接上传文件到 S3
  ///
  /// **Validates: Requirements 3.7**
  Future<void> _uploadToS3({
    required String localPath,
    required String uploadUrl,
    required String contentType,
    UploadProgressCallback? onProgress,
    CancelToken? cancelToken,
  }) async {
    final file = File(localPath);
    final fileBytes = await file.readAsBytes();

    await _s3Dio.put(
      uploadUrl,
      data: Stream.fromIterable([fileBytes]),
      options: Options(
        headers: {
          'Content-Type': contentType,
          'Content-Length': fileBytes.length,
        },
      ),
      onSendProgress: (sent, total) {
        if (total > 0 && onProgress != null) {
          onProgress(sent / total);
        }
      },
      cancelToken: cancelToken,
    );
  }

  /// 批量上传文件
  ///
  /// 依次上传多个文件
  ///
  /// [files] - 文件信息列表
  /// [metadata] - 共享的上传元数据
  /// [onFileProgress] - 单个文件进度回调
  /// [onFileComplete] - 单个文件完成回调
  /// [onFileError] - 单个文件错误回调
  /// [onTotalProgress] - 总进度回调
  Future<BatchUploadResult> uploadFiles({
    required List<UploadFileInfo> files,
    required UploadMetadata metadata,
    void Function(int index, double progress)? onFileProgress,
    void Function(int index, UploadResult result)? onFileComplete,
    void Function(int totalCompleted, int totalFiles)? onTotalProgress,
  }) async {
    final results = <UploadResult>[];
    int successCount = 0;
    int failedCount = 0;

    for (int i = 0; i < files.length; i++) {
      final file = files[i];

      final result = await uploadFile(
        localPath: file.localPath,
        originalFilename: file.originalFilename,
        contentType: file.contentType,
        size: file.size,
        metadata: metadata,
        onProgress: (progress) {
          onFileProgress?.call(i, progress);
        },
      );

      results.add(result);

      if (result.isSuccess) {
        successCount++;
      } else if (result.isError) {
        failedCount++;
      }

      onFileComplete?.call(i, result);
      onTotalProgress?.call(i + 1, files.length);
    }

    return BatchUploadResult(
      results: results,
      successCount: successCount,
      failedCount: failedCount,
    );
  }

  /// 获取 Dio 错误消息
  String _getDioErrorMessage(DioException e) {
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
        final statusCode = response?.statusCode;
        if (statusCode != null) {
          return '服务器错误 ($statusCode)';
        }
        return '服务器错误';
      case DioExceptionType.cancel:
        return '上传已取消';
      default:
        return '上传失败';
    }
  }
}

/// 上传文件信息
class UploadFileInfo {
  final String localPath;
  final String originalFilename;
  final String contentType;
  final int size;

  const UploadFileInfo({
    required this.localPath,
    required this.originalFilename,
    required this.contentType,
    required this.size,
  });
}

/// 上传结果
sealed class UploadResult {
  const UploadResult();

  const factory UploadResult.success({
    required String s3Key,
    required String generatedFilename,
    required Map<String, dynamic> fileData,
  }) = UploadResultSuccess;

  const factory UploadResult.error(String message) = UploadResultError;

  const factory UploadResult.cancelled() = UploadResultCancelled;

  bool get isSuccess => this is UploadResultSuccess;
  bool get isError => this is UploadResultError;
  bool get isCancelled => this is UploadResultCancelled;
}

/// 上传成功结果
class UploadResultSuccess extends UploadResult {
  final String s3Key;
  final String generatedFilename;
  final Map<String, dynamic> fileData;

  const UploadResultSuccess({
    required this.s3Key,
    required this.generatedFilename,
    required this.fileData,
  });
}

/// 上传错误结果
class UploadResultError extends UploadResult {
  final String message;

  const UploadResultError(this.message);
}

/// 上传取消结果
class UploadResultCancelled extends UploadResult {
  const UploadResultCancelled();
}

/// 批量上传结果
class BatchUploadResult {
  final List<UploadResult> results;
  final int successCount;
  final int failedCount;

  const BatchUploadResult({
    required this.results,
    required this.successCount,
    required this.failedCount,
  });

  bool get allSuccess => failedCount == 0;
  bool get allFailed => successCount == 0;
  bool get partialSuccess => successCount > 0 && failedCount > 0;
}

/// UploadService Provider
@Riverpod(keepAlive: true)
UploadService uploadService(Ref ref) {
  final repository = ref.watch(uploadRepositoryProvider);
  return UploadService(repository: repository);
}
