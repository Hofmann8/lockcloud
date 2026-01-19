import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 视频播放质量枚举
enum VideoQuality {
  auto('auto', '自动'),
  quality1080p('1080p', '1080p'),
  quality720p('720p', '720p'),
  quality480p('480p', '480p');

  final String value;
  final String displayName;

  const VideoQuality(this.value, this.displayName);

  static VideoQuality fromValue(String? value) {
    return VideoQuality.values.firstWhere(
      (q) => q.value == value,
      orElse: () => VideoQuality.auto,
    );
  }
}

/// 播放速度枚举
enum PlaybackSpeed {
  speed0_5x(0.5, '0.5x'),
  speed1x(1.0, '1x'),
  speed1_5x(1.5, '1.5x'),
  speed2x(2.0, '2x');

  final double value;
  final String displayName;

  const PlaybackSpeed(this.value, this.displayName);

  static PlaybackSpeed fromValue(double? value) {
    return PlaybackSpeed.values.firstWhere(
      (s) => s.value == value,
      orElse: () => PlaybackSpeed.speed1x,
    );
  }
}

/// 文件排序方式枚举
enum FileSortOrder {
  dateDesc('date_desc', '日期降序'),
  dateAsc('date_asc', '日期升序'),
  nameAsc('name_asc', '名称升序'),
  nameDesc('name_desc', '名称降序'),
  sizeDesc('size_desc', '大小降序'),
  sizeAsc('size_asc', '大小升序');

  final String value;
  final String displayName;

  const FileSortOrder(this.value, this.displayName);

  static FileSortOrder fromValue(String? value) {
    return FileSortOrder.values.firstWhere(
      (s) => s.value == value,
      orElse: () => FileSortOrder.dateDesc,
    );
  }
}

/// 偏好设置存储服务
///
/// 使用 shared_preferences 存储用户偏好设置，包括：
/// - 主题偏好（深色/浅色模式）
/// - 视频播放设置（默认质量、播放速度、镜像模式）
/// - 文件列表视图偏好（网格列数、排序方式）
/// - 最后选择的目录/筛选条件
/// - 通知偏好
/// - 缓存设置
///
/// **Validates: Requirements 10.2**
class PreferencesStorage {
  // ==================== 存储键常量 ====================

  // 主题设置
  static const String _keyThemeMode = 'theme_mode';

  // 视频播放设置
  static const String _keyDefaultVideoQuality = 'default_video_quality';
  static const String _keyDefaultPlaybackSpeed = 'default_playback_speed';
  static const String _keyMirrorModeEnabled = 'mirror_mode_enabled';
  static const String _keyAutoPlayEnabled = 'auto_play_enabled';

  // 文件列表视图设置
  static const String _keyGridColumns = 'grid_columns';
  static const String _keyFileSortOrder = 'file_sort_order';
  static const String _keyShowFileSize = 'show_file_size';
  static const String _keyShowUploadDate = 'show_upload_date';

  // 最后选择的目录/筛选条件
  static const String _keyLastDirectory = 'last_directory';
  static const String _keyLastMediaTypeFilter = 'last_media_type_filter';
  static const String _keyLastActivityType = 'last_activity_type';
  static const String _keyLastSelectedTags = 'last_selected_tags';

  // 通知设置
  static const String _keyNotificationsEnabled = 'notifications_enabled';
  static const String _keyUploadNotificationsEnabled =
      'upload_notifications_enabled';
  static const String _keyRequestNotificationsEnabled =
      'request_notifications_enabled';

  // 缓存设置
  static const String _keyCacheEnabled = 'cache_enabled';
  static const String _keyCacheMaxSizeMb = 'cache_max_size_mb';
  static const String _keyAutoClearCache = 'auto_clear_cache';
  static const String _keyCacheDurationDays = 'cache_duration_days';

  // 其他设置
  static const String _keyFirstLaunch = 'first_launch';
  static const String _keyLastSyncTime = 'last_sync_time';

  final SharedPreferences _prefs;

  /// 私有构造函数，使用 [init] 方法创建实例
  PreferencesStorage._(this._prefs);

  /// 异步初始化 PreferencesStorage
  ///
  /// 必须在使用前调用此方法获取实例
  static Future<PreferencesStorage> init() async {
    final prefs = await SharedPreferences.getInstance();
    return PreferencesStorage._(prefs);
  }

  /// 使用已有的 SharedPreferences 实例创建（用于测试）
  factory PreferencesStorage.withPrefs(SharedPreferences prefs) {
    return PreferencesStorage._(prefs);
  }

  // ==================== 主题设置 ====================

  /// 获取主题模式
  ///
  /// 返回值：'dark'、'light' 或 'system'
  /// 默认值：'dark'（应用默认使用深色主题）
  String getThemeMode() {
    return _prefs.getString(_keyThemeMode) ?? 'dark';
  }

  /// 设置主题模式
  ///
  /// [mode] - 'dark'、'light' 或 'system'
  Future<bool> setThemeMode(String mode) async {
    return _prefs.setString(_keyThemeMode, mode);
  }

  /// 是否为深色模式
  bool isDarkMode() {
    return getThemeMode() == 'dark';
  }

  // ==================== 视频播放设置 ====================

  /// 获取默认视频质量
  VideoQuality getDefaultVideoQuality() {
    final value = _prefs.getString(_keyDefaultVideoQuality);
    return VideoQuality.fromValue(value);
  }

  /// 设置默认视频质量
  Future<bool> setDefaultVideoQuality(VideoQuality quality) async {
    return _prefs.setString(_keyDefaultVideoQuality, quality.value);
  }

  /// 获取默认播放速度
  PlaybackSpeed getDefaultPlaybackSpeed() {
    final value = _prefs.getDouble(_keyDefaultPlaybackSpeed);
    return PlaybackSpeed.fromValue(value);
  }

  /// 设置默认播放速度
  Future<bool> setDefaultPlaybackSpeed(PlaybackSpeed speed) async {
    return _prefs.setDouble(_keyDefaultPlaybackSpeed, speed.value);
  }

  /// 获取镜像模式是否启用
  ///
  /// 默认值：false
  bool isMirrorModeEnabled() {
    return _prefs.getBool(_keyMirrorModeEnabled) ?? false;
  }

  /// 设置镜像模式
  Future<bool> setMirrorModeEnabled(bool enabled) async {
    return _prefs.setBool(_keyMirrorModeEnabled, enabled);
  }

  /// 获取自动播放是否启用
  ///
  /// 默认值：true
  bool isAutoPlayEnabled() {
    return _prefs.getBool(_keyAutoPlayEnabled) ?? true;
  }

  /// 设置自动播放
  Future<bool> setAutoPlayEnabled(bool enabled) async {
    return _prefs.setBool(_keyAutoPlayEnabled, enabled);
  }

  // ==================== 文件列表视图设置 ====================

  /// 获取网格列数
  ///
  /// 默认值：2（根据需求 2.1）
  int getGridColumns() {
    return _prefs.getInt(_keyGridColumns) ?? 2;
  }

  /// 设置网格列数
  ///
  /// [columns] - 列数，有效值为 2、3、4
  Future<bool> setGridColumns(int columns) async {
    // 限制有效范围
    final validColumns = columns.clamp(2, 4);
    return _prefs.setInt(_keyGridColumns, validColumns);
  }

  /// 获取文件排序方式
  FileSortOrder getFileSortOrder() {
    final value = _prefs.getString(_keyFileSortOrder);
    return FileSortOrder.fromValue(value);
  }

  /// 设置文件排序方式
  Future<bool> setFileSortOrder(FileSortOrder order) async {
    return _prefs.setString(_keyFileSortOrder, order.value);
  }

  /// 获取是否显示文件大小
  ///
  /// 默认值：true
  bool getShowFileSize() {
    return _prefs.getBool(_keyShowFileSize) ?? true;
  }

  /// 设置是否显示文件大小
  Future<bool> setShowFileSize(bool show) async {
    return _prefs.setBool(_keyShowFileSize, show);
  }

  /// 获取是否显示上传日期
  ///
  /// 默认值：true
  bool getShowUploadDate() {
    return _prefs.getBool(_keyShowUploadDate) ?? true;
  }

  /// 设置是否显示上传日期
  Future<bool> setShowUploadDate(bool show) async {
    return _prefs.setBool(_keyShowUploadDate, show);
  }

  // ==================== 最后选择的目录/筛选条件 ====================

  /// 获取最后选择的目录
  String? getLastDirectory() {
    return _prefs.getString(_keyLastDirectory);
  }

  /// 设置最后选择的目录
  Future<bool> setLastDirectory(String? directory) async {
    if (directory == null) {
      return _prefs.remove(_keyLastDirectory);
    }
    return _prefs.setString(_keyLastDirectory, directory);
  }

  /// 获取最后选择的媒体类型筛选
  ///
  /// 返回值：'all'、'image' 或 'video'
  /// 默认值：'all'
  String getLastMediaTypeFilter() {
    return _prefs.getString(_keyLastMediaTypeFilter) ?? 'all';
  }

  /// 设置最后选择的媒体类型筛选
  Future<bool> setLastMediaTypeFilter(String mediaType) async {
    return _prefs.setString(_keyLastMediaTypeFilter, mediaType);
  }

  /// 获取最后选择的活动类型
  String? getLastActivityType() {
    return _prefs.getString(_keyLastActivityType);
  }

  /// 设置最后选择的活动类型
  Future<bool> setLastActivityType(String? activityType) async {
    if (activityType == null) {
      return _prefs.remove(_keyLastActivityType);
    }
    return _prefs.setString(_keyLastActivityType, activityType);
  }

  /// 获取最后选择的标签列表
  List<String> getLastSelectedTags() {
    return _prefs.getStringList(_keyLastSelectedTags) ?? [];
  }

  /// 设置最后选择的标签列表
  Future<bool> setLastSelectedTags(List<String> tags) async {
    return _prefs.setStringList(_keyLastSelectedTags, tags);
  }

  // ==================== 通知设置 ====================

  /// 获取通知是否启用
  ///
  /// 默认值：true
  bool isNotificationsEnabled() {
    return _prefs.getBool(_keyNotificationsEnabled) ?? true;
  }

  /// 设置通知是否启用
  Future<bool> setNotificationsEnabled(bool enabled) async {
    return _prefs.setBool(_keyNotificationsEnabled, enabled);
  }

  /// 获取上传通知是否启用
  ///
  /// 默认值：true
  bool isUploadNotificationsEnabled() {
    return _prefs.getBool(_keyUploadNotificationsEnabled) ?? true;
  }

  /// 设置上传通知是否启用
  Future<bool> setUploadNotificationsEnabled(bool enabled) async {
    return _prefs.setBool(_keyUploadNotificationsEnabled, enabled);
  }

  /// 获取请求通知是否启用
  ///
  /// 默认值：true
  bool isRequestNotificationsEnabled() {
    return _prefs.getBool(_keyRequestNotificationsEnabled) ?? true;
  }

  /// 设置请求通知是否启用
  Future<bool> setRequestNotificationsEnabled(bool enabled) async {
    return _prefs.setBool(_keyRequestNotificationsEnabled, enabled);
  }

  // ==================== 缓存设置 ====================

  /// 获取缓存是否启用
  ///
  /// 默认值：true
  bool isCacheEnabled() {
    return _prefs.getBool(_keyCacheEnabled) ?? true;
  }

  /// 设置缓存是否启用
  Future<bool> setCacheEnabled(bool enabled) async {
    return _prefs.setBool(_keyCacheEnabled, enabled);
  }

  /// 获取缓存最大大小（MB）
  ///
  /// 默认值：500 MB
  int getCacheMaxSizeMb() {
    return _prefs.getInt(_keyCacheMaxSizeMb) ?? 500;
  }

  /// 设置缓存最大大小（MB）
  Future<bool> setCacheMaxSizeMb(int sizeMb) async {
    // 限制有效范围：100MB - 2000MB
    final validSize = sizeMb.clamp(100, 2000);
    return _prefs.setInt(_keyCacheMaxSizeMb, validSize);
  }

  /// 获取是否自动清理缓存
  ///
  /// 默认值：true
  bool isAutoClearCacheEnabled() {
    return _prefs.getBool(_keyAutoClearCache) ?? true;
  }

  /// 设置是否自动清理缓存
  Future<bool> setAutoClearCacheEnabled(bool enabled) async {
    return _prefs.setBool(_keyAutoClearCache, enabled);
  }

  /// 获取缓存保留天数
  ///
  /// 默认值：7 天
  int getCacheDurationDays() {
    return _prefs.getInt(_keyCacheDurationDays) ?? 7;
  }

  /// 设置缓存保留天数
  Future<bool> setCacheDurationDays(int days) async {
    // 限制有效范围：1-30 天
    final validDays = days.clamp(1, 30);
    return _prefs.setInt(_keyCacheDurationDays, validDays);
  }

  // ==================== 其他设置 ====================

  /// 检查是否首次启动
  ///
  /// 默认值：true
  bool isFirstLaunch() {
    return _prefs.getBool(_keyFirstLaunch) ?? true;
  }

  /// 设置首次启动标记
  Future<bool> setFirstLaunch(bool isFirst) async {
    return _prefs.setBool(_keyFirstLaunch, isFirst);
  }

  /// 获取最后同步时间
  DateTime? getLastSyncTime() {
    final timestamp = _prefs.getInt(_keyLastSyncTime);
    if (timestamp == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(timestamp);
  }

  /// 设置最后同步时间
  Future<bool> setLastSyncTime(DateTime time) async {
    return _prefs.setInt(_keyLastSyncTime, time.millisecondsSinceEpoch);
  }

  // ==================== 清除操作 ====================

  /// 清除所有偏好设置
  ///
  /// 用于用户退出登录时清除所有本地偏好
  Future<bool> clearAll() async {
    return _prefs.clear();
  }

  /// 清除筛选相关的偏好设置
  ///
  /// 保留主题、视频播放等个人偏好，仅清除筛选条件
  Future<void> clearFilterPreferences() async {
    await Future.wait([
      _prefs.remove(_keyLastDirectory),
      _prefs.remove(_keyLastMediaTypeFilter),
      _prefs.remove(_keyLastActivityType),
      _prefs.remove(_keyLastSelectedTags),
    ]);
  }

  /// 重置为默认设置
  ///
  /// 清除所有设置并恢复默认值
  Future<bool> resetToDefaults() async {
    return _prefs.clear();
  }
}

/// PreferencesStorage 的 Riverpod Provider
///
/// 使用 keepAlive: true 保持实例在整个应用生命周期内存活
final preferencesStorageProvider = FutureProvider<PreferencesStorage>((ref) async {
  final storage = await PreferencesStorage.init();
  ref.keepAlive();
  return storage;
});

/// 同步访问 PreferencesStorage 的 Provider
///
/// 需要在应用启动时先初始化 preferencesStorageProvider
/// 然后可以通过此 provider 同步访问
final preferencesStorageSyncProvider = Provider<PreferencesStorage?>((ref) {
  final asyncValue = ref.watch(preferencesStorageProvider);
  return asyncValue.valueOrNull;
});
