// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'batch_selection_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$selectedCountHash() => r'f21433e09e367296a5075d7f338fd19a5f15e2e9';

/// 选中文件数量 Provider
///
/// 便捷 Provider，用于获取当前选中的文件数量
///
/// **Validates: Requirements 2.9**
///
/// Copied from [selectedCount].
@ProviderFor(selectedCount)
final selectedCountProvider = AutoDisposeProvider<int>.internal(
  selectedCount,
  name: r'selectedCountProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$selectedCountHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef SelectedCountRef = AutoDisposeProviderRef<int>;
String _$isInSelectionModeHash() => r'41e8f956517e7a7b72e437000ac7ac7e852cc5f8';

/// 是否处于选择模式 Provider
///
/// 便捷 Provider，用于判断是否处于选择模式
///
/// Copied from [isInSelectionMode].
@ProviderFor(isInSelectionMode)
final isInSelectionModeProvider = AutoDisposeProvider<bool>.internal(
  isInSelectionMode,
  name: r'isInSelectionModeProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isInSelectionModeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef IsInSelectionModeRef = AutoDisposeProviderRef<bool>;
String _$isAllSelectedHash() => r'c58b508298c9b764a95c9d6ce1abb2ef4e417ab2';

/// 是否全选 Provider
///
/// 便捷 Provider，用于判断是否全选
///
/// Copied from [isAllSelected].
@ProviderFor(isAllSelected)
final isAllSelectedProvider = AutoDisposeProvider<bool>.internal(
  isAllSelected,
  name: r'isAllSelectedProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isAllSelectedHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef IsAllSelectedRef = AutoDisposeProviderRef<bool>;
String _$selectedFileIdsHash() => r'ddf46a417885e265c41a2428d463126a6271126a';

/// 选中的文件 ID 列表 Provider
///
/// 便捷 Provider，用于获取选中的文件 ID 列表
///
/// Copied from [selectedFileIds].
@ProviderFor(selectedFileIds)
final selectedFileIdsProvider = AutoDisposeProvider<List<int>>.internal(
  selectedFileIds,
  name: r'selectedFileIdsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$selectedFileIdsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef SelectedFileIdsRef = AutoDisposeProviderRef<List<int>>;
String _$isFileSelectedHash() => r'af5fffcbb5590e8f4f673c667456f1db70b908be';

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

/// 检查文件是否被选中 Provider
///
/// 便捷 Provider，用于检查特定文件是否被选中
///
/// Copied from [isFileSelected].
@ProviderFor(isFileSelected)
const isFileSelectedProvider = IsFileSelectedFamily();

/// 检查文件是否被选中 Provider
///
/// 便捷 Provider，用于检查特定文件是否被选中
///
/// Copied from [isFileSelected].
class IsFileSelectedFamily extends Family<bool> {
  /// 检查文件是否被选中 Provider
  ///
  /// 便捷 Provider，用于检查特定文件是否被选中
  ///
  /// Copied from [isFileSelected].
  const IsFileSelectedFamily();

  /// 检查文件是否被选中 Provider
  ///
  /// 便捷 Provider，用于检查特定文件是否被选中
  ///
  /// Copied from [isFileSelected].
  IsFileSelectedProvider call(int fileId) {
    return IsFileSelectedProvider(fileId);
  }

  @override
  IsFileSelectedProvider getProviderOverride(
    covariant IsFileSelectedProvider provider,
  ) {
    return call(provider.fileId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'isFileSelectedProvider';
}

/// 检查文件是否被选中 Provider
///
/// 便捷 Provider，用于检查特定文件是否被选中
///
/// Copied from [isFileSelected].
class IsFileSelectedProvider extends AutoDisposeProvider<bool> {
  /// 检查文件是否被选中 Provider
  ///
  /// 便捷 Provider，用于检查特定文件是否被选中
  ///
  /// Copied from [isFileSelected].
  IsFileSelectedProvider(int fileId)
    : this._internal(
        (ref) => isFileSelected(ref as IsFileSelectedRef, fileId),
        from: isFileSelectedProvider,
        name: r'isFileSelectedProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$isFileSelectedHash,
        dependencies: IsFileSelectedFamily._dependencies,
        allTransitiveDependencies:
            IsFileSelectedFamily._allTransitiveDependencies,
        fileId: fileId,
      );

  IsFileSelectedProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.fileId,
  }) : super.internal();

  final int fileId;

  @override
  Override overrideWith(bool Function(IsFileSelectedRef provider) create) {
    return ProviderOverride(
      origin: this,
      override: IsFileSelectedProvider._internal(
        (ref) => create(ref as IsFileSelectedRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        fileId: fileId,
      ),
    );
  }

  @override
  AutoDisposeProviderElement<bool> createElement() {
    return _IsFileSelectedProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is IsFileSelectedProvider && other.fileId == fileId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, fileId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin IsFileSelectedRef on AutoDisposeProviderRef<bool> {
  /// The parameter `fileId` of this provider.
  int get fileId;
}

class _IsFileSelectedProviderElement extends AutoDisposeProviderElement<bool>
    with IsFileSelectedRef {
  _IsFileSelectedProviderElement(super.provider);

  @override
  int get fileId => (origin as IsFileSelectedProvider).fileId;
}

String _$batchSelectionNotifierHash() =>
    r'd6dee49c20ffbdc8ef289f557eb4b843fd8fb37e';

/// 批量选择状态管理器
///
/// 使用 Riverpod 管理批量选择状态，提供以下功能：
/// - 进入/退出选择模式
/// - 切换单个文件选择
/// - 全选/取消全选
/// - 清除选择
///
/// **Validates: Requirements 2.8, 2.9, 2.10**
///
/// Copied from [BatchSelectionNotifier].
@ProviderFor(BatchSelectionNotifier)
final batchSelectionNotifierProvider =
    NotifierProvider<BatchSelectionNotifier, BatchSelectionState>.internal(
      BatchSelectionNotifier.new,
      name: r'batchSelectionNotifierProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$batchSelectionNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$BatchSelectionNotifier = Notifier<BatchSelectionState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
