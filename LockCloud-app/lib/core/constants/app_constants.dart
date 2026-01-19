/// 应用常量
/// 
/// 定义应用中使用的各种常量值。
class AppConstants {
  AppConstants._();

  /// 应用名称
  static const String appName = 'LockCloud';

  /// 文件列表每页数量
  static const int filesPerPage = 24;

  /// 批量操作最大文件数
  static const int maxBatchFiles = 100;

  /// 视频快进/快退秒数
  static const int videoSeekSeconds = 10;

  /// 支持的视频倍速
  static const List<double> videoPlaybackSpeeds = [0.5, 1.0, 1.5, 2.0];

  /// 支持的视频清晰度
  static const List<String> videoQualities = ['1080p', '720p', '480p'];

  /// 活动类型列表
  static const List<String> activityTypes = [
    'practice',
    'performance',
    'workshop',
    'other',
  ];
}
