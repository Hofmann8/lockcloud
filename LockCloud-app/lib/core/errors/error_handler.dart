import 'api_error.dart';

/// 错误处理器
/// 
/// 负责解析和处理各种错误，将错误码转换为用户友好的中文消息。
class ErrorHandler {
  ErrorHandler._();

  /// 错误码到中文消息的映射
  static const Map<String, String> _errorMessages = {
    'VALIDATION_001': '验证失败',
    'AUTH_001': '用户不存在',
    'AUTH_006': '账号已禁用',
    'AUTH_INVALID_TOKEN': 'Token 无效或已过期',
    'FILE_001': '文件不存在',
    'FILE_002': '无权操作此文件',
    'FILE_005': '文件已存在',
    'FILE_007': '日期格式无效',
    'FILE_008': '活动类型无效',
    'REQUEST_001': '不能对自己的文件发起请求',
    'REQUEST_002': '已有待处理的请求',
    'REQUEST_003': '请求不存在',
    'REQUEST_004': '无权处理此请求',
    'REQUEST_005': '请求已处理',
    'S3_001': 'S3 操作失败',
    'BATCH_001': '批量操作参数错误',
    'BATCH_002': '批量操作超过限制（最多 100 个文件）',
    'INTERNAL_ERROR': '服务器内部错误，请稍后重试',
  };

  /// 获取错误的中文消息
  static String getMessage(ApiError error) {
    return _errorMessages[error.code] ?? error.message;
  }

  /// 获取网络错误消息
  static String getNetworkErrorMessage(String type) {
    switch (type) {
      case 'connectionTimeout':
      case 'sendTimeout':
      case 'receiveTimeout':
        return '请求超时，请检查网络连接';
      case 'connectionError':
        return '网络连接失败，请检查网络设置';
      default:
        return '请求失败，请稍后重试';
    }
  }
}
