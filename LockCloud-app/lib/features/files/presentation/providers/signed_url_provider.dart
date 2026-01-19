import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/services/signed_url_service.dart';

part 'signed_url_provider.g.dart';

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
  final Map<int, String> urls;
  final bool isLoading;
  final String? error;

  const BatchSignedUrlState({
    this.urls = const {},
    this.isLoading = false,
    this.error,
  });

  BatchSignedUrlState copyWith({
    Map<int, String>? urls,
    bool? isLoading,
    String? error,
  }) {
    return BatchSignedUrlState(
      urls: urls ?? this.urls,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 批量签名URL Notifier
/// 
/// 管理一组文件的签名URL，支持批量获取
@riverpod
class BatchSignedUrlNotifier extends _$BatchSignedUrlNotifier {
  @override
  BatchSignedUrlState build() {
    return const BatchSignedUrlState();
  }

  /// 批量获取签名URL
  Future<void> fetchUrls(
    List<int> fileIds, {
    StylePreset style = StylePreset.thumbdesktop,
  }) async {
    if (fileIds.isEmpty) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final service = ref.read(signedUrlServiceProvider);
      final urls = await service.getSignedUrlsBatch(fileIds, style: style);
      
      state = state.copyWith(
        urls: {...state.urls, ...urls},
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  /// 获取单个文件的URL（从缓存）
  String? getUrl(int fileId) {
    return state.urls[fileId];
  }

  /// 清除缓存
  void clear() {
    state = const BatchSignedUrlState();
  }
}
