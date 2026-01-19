import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/network/api_client.dart';

part 'signed_url_service.g.dart';

/// 样式预设类型
enum StylePreset {
  original('original'),
  thumbdesktop('thumbdesktop'),
  thumbmobile('thumbmobile'),
  thumbnavdesktop('thumbnavdesktop'),
  previewdesktop('previewdesktop'),
  previewmobile('previewmobile'),
  // 视频缩略图样式
  videothumbdesktop('videothumbdesktop'),
  videothumbmobile('videothumbmobile'),
  videothumbnav('videothumbnav'),
  videothumbnavdesktop('videothumbnavdesktop');

  final String value;
  const StylePreset(this.value);
}

/// 签名URL缓存项
class _CacheEntry {
  final String url;
  final DateTime expiresAt;

  _CacheEntry(this.url, this.expiresAt);

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

/// 签名URL服务
/// 
/// 管理文件签名URL的获取和缓存，类似前端的 useSignedUrl
class SignedUrlService {
  final ApiClient _apiClient;
  
  // URL缓存 - key: "fileId:style"
  final Map<String, _CacheEntry> _cache = {};
  
  // 正在进行的请求 - 防止重复请求
  final Map<String, Future<String>> _pendingRequests = {};

  SignedUrlService({required ApiClient apiClient}) : _apiClient = apiClient;

  /// 生成缓存key
  String _getCacheKey(int fileId, StylePreset style) => '$fileId:${style.value}';

  /// 获取单个文件的签名URL
  Future<String> getSignedUrl(
    int fileId, {
    StylePreset style = StylePreset.thumbdesktop,
    int expiration = 3600,
  }) async {
    final cacheKey = _getCacheKey(fileId, style);
    
    // 检查缓存
    final cached = _cache[cacheKey];
    if (cached != null && !cached.isExpired) {
      return cached.url;
    }
    
    // 检查是否有正在进行的请求
    if (_pendingRequests.containsKey(cacheKey)) {
      return _pendingRequests[cacheKey]!;
    }
    
    // 发起新请求
    final future = _fetchSignedUrl(fileId, style, expiration);
    _pendingRequests[cacheKey] = future;
    
    try {
      final url = await future;
      return url;
    } finally {
      _pendingRequests.remove(cacheKey);
    }
  }

  /// 从API获取签名URL
  Future<String> _fetchSignedUrl(
    int fileId,
    StylePreset style,
    int expiration,
  ) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '/api/files/signed-url/$fileId',
      queryParameters: {
        'style': style.value,
        'expiration': expiration,
      },
    );
    
    final signedUrl = response.data!['signed_url'] as String;
    final expiresIn = response.data!['expires_in'] as int;
    
    // 缓存URL（提前5分钟过期，避免边界情况）
    final cacheKey = _getCacheKey(fileId, style);
    _cache[cacheKey] = _CacheEntry(
      signedUrl,
      DateTime.now().add(Duration(seconds: expiresIn - 300)),
    );
    
    return signedUrl;
  }

  /// 批量获取签名URL
  Future<Map<int, String>> getSignedUrlsBatch(
    List<int> fileIds, {
    StylePreset style = StylePreset.thumbdesktop,
    int expiration = 3600,
  }) async {
    if (fileIds.isEmpty) return {};
    
    final result = <int, String>{};
    final needFetch = <int>[];
    
    // 检查缓存
    for (final fileId in fileIds) {
      final cacheKey = _getCacheKey(fileId, style);
      final cached = _cache[cacheKey];
      if (cached != null && !cached.isExpired) {
        result[fileId] = cached.url;
      } else {
        needFetch.add(fileId);
      }
    }
    
    // 如果所有都在缓存中，直接返回
    if (needFetch.isEmpty) return result;
    
    try {
      // 批量获取 - 使用正确的请求体格式
      final requestBody = {
        'file_ids': needFetch,
        'style': style.value,
        'expiration': expiration,
      };
      
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/api/files/signed-urls',
        data: requestBody,
      );
      
      final urls = response.data!['urls'] as Map<String, dynamic>;
      final expiresIn = response.data!['expires_in'] as int;
      final expiresAt = DateTime.now().add(Duration(seconds: expiresIn - 300));
      
      // 更新缓存和结果
      for (final entry in urls.entries) {
        final fileId = int.parse(entry.key);
        final data = entry.value as Map<String, dynamic>;
        final signedUrl = data['signed_url'] as String;
        
        final cacheKey = _getCacheKey(fileId, style);
        _cache[cacheKey] = _CacheEntry(signedUrl, expiresAt);
        result[fileId] = signedUrl;
      }
    } catch (e) {
      // 批量请求失败，回退到单个请求
      for (final fileId in needFetch) {
        try {
          final url = await getSignedUrl(fileId, style: style, expiration: expiration);
          result[fileId] = url;
        } catch (_) {
          // 单个请求也失败，跳过
        }
      }
    }
    
    return result;
  }

  /// 清除缓存
  void clearCache({int? fileId, StylePreset? style}) {
    if (fileId != null && style != null) {
      _cache.remove(_getCacheKey(fileId, style));
    } else if (fileId != null) {
      _cache.removeWhere((key, _) => key.startsWith('$fileId:'));
    } else {
      _cache.clear();
    }
  }

  /// 预取签名URL（填充缓存）
  Future<void> prefetch(
    List<int> fileIds, {
    StylePreset style = StylePreset.thumbdesktop,
  }) async {
    await getSignedUrlsBatch(fileIds, style: style);
  }
}

/// SignedUrlService Provider
@Riverpod(keepAlive: true)
SignedUrlService signedUrlService(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  return SignedUrlService(apiClient: apiClient);
}
