import 'dart:io';

import 'package:dio/dio.dart';

import '../errors/api_error.dart';
import '../errors/error_handler.dart';

/// API 异常类
///
/// 封装所有 API 相关的异常，包括网络错误、超时和业务错误。
/// 提供用户友好的中文错误信息。
///
/// **Validates: Requirements 8.1, 8.3, 8.6**
class ApiException implements Exception {
  /// 错误码
  final String code;

  /// 用户友好的中文错误信息
  final String message;

  /// HTTP 状态码
  final int? statusCode;

  /// 原始错误数据
  final dynamic data;

  /// 是否为网络错误
  final bool isNetworkError;

  /// 是否为超时错误
  final bool isTimeout;

  /// 是否可重试
  final bool canRetry;

  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.data,
    this.isNetworkError = false,
    this.isTimeout = false,
    this.canRetry = false,
  });

  @override
  String toString() => 'ApiException: [$code] $message';

  /// 从 ApiError 创建 ApiException
  factory ApiException.fromApiError(ApiError error) {
    return ApiException(
      code: error.code,
      message: ErrorHandler.getMessage(error),
      statusCode: error.statusCode,
      data: error.data,
      canRetry: false,
    );
  }

  /// 创建网络连接错误
  ///
  /// **Validates: Requirements 8.1**
  factory ApiException.networkError() {
    return const ApiException(
      code: 'NETWORK_ERROR',
      message: '网络连接失败，请检查网络设置',
      isNetworkError: true,
      canRetry: true,
    );
  }

  /// 创建连接超时错误
  ///
  /// **Validates: Requirements 8.6**
  factory ApiException.connectionTimeout() {
    return const ApiException(
      code: 'CONNECTION_TIMEOUT',
      message: '连接超时，请检查网络连接',
      isTimeout: true,
      canRetry: true,
    );
  }

  /// 创建发送超时错误
  ///
  /// **Validates: Requirements 8.6**
  factory ApiException.sendTimeout() {
    return const ApiException(
      code: 'SEND_TIMEOUT',
      message: '请求超时，请检查网络连接',
      isTimeout: true,
      canRetry: true,
    );
  }

  /// 创建接收超时错误
  ///
  /// **Validates: Requirements 8.6**
  factory ApiException.receiveTimeout() {
    return const ApiException(
      code: 'RECEIVE_TIMEOUT',
      message: '响应超时，请稍后重试',
      isTimeout: true,
      canRetry: true,
    );
  }

  /// 创建请求取消错误
  factory ApiException.cancelled() {
    return const ApiException(
      code: 'REQUEST_CANCELLED',
      message: '请求已取消',
      canRetry: false,
    );
  }

  /// 创建未知错误
  factory ApiException.unknown([String? message]) {
    return ApiException(
      code: 'UNKNOWN_ERROR',
      message: message ?? '请求失败，请稍后重试',
      canRetry: true,
    );
  }
}

/// 错误拦截器
///
/// 拦截 Dio 请求错误，解析 API 错误码并转换为用户友好的中文错误信息。
/// 处理网络错误、超时和业务错误。
///
/// **Validates: Requirements 8.1, 8.3, 8.6**
class ErrorInterceptor extends Interceptor {
  /// 创建错误拦截器实例
  ErrorInterceptor();

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final apiException = _convertToApiException(err);

    // 创建新的 DioException，将 ApiException 作为 error
    final newError = DioException(
      requestOptions: err.requestOptions,
      response: err.response,
      type: err.type,
      error: apiException,
      message: apiException.message,
    );

    handler.next(newError);
  }

  /// 将 DioException 转换为 ApiException
  ///
  /// 根据错误类型和响应内容，生成用户友好的错误信息。
  ApiException _convertToApiException(DioException err) {
    switch (err.type) {
      // 连接超时
      // **Validates: Requirements 8.6**
      case DioExceptionType.connectionTimeout:
        return ApiException.connectionTimeout();

      // 发送超时
      // **Validates: Requirements 8.6**
      case DioExceptionType.sendTimeout:
        return ApiException.sendTimeout();

      // 接收超时
      // **Validates: Requirements 8.6**
      case DioExceptionType.receiveTimeout:
        return ApiException.receiveTimeout();

      // 请求取消
      case DioExceptionType.cancel:
        return ApiException.cancelled();

      // 连接错误（网络不可用）
      // **Validates: Requirements 8.1**
      case DioExceptionType.connectionError:
        return ApiException.networkError();

      // 服务器响应错误
      // **Validates: Requirements 8.3**
      case DioExceptionType.badResponse:
        return _parseResponseError(err.response);

      // 证书错误
      case DioExceptionType.badCertificate:
        return const ApiException(
          code: 'CERTIFICATE_ERROR',
          message: '安全证书验证失败',
          canRetry: false,
        );

      // 未知错误
      case DioExceptionType.unknown:
        return _handleUnknownError(err);
    }
  }

  /// 解析服务器响应错误
  ///
  /// 从响应体中提取错误码和错误信息，转换为中文错误提示。
  ///
  /// **Validates: Requirements 8.3**
  ApiException _parseResponseError(Response? response) {
    if (response == null) {
      return ApiException.unknown();
    }

    final statusCode = response.statusCode;
    final data = response.data;

    // 尝试解析 API 错误响应
    if (data is Map<String, dynamic>) {
      try {
        final apiError = ApiError.fromResponse(data, statusCode: statusCode);
        return ApiException.fromApiError(apiError);
      } catch (_) {
        // 解析失败，使用默认错误处理
      }
    }

    // 根据 HTTP 状态码返回默认错误信息
    return _getDefaultErrorByStatusCode(statusCode);
  }

  /// 根据 HTTP 状态码获取默认错误信息
  ApiException _getDefaultErrorByStatusCode(int? statusCode) {
    switch (statusCode) {
      case 400:
        return const ApiException(
          code: 'BAD_REQUEST',
          message: '请求参数错误',
          statusCode: 400,
          canRetry: false,
        );
      case 401:
        // 401 错误由 AuthInterceptor 处理，这里只做基本处理
        return const ApiException(
          code: 'UNAUTHORIZED',
          message: '登录已过期，请重新登录',
          statusCode: 401,
          canRetry: false,
        );
      case 403:
        return const ApiException(
          code: 'FORBIDDEN',
          message: '没有权限执行此操作',
          statusCode: 403,
          canRetry: false,
        );
      case 404:
        return const ApiException(
          code: 'NOT_FOUND',
          message: '请求的资源不存在',
          statusCode: 404,
          canRetry: false,
        );
      case 409:
        return const ApiException(
          code: 'CONFLICT',
          message: '操作冲突，请刷新后重试',
          statusCode: 409,
          canRetry: true,
        );
      case 422:
        return const ApiException(
          code: 'VALIDATION_ERROR',
          message: '数据验证失败',
          statusCode: 422,
          canRetry: false,
        );
      case 429:
        return const ApiException(
          code: 'TOO_MANY_REQUESTS',
          message: '请求过于频繁，请稍后重试',
          statusCode: 429,
          canRetry: true,
        );
      case 500:
        return const ApiException(
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误，请稍后重试',
          statusCode: 500,
          canRetry: true,
        );
      case 502:
        return const ApiException(
          code: 'BAD_GATEWAY',
          message: '服务器暂时不可用，请稍后重试',
          statusCode: 502,
          canRetry: true,
        );
      case 503:
        return const ApiException(
          code: 'SERVICE_UNAVAILABLE',
          message: '服务暂时不可用，请稍后重试',
          statusCode: 503,
          canRetry: true,
        );
      case 504:
        return const ApiException(
          code: 'GATEWAY_TIMEOUT',
          message: '服务器响应超时，请稍后重试',
          statusCode: 504,
          canRetry: true,
        );
      default:
        return ApiException(
          code: 'HTTP_ERROR',
          message: '请求失败 (${statusCode ?? "未知状态"})',
          statusCode: statusCode,
          canRetry: true,
        );
    }
  }

  /// 处理未知错误
  ///
  /// 检查是否为网络相关错误（如 SocketException）。
  ///
  /// **Validates: Requirements 8.1**
  ApiException _handleUnknownError(DioException err) {
    final error = err.error;

    // 检查是否为 Socket 异常（网络不可用）
    if (error is SocketException) {
      return ApiException.networkError();
    }

    // 其他未知错误
    return ApiException.unknown(err.message);
  }
}
