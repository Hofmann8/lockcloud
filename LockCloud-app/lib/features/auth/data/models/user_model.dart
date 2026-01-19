import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

/// 用户模型
/// 
/// 用于表示系统中的用户信息，包括基本信息、头像、状态等。
/// 
/// **Validates: Requirements 1.3, 1.4**
@freezed
sealed class User with _$User {
  const factory User({
    /// 用户唯一标识符
    required int id,
    
    /// 用户邮箱地址
    required String email,
    
    /// 用户姓名
    required String name,
    
    /// 头像在 S3 中的 key
    @JsonKey(name: 'avatar_key') String? avatarKey,
    
    /// 头像完整 URL
    @JsonKey(name: 'avatar_url') String? avatarUrl,
    
    /// 账号创建时间
    @JsonKey(name: 'created_at') required DateTime createdAt,
    
    /// 最后登录时间
    @JsonKey(name: 'last_login') DateTime? lastLogin,
    
    /// 账号是否激活
    @JsonKey(name: 'is_active') required bool isActive,
    
    /// 是否为管理员
    @JsonKey(name: 'is_admin') required bool isAdmin,
  }) = _User;

  /// 从 JSON 创建 User 实例
  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}
