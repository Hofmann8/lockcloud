import type { ActivityKey } from './api/types';

/** 活动页地址。活动名里可能有斜杠之类，放查询串里最稳 */
export function activityHref(key: Pick<ActivityKey, 'activity_date' | 'activity_type' | 'activity_name'>): string {
  const q = new URLSearchParams({
    date: key.activity_date,
    type: key.activity_type || '',
    name: key.activity_name || '',
  });
  return `/activity?${q.toString()}`;
}

export const fileHref = (id: number, t?: number) => (t != null ? `/f/${id}?t=${t.toFixed(1)}` : `/f/${id}`);

/** 修改八拍的工作台；带 requestId 是看一条八拍修改申请 */
export const beatsHref = (fileId: number, requestId?: number) =>
  requestId ? `/beats?file=${fileId}&request=${requestId}` : `/beats?file=${fileId}`;

export const compareHref = (a: number, b: number) => `/compare?a=${a}&b=${b}`;

export const personHref = (id: number) => `/people/${id}`;

/** 登录前想去的地址，SSO 回跳后接着去 */
export const NEXT_KEY = 'lockcloud-next';
