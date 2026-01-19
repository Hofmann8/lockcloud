import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/errors/api_error.dart';
import '../../data/models/user_model.dart';
import '../../data/repositories/auth_repository.dart';

part 'auth_provider.freezed.dart';
part 'auth_provider.g.dart';

/// 认证状态
///
/// 使用 freezed 定义认证的各种状态：
/// - initial: 初始状态，应用刚启动
/// - loading: 加载中，正在检查认证状态或登录
/// - authenticated: 已认证，包含用户信息和 Token
/// - unauthenticated: 未认证，需要登录
/// - error: 错误状态，包含错误信息
///
/// **Validates: Requirements 1.1, 1.5, 1.8**
@freezed
sealed class AuthState with _$AuthState {
  /// 初始状态
  const factory AuthState.initial() = AuthStateInitial;

  /// 加载中状态
  const factory AuthState.loading() = AuthStateLoading;

  /// 已认证状态
  const factory AuthState.authenticated({
    required User user,
    required String token,
  }) = AuthStateAuthenticated;

  /// 未认证状态
  const factory AuthState.unauthenticated() = AuthStateUnauthenticated;

  /// 错误状态
  const factory AuthState.error({
    required String message,
    String? code,
  }) = AuthStateError;
}

/// 认证状态管理器
///
/// 使用 Riverpod 管理认证状态，提供以下功能：
/// - 检查认证状态（应用启动时）
/// - SSO 登录
/// - Token 刷新
/// - 登出
///
/// **Validates: Requirements 1.1, 1.5, 1.8**
@Riverpod(keepAlive: true)
class AuthNotifier extends _$AuthNotifier {
  @override
  AuthState build() {
    // 初始状态，等待检查认证状态
    return const AuthState.initial();
  }

  /// 获取 AuthRepository 实例
  AuthRepository get _repository => ref.read(authRepositoryProvider);

  /// 检查认证状态
  ///
  /// 应用启动时调用，检查本地是否存在有效的 Token。
  /// 如果存在有效 Token，自动恢复登录状态。
  ///
  /// **Validates: Requirements 1.5**
  Future<void> checkAuthStatus() async {
    state = const AuthState.loading();

    try {
      final isLoggedIn = await _repository.isLoggedIn();

      if (!isLoggedIn) {
        state = const AuthState.unauthenticated();
        return;
      }

      // 检查 Token 是否即将过期
      final isExpiringSoon = await _repository.isTokenExpiringSoon();
      if (isExpiringSoon) {
        // 尝试刷新 Token
        try {
          final authResponse = await _repository.refreshToken();
          state = AuthState.authenticated(
            user: authResponse.user,
            token: authResponse.token,
          );
          return;
        } catch (e) {
          // 刷新失败，需要重新登录
          await _repository.logout();
          state = const AuthState.unauthenticated();
          return;
        }
      }

      // Token 有效，恢复用户状态
      final user = await _repository.getStoredUser();
      final token = await _repository.getToken();

      if (user != null && token != null) {
        state = AuthState.authenticated(user: user, token: token);
      } else {
        // 数据不完整，尝试从服务器获取
        try {
          final currentUser = await _repository.getCurrentUser();
          final currentToken = await _repository.getToken();
          if (currentToken != null) {
            state = AuthState.authenticated(user: currentUser, token: currentToken);
          } else {
            state = const AuthState.unauthenticated();
          }
        } catch (e) {
          state = const AuthState.unauthenticated();
        }
      }
    } catch (e) {
      state = AuthState.error(message: _getErrorMessage(e));
    }
  }

  /// SSO 登录
  ///
  /// 使用 SSO Token 进行登录验证。
  ///
  /// [ssoToken] - 从 SSO 认证页面获取的 Token
  ///
  /// **Validates: Requirements 1.1, 1.3**
  Future<void> loginWithSSO(String ssoToken) async {
    state = const AuthState.loading();

    try {
      final authResponse = await _repository.loginWithSSO(ssoToken);
      state = AuthState.authenticated(
        user: authResponse.user,
        token: authResponse.token,
      );
    } on ApiError catch (e) {
      state = AuthState.error(message: e.message, code: e.code);
    } on DioException catch (e) {
      state = AuthState.error(message: _getDioErrorMessage(e));
    } catch (e) {
      state = AuthState.error(message: _getErrorMessage(e));
    }
  }

  /// 邮箱密码登录
  ///
  /// 使用邮箱和密码进行登录：
  /// 1. 先调用 SSO 服务获取 SSO token
  /// 2. 再用 SSO token 换取 LockCloud token
  ///
  /// **Validates: Requirements 1.1, 1.2**
  Future<void> login(String email, String password) async {
    state = const AuthState.loading();

    try {
      final authResponse = await _repository.login(email, password);
      state = AuthState.authenticated(
        user: authResponse.user,
        token: authResponse.token,
      );
    } on ApiError catch (e) {
      state = AuthState.error(message: e.message, code: e.code);
    } on DioException catch (e) {
      state = AuthState.error(message: _getDioErrorMessage(e));
    } catch (e) {
      state = AuthState.error(message: _getErrorMessage(e));
    }
  }

  /// 刷新 Token
  ///
  /// 手动刷新 JWT Token。
  ///
  /// **Validates: Requirements 1.6**
  Future<void> refreshToken() async {
    // 只有在已认证状态下才能刷新
    final currentState = state;
    if (currentState is! AuthStateAuthenticated) {
      return;
    }

    try {
      final authResponse = await _repository.refreshToken();
      state = AuthState.authenticated(
        user: authResponse.user,
        token: authResponse.token,
      );
    } catch (e) {
      // 刷新失败，登出
      await logout();
    }
  }

  /// 登出
  ///
  /// 清除所有本地存储的认证数据并返回未认证状态。
  ///
  /// **Validates: Requirements 1.8**
  Future<void> logout() async {
    state = const AuthState.loading();

    try {
      await _repository.logout();
    } finally {
      state = const AuthState.unauthenticated();
    }
  }

  /// 更新用户信息
  ///
  /// 当用户信息发生变化时（如更新头像），更新状态中的用户信息。
  void updateUser(User user) {
    final currentState = state;
    if (currentState is AuthStateAuthenticated) {
      state = AuthState.authenticated(
        user: user,
        token: currentState.token,
      );
    }
  }

  /// 获取 Dio 错误消息
  String _getDioErrorMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return '请求超时，请检查网络连接';
      case DioExceptionType.connectionError:
        return '网络连接失败，请检查网络设置';
      case DioExceptionType.badResponse:
        final response = e.response;
        if (response?.data is Map) {
          final error = response!.data['error'];
          if (error is Map) {
            return error['message'] ?? '服务器错误';
          }
        }
        return '服务器错误，请稍后重试';
      default:
        return '请求失败，请稍后重试';
    }
  }

  /// 获取通用错误消息
  String _getErrorMessage(dynamic e) {
    if (e is ApiError) {
      return e.message;
    }
    if (e is Exception) {
      return e.toString().replaceFirst('Exception: ', '');
    }
    return '未知错误';
  }
}

/// 是否已认证 Provider
///
/// 便捷 Provider，用于快速检查用户是否已认证。
/// 用于路由守卫等场景。
@riverpod
bool isAuthenticated(Ref ref) {
  final authState = ref.watch(authNotifierProvider);
  return authState is AuthStateAuthenticated;
}

/// 当前用户 Provider
///
/// 便捷 Provider，用于获取当前登录用户。
/// 如果未登录，返回 null。
@riverpod
User? currentUser(Ref ref) {
  final authState = ref.watch(authNotifierProvider);
  return switch (authState) {
    AuthStateAuthenticated(:final user) => user,
    _ => null,
  };
}
