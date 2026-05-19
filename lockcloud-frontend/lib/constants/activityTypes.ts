// 与 backend/constants/activity_types.py 镜像保持一致。
// 新增/删除活动类型 → 两边同步改 + 数据库迁移。
// null/空字符串视为"未分类"。

export interface ActivityType {
  value: string;
  label: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { value: 'regular_training', label: '例训' },
  { value: 'internal_training', label: '内训' },
  { value: 'team_building', label: '团建' },
  { value: 'master_class', label: '大师课' },
  { value: 'competition', label: '比赛' },
  { value: 'special_event', label: '特殊活动' },
];

export const ACTIVITY_TYPE_VALUES: ReadonlySet<string> = new Set(
  ACTIVITY_TYPES.map((t) => t.value),
);

const DISPLAY_MAP: Record<string, string> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.value, t.label]),
);

export const UNCATEGORIZED_LABEL = '未分类';

export function activityTypeLabel(value?: string | null): string {
  if (!value) return UNCATEGORIZED_LABEL;
  return DISPLAY_MAP[value] ?? value;
}
