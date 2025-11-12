/**
 * 错误消息映射工具
 * 将后端返回的错误码映射为用户友好的中文消息
 */

/**
 * 错误码到中文消息的映射表
 */
export const errorMessages: Record<string, string> = {
  // 文件相关错误 (FILE_*)
  FILE_001: '文件不存在',
  FILE_002: '文件大小超出限制',
  FILE_003: '不支持的文件类型',
  FILE_004: 'S3上传失败，请重试',
  FILE_005: '文件名格式无效',
  FILE_006: '文件名生成失败',
  FILE_007: '活动日期格式无效，应为YYYY-MM-DD格式',
  FILE_008: '活动类型无效，请从列表中选择',
  FILE_009: '带训老师标签无效，请从列表中选择',
  
  // 标签相关错误 (TAG_*)
  TAG_001: '标签预设不存在',
  TAG_002: '标签预设已存在',
  TAG_003: '无权限管理标签预设',
  
  // 认证相关错误 (AUTH_*)
  AUTH_001: '未提供认证令牌',
  AUTH_002: '认证令牌无效或已过期',
  AUTH_003: '权限不足',
};

/**
 * 根据错误码获取对应的中文错误消息
 * @param code 错误码（如 'FILE_007'）
 * @returns 对应的中文错误消息，如果错误码不存在则返回默认消息
 */
export function getErrorMessage(code: string): string {
  return errorMessages[code] || '发生未知错误';
}

/**
 * 从错误响应中提取错误消息
 * @param error 错误对象，可能包含 error_code 字段
 * @returns 格式化的错误消息
 */
export function extractErrorMessage(error: any): string {
  // 如果错误对象包含 error_code 字段
  if (error?.error_code) {
    return getErrorMessage(error.error_code);
  }
  
  // 如果错误对象包含 message 字段
  if (error?.message) {
    return error.message;
  }
  
  // 如果是字符串类型的错误
  if (typeof error === 'string') {
    return error;
  }
  
  // 默认错误消息
  return '发生未知错误';
}
