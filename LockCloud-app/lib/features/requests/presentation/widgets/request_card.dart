import 'package:flutter/material.dart';

import '../../../../core/config/theme_config.dart';
import '../../data/models/file_request_model.dart';

/// 请求卡片组件
///
/// 显示单个请求的卡片，包括：
/// - 文件信息（文件名、活动信息）
/// - 请求者/所有者信息
/// - 请求类型和状态
/// - 提议的修改内容
/// - 批准/拒绝按钮（仅收到的待处理请求）
///
/// **Validates: Requirements 6.2, 6.3, 6.6, 6.7, 6.8**
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
        border: Border.all(
          color: _getStatusBorderColor(),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 头部：请求类型和状态
          _buildHeader(),

          const Divider(height: 1, color: ThemeConfig.dividerColor),

          // 内容区域
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 文件信息或目录信息
                if (request.isDirectoryRequest)
                  _buildDirectoryInfo()
                else
                  _buildFileInfo(),

                const SizedBox(height: 12),

                // 请求者/所有者信息
                _buildUserInfo(),

                // 提议的修改内容
                if (request.proposedChanges != null) ...[
                  const SizedBox(height: 12),
                  _buildProposedChanges(),
                ],

                // 请求消息
                if (request.message != null &&
                    request.message!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _buildMessage(),
                ],

                // 响应消息（已处理的请求）
                if (request.responseMessage != null &&
                    request.responseMessage!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _buildResponseMessage(),
                ],

                // 时间信息
                const SizedBox(height: 12),
                _buildTimeInfo(),
              ],
            ),
          ),

          // 操作按钮（仅收到的待处理请求）
          if (isReceived && request.isPending) ...[
            const Divider(height: 1, color: ThemeConfig.dividerColor),
            _buildActionButtons(),
          ],
        ],
      ),
    );
  }

  /// 获取状态边框颜色
  Color _getStatusBorderColor() {
    switch (request.status) {
      case RequestStatus.pending:
        return Colors.orange.withValues(alpha: 0.5);
      case RequestStatus.approved:
        return Colors.green.withValues(alpha: 0.5);
      case RequestStatus.rejected:
        return Colors.red.withValues(alpha: 0.5);
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
      ),
      child: Row(
        children: [
          // 请求类型图标
          Icon(
            _getRequestTypeIcon(),
            size: 18,
            color: ThemeConfig.primaryColor,
          ),
          const SizedBox(width: 8),
          // 请求类型
          Text(
            request.requestTypeDisplay,
            style: const TextStyle(
              color: ThemeConfig.onBackgroundColor,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          // 状态标签
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _getStatusColor().withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              request.statusDisplay,
              style: TextStyle(
                color: _getStatusColor(),
                fontSize: 12,
                fontWeight: FontWeight.w500,
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
            const Icon(
              Icons.insert_drive_file,
              size: 16,
              color: ThemeConfig.onSurfaceVariantColor,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                file.filename,
                style: const TextStyle(
                  color: ThemeConfig.onBackgroundColor,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
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
              file.activityType,
              file.activityName,
            ].where((e) => e != null && e.isNotEmpty).join(' · '),
            style: const TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
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
            const Icon(
              Icons.folder,
              size: 16,
              color: ThemeConfig.onSurfaceVariantColor,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${directoryInfo.activityDate} / ${directoryInfo.activityType} / ${directoryInfo.activityName}',
                style: const TextStyle(
                  color: ThemeConfig.onBackgroundColor,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
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
          size: 16,
          color: ThemeConfig.onSurfaceVariantColor,
        ),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(
            color: ThemeConfig.onSurfaceVariantColor,
            fontSize: 12,
          ),
        ),
        Text(
          user?.name ?? '未知用户',
          style: const TextStyle(
            color: ThemeConfig.onBackgroundColor,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  /// 构建提议的修改内容
  Widget _buildProposedChanges() {
    final changes = request.proposedChanges!;
    final changeItems = <Widget>[];

    if (changes.activityDate != null) {
      changeItems.add(_buildChangeItem('活动日期', changes.activityDate!));
    }
    if (changes.activityType != null) {
      changeItems.add(_buildChangeItem('活动类型', changes.activityType!));
    }
    if (changes.activityName != null) {
      changeItems.add(_buildChangeItem('活动名称', changes.activityName!));
    }
    if (changes.newActivityName != null) {
      changeItems.add(_buildChangeItem('新活动名称', changes.newActivityName!));
    }
    if (changes.newActivityType != null) {
      changeItems.add(_buildChangeItem('新活动类型', changes.newActivityType!));
    }
    if (changes.filename != null) {
      changeItems.add(_buildChangeItem('文件名', changes.filename!));
    }
    if (changes.freeTags != null && changes.freeTags!.isNotEmpty) {
      changeItems.add(_buildChangeItem('标签', changes.freeTags!.join(', ')));
    }

    if (changeItems.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '提议的修改',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          ...changeItems,
        ],
      ),
    );
  }

  /// 构建修改项
  Widget _buildChangeItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 70,
            child: Text(
              label,
              style: const TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
                fontSize: 12,
              ),
            ),
          ),
          const Icon(
            Icons.arrow_forward,
            size: 12,
            color: ThemeConfig.primaryColor,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: ThemeConfig.onBackgroundColor,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建请求消息
  Widget _buildMessage() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: ThemeConfig.surfaceContainerColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '请求说明',
            style: TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            request.message!,
            style: const TextStyle(
              color: ThemeConfig.onBackgroundColor,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建响应消息
  Widget _buildResponseMessage() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: request.isRejected
            ? Colors.red.withValues(alpha: 0.1)
            : Colors.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            request.isRejected ? '拒绝理由' : '批准说明',
            style: TextStyle(
              color: request.isRejected ? Colors.red : Colors.green,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            request.responseMessage!,
            style: const TextStyle(
              color: ThemeConfig.onBackgroundColor,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建时间信息
  Widget _buildTimeInfo() {
    return Row(
      children: [
        Icon(
          Icons.access_time,
          size: 14,
          color: ThemeConfig.onSurfaceVariantColor,
        ),
        const SizedBox(width: 4),
        Text(
          _formatDateTime(request.createdAt),
          style: const TextStyle(
            color: ThemeConfig.onSurfaceVariantColor,
            fontSize: 11,
          ),
        ),
        if (request.updatedAt != null &&
            request.updatedAt != request.createdAt) ...[
          const SizedBox(width: 12),
          Text(
            '更新于 ${_formatDateTime(request.updatedAt!)}',
            style: const TextStyle(
              color: ThemeConfig.onSurfaceVariantColor,
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }

  /// 构建操作按钮
  ///
  /// **Validates: Requirements 6.6, 6.7, 6.8**
  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          // 拒绝按钮
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: ThemeConfig.errorColor,
                side: BorderSide(color: ThemeConfig.errorColor),
                padding: const EdgeInsets.symmetric(vertical: 10),
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
              ),
              child: const Text('批准'),
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化日期时间
  String _formatDateTime(String dateTimeStr) {
    try {
      final dateTime = DateTime.parse(dateTimeStr);
      final now = DateTime.now();
      final diff = now.difference(dateTime);

      if (diff.inDays == 0) {
        if (diff.inHours == 0) {
          if (diff.inMinutes == 0) {
            return '刚刚';
          }
          return '${diff.inMinutes}分钟前';
        }
        return '${diff.inHours}小时前';
      } else if (diff.inDays == 1) {
        return '昨天';
      } else if (diff.inDays < 7) {
        return '${diff.inDays}天前';
      } else {
        return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')}';
      }
    } catch (e) {
      return dateTimeStr;
    }
  }
}
