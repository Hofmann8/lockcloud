'use client';

import { Dialog } from '@/components/ui/Dialog';
import { Kbd } from '@/components/ui/Field';
import { modKey } from '@/lib/cn';

const GROUPS: Array<{ title: string; items: Array<[string[], string]> }> = [
  {
    title: '通用',
    items: [
      [[modKey(), 'K'], '命令面板'],
      [['/'], '搜索'],
      [['U'], '上传'],
      [['?'], '快捷键'],
    ],
  },
  {
    title: '查看照片和视频',
    items: [
      [['←', '→'], '上一个 / 下一个'],
      [['Esc'], '关闭'],
      [['I'], '显示 / 隐藏信息'],
      [['空格', 'K'], '播放 / 暂停'],
      [['J', 'L'], '后退 / 前进 5 秒'],
      [['F'], '全屏'],
    ],
  },
  {
    title: '练舞',
    items: [
      [[',', '.'], '逐帧'],
      [['[', ']'], '设循环起点 / 终点'],
      [['\\'], '取消循环'],
      [['M'], '镜像'],
      [['-', '='], '减速 / 加速'],
      [['⇧', '点节拍器'], '循环这个八拍'],
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="快捷键" className="max-w-lg">
      <div className="grid gap-6 px-6 pb-6 pt-3 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className={g.title.startsWith('查看') ? 'sm:row-span-2' : ''}>
            <h3 className="mb-2 text-[11px] font-medium tracking-wide text-fg-faint">{g.title}</h3>
            <ul className="flex flex-col gap-2">
              {g.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-3 text-[13px] text-fg-soft">
                  <span>{label}</span>
                  <span className="flex gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
