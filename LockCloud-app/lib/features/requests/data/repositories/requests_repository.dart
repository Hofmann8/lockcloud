import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/file_request_model.dart';

part 'requests_repository.g.dart';

/// 请求列表响应
class RequestListResponse {
  final List<FileRequestModel> requests;
  final int total;
  final int page;
  final int perPage;
  final bool hasNext;

  RequestListResponse({
    required this.requests,
    required this.total,
    required this.page,
    required this.perPage,
    required this.hasNext,
  });

  factory RequestListResponse.fromJson(Map<String, dynamic> json) {
    final requestsList = json['requests'] as List<dynamic>? ?? [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? {};

    return RequestListResponse(
      requests: requestsList
          .map((e) => FileRequestModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: pagination['total'] as int? ?? 0,
      page: pagination['page'] as int? ?? 1,
      perPage: pagination['per_page'] as int? ?? 20,
      hasNext: pagination['has_next'] as bool? ?? false,
    );
  }
}

/// 请求 Repository
///
/// 负责处理所有请求相关的 API 调用，包括：
/// - 获取收到的请求列表
/// - 获取发出的请求列表
/// - 创建请求
/// - 批准请求
/// - 拒绝请求
///
/// **Validates: Requirements 6.2, 6.3, 6.6, 6.7, 6.8**
class RequestsRepository {
  final ApiClient _apiClient;

  RequestsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  /// 获取收到的请求列表
  ///
  /// 返回其他用户对当前用户文件的修改请求
  ///
  /// [status] - 状态筛选 (pending, approved, rejected)
  /// [page] - 页码
  /// [perPage] - 每页数量
  ///
  /// **Validates: Requirements 6.2**
  Future<RequestListResponse> getReceivedRequests({
    String? status,
    int page = 1,
    int perPage = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };

    if (status != null && status.isNotEmpty && status != 'all') {
      queryParams['status'] = status;
    }

    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.requestsReceived,
      queryParameters: queryParams,
    );

    return RequestListResponse.fromJson(response.data!);
  }

  /// 获取发出的请求列表
  ///
  /// 返回当前用户对他人文件的修改请求
  ///
  /// [status] - 状态筛选 (pending, approved, rejected)
  /// [page] - 页码
  /// [perPage] - 每页数量
  ///
  /// **Validates: Requirements 6.3**
  Future<RequestListResponse> getSentRequests({
    String? status,
    int page = 1,
    int perPage = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'per_page': perPage,
    };

    if (status != null && status.isNotEmpty && status != 'all') {
      queryParams['status'] = status;
    }

    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiConstants.requestsSent,
      queryParameters: queryParams,
    );

    return RequestListResponse.fromJson(response.data!);
  }

  /// 获取待处理请求数量
  ///
  /// 返回当前用户收到的待处理请求数量
  ///
  /// **Validates: Requirements 6.5**
  Future<int> getPendingCount() async {
    final response = await getReceivedRequests(
      status: 'pending',
      page: 1,
      perPage: 1,
    );
    return response.total;
  }

  /// 创建文件修改请求
  ///
  /// [params] - 创建请求参数
  ///
  /// **Validates: Requirements 6.6**
  Future<FileRequestModel> createRequest(CreateRequestParams params) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiConstants.requests,
      data: params.toJson(),
    );

    return FileRequestModel.fromJson(response.data!);
  }

  /// 创建目录修改请求
  ///
  /// [params] - 创建目录请求参数
  Future<FileRequestModel> createDirectoryRequest(
      CreateDirectoryRequestParams params) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '${ApiConstants.requests}/directory',
      data: params.toJson(),
    );

    return FileRequestModel.fromJson(response.data!);
  }

  /// 批量创建请求
  ///
  /// [params] - 批量创建请求参数
  Future<List<FileRequestModel>> batchCreateRequests(
      BatchCreateRequestParams params) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '${ApiConstants.requests}/batch',
      data: params.toJson(),
    );

    final requests = response.data!['requests'] as List<dynamic>? ?? [];
    return requests
        .map((e) => FileRequestModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 批准请求
  ///
  /// [requestId] - 请求 ID
  ///
  /// **Validates: Requirements 6.6, 6.7**
  Future<FileRequestModel> approveRequest(int requestId) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      '${ApiConstants.requests}/$requestId/approve',
    );

    return FileRequestModel.fromJson(response.data!);
  }

  /// 拒绝请求
  ///
  /// [requestId] - 请求 ID
  /// [responseMessage] - 拒绝理由（可选）
  ///
  /// **Validates: Requirements 6.8**
  Future<FileRequestModel> rejectRequest(
    int requestId, {
    String? responseMessage,
  }) async {
    final data = <String, dynamic>{};
    if (responseMessage != null && responseMessage.isNotEmpty) {
      data['response_message'] = responseMessage;
    }

    final response = await _apiClient.post<Map<String, dynamic>>(
      '${ApiConstants.requests}/$requestId/reject',
      data: data.isNotEmpty ? data : null,
    );

    return FileRequestModel.fromJson(response.data!);
  }

  /// 获取请求详情
  ///
  /// [requestId] - 请求 ID
  Future<FileRequestModel> getRequestDetail(int requestId) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      '${ApiConstants.requests}/$requestId',
    );

    return FileRequestModel.fromJson(response.data!);
  }

  /// 取消请求
  ///
  /// [requestId] - 请求 ID
  Future<void> cancelRequest(int requestId) async {
    await _apiClient.delete('${ApiConstants.requests}/$requestId');
  }
}

/// RequestsRepository Provider
///
/// 提供 RequestsRepository 实例的 Riverpod Provider
@Riverpod(keepAlive: true)
RequestsRepository requestsRepository(Ref ref) {
  final apiClient = ref.watch(apiClientProvider);
  return RequestsRepository(apiClient: apiClient);
}
