import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../config/app_config.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage.dart';
import 'auth_interceptor.dart';
import 'error_interceptor.dart';

part 'api_client.g.dart';

/// API 客户端
///
/// 封装 Dio HTTP 客户端，提供统一的 API 请求接口。
///
/// 功能：
/// - 配置基础 URL 和超时（默认 30 秒）
/// - 添加认证拦截器（自动添加 JWT Token）
/// - 添加错误拦截器
/// - 提供 GET、POST、PATCH、DELETE 方法
///
/// **Validates: Requirements 8.2, 8.4, 8.5**
class ApiClient {
  final Dio _dio;
  final SecureStorage _storage;

  /// 登出回调函数
  ///
  /// 当 Token 刷新失败时调用，用于触发应用级别的登出逻辑
  final void Function()? onLogout;

  /// 创建 API 客户端实例
  ///
  /// [storage] - 安全存储服务，用于获取 JWT Token
  /// [onLogout] - 登出回调，当 Token 刷新失败时调用
  ApiClient({
    required SecureStorage storage,
    this.onLogout,
  })  : _storage = storage,
        _dio = Dio(
          BaseOptions(
            baseUrl: ApiConstants.baseUrl,
            connectTimeout: Duration(seconds: AppConfig.requestTimeout),
            receiveTimeout: Duration(seconds: AppConfig.requestTimeout),
            sendTimeout: Duration(seconds: AppConfig.requestTimeout),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        ) {
    _setupInterceptors();
  }

  /// 配置拦截器
  void _setupInterceptors() {
    // 添加认证拦截器 - 自动添加 JWT Token 到请求头并处理 Token 刷新
    // **Validates: Requirements 8.2, 8.4**
    _dio.interceptors.add(
      AuthInterceptor(
        storage: _storage,
        dio: _dio,
        onLogout: onLogout,
      ),
    );

    // 添加日志拦截器（仅在开发环境）
    if (AppConfig.isDevelopment) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
          requestHeader: true,
          responseHeader: false,
          error: true,
        ),
      );
    }

    // 添加错误拦截器 - 解析 API 错误码并转换为中文错误信息
    // **Validates: Requirements 8.1, 8.3, 8.6**
    _dio.interceptors.add(ErrorInterceptor());
  }

  /// 获取 Dio 实例（用于高级配置或测试）
  Dio get dio => _dio;

  /// 获取安全存储实例
  SecureStorage get storage => _storage;

  /// 发送 GET 请求
  ///
  /// [path] - API 路径
  /// [queryParameters] - 查询参数
  /// [options] - 额外的请求选项
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// 发送 POST 请求
  ///
  /// [path] - API 路径
  /// [data] - 请求体数据
  /// [queryParameters] - 查询参数
  /// [options] - 额外的请求选项
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    return _dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );
  }

  /// 发送 PATCH 请求
  ///
  /// [path] - API 路径
  /// [data] - 请求体数据
  /// [queryParameters] - 查询参数
  /// [options] - 额外的请求选项
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _dio.patch<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// 发送 DELETE 请求
  ///
  /// [path] - API 路径
  /// [data] - 请求体数据
  /// [queryParameters] - 查询参数
  /// [options] - 额外的请求选项
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// 发送 PUT 请求
  ///
  /// [path] - API 路径
  /// [data] - 请求体数据
  /// [queryParameters] - 查询参数
  /// [options] - 额外的请求选项
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// 添加自定义拦截器
  ///
  /// 用于在后续任务中添加 AuthInterceptor 和 ErrorInterceptor
  void addInterceptor(Interceptor interceptor) {
    _dio.interceptors.add(interceptor);
  }

  /// 在指定位置插入拦截器
  void insertInterceptor(int index, Interceptor interceptor) {
    _dio.interceptors.insert(index, interceptor);
  }

  /// 移除拦截器
  void removeInterceptor(Interceptor interceptor) {
    _dio.interceptors.remove(interceptor);
  }

  /// 清除所有拦截器
  void clearInterceptors() {
    _dio.interceptors.clear();
  }
}

/// SecureStorage Provider
///
/// 提供 SecureStorage 实例的 Riverpod Provider
@Riverpod(keepAlive: true)
SecureStorage secureStorage(Ref ref) {
  return SecureStorage();
}

/// 登出回调 Provider
///
/// 提供登出回调函数的 Provider
/// 当 Token 刷新失败时，ApiClient 会调用此回调
///
/// 注意：此 Provider 需要在应用初始化时被覆盖（override）
/// 以提供实际的登出逻辑（如导航到登录页面）
@Riverpod(keepAlive: true)
void Function()? onLogoutCallback(Ref ref) {
  // 默认返回 null，需要在 ProviderScope 中 override
  return null;
}

/// ApiClient Provider
///
/// 提供 ApiClient 实例的 Riverpod Provider
/// 依赖于 SecureStorage Provider 和 onLogoutCallback Provider
///
/// **Validates: Requirements 8.2, 8.4**
@Riverpod(keepAlive: true)
ApiClient apiClient(Ref ref) {
  final storage = ref.watch(secureStorageProvider);
  final onLogout = ref.watch(onLogoutCallbackProvider);
  return ApiClient(
    storage: storage,
    onLogout: onLogout,
  );
}
