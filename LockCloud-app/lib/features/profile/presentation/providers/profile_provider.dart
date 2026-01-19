import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/errors/api_error.dart';
import '../../../auth/data/models/user_model.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/repositories/profile_repository.dart';

part 'profile_provider.freezed.dart';
part 'profile_provider.g.dart';

/// 头像上传状态
@freezed
sealed class AvatarUploadState with _$AvatarUploadState {
  /// 初始状态
  const factory AvatarUploadState.initial() = AvatarUploadStateInitial;

  /// 上传中状态
  const factory AvatarUploadState.uploading({
    @Default(0.0) double progress,
  }) = AvatarUploadStateUploading;

  /// 上传成功状态
  const factory AvatarUploadState.success({
    required User user,
  }) = AvatarUploadStateSuccess;

  /// 上传失败状态
  const factory AvatarUploadState.error({
    required String message,
  }) = AvatarUploadStateError;
}

/// 头像上传状态管理器
///
/// 管理头像上传的状态和进度
///
/// **Validates: Requirements 9.5**
@riverpod
class AvatarUploadNotifier extends _$AvatarUploadNotifier {
  @override
  AvatarUploadState build() => const AvatarUploadState.initial();

  /// 获取 ProfileRepository 实例
  ProfileRepository get _repository => ref.read(profileRepositoryProvider);

  /// 上传头像
  ///
  /// [localPath] - 本地文件路径
  /// [contentType] - 内容类型 (image/jpeg, image/png)
  ///
  /// **Validates: Requirements 9.5**
  Future<bool> uploadAvatar({
    required String localPath,
    required String contentType,
  }) async {
    state = const AvatarUploadState.uploading(progress: 0.0);

    try {
      final user = await _repository.uploadAvatar(
        localPath: localPath,
        contentType: contentType,
        onProgress: (progress) {
          state = AvatarUploadState.uploading(progress: progress);
        },
      );

      state = AvatarUploadState.success(user: user);

      // 更新 AuthNotifier 中的用户信息
      ref.read(authNotifierProvider.notifier).updateUser(user);

      return true;
    } on ApiError catch (e) {
      state = AvatarUploadState.error(message: e.message);
      return false;
    } on DioException catch (e) {
      state = AvatarUploadState.error(message: _getDioErrorMessage(e));
      return false;
    } catch (e) {
      state = AvatarUploadState.error(message: '上传失败: ${e.toString()}');
      return false;
    }
  }

  /// 重置状态
  void reset() {
    state = const AvatarUploadState.initial();
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
        return '服务器错误';
      default:
        return '上传失败';
    }
  }
}
