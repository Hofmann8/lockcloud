// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'signed_url_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$signedUrlHash() => r'2a3f42f4e18d48e928b8b500cbfa2968e61144e5';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

/// 单个文件签名URL Provider
///
/// 用于获取单个文件的签名URL，自动处理缓存
///
/// Copied from [signedUrl].
@ProviderFor(signedUrl)
const signedUrlProvider = SignedUrlFamily();

/// 单个文件签名URL Provider
///
/// 用于获取单个文件的签名URL，自动处理缓存
///
/// Copied from [signedUrl].
class SignedUrlFamily extends Family<AsyncValue<String?>> {
  /// 单个文件签名URL Provider
  ///
  /// 用于获取单个文件的签名URL，自动处理缓存
  ///
  /// Copied from [signedUrl].
  const SignedUrlFamily();

  /// 单个文件签名URL Provider
  ///
  /// 用于获取单个文件的签名URL，自动处理缓存
  ///
  /// Copied from [signedUrl].
  SignedUrlProvider call(
    int fileId, {
    StylePreset style = StylePreset.thumbdesktop,
  }) {
    return SignedUrlProvider(fileId, style: style);
  }

  @override
  SignedUrlProvider getProviderOverride(covariant SignedUrlProvider provider) {
    return call(provider.fileId, style: provider.style);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'signedUrlProvider';
}

/// 单个文件签名URL Provider
///
/// 用于获取单个文件的签名URL，自动处理缓存
///
/// Copied from [signedUrl].
class SignedUrlProvider extends AutoDisposeFutureProvider<String?> {
  /// 单个文件签名URL Provider
  ///
  /// 用于获取单个文件的签名URL，自动处理缓存
  ///
  /// Copied from [signedUrl].
  SignedUrlProvider(int fileId, {StylePreset style = StylePreset.thumbdesktop})
    : this._internal(
        (ref) => signedUrl(ref as SignedUrlRef, fileId, style: style),
        from: signedUrlProvider,
        name: r'signedUrlProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$signedUrlHash,
        dependencies: SignedUrlFamily._dependencies,
        allTransitiveDependencies: SignedUrlFamily._allTransitiveDependencies,
        fileId: fileId,
        style: style,
      );

  SignedUrlProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.fileId,
    required this.style,
  }) : super.internal();

  final int fileId;
  final StylePreset style;

  @override
  Override overrideWith(
    FutureOr<String?> Function(SignedUrlRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: SignedUrlProvider._internal(
        (ref) => create(ref as SignedUrlRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        fileId: fileId,
        style: style,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<String?> createElement() {
    return _SignedUrlProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is SignedUrlProvider &&
        other.fileId == fileId &&
        other.style == style;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, fileId.hashCode);
    hash = _SystemHash.combine(hash, style.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin SignedUrlRef on AutoDisposeFutureProviderRef<String?> {
  /// The parameter `fileId` of this provider.
  int get fileId;

  /// The parameter `style` of this provider.
  StylePreset get style;
}

class _SignedUrlProviderElement
    extends AutoDisposeFutureProviderElement<String?>
    with SignedUrlRef {
  _SignedUrlProviderElement(super.provider);

  @override
  int get fileId => (origin as SignedUrlProvider).fileId;
  @override
  StylePreset get style => (origin as SignedUrlProvider).style;
}

String _$batchSignedUrlNotifierHash() =>
    r'44a2a7ee9968cba623ec73e8c38da86dd44ca3ea';

/// 批量签名URL Notifier
///
/// 管理一组文件的签名URL，支持批量获取
///
/// Copied from [BatchSignedUrlNotifier].
@ProviderFor(BatchSignedUrlNotifier)
final batchSignedUrlNotifierProvider =
    AutoDisposeNotifierProvider<
      BatchSignedUrlNotifier,
      BatchSignedUrlState
    >.internal(
      BatchSignedUrlNotifier.new,
      name: r'batchSignedUrlNotifierProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$batchSignedUrlNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$BatchSignedUrlNotifier = AutoDisposeNotifier<BatchSignedUrlState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
