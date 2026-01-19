import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../auth/data/models/user_model.dart';

part 'profile_repository.g.dart';

/// 头像上传 URL 响应
class AvatarUploadUrlResponse {
  final String uploadUrl;
  final String avatarKey;

  AvatarUploadUrlResponse({
    required this.uploadUrl,
    required this.avatarKey,
  });

  factory AvatarUploadUrlResponse.fromJson(Map<String, dynamic> json) {
    return AvatarUploadUrlResponse(
      uploadUrl: json['upload_url'] as String,
      avatarKey: json['avatar_key'] as String,
    );
  }
}

/// 个人中心 Repository
///
/// 负责处理个人中心相关的 API 调用，包括：
/// - 头像上传
/// - 用户信息更新
///
/// **Validates: Requirements 9.5**
class ProfileRepository {
  final ApiClient _apiClient;
  final SecureStorage _storage;
  final Dio _s3Dio;

  ProfileRepository({
    required ApiClient apiClient,
    required SecureStorage storage,
  })  : _apiClient = apiClient,
        _storage = storage,
        _s3Dio = Dio(
          BaseOptions(
            connectTimeout: const Duration(minutes: 2),
            receiveTimeout: const Duration(minutes: 2),
            sendTimeout: const Duration(minutes: 5),
          ),
        );

  /// 获取头像上传预签名 URL
  ///
  /// [contentType] - 图片内容类型 (image/jpeg, image/png)
  Future<AvatarUploadUrlResponse> getAvatarUploadUrl(String contentType) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.avatarUploadUrl,
      data: {'content_type': contentType},
    );

    return AvatarUploadUrlResponse.fromJson(response.data!);
  }

  /// 上传头像到 S3
  ///
  /// [localPath] - 本地文件路径
  /// [uploadUrl] - 预签名上传 URL
  /// [contentType] - 内容类型
  /// [onProgress] - 进度回调
  Future<void> uploadAvatarToS3({
    required String localPath,
    required String uploadUrl,
    required String contentType,
    void Function(double progress)? onProgress,
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
    );
  }

  /// 确认头像上传
  ///
  /// [avatarKey] - S3 中的头像 key
  Future<User> confirmAvatarUpload(String avatarKey) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.avatarConfirm,
      data: {'avatar_key': avatarKey},
    );

    final user = User.fromJson(response.data!['user'] as Map<String, dynamic>);
    
    // 更新本地存储的用户信息
    await _storage.saveUserInfo(user.toJson());
    
    return user;
  }

  /// 完整的头像上传流程
  ///
  /// 1. 获取预签名 URL
  /// 2. 上传到 S3
  /// 3. 确认上传
  ///
  /// [localPath] - 本地文件路径
  /// [contentType] - 内容类型
  /// [onProgress] - 进度回调
  ///
  /// **Validates: Requirements 9.5**
  Future<User> uploadAvatar({
    required String localPath,
    required String contentType,
    void Function(double progress)? onProgress,
  }) async {
    // 1. 获取预签名 URL
    final urlResponse = await getAvatarUploadUrl(contentType);

    // 2. 上传到 S3
    await uploadAvatarToS3(
      localPath: localPath,
      uploadUrl: urlResponse.uploadUrl,
      contentType: contentType,
      onProgress: onProgress,
    );

    // 3. 确认上传
    return await confirmAvatarUpload(urlResponse.avatarKey);
  }

  /// 删除头像
  ///
  /// **Validates: Requirements 9.5**
  Future<User> deleteAvatar() async {
    final response = await _apiClient.delete<Map<String, dynamic>>(
      ApiConstants.avatarDelete,
    );

    final user = User.fromJson(response.data!['user'] as Map<String, dynamic>);
    
    // 更新本地存储的用户信息
    await _storage.saveUserInfo(user.toJson());
    
    return user;
  }

  /// 获取头像签名 URL
  Future<String?> getAvatarSignedUrl() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        ApiConstants.avatarSignedUrl,
      );
      return response.data!['signed_url'] as String?;
    } catch (e) {
      return null;
    }
  }
}

/// ProfileRepository Provider
@Riverpod(keepAlive: true)
ProfileRepository profileRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  final storage = ref.watch(secureStorageProvider);
  return ProfileRepository(
    apiClient: apiClient,
    storage: storage,
  );
}
