// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_User _$UserFromJson(Map<String, dynamic> json) => _User(
  id: (json['id'] as num).toInt(),
  email: json['email'] as String,
  name: json['name'] as String,
  avatarKey: json['avatar_key'] as String?,
  avatarUrl: json['avatar_url'] as String?,
  createdAt: DateTime.parse(json['created_at'] as String),
  lastLogin: json['last_login'] == null
      ? null
      : DateTime.parse(json['last_login'] as String),
  isActive: json['is_active'] as bool,
  isAdmin: json['is_admin'] as bool,
);

Map<String, dynamic> _$UserToJson(_User instance) => <String, dynamic>{
  'id': instance.id,
  'email': instance.email,
  'name': instance.name,
  'avatar_key': instance.avatarKey,
  'avatar_url': instance.avatarUrl,
  'created_at': instance.createdAt.toIso8601String(),
  'last_login': instance.lastLogin?.toIso8601String(),
  'is_active': instance.isActive,
  'is_admin': instance.isAdmin,
};
