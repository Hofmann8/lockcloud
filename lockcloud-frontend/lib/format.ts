// 显示用的格式化。后端的时间戳是不带时区的 UTC；拍摄时间不带时区时是拍摄地的钟面时间，原样显示不换算。

const pad = (n: number) => String(n).padStart(2, '0');

/** 后端时间戳（naive UTC）→ Date */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 拍摄时间 → 钟面时间的各个分量。
 * 不带时区（照片 EXIF 常见）原样取数字；带时区（视频的 creation_time 多是 UTC）换成看的人所在时区，
 * 不然 `14:25+00:00` 会被当成下午两点，其实是北京晚上十点。
 */
export function wallClock(value: string | null | undefined) {
  if (!value) return null;
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
    }
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] ?? 0) };
}

export function formatTakenAt(value: string | null | undefined): string | null {
  const c = wallClock(value);
  if (!c) return null;
  return `${c.y}年${c.mo}月${c.d}日 ${pad(c.h)}:${pad(c.mi)}`;
}

/** 活动日期 `2026-03-15` → 各个分量，不经过 Date，避免时区把日子挪一天 */
export function splitDate(value: string | null | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3], mm: m[2], dd: m[3] };
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekday(value: string): string {
  const p = splitDate(value);
  if (!p) return '';
  return `周${WEEKDAYS[new Date(p.y, p.m - 1, p.d).getDay()]}`;
}

export function formatDate(value: string | null | undefined): string {
  const p = splitDate(value);
  return p ? `${p.y}年${p.m}月${p.d}日` : '';
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseServerTime(value);
  if (!d) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relativeTime(value: string | null | undefined): string {
  const d = parseServerTime(value);
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** 时长：1:05、12:30、1:02:03 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** 时间码，带十分之一秒：0:34.5 */
export function formatTimecode(seconds: number, precise = false): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  if (!precise) return `${m}:${pad(Math.floor(r))}`;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

export function plural(n: number, unit: string): string {
  return `${n.toLocaleString('zh-CN')} ${unit}`;
}
