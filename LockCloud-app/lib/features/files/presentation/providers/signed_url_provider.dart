import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/services/signed_url_service.dart';

part 'signed_url_provider.g.dart';

String _signedUrlCacheKey(int fileId, StylePreset style) {
  return '${style.value}:$fileId';
}

/// 单个文件签名URL Provider
/// 
/// 用于获取单个文件的签名URL，自动处理缓存
@riverpod
Future<String?> signedUrl(
  Ref ref,
  int fileId, {
  StylePreset style = StylePreset.thumbdesktop,
}) async {
  final service = ref.watch(signedUrlServiceProvider);
  try {
    return await service.getSignedUrl(fileId, style: style);
  } catch (e) {
    return null;
  }
}

/// 批量签名URL状态
class BatchSignedUrlState {
  final Map<String, String> urls;
  final bool isLoading;
  final String? error;

  const BatchSignedUrlState({
    this.urls = const {},
    this.isLoading = false,
    this.error,
  });

  BatchSignedUrlState copyWith({
    Map<String, String>? urls,
    bool? isLoading,
    String? error,
  }) {
    return BatchSignedUrlState(
      urls: urls ?? this.urls,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  String? getUrl(int fileId, StylePreset style) {
    return urls[_signedUrlCacheKey(fileId, style)];
  }
}

/// 批量签名URL Notifier
/// 
/// 管理一组文件的签名URL，支持批量获取
@Riverpod(keepAlive: true)
class BatchSignedUrlNotifier extends _$BatchSignedUrlNotifier {
  @override
  BatchSignedUrlState build() {
    return const BatchSignedUrlState();
  }

  /// 批量获取签名URL
  Future<Map<int, String>> fetchUrls(
    List<int> fileIds, {
    StylePreset style = StylePreset.thumbdesktop,
  }) async {
    if (fileIds.isEmpty) return {};

    state = state.copyWith(isLoading: true, error: null);

    try {
      final service = ref.read(signedUrlServiceProvider);
      final urls = await service.getSignedUrlsBatch(fileIds, style: style);
      final keyedUrls = <String, String>{};

      for (final entry in urls.entries) {
        keyedUrls[_signedUrlCacheKey(entry.key, style)] = entry.value;
      }
      
      state = state.copyWith(
        urls: {...state.urls, ...keyedUrls},
        isLoading: false,
      );
      return urls;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      return {};
    }
  }

  /// 获取单个文件的URL（从缓存）
  String? getUrl(int fileId, StylePreset style) {
    return state.getUrl(fileId, style);
  }

  /// 清除缓存
  void clear() {
    state = const BatchSignedUrlState();
  }
}
