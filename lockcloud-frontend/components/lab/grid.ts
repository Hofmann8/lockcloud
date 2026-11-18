import type { Sections } from '@/components/player/beats';
import type { LabGrid, LabMark } from '@/lib/api/lab';

/**
 * 把标注套到算法的网格上，得到现在该怎么数。
 * 一段连续的音乐里小节位置不变，所以标一个"1"，这一段从头到尾都跟着它数；
 * 同一段里后面又标了一个，从那一拍起按新的数（中间有没切开的接口）。标了"换歌"的地方把这一段切开。
 */
export function applyMarks(grid: LabGrid, marks: LabMark[]): { sections: Sections; parts: number[] } {
  const n = grid.times.length;
  const ones = marks.filter((m) => m.kind === 'one').map((m) => m.beat).sort((a, b) => a - b);
  const cuts = marks.filter((m) => m.kind === 'cut').map((m) => m.beat);
  const starts = [...new Set([...grid.sections.map(([s]) => s), ...cuts.filter((c) => c > 0 && c < n)])].sort((a, b) => a - b);
  const sections: Sections = [];
  starts.forEach((s, k) => {
    const e = k + 1 < starts.length ? starts[k + 1] : n;
    const inside = ones.filter((m) => m >= s && m < e);
    if (!inside.length) {
      // 没标：照算法的数（标"换歌"切出来的后半段接着前面数）
      let j = 0;
      while (j + 1 < grid.sections.length && grid.sections[j + 1][0] <= s) j++;
      sections.push([s, grid.sections[j][1]]);
      return;
    }
    sections.push([s, inside[0]]);
    for (const m of inside.slice(1)) if (m > s) sections.push([m, m]);
  });
  return { sections, parts: starts };
}

export const MARK_LABEL: Record<LabMark['kind'], string> = {
  one: '这拍是 1',
  cut: '换歌',
  off: '拍点不准',
  note: '备注',
};

export const WHY_LABEL: Record<string, string> = {
  start: '',
  pause: '停顿',
  tempo: '变速',
  edit: '接口',
  'edit?': '接口？',
};
