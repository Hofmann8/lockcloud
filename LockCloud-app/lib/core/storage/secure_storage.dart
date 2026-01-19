import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 安全存储服务
///
/// 使用 flutter_secure_storage 安全存储敏感数据，如 JWT Token 和用户信息。
///
/// 功能：
/// - JWT Token 存取（getToken、saveToken、deleteToken）
/// - Refresh Token 存取
/// - 用户信息存储（JSON 格式）
/// - Token 过期检查
/// - 登录状态检查
///
/// **Validates: Requirements 10.1**
class SecureStorage {
  static const String _tokenKey = 'jwt_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userInfoKey = 'user_info';
  static const String _tokenExpirationKey = 'token_expiration';

  final FlutterSecureStorage _storage;

  /// 创建安全存储实例
  ///
  /// [storage] - 可选的 FlutterSecureStorage 实例，用于测试注入
  SecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
              ),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  // ==================== JWT Token 操作 ====================

  /// 获取 JWT Token
  ///
  /// 返回存储的 JWT Token，如果不存在则返回 null。
  /// 如果发生存储错误，返回 null 并记录错误。
  Future<String?> getToken() async {
    try {
      return await _storage.read(key: _tokenKey);
    } catch (e) {
      // 存储读取失败，返回 null
      return null;
    }
  }

  /// 保存 JWT Token
  ///
  /// [token] - 要保存的 JWT Token
  ///
  /// 同时会解析 Token 中的过期时间并存储。
  /// 如果存储失败，会抛出 [SecureStorageException]。
  Future<void> saveToken(String token) async {
    try {
      await _storage.write(key: _tokenKey, value: token);

      // 尝试解析并存储 Token 过期时间
      final expiration = _extractExpirationFromToken(token);
      if (expiration != null) {
        await _storage.write(
          key: _tokenExpirationKey,
          value: expiration.millisecondsSinceEpoch.toString(),
        );
      }
    } catch (e) {
      throw SecureStorageException('保存 Token 失败: $e');
    }
  }

  /// 设置 JWT Token（saveToken 的别名，符合任务要求的命名）
  ///
  /// [token] - 要保存的 JWT Token
  Future<void> setToken(String token) async {
    await saveToken(token);
  }

  /// 删除 JWT Token
  ///
  /// 同时删除存储的过期时间。
  Future<void> deleteToken() async {
    try {
      await _storage.delete(key: _tokenKey);
      await _storage.delete(key: _tokenExpirationKey);
    } catch (e) {
      throw SecureStorageException('删除 Token 失败: $e');
    }
  }

  // ==================== Refresh Token 操作 ====================

  /// 获取 Refresh Token
  ///
  /// 返回存储的 Refresh Token，如果不存在则返回 null
  Future<String?> getRefreshToken() async {
    try {
      return await _storage.read(key: _refreshTokenKey);
    } catch (e) {
      return null;
    }
  }

  /// 保存 Refresh Token
  ///
  /// [token] - 要保存的 Refresh Token
  Future<void> saveRefreshToken(String token) async {
    try {
      await _storage.write(key: _refreshTokenKey, value: token);
    } catch (e) {
      throw SecureStorageException('保存 Refresh Token 失败: $e');
    }
  }

  /// 删除 Refresh Token
  Future<void> deleteRefreshToken() async {
    try {
      await _storage.delete(key: _refreshTokenKey);
    } catch (e) {
      throw SecureStorageException('删除 Refresh Token 失败: $e');
    }
  }

  // ==================== 用户信息操作 ====================

  /// 获取用户信息
  ///
  /// 返回存储的用户信息 Map，如果不存在或解析失败则返回 null
  Future<Map<String, dynamic>?> getUserInfo() async {
    try {
      final jsonString = await _storage.read(key: _userInfoKey);
      if (jsonString == null || jsonString.isEmpty) {
        return null;
      }
      return json.decode(jsonString) as Map<String, dynamic>;
    } catch (e) {
      // JSON 解析失败或存储读取失败
      return null;
    }
  }

  /// 保存用户信息
  ///
  /// [userInfo] - 用户信息 Map，将被序列化为 JSON 存储
  Future<void> saveUserInfo(Map<String, dynamic> userInfo) async {
    try {
      final jsonString = json.encode(userInfo);
      await _storage.write(key: _userInfoKey, value: jsonString);
    } catch (e) {
      throw SecureStorageException('保存用户信息失败: $e');
    }
  }

  /// 删除用户信息
  Future<void> deleteUserInfo() async {
    try {
      await _storage.delete(key: _userInfoKey);
    } catch (e) {
      throw SecureStorageException('删除用户信息失败: $e');
    }
  }

  // ==================== Token 过期检查 ====================

  /// 检查 Token 是否已过期
  ///
  /// 返回 true 如果 Token 已过期或无法确定过期时间
  /// 返回 false 如果 Token 仍然有效
  Future<bool> isTokenExpired() async {
    try {
      final expirationStr = await _storage.read(key: _tokenExpirationKey);
      if (expirationStr == null) {
        // 无法确定过期时间，尝试从 Token 中解析
        final token = await getToken();
        if (token == null) {
          return true;
        }
        final expiration = _extractExpirationFromToken(token);
        if (expiration == null) {
          // 无法解析过期时间，假设未过期
          return false;
        }
        return DateTime.now().isAfter(expiration);
      }

      final expirationMs = int.tryParse(expirationStr);
      if (expirationMs == null) {
        return true;
      }

      final expiration = DateTime.fromMillisecondsSinceEpoch(expirationMs);
      return DateTime.now().isAfter(expiration);
    } catch (e) {
      // 发生错误，假设已过期
      return true;
    }
  }

  /// 检查 Token 是否即将过期（在指定时间内）
  ///
  /// [withinMinutes] - 检查是否在指定分钟数内过期，默认 5 分钟
  ///
  /// 返回 true 如果 Token 将在指定时间内过期
  Future<bool> isTokenExpiringSoon({int withinMinutes = 5}) async {
    try {
      final expirationStr = await _storage.read(key: _tokenExpirationKey);
      if (expirationStr == null) {
        final token = await getToken();
        if (token == null) {
          return true;
        }
        final expiration = _extractExpirationFromToken(token);
        if (expiration == null) {
          return false;
        }
        final threshold = DateTime.now().add(Duration(minutes: withinMinutes));
        return expiration.isBefore(threshold);
      }

      final expirationMs = int.tryParse(expirationStr);
      if (expirationMs == null) {
        return true;
      }

      final expiration = DateTime.fromMillisecondsSinceEpoch(expirationMs);
      final threshold = DateTime.now().add(Duration(minutes: withinMinutes));
      return expiration.isBefore(threshold);
    } catch (e) {
      return true;
    }
  }

  /// 获取 Token 过期时间
  ///
  /// 返回 Token 的过期时间，如果无法确定则返回 null
  Future<DateTime?> getTokenExpiration() async {
    try {
      final expirationStr = await _storage.read(key: _tokenExpirationKey);
      if (expirationStr == null) {
        final token = await getToken();
        if (token == null) {
          return null;
        }
        return _extractExpirationFromToken(token);
      }

      final expirationMs = int.tryParse(expirationStr);
      if (expirationMs == null) {
        return null;
      }

      return DateTime.fromMillisecondsSinceEpoch(expirationMs);
    } catch (e) {
      return null;
    }
  }

  // ==================== 登录状态检查 ====================

  /// 检查是否有有效的 Token
  ///
  /// 返回 true 如果存在非空的 Token
  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  /// 检查用户是否已登录
  ///
  /// 返回 true 如果存在有效的 Token 且未过期
  Future<bool> isLoggedIn() async {
    final hasValidToken = await hasToken();
    if (!hasValidToken) {
      return false;
    }

    final isExpired = await isTokenExpired();
    return !isExpired;
  }

  // ==================== 清除操作 ====================

  /// 清除所有认证数据
  ///
  /// 删除 Token、Refresh Token、用户信息和过期时间
  Future<void> clearAll() async {
    try {
      await _storage.deleteAll();
    } catch (e) {
      throw SecureStorageException('清除所有数据失败: $e');
    }
  }

  /// 清除认证相关数据（保留其他数据）
  ///
  /// 仅删除 Token、Refresh Token、用户信息和过期时间
  Future<void> clearAuthData() async {
    try {
      await Future.wait([
        _storage.delete(key: _tokenKey),
        _storage.delete(key: _refreshTokenKey),
        _storage.delete(key: _userInfoKey),
        _storage.delete(key: _tokenExpirationKey),
      ]);
    } catch (e) {
      throw SecureStorageException('清除认证数据失败: $e');
    }
  }

  // ==================== 私有方法 ====================

  /// 从 JWT Token 中提取过期时间
  ///
  /// JWT Token 格式: header.payload.signature
  /// payload 是 Base64 编码的 JSON，包含 exp 字段（Unix 时间戳）
  DateTime? _extractExpirationFromToken(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) {
        return null;
      }

      // 解码 payload（第二部分）
      String payload = parts[1];

      // 添加 Base64 填充
      switch (payload.length % 4) {
        case 1:
          payload += '===';
          break;
        case 2:
          payload += '==';
          break;
        case 3:
          payload += '=';
          break;
      }

      // Base64 URL 解码
      final normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
      final decoded = utf8.decode(base64Decode(normalized));
      final payloadMap = json.decode(decoded) as Map<String, dynamic>;

      // 获取 exp 字段
      final exp = payloadMap['exp'];
      if (exp == null) {
        return null;
      }

      // exp 是 Unix 时间戳（秒）
      return DateTime.fromMillisecondsSinceEpoch(exp * 1000);
    } catch (e) {
      // 解析失败，返回 null
      return null;
    }
  }
}

/// 安全存储异常
///
/// 当安全存储操作失败时抛出
class SecureStorageException implements Exception {
  final String message;

  SecureStorageException(this.message);

  @override
  String toString() => 'SecureStorageException: $message';
}
