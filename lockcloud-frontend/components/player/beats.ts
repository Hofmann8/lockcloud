// 节拍数据的换算。times 是每一拍的时刻（秒，递增）；sections 是相位段 [这段第一拍的下标, 这段里一个"1"的下标]，
// 按第一拍升序，段内每 8 拍一个"1"。换歌、音乐停顿、剪辑接口处小节位置变了，就是新的一段。
// parts 是段落（一个视频里的每支舞）第一拍的下标，第一个是 0，每个都是某个相位段的起点；八拍按段落各自从 1 数。

/** 最后一个 ≤ t 的拍的下标；t 在第一拍之前时返回 -1 */
export function beatIndexAt(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  if (hi < 0 || t < times[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function nearestBeat(times: number[], t: number): number {
  const i = beatIndexAt(times, t);
  if (i < 0) return 0;
  if (i >= times.length - 1) return i;
  return t - times[i] <= times[i + 1] - t ? i : i + 1;
}

export type Sections = [number, number][];

/** 第 i 拍在第几段 */
export function sectionAt(sections: Sections, i: number): number {
  let lo = 0;
  let hi = sections.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sections[mid][0] <= i) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 第 i 拍是八拍里的第几拍（1–8）。段首"1"之前的几拍数成上一个八拍的尾巴（…6 7 8） */
export function countOf(i: number, sections: Sections): number {
  const one = sections[sectionAt(sections, i)][1];
  return (((i - one) % 8) + 8) % 8 + 1;
}

/** 这一段里第一个"1"的下标。段里记的"1"可以是段内任何一个"1"，往前推到段首 */
function firstOne([start, one]: [number, number]): number {
  return start + ((((one - start) % 8) + 8) % 8);
}

/** 第 i 拍在第几个段落（从 0 数） */
export function partAt(parts: number[], i: number): number {
  let k = 0;
  while (k + 1 < parts.length && parts[k + 1] <= i) k++;
  return k;
}

/** 第 i 拍是所在段落的第几个八拍（从 1 数；段落里第一个"1"之前那几拍算第 0 个） */
export function eightOf(i: number, sections: Sections, parts: number[] = [0]): number {
  const k = sectionAt(sections, i);
  const from = sectionAt(sections, parts[partAt(parts, i)] ?? 0);
  let n = 0;
  for (let j = from; j < k; j++) {
    const one = firstOne(sections[j]);
    const end = sections[j + 1][0];
    if (one < end) n += Math.floor((end - 1 - one) / 8) + 1;
  }
  const one = firstOne(sections[k]);
  return i >= one ? n + Math.floor((i - one) / 8) + 1 : n;
}

/** 第 i 拍所在八拍的起止时刻（循环用），截在所在段内：段首不完整的八拍从段首开始，段尾的到段尾那一拍再加一拍长 */
export function eightRange(times: number[], sections: Sections, i: number): [number, number] {
  const k = sectionAt(sections, i);
  const segStart = sections[k][0];
  const segEnd = k + 1 < sections.length ? sections[k + 1][0] : times.length;
  const one = i - (countOf(i, sections) - 1);
  const start = Math.max(segStart, one);
  const end = Math.min(segEnd, one + 8);
  if (end < segEnd) return [times[start], times[end]];
  const period = end - 1 > segStart ? (times[end - 1] - times[segStart]) / (end - 1 - segStart) : 0.5;
  return [times[start], times[end - 1] + period];
}

export function snapToBeat(times: number[], t: number): number {
  if (!times.length) return t;
  return times[nearestBeat(times, t)];
}

/** uint8 base64 起音包络 → 0–1 的数组 */
export function decodeEnvelope(b64: string): Float32Array {
  try {
    const bin = atob(b64);
    const out = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) / 255;
    return out;
  } catch {
    return new Float32Array(0);
  }
}
