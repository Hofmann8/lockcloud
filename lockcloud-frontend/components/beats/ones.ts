import { nearestBeat, sectionAt, type Sections } from '@/components/player/beats';

function splitAt(sections: Sections, i: number): Sections {
  const k = sectionAt(sections, i);
  if (sections[k][0] === i) return sections;
  return [...sections.slice(0, k + 1), [i, sections[k][1]], ...sections.slice(k + 1)];
}

/**
 * 把人标的"这一拍是 1"（时刻，秒）套到算法的数法上。
 * 一段连续的音乐里数法不变：标一个，这一段从头到尾都跟着它数；同一段里后面又标了一个，从那一拍起按新的数。
 * bounds 是每一段第一拍的下标。和后端 services/beat_grid.py 的 apply_ones 是同一套规则，改一边要改另一边。
 */
export function applyOnes(times: number[], base: Sections, bounds: number[], ones: number[]): Sections {
  let sections: Sections = base.map(([s, one]) => [s, one]);
  if (!ones.length || !times.length) return sections;
  const marks = [...new Set(ones.map((t) => nearestBeat(times, t)))].sort((a, b) => a - b);
  bounds.forEach((lo, k) => {
    const hi = k + 1 < bounds.length ? bounds[k + 1] : times.length;
    const inside = marks.filter((m) => m >= lo && m < hi);
    if (!inside.length) return;
    for (const m of inside.slice(1)) sections = splitAt(sections, m);
    for (const s of sections) {
      if (s[0] >= lo && s[0] < hi) s[1] = Math.max(...inside.filter((m) => m <= s[0] || m === inside[0]));
    }
  });
  return sections;
}
