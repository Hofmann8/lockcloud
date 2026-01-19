/// API 错误类
/// 
/// 封装 API 返回的错误信息，包括错误码和错误消息。
class ApiError implements Exception {
  final String code;
  final String message;
  final int? statusCode;
  final dynamic data;

  const ApiError({
    required this.code,
    required this.message,
    this.statusCode,
    this.data,
  });

  @override
  String toString() => 'ApiError: [$code] $message';

  /// 从 API 响应创建错误
  factory ApiError.fromResponse(Map<String, dynamic> json, {int? statusCode}) {
    final error = json['error'] as Map<String, dynamic>?;
    return ApiError(
      code: error?['code'] ?? 'UNKNOWN_ERROR',
      message: error?['message'] ?? '未知错误',
      statusCode: statusCode,
      data: error?['data'],
    );
  }
}
