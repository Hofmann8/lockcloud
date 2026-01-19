/// API 常量
/// 
/// 定义所有 API 端点路径和相关常量。
class ApiConstants {
  ApiConstants._();

  /// API 基础路径
  static const String baseUrl = 'https://cloud.funk-and.love';

  // 认证相关
  static const String authLogin = '/api/auth/sso/login';
  static const String authRefresh = '/api/auth/refresh';
  static const String authLogout = '/api/auth/logout';
  static const String authMe = '/api/auth/me';

  // 文件相关
  static const String files = '/api/files';
  static const String filesTimeline = '/api/files/timeline';
  static const String filesDirectories = '/api/files/directories';
  static const String filesActivityNames = '/api/files/activity-names';

  // 文件标签相关
  static String fileTags(int fileId) => '/api/files/$fileId/tags';
  static String fileTagDelete(int fileId, int tagId) => '/api/files/$fileId/tags/$tagId';

  // 签名 URL 相关
  static String fileSignedUrl(int fileId) => '/api/files/$fileId/signed-url';
  static String fileAdjacentFiles(int fileId) => '/api/files/$fileId/adjacent';

  // HLS 视频相关
  static String hlsQualities(int fileId) => '/api/files/hls-qualities/$fileId';
  static String hlsProxy(int fileId, String hlsPath) => '/api/files/hls-proxy/$fileId/$hlsPath';

  // 批量操作相关
  static const String batchDelete = '/api/files/batch/delete';
  static const String batchTags = '/api/files/batch/tags';
  static const String batchUpdate = '/api/files/batch/update';

  // 上传相关
  static const String uploadPresign = '/api/files/upload-url';
  static const String uploadConfirm = '/api/files/confirm';

  // 请求相关
  static const String requests = '/api/requests';
  static const String requestsReceived = '/api/requests/received';
  static const String requestsSent = '/api/requests/sent';
  static const String requestsPendingCount = '/api/requests/pending-count';
  static const String requestsDirectory = '/api/requests/directory';
  static const String requestsBatch = '/api/requests/batch';
  static String requestApprove(int requestId) => '/api/requests/$requestId/approve';
  static String requestReject(int requestId) => '/api/requests/$requestId/reject';

  // 标签相关
  static const String tags = '/api/tags';
  static const String tagsSearch = '/api/tags/search';
  static const String tagPresets = '/api/tag-presets';

  // 用户相关
  static const String userAvatar = '/api/auth/avatar';
  static const String avatarUploadUrl = '/api/auth/avatar/upload-url';
  static const String avatarConfirm = '/api/auth/avatar/confirm';
  static const String avatarSignedUrl = '/api/auth/avatar/signed-url';
  static const String avatarDelete = '/api/auth/avatar';
}
