import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/file_cache_storage.dart';
import '../../../../core/storage/image_cache_manager.dart';
import '../../../../core/storage/secure_storage.dart';
import '../models/user_model.dart';

part 'auth_repository.g.dart';

/// 认证响应模型
class AuthResponse {
  final String token;
  final String? refreshToken;
  final User user;

  AuthResponse({
    required this.token,
    this.refreshToken,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      token: json['token'] as String,
      refreshToken: json['refresh_token'] as String?,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

/// 认证 Repository
///
/// 负责处理所有认证相关的 API 调用，包括：
/// - SSO 登录验证
/// - 邮箱密码登录
/// - Token 刷新
/// - 获取当前用户信息
/// - 登出
///
/// **Validates: Requirements 1.3, 1.6**
class AuthRepository {
  final ApiClient _apiClient;
  final SecureStorage _storage;
  final FileCacheStorage? _fileCacheStorage;
  final ImageCacheService? _imageCacheService;

  // SSO 服务地址
  static const String _ssoBaseUrl = 'https://auth.funk-and.love';

  AuthRepository({
    required ApiClient apiClient,
    required SecureStorage storage,
    FileCacheStorage? fileCacheStorage,
    ImageCacheService? imageCacheService,
  })  : _apiClient = apiClient,
        _storage = storage,
        _fileCacheStorage = fileCacheStorage,
        _imageCacheService = imageCacheService;

  /// 邮箱密码登录
  ///
  /// 1. 先调用 SSO 服务获取 SSO token
  /// 2. 再用 SSO token 换取 LockCloud token
  ///
  /// **Validates: Requirements 1.1, 1.2**
  Future<AuthResponse> login(String email, String password) async {
    // Step 1: 调用 SSO 登录获取 SSO token
    final ssoDio = Dio(BaseOptions(
      baseUrl: _ssoBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
    ));

    final ssoResponse = await ssoDio.post<Map<String, dynamic>>(
      '/api/auth/login',
      data: {
        'email': email,
        'password': password,
      },
    );

    final ssoData = ssoResponse.data!;
    if (ssoData['success'] != true) {
      throw Exception(ssoData['message'] ?? '邮箱或密码错误');
    }

    final ssoToken = ssoData['token'] as String;

    // Step 2: 用 SSO token 换取 LockCloud token
    return await loginWithSSO(ssoToken);
  }

  /// SSO 登录
  ///
  /// 将 SSO Token 发送到后端验证，获取本地 JWT Token
  ///
  /// [ssoToken] - 从 SSO 认证页面获取的 Token
  ///
  /// **Validates: Requirements 1.3**
  Future<AuthResponse> loginWithSSO(String ssoToken) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.authLogin,
      data: {'token': ssoToken},
    );

    final authResponse = AuthResponse.fromJson(response.data!);

    // 保存 Token 到安全存储
    await _storage.saveToken(authResponse.token);
    if (authResponse.refreshToken != null) {
      await _storage.saveRefreshToken(authResponse.refreshToken!);
    }
    await _storage.saveUserInfo(authResponse.user.toJson());

    return authResponse;
  }

  /// 刷新 Token
  ///
  /// 使用 Refresh Token 获取新的 JWT Token
  ///
  /// **Validates: Requirements 1.6**
  Future<AuthResponse> refreshToken() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) {
      throw Exception('No refresh token available');
    }

    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.authRefresh,
      data: {'refresh_token': refreshToken},
    );

    final authResponse = AuthResponse.fromJson(response.data!);

    // 更新存储的 Token
    await _storage.saveToken(authResponse.token);
    if (authResponse.refreshToken != null) {
      await _storage.saveRefreshToken(authResponse.refreshToken!);
    }
    await _storage.saveUserInfo(authResponse.user.toJson());

    return authResponse;
  }

  /// 获取当前用户信息
  ///
  /// 从后端获取当前登录用户的详细信息
  Future<User> getCurrentUser() async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.authMe,
    );

    final user = User.fromJson(response.data!);
    await _storage.saveUserInfo(user.toJson());
    return user;
  }

  /// 从本地存储获取用户信息
  ///
  /// 用于快速恢复用户状态，无需网络请求
  Future<User?> getStoredUser() async {
    final userInfo = await _storage.getUserInfo();
    if (userInfo == null) return null;
    return User.fromJson(userInfo);
  }

  /// 检查是否已登录
  ///
  /// 检查本地是否存在有效的 Token
  Future<bool> isLoggedIn() async {
    return await _storage.isLoggedIn();
  }

  /// 检查 Token 是否即将过期
  ///
  /// [withinMinutes] - 检查是否在指定分钟数内过期
  Future<bool> isTokenExpiringSoon({int withinMinutes = 5}) async {
    return await _storage.isTokenExpiringSoon(withinMinutes: withinMinutes);
  }

  /// 登出
  ///
  /// 清除所有本地存储的认证数据和缓存数据
  ///
  /// **Validates: Requirements 1.8, 10.5**
  Future<void> logout() async {
    try {
      // 尝试调用后端登出接口（可选）
      await _apiClient.post(ApiConstants.authLogout);
    } on DioException {
      // 忽略网络错误，继续清除本地数据
    }

    // 清除本地认证数据
    await _storage.clearAuthData();

    // 清除文件列表缓存
    if (_fileCacheStorage != null) {
      await _fileCacheStorage.clearAllCache();
    }

    // 清除图片缓存
    if (_imageCacheService != null) {
      await _imageCacheService.clearCache();
    }
  }

  /// 获取存储的 Token
  Future<String?> getToken() async {
    return await _storage.getToken();
  }
}

/// AuthRepository Provider
///
/// 提供 AuthRepository 实例的 Riverpod Provider
/// 包含缓存服务以支持登出时清除缓存
///
/// **Validates: Requirements 10.5**
@Riverpod(keepAlive: true)
AuthRepository authRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  final storage = ref.watch(secureStorageProvider);
  final fileCacheStorage = ref.watch(fileCacheStorageSyncProvider);
  final imageCacheService = ref.watch(imageCacheServiceProvider);
  return AuthRepository(
    apiClient: apiClient,
    storage: storage,
    fileCacheStorage: fileCacheStorage,
    imageCacheService: imageCacheService,
  );
}
