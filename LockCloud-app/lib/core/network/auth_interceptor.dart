import 'dart:async';

import 'package:dio/dio.dart';

import '../constants/api_constants.dart';
import '../storage/secure_storage.dart';

/// 认证拦截器
///
/// 自动添加 JWT Token 到请求头，并处理 Token 过期和刷新。
///
/// 功能：
/// - 自动为所有请求添加 Authorization 头（Bearer Token）
/// - 处理 401 未授权错误，尝试刷新 Token
/// - 刷新成功后自动重试原请求
/// - 刷新失败时清除本地 Token 并触发登出回调
/// - 使用锁机制防止多个请求同时触发 Token 刷新
///
/// **Validates: Requirements 8.2, 8.4**
class AuthInterceptor extends Interceptor {
  final SecureStorage _storage;
  final Dio _dio;

  /// 登出回调函数
  ///
  /// 当 Token 刷新失败时调用，用于触发应用级别的登出逻辑
  final void Function()? onLogout;

  /// 是否正在刷新 Token
  bool _isRefreshing = false;

  /// 等待 Token 刷新完成的请求队列
  final List<_QueuedRequest> _pendingRequests = [];

  /// 创建认证拦截器
  ///
  /// [storage] - 安全存储服务，用于获取和保存 Token
  /// [dio] - Dio 实例，用于发送刷新 Token 请求
  /// [onLogout] - 登出回调，当 Token 刷新失败时调用
  AuthInterceptor({
    required SecureStorage storage,
    required Dio dio,
    this.onLogout,
  })  : _storage = storage,
        _dio = dio;

  /// 请求拦截
  ///
  /// 自动添加 JWT Token 到请求头
  ///
  /// **Validates: Requirement 8.4**
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // 跳过刷新 Token 请求本身，避免循环
    if (_isRefreshRequest(options.path)) {
      handler.next(options);
      return;
    }

    final token = await _storage.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  /// 错误拦截
  ///
  /// 处理 401 未授权错误，尝试刷新 Token
  ///
  /// **Validates: Requirement 8.2**
  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // 只处理 401 错误
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // 跳过刷新 Token 请求本身的 401 错误
    if (_isRefreshRequest(err.requestOptions.path)) {
      handler.next(err);
      return;
    }

    // 如果正在刷新 Token，将请求加入等待队列
    if (_isRefreshing) {
      try {
        final response = await _enqueueRequest(err.requestOptions);
        handler.resolve(response);
      } catch (e) {
        handler.next(err);
      }
      return;
    }

    // 开始刷新 Token
    _isRefreshing = true;

    try {
      final refreshed = await _refreshToken();

      if (refreshed) {
        // 刷新成功，重试原请求
        final response = await _retryRequest(err.requestOptions);
        
        // 处理等待队列中的请求
        _processQueue(success: true);
        
        handler.resolve(response);
      } else {
        // 刷新失败，触发登出
        await _handleRefreshFailure();
        
        // 处理等待队列中的请求（全部失败）
        _processQueue(success: false);
        
        handler.next(err);
      }
    } catch (e) {
      // 刷新过程中发生异常
      await _handleRefreshFailure();
      _processQueue(success: false);
      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }

  /// 检查是否为刷新 Token 请求
  bool _isRefreshRequest(String path) {
    return path == ApiConstants.authRefresh;
  }

  /// 刷新 Token
  ///
  /// 使用 Refresh Token 获取新的 JWT Token
  ///
  /// 返回 true 表示刷新成功，false 表示刷新失败
  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _storage.getRefreshToken();

      if (refreshToken == null || refreshToken.isEmpty) {
        return false;
      }

      // 发送刷新 Token 请求
      final response = await _dio.post(
        ApiConstants.authRefresh,
        data: {'refreshToken': refreshToken},
        options: Options(
          // 不使用拦截器，避免循环
          extra: {'skipAuth': true},
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        
        // 保存新的 Token
        final newToken = data['token'] as String?;
        final newRefreshToken = data['refreshToken'] as String?;

        if (newToken != null && newToken.isNotEmpty) {
          await _storage.saveToken(newToken);
          
          // 如果返回了新的 Refresh Token，也保存
          if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
            await _storage.saveRefreshToken(newRefreshToken);
          }
          
          return true;
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  /// 重试请求
  ///
  /// 使用新的 Token 重试原请求
  Future<Response<dynamic>> _retryRequest(RequestOptions requestOptions) async {
    // 获取新的 Token
    final token = await _storage.getToken();

    // 更新请求头
    requestOptions.headers['Authorization'] = 'Bearer $token';

    // 重新发送请求
    return _dio.fetch(requestOptions);
  }

  /// 将请求加入等待队列
  ///
  /// 当正在刷新 Token 时，新的 401 请求会被加入队列等待
  Future<Response<dynamic>> _enqueueRequest(RequestOptions requestOptions) {
    final completer = Completer<Response<dynamic>>();
    _pendingRequests.add(_QueuedRequest(
      requestOptions: requestOptions,
      completer: completer,
    ));
    return completer.future;
  }

  /// 处理等待队列中的请求
  ///
  /// [success] - Token 刷新是否成功
  void _processQueue({required bool success}) {
    for (final request in _pendingRequests) {
      if (success) {
        // 刷新成功，重试请求
        _retryRequest(request.requestOptions).then(
          (response) => request.completer.complete(response),
          onError: (error) => request.completer.completeError(error),
        );
      } else {
        // 刷新失败，返回错误
        request.completer.completeError(
          DioException(
            requestOptions: request.requestOptions,
            error: 'Token refresh failed',
            type: DioExceptionType.unknown,
          ),
        );
      }
    }
    _pendingRequests.clear();
  }

  /// 处理刷新失败
  ///
  /// 清除本地 Token 并触发登出回调
  Future<void> _handleRefreshFailure() async {
    // 清除所有认证数据
    await _storage.deleteToken();
    await _storage.deleteRefreshToken();

    // 触发登出回调
    onLogout?.call();
  }
}

/// 等待队列中的请求
class _QueuedRequest {
  final RequestOptions requestOptions;
  final Completer<Response<dynamic>> completer;

  _QueuedRequest({
    required this.requestOptions,
    required this.completer,
  });
}
