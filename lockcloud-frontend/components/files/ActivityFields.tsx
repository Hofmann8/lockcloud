'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, Input } from '@/components/ui/Field';
import { filesApi } from '@/lib/api/files';
import { ACTIVITY_TYPES } from '@/lib/constants/activityTypes';

export interface ActivityValue {
  activity_date: string;
  activity_type: string;
  activity_name: string;
}

/** 批量编辑时选中的文件在这一项上不一致：空着显示"多个…"，不填就不改 */
export interface ActivityMixed {
  date?: boolean;
  type?: boolean;
  name?: boolean;
}

interface ActivityFieldsProps {
  value: ActivityValue;
  onChange: (value: ActivityValue) => void;
  mixed?: ActivityMixed;
  className?: string;
}

/** 活动的三个字段：日期、类型、名字。选了日期后，当天已有的活动做成候选，点一下就填上 */
export function ActivityFields({ value, onChange, mixed = {}, className }: ActivityFieldsProps) {
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(value.activity_date);
  const existing = useQuery({
    queryKey: ['activity-names', value.activity_date],
    queryFn: () => filesApi.activityNames(value.activity_date),
    enabled: validDate,
    meta: { silent: true },
    staleTime: 30_000,
  });
  // 已经填着的那个活动不用再列；只剩它自己时整块不显示
  const candidates = (existing.data?.activity_names ?? []).filter(
    (c) => !(c.name === value.activity_name && c.activity_type === value.activity_type),
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Field label="日期" as="div">
        <DatePicker
          value={value.activity_date}
          placeholder={mixed.date ? '多个日期' : '选择日期'}
          onChange={(d) => onChange({ ...value, activity_date: d })}
        />
        {candidates.length > 0 && (
          <div className="mt-2.5 rounded-xl bg-surface-2 p-2">
            <p className="px-1 pb-1.5 text-[11.5px] text-fg-faint">当天已有的活动</p>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((c) => {
                const on = value.activity_name === c.name && value.activity_type === c.activity_type;
                return (
                  <button
                    key={`${c.name}|${c.activity_type}`}
                    type="button"
                    onClick={() => onChange({ ...value, activity_name: c.name, activity_type: c.activity_type })}
                    className={cn(
                      'inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] transition-colors',
                      on ? 'bg-accent text-accent-fg' : 'bg-surface text-fg-soft shadow-soft hover:text-fg',
                    )}
                  >
                    <span className="truncate">{c.name || '未命名活动'}</span>
                    <span className={cn('shrink-0', on ? 'opacity-80' : 'text-fg-faint')}>{c.activity_type_display}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Field>

      <Field label="类型" as="div">
        {/* 每格按字数要宽度、剩下的平分（"特殊活动"比"例训"宽）；放不下一行就折行。等宽格子在窄栏里会把长的挤出去 */}
        <div role="radiogroup" aria-label="活动类型" className="flex flex-wrap gap-0.5 rounded-xl bg-surface-2 p-0.5">
          {ACTIVITY_TYPES.map((t) => {
            const on = value.activity_type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...value, activity_type: t.value })}
                className={cn(
                  'h-8 flex-auto whitespace-nowrap rounded-[10px] px-1.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
                  on ? 'bg-surface text-fg shadow-soft' : 'text-fg-faint hover:text-fg-soft',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {mixed.type && !value.activity_type && <p className="mt-1.5 text-xs text-fg-faint">类型不一致，不选就保持原样</p>}
      </Field>

      <Field label="活动名称">
        <Input
          value={value.activity_name}
          maxLength={200}
          onChange={(e) => onChange({ ...value, activity_name: e.target.value })}
          placeholder={mixed.name ? '多个名称' : '例如：春季例训'}
        />
      </Field>
    </div>
  );
}
