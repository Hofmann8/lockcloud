import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:lockcloud/core/storage/preferences_storage.dart';

void main() {
  late PreferencesStorage storage;

  setUp(() async {
    // 设置 SharedPreferences 的 mock 值
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    storage = PreferencesStorage.withPrefs(prefs);
  });

  group('PreferencesStorage', () {
    group('Theme Settings', () {
      test('getThemeMode returns dark by default', () {
        expect(storage.getThemeMode(), equals('dark'));
      });

      test('setThemeMode and getThemeMode work correctly', () async {
        await storage.setThemeMode('light');
        expect(storage.getThemeMode(), equals('light'));

        await storage.setThemeMode('system');
        expect(storage.getThemeMode(), equals('system'));
      });

      test('isDarkMode returns true by default', () {
        expect(storage.isDarkMode(), isTrue);
      });

      test('isDarkMode returns false when theme is light', () async {
        await storage.setThemeMode('light');
        expect(storage.isDarkMode(), isFalse);
      });
    });

    group('Video Playback Settings', () {
      test('getDefaultVideoQuality returns auto by default', () {
        expect(storage.getDefaultVideoQuality(), equals(VideoQuality.auto));
      });

      test('setDefaultVideoQuality and getDefaultVideoQuality work correctly',
          () async {
        await storage.setDefaultVideoQuality(VideoQuality.quality1080p);
        expect(
            storage.getDefaultVideoQuality(), equals(VideoQuality.quality1080p));

        await storage.setDefaultVideoQuality(VideoQuality.quality720p);
        expect(
            storage.getDefaultVideoQuality(), equals(VideoQuality.quality720p));
      });

      test('getDefaultPlaybackSpeed returns 1x by default', () {
        expect(storage.getDefaultPlaybackSpeed(), equals(PlaybackSpeed.speed1x));
      });

      test('setDefaultPlaybackSpeed and getDefaultPlaybackSpeed work correctly',
          () async {
        await storage.setDefaultPlaybackSpeed(PlaybackSpeed.speed2x);
        expect(storage.getDefaultPlaybackSpeed(), equals(PlaybackSpeed.speed2x));

        await storage.setDefaultPlaybackSpeed(PlaybackSpeed.speed0_5x);
        expect(
            storage.getDefaultPlaybackSpeed(), equals(PlaybackSpeed.speed0_5x));
      });

      test('isMirrorModeEnabled returns false by default', () {
        expect(storage.isMirrorModeEnabled(), isFalse);
      });

      test('setMirrorModeEnabled and isMirrorModeEnabled work correctly',
          () async {
        await storage.setMirrorModeEnabled(true);
        expect(storage.isMirrorModeEnabled(), isTrue);

        await storage.setMirrorModeEnabled(false);
        expect(storage.isMirrorModeEnabled(), isFalse);
      });

      test('isAutoPlayEnabled returns true by default', () {
        expect(storage.isAutoPlayEnabled(), isTrue);
      });

      test('setAutoPlayEnabled and isAutoPlayEnabled work correctly', () async {
        await storage.setAutoPlayEnabled(false);
        expect(storage.isAutoPlayEnabled(), isFalse);

        await storage.setAutoPlayEnabled(true);
        expect(storage.isAutoPlayEnabled(), isTrue);
      });
    });

    group('File List View Settings', () {
      test('getGridColumns returns 2 by default', () {
        expect(storage.getGridColumns(), equals(2));
      });

      test('setGridColumns and getGridColumns work correctly', () async {
        await storage.setGridColumns(3);
        expect(storage.getGridColumns(), equals(3));

        await storage.setGridColumns(4);
        expect(storage.getGridColumns(), equals(4));
      });

      test('setGridColumns clamps value to valid range', () async {
        await storage.setGridColumns(1);
        expect(storage.getGridColumns(), equals(2)); // Clamped to min

        await storage.setGridColumns(10);
        expect(storage.getGridColumns(), equals(4)); // Clamped to max
      });

      test('getFileSortOrder returns dateDesc by default', () {
        expect(storage.getFileSortOrder(), equals(FileSortOrder.dateDesc));
      });

      test('setFileSortOrder and getFileSortOrder work correctly', () async {
        await storage.setFileSortOrder(FileSortOrder.nameAsc);
        expect(storage.getFileSortOrder(), equals(FileSortOrder.nameAsc));

        await storage.setFileSortOrder(FileSortOrder.sizeDesc);
        expect(storage.getFileSortOrder(), equals(FileSortOrder.sizeDesc));
      });

      test('getShowFileSize returns true by default', () {
        expect(storage.getShowFileSize(), isTrue);
      });

      test('getShowUploadDate returns true by default', () {
        expect(storage.getShowUploadDate(), isTrue);
      });
    });

    group('Last Selected Directory/Filter', () {
      test('getLastDirectory returns null by default', () {
        expect(storage.getLastDirectory(), isNull);
      });

      test('setLastDirectory and getLastDirectory work correctly', () async {
        await storage.setLastDirectory('/2024/01/training');
        expect(storage.getLastDirectory(), equals('/2024/01/training'));

        await storage.setLastDirectory(null);
        expect(storage.getLastDirectory(), isNull);
      });

      test('getLastMediaTypeFilter returns all by default', () {
        expect(storage.getLastMediaTypeFilter(), equals('all'));
      });

      test('setLastMediaTypeFilter and getLastMediaTypeFilter work correctly',
          () async {
        await storage.setLastMediaTypeFilter('video');
        expect(storage.getLastMediaTypeFilter(), equals('video'));

        await storage.setLastMediaTypeFilter('image');
        expect(storage.getLastMediaTypeFilter(), equals('image'));
      });

      test('getLastActivityType returns null by default', () {
        expect(storage.getLastActivityType(), isNull);
      });

      test('setLastActivityType and getLastActivityType work correctly',
          () async {
        await storage.setLastActivityType('training');
        expect(storage.getLastActivityType(), equals('training'));

        await storage.setLastActivityType(null);
        expect(storage.getLastActivityType(), isNull);
      });

      test('getLastSelectedTags returns empty list by default', () {
        expect(storage.getLastSelectedTags(), isEmpty);
      });

      test('setLastSelectedTags and getLastSelectedTags work correctly',
          () async {
        await storage.setLastSelectedTags(['tag1', 'tag2', 'tag3']);
        expect(storage.getLastSelectedTags(), equals(['tag1', 'tag2', 'tag3']));

        await storage.setLastSelectedTags([]);
        expect(storage.getLastSelectedTags(), isEmpty);
      });
    });

    group('Notification Settings', () {
      test('isNotificationsEnabled returns true by default', () {
        expect(storage.isNotificationsEnabled(), isTrue);
      });

      test('setNotificationsEnabled and isNotificationsEnabled work correctly',
          () async {
        await storage.setNotificationsEnabled(false);
        expect(storage.isNotificationsEnabled(), isFalse);

        await storage.setNotificationsEnabled(true);
        expect(storage.isNotificationsEnabled(), isTrue);
      });

      test('isUploadNotificationsEnabled returns true by default', () {
        expect(storage.isUploadNotificationsEnabled(), isTrue);
      });

      test('isRequestNotificationsEnabled returns true by default', () {
        expect(storage.isRequestNotificationsEnabled(), isTrue);
      });
    });

    group('Cache Settings', () {
      test('isCacheEnabled returns true by default', () {
        expect(storage.isCacheEnabled(), isTrue);
      });

      test('setCacheEnabled and isCacheEnabled work correctly', () async {
        await storage.setCacheEnabled(false);
        expect(storage.isCacheEnabled(), isFalse);

        await storage.setCacheEnabled(true);
        expect(storage.isCacheEnabled(), isTrue);
      });

      test('getCacheMaxSizeMb returns 500 by default', () {
        expect(storage.getCacheMaxSizeMb(), equals(500));
      });

      test('setCacheMaxSizeMb and getCacheMaxSizeMb work correctly', () async {
        await storage.setCacheMaxSizeMb(1000);
        expect(storage.getCacheMaxSizeMb(), equals(1000));
      });

      test('setCacheMaxSizeMb clamps value to valid range', () async {
        await storage.setCacheMaxSizeMb(50);
        expect(storage.getCacheMaxSizeMb(), equals(100)); // Clamped to min

        await storage.setCacheMaxSizeMb(5000);
        expect(storage.getCacheMaxSizeMb(), equals(2000)); // Clamped to max
      });

      test('isAutoClearCacheEnabled returns true by default', () {
        expect(storage.isAutoClearCacheEnabled(), isTrue);
      });

      test('getCacheDurationDays returns 7 by default', () {
        expect(storage.getCacheDurationDays(), equals(7));
      });

      test('setCacheDurationDays clamps value to valid range', () async {
        await storage.setCacheDurationDays(0);
        expect(storage.getCacheDurationDays(), equals(1)); // Clamped to min

        await storage.setCacheDurationDays(100);
        expect(storage.getCacheDurationDays(), equals(30)); // Clamped to max
      });
    });

    group('Other Settings', () {
      test('isFirstLaunch returns true by default', () {
        expect(storage.isFirstLaunch(), isTrue);
      });

      test('setFirstLaunch and isFirstLaunch work correctly', () async {
        await storage.setFirstLaunch(false);
        expect(storage.isFirstLaunch(), isFalse);
      });

      test('getLastSyncTime returns null by default', () {
        expect(storage.getLastSyncTime(), isNull);
      });

      test('setLastSyncTime and getLastSyncTime work correctly', () async {
        final now = DateTime.now();
        await storage.setLastSyncTime(now);
        final retrieved = storage.getLastSyncTime();
        expect(retrieved, isNotNull);
        // Compare milliseconds since DateTime precision may vary
        expect(retrieved!.millisecondsSinceEpoch,
            equals(now.millisecondsSinceEpoch));
      });
    });

    group('Clear Operations', () {
      test('clearAll removes all preferences', () async {
        // Set some values
        await storage.setThemeMode('light');
        await storage.setGridColumns(3);
        await storage.setLastDirectory('/test');

        // Clear all
        await storage.clearAll();

        // Verify defaults are restored
        expect(storage.getThemeMode(), equals('dark'));
        expect(storage.getGridColumns(), equals(2));
        expect(storage.getLastDirectory(), isNull);
      });

      test('clearFilterPreferences only clears filter-related settings',
          () async {
        // Set various values
        await storage.setThemeMode('light');
        await storage.setLastDirectory('/test');
        await storage.setLastMediaTypeFilter('video');
        await storage.setLastSelectedTags(['tag1']);

        // Clear filter preferences
        await storage.clearFilterPreferences();

        // Verify theme is preserved
        expect(storage.getThemeMode(), equals('light'));

        // Verify filter settings are cleared
        expect(storage.getLastDirectory(), isNull);
        expect(storage.getLastMediaTypeFilter(), equals('all'));
        expect(storage.getLastSelectedTags(), isEmpty);
      });

      test('resetToDefaults clears all settings', () async {
        await storage.setThemeMode('light');
        await storage.setGridColumns(4);

        await storage.resetToDefaults();

        expect(storage.getThemeMode(), equals('dark'));
        expect(storage.getGridColumns(), equals(2));
      });
    });
  });

  group('Enums', () {
    group('VideoQuality', () {
      test('fromValue returns correct enum', () {
        expect(VideoQuality.fromValue('auto'), equals(VideoQuality.auto));
        expect(
            VideoQuality.fromValue('1080p'), equals(VideoQuality.quality1080p));
        expect(VideoQuality.fromValue('720p'), equals(VideoQuality.quality720p));
        expect(VideoQuality.fromValue('480p'), equals(VideoQuality.quality480p));
      });

      test('fromValue returns auto for invalid value', () {
        expect(VideoQuality.fromValue('invalid'), equals(VideoQuality.auto));
        expect(VideoQuality.fromValue(null), equals(VideoQuality.auto));
      });
    });

    group('PlaybackSpeed', () {
      test('fromValue returns correct enum', () {
        expect(PlaybackSpeed.fromValue(0.5), equals(PlaybackSpeed.speed0_5x));
        expect(PlaybackSpeed.fromValue(1.0), equals(PlaybackSpeed.speed1x));
        expect(PlaybackSpeed.fromValue(1.5), equals(PlaybackSpeed.speed1_5x));
        expect(PlaybackSpeed.fromValue(2.0), equals(PlaybackSpeed.speed2x));
      });

      test('fromValue returns 1x for invalid value', () {
        expect(PlaybackSpeed.fromValue(3.0), equals(PlaybackSpeed.speed1x));
        expect(PlaybackSpeed.fromValue(null), equals(PlaybackSpeed.speed1x));
      });
    });

    group('FileSortOrder', () {
      test('fromValue returns correct enum', () {
        expect(
            FileSortOrder.fromValue('date_desc'), equals(FileSortOrder.dateDesc));
        expect(
            FileSortOrder.fromValue('date_asc'), equals(FileSortOrder.dateAsc));
        expect(
            FileSortOrder.fromValue('name_asc'), equals(FileSortOrder.nameAsc));
        expect(
            FileSortOrder.fromValue('name_desc'), equals(FileSortOrder.nameDesc));
        expect(
            FileSortOrder.fromValue('size_desc'), equals(FileSortOrder.sizeDesc));
        expect(
            FileSortOrder.fromValue('size_asc'), equals(FileSortOrder.sizeAsc));
      });

      test('fromValue returns dateDesc for invalid value', () {
        expect(
            FileSortOrder.fromValue('invalid'), equals(FileSortOrder.dateDesc));
        expect(FileSortOrder.fromValue(null), equals(FileSortOrder.dateDesc));
      });
    });
  });
}
