import type { FileItem, User } from './api/types';

/** 上传者和管理员直接改；别人改要走申请 */
export function canEdit(file: Pick<FileItem, 'uploader_id'>, user: User | null): boolean {
  return !!user && (user.is_admin || file.uploader_id === user.id);
}

export function splitByPermission<T extends Pick<FileItem, 'uploader_id' | 'id'>>(files: T[], user: User | null) {
  const own: T[] = [];
  const others: T[] = [];
  for (const f of files) (canEdit(f, user) ? own : others).push(f);
  return { own, others };
}
