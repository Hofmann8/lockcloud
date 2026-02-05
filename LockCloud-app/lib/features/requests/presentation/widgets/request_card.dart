import 'package:flutter/material.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/file_request_model.dart';

/// 请求卡片组件
///
/// 显示单个请求的卡片，包括：
/// - 左侧彩色边框指示请求类型
/// - 文件信息（文件名、活动信息）
/// - 请求者/所有者信息
/// - 请求类型和状态
/// - 批准/拒绝按钮（仅收到的待处理请求）
class RequestCard extends StatelessWidget {
  final FileRequestModel request;
  final bool isReceived;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;

  const RequestCard({
    super.key,
    required this.request,
    required this.isReceived,
    this.onApprove,
    this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 左侧彩色边框
            Container(
              width: 4,
              constraints: const BoxConstraints(minHeight: 120),
              color: _getTypeColor(),
            ),
            // 内容区域
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 头部：请求类型图标 + 类型名称 + 状态标签
                  _buildHeader(),

                  // 文件信息
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 文件信息或目录信息
                        if (request.isDirectoryRequest)
                          _buildDirectoryInfo()
                        else
                          _buildFileInfo(),

                        const SizedBox(height: 8),

                        // 请求者/所有者信息
                        _buildUserInfo(),

                        // 已处理的请求显示处理时间
                        if (!request.isPending) ...[
                          const SizedBox(height: 4),
                          _buildProcessedTime(),
                        ],
                      ],
                    ),
                  ),

                  // 操作按钮（仅收到的待处理请求）
                  if (isReceived && request.isPending) _buildActionButtons(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 获取请求类型对应的颜色
  Color _getTypeColor() {
    switch (request.requestType) {
      case RequestType.edit:
        return Colors.green;
      case RequestType.delete:
        return Colors.red;
      case RequestType.directoryEdit:
        return Colors.blue;
    }
  }

  /// 获取状态颜色
  Color _getStatusColor() {
    switch (request.status) {
      case RequestStatus.pending:
        return Colors.orange;
      case RequestStatus.approved:
        return Colors.green;
      case RequestStatus.rejected:
        return Colors.red;
    }
  }

  /// 获取状态背景颜色
  Color _getStatusBgColor() {
    switch (request.status) {
      case RequestStatus.pending:
        return Colors.orange.withValues(alpha: 0.15);
      case RequestStatus.approved:
        return Colors.green.withValues(alpha: 0.15);
      case RequestStatus.rejected:
        return Colors.red.withValues(alpha: 0.15);
    }
  }

  /// 获取请求类型图标
  IconData _getRequestTypeIcon() {
    switch (request.requestType) {
      case RequestType.edit:
        return Icons.edit;
      case RequestType.delete:
        return Icons.delete;
      case RequestType.directoryEdit:
        return Icons.folder_open;
    }
  }

  /// 构建头部
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          // 请求类型图标
          Icon(
            _getRequestTypeIcon(),
            size: 18,
            color: _getTypeColor(),
          ),
          const SizedBox(width: 8),
          // 请求类型
          Text(
            request.requestTypeDisplay,
            style: TextStyle(
              color: ThemeConfig.primaryBlack,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          // 状态标签
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _getStatusBgColor(),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              request.statusDisplay,
              style: TextStyle(
                color: _getStatusColor(),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建文件信息
  Widget _buildFileInfo() {
    final file = request.file;
    if (file == null) {
      return const Text(
        '文件信息不可用',
        style: TextStyle(
          color: ThemeConfig.onSurfaceVariantColor,
          fontSize: 14,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 文件名
        Row(
          children: [
            Icon(
              Icons.insert_drive_file,
              size: 16,
              color: ThemeConfig.onSurfaceVariantColor,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                file.filename,
                style: TextStyle(
                  color: ThemeConfig.primaryBlack,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        // 活动信息
        if (file.activityDate != null || file.activityType != null) ...[
          const SizedBox(height: 4),
          Text(
            [
              file.activityDate,
              if (file.activityType != null) '#${file.activityType}',
              file.activityName,
            ].where((e) => e != null && e.isNotEmpty).join(' · '),
            style: TextStyle(
              color: ThemeConfig.accentGray,
              fontSize: 12,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  /// 构建目录信息
  Widget _buildDirectoryInfo() {
    final directoryInfo = request.directoryInfo;
    if (directoryInfo == null) {
      return const Text(
        '目录信息不可用',
        style: TextStyle(
          color: ThemeConfig.onSurfaceVariantColor,
          fontSize: 14,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.folder,
              size: 16,
              color: ThemeConfig.onSurfaceVariantColor,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${directoryInfo.activityDate} / ${directoryInfo.activityType} / ${directoryInfo.activityName}',
                style: TextStyle(
                  color: ThemeConfig.primaryBlack,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// 构建用户信息
  Widget _buildUserInfo() {
    final user = isReceived ? request.requester : request.owner;
    final label = isReceived ? '请求者' : '所有者';

    return Row(
      children: [
        Icon(
          Icons.person_outline,
          size: 14,
          color: ThemeConfig.accentGray,
        ),
        const SizedBox(width: 6),
        Text(
          '$label: ${user?.name ?? '未知用户'}',
          style: TextStyle(
            color: ThemeConfig.accentGray,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  /// 构建已处理时间
  Widget _buildProcessedTime() {
    return Text(
      '处理于 ${_formatDate(request.updatedAt ?? request.createdAt)}',
      style: TextStyle(
        color: ThemeConfig.accentGray,
        fontSize: 12,
      ),
    );
  }

  /// 构建操作按钮
  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Row(
        children: [
          // 拒绝按钮
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: ThemeConfig.errorColor,
                side: BorderSide(color: ThemeConfig.errorColor.withValues(alpha: 0.5)),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text('拒绝'),
            ),
          ),
          const SizedBox(width: 12),
          // 批准按钮
          Expanded(
            child: ElevatedButton(
              onPressed: onApprove,
              style: ElevatedButton.styleFrom(
                backgroundColor: ThemeConfig.primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                elevation: 0,
              ),
              child: const Text('批准'),
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化日期
  String _formatDate(String dateTimeStr) {
    try {
      final dateTime = DateTime.parse(dateTimeStr);
      return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')}';
    } catch (e) {
      return dateTimeStr;
    }
  }
}
