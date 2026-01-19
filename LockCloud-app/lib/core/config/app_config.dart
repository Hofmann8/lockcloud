/// 应用配置
/// 
/// 包含应用的全局配置项，如 API 地址、环境变量等。
class AppConfig {
  AppConfig._();

  /// API 基础地址
  static const String apiBaseUrl = 'https://api.lockcloud.funk-and.love';

  /// SSO 认证地址
  static const String ssoAuthUrl = 'https://auth.funk-and.love';

  /// 是否为开发环境
  static const bool isDevelopment = true;

  /// 请求超时时间（秒）
  static const int requestTimeout = 30;

  /// 每页文件数量
  static const int filesPerPage = 24;
}
