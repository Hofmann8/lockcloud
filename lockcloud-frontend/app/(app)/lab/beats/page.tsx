'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CircleDashed, Pause, Play, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react';
import { cn, isTyping } from '@/lib/cn';
import { PauseMark } from '@/components/brand/PauseMark';
import { LabOverview, LabRuler } from '@/components/lab/LabRuler';
import { applyMarks, MARK_LABEL } from '@/components/lab/grid';
import { beatIndexAt, countOf, nearestBeat } from '@/components/player/beats';
import { useHlsSource } from '@/components/player/useHlsSource';
import { errorMessage } from '@/lib/api/client';
import { labApi, type LabGrid, type LabLabels, type LabMark, type LabSample, type MarkKind } from '@/lib/api/lab';
import { mediaApi } from '@/lib/api/media';
import type { MediaDetail } from '@/lib/api/types';
import { formatDuration, formatTimecode } from '@/lib/format';

const SPEEDS = [1, 0.75, 0.5];

// 节拍标注（本地试验用）：一批视频按现在的算法打好拍子，人来标哪里不对。数据在后端 instance/beat_lab/。
export default function BeatLabPage() {
  const samples = useQuery({ queryKey: ['lab-samples'], queryFn: labApi.samples, retry: false });
  const [chosen, setChosen] = useState<number | null>(null);
  const ready = useMemo(() => (samples.data ?? []).filter((s) => s.ready), [samples.data]);
  const [fromUrl] = useState(() =>
    typeof window === 'undefined' ? NaN : Number(new URLSearchParams(window.location.search).get('id')),
  );
  // 没点过就开地址栏里那个，再不然第一个还没标的
  const id = chosen ?? (ready.find((s) => s.file_id === fromUrl) ?? ready.find((s) => !s.status) ?? ready[0])?.file_id ?? null;
  const index = ready.findIndex((s) => s.file_id === id);
  const sample = index >= 0 ? ready[index] : null;

  useEffect(() => {
    if (id != null) window.history.replaceState(null, '', `?id=${id}`);
  }, [id]);

  const go = (d: number) => {
    const next = ready[index + d];
    if (next) setChosen(next.file_id);
  };

  return (
    <div className="stage fixed inset-0 z-40 flex bg-stage text-stage-fg">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-stage-line px-4">
          <Link href="/" aria-label="返回" className="grid size-8 place-items-center rounded-full text-stage-soft hover:bg-white/10 hover:text-stage-fg">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-sm font-medium">节拍标注</h1>
          {sample && (
            <span className="min-w-0 truncate text-sm text-stage-soft">
              {sample.name}
              {!sample.has_allin1 && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-stage-faint">仅 beat_this</span>}
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs tabular-nums text-stage-faint">
            已标 {ready.filter((s) => s.status).length} / {ready.length}
          </span>
        </header>
        {samples.isLoading ? (
          <div className="grid flex-1 place-items-center"><PauseMark size={28} state="busy" /></div>
        ) : !sample ? (
          <div className="grid flex-1 place-items-center text-sm text-stage-soft">
            {samples.error ? errorMessage(samples.error) : '没有标注样本'}
          </div>
        ) : (
          <Workbench key={sample.file_id} sample={sample} onStep={go} />
        )}
      </div>
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-stage-line">
        <div className="px-4 pb-1 pt-3 text-xs text-stage-faint">样本</div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {(samples.data ?? []).map((s) => (
            <li key={s.file_id}>
              <button
                type="button"
                disabled={!s.ready}
                onClick={() => setChosen(s.file_id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors disabled:opacity-40',
                  s.file_id === id ? 'bg-white/12' : 'hover:bg-white/6',
                )}
              >
                <StatusIcon sample={s} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{s.name}</span>
                  <span className="block truncate text-[11px] tabular-nums text-stage-faint">
                    {formatDuration(s.duration)}　{s.bpm ? `${Math.round(s.bpm)} BPM` : ''}　{s.activity_name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Keys />
      </aside>
    </div>
  );
}

function StatusIcon({ sample }: { sample: LabSample }) {
  if (sample.status === 'ok') {
    return <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/90 text-black"><Check className="size-3" strokeWidth={3} /></span>;
  }
  if (sample.status === 'issues') {
    return <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-400/90 text-[10px] font-semibold tabular-nums text-black">{sample.marks}</span>;
  }
  return <CircleDashed className="size-5 shrink-0 text-stage-faint" />;
}

function Keys() {
  const rows: [string, string][] = [
    ['空格', '播放、暂停'],
    ['← →', '前后一拍，按住 Shift 一个八拍'],
    ['1', '这拍是 1'],
    ['C', '这里换歌、有剪辑'],
    ['B', '拍点没踩在拍上'],
    ['N', '写备注'],
    ['Z', '撤销'],
    ['S', '变速'],
    ['回车', '标完，下一个'],
  ];
  return (
    <dl className="grid shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-stage-line px-4 py-3 text-[11px] text-stage-faint">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-stage-soft">{k}</kbd></dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Workbench({ sample, onStep }: { sample: LabSample; onStep: (d: number) => void }) {
  const id = sample.file_id;
  // 不留缓存：每次进来都拿后端存的那份标注
  const data = useQuery({ queryKey: ['lab-sample', id], queryFn: () => labApi.sample(id), gcTime: 0, refetchOnWindowFocus: false });
  const media = useQuery({ queryKey: ['lab-media', id], queryFn: () => mediaApi.detail(id), refetchOnWindowFocus: false });
  if (data.error || media.error) {
    return <div className="grid flex-1 place-items-center text-sm text-stage-soft">{errorMessage(data.error ?? media.error)}</div>;
  }
  if (!data.data || !media.data) {
    return <div className="grid flex-1 place-items-center"><PauseMark size={28} state="busy" /></div>;
  }
  return <Editor sample={sample} grid={data.data.grid} initial={data.data.labels} media={media.data} onStep={onStep} />;
}

function Editor({
  sample,
  grid,
  initial,
  media,
  onStep,
}: {
  sample: LabSample;
  grid: LabGrid;
  initial: LabLabels;
  media: MediaDetail;
  onStep: (d: number) => void;
}) {
  const id = sample.file_id;
  const qc = useQueryClient();
  const video = useRef<HTMLVideoElement>(null);
  const countEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const [labels, setLabels] = useState<LabLabels>({ status: initial.status, note: initial.note, marks: initial.marks });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [click, setClick] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { error: playError } = useHlsSource(video, media.playback?.url, !!media.playback?.hls);

  const times = grid.times;
  const duration = Math.max(media.duration ?? 0, (times[times.length - 1] ?? 0) + 1);
  const getTime = useCallback(() => video.current?.currentTime ?? 0, []);
  const { sections } = useMemo(() => applyMarks(grid, labels.marks), [grid, labels.marks]);

  // ---- 保存：改了就存（停手 0.4 秒后），离开这个视频时把没存的存掉
  const pending = useRef<LabLabels | null>(null);
  const timer = useRef(0);
  const history = useRef<LabMark[][]>([]);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaving('saving');
    try {
      await labApi.save(id, next);
      setSaving(pending.current ? 'saving' : 'saved');
      qc.setQueryData<LabSample[]>(['lab-samples'], (list) =>
        list?.map((s) => (s.file_id === id ? { ...s, status: next.status, marks: next.marks.length } : s)),
      );
    } catch {
      pending.current ??= next;
      setSaving('error');
    }
  }, [id, qc]);
  useEffect(() => () => void flush(), [flush]);

  const change = (next: LabLabels, now = false) => {
    setLabels(next);
    pending.current = next;
    window.clearTimeout(timer.current);
    if (now) void flush();
    else timer.current = window.setTimeout(() => void flush(), 400);
  };
  const setMarks = (marks: LabMark[]) => {
    history.current.push(labels.marks);
    change({ ...labels, marks: [...marks].sort((a, b) => a.t - b.t), status: null });
  };

  // ---- 播放
  const seek = (t: number) => {
    if (video.current) video.current.currentTime = Math.max(0, Math.min(duration - 0.05, t));
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };
  const step = (d: number) => {
    const i = Math.max(0, Math.min(times.length - 1, nearestBeat(times, getTime()) + d));
    seek(times[i] + 0.001);
  };
  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    if (video.current) video.current.playbackRate = s;
  };
  const toggleClick = () => {
    if (!click && !audio.current) audio.current = new AudioContext();
    void audio.current?.resume();
    setClick(!click);
  };

  // ---- 标注
  const mark = (kind: MarkKind) => {
    const beat = nearestBeat(times, getTime());
    const at = labels.marks.findIndex((m) => m.kind === kind && m.beat === beat);
    if (kind === 'note') {
      video.current?.pause();
      if (at < 0) setMarks([...labels.marks, { t: times[beat], beat, kind, text: '' }]);
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-mark="note-${beat}"]`)?.focus());
      return;
    }
    setMarks(at >= 0 ? labels.marks.filter((_, i) => i !== at) : [...labels.marks, { t: times[beat], beat, kind, text: '' }]);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) change({ ...labels, marks: prev, status: null });
  };
  const finish = () => {
    change({ ...labels, status: labels.marks.length || labels.note.trim() ? 'issues' : 'ok' }, true);
    onStep(1);
  };

  // ---- 当前第几拍的大字、时间、拍子声：每帧直接写 DOM，不走 React
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const period = 60 / (grid.bpm || 120);
    const tick = () => {
      const t = getTime();
      const i = beatIndexAt(times, t);
      const on = i >= 0 && t - times[i] < 1.5 * period;
      const count = on ? countOf(i, sections) : 0;
      if (countEl.current) {
        countEl.current.textContent = on ? String(count) : '';
        countEl.current.dataset.one = count === 1 ? '1' : '0';
      }
      if (timeEl.current) timeEl.current.textContent = `${formatTimecode(t, true)} / ${formatTimecode(duration)}`;
      const v = video.current;
      if (click && audio.current && v && !v.paused && on && i !== last && t - times[i] < 0.12) {
        const ctx = audio.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = count === 1 ? 1760 : 1175;
        gain.gain.setValueAtTime(count === 1 ? 0.35 : 0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      }
      last = i;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [grid.bpm, times, sections, duration, click, getTime]);
  useEffect(() => () => void audio.current?.close(), []);

  // ---- 快捷键（每次渲染重新挂，里面用到的都是最新的）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) {
        if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLElement).blur();
        return;
      }
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (e.key === ' ') run(toggle);
      else if (e.key === 'ArrowLeft') run(() => step(e.shiftKey ? -8 : -1));
      else if (e.key === 'ArrowRight') run(() => step(e.shiftKey ? 8 : 1));
      else if (k === '1') run(() => mark('one'));
      else if (k === 'c') run(() => mark('cut'));
      else if (k === 'b') run(() => mark('off'));
      else if (k === 'n') run(() => mark('note'));
      else if (k === 'z' || e.key === 'Backspace') run(undo);
      else if (k === 's') run(nextSpeed);
      else if (k === 'm') run(toggleClick);
      else if (e.key === 'Enter') run(finish);
      else if (e.key === '[') run(() => onStep(-1));
      else if (e.key === ']') run(() => onStep(1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tool = 'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-stage-soft transition-colors hover:bg-white/10 hover:text-stage-fg';

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 bg-black" onClick={toggle}>
          <video
            ref={video}
            className="h-full w-full object-contain"
            poster={media.poster_url ?? undefined}
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <span
            ref={countEl}
            className="pointer-events-none absolute bottom-3 left-4 font-mono text-7xl font-semibold tabular-nums leading-none text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] data-[one=1]:text-stage-accent"
          />
          {playError && <div className="absolute inset-0 grid place-items-center text-sm text-stage-soft">{playError}</div>}
        </div>

        <div className="shrink-0 border-t border-stage-line px-4 pb-3 pt-2">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={toggle} aria-label={playing ? '暂停' : '播放'} className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 translate-x-px" fill="currentColor" />}
            </button>
            <span ref={timeEl} className="mx-2 w-28 font-mono text-xs tabular-nums text-stage-soft" />
            <button type="button" onClick={nextSpeed} className={cn(tool, 'tabular-nums')}>{speed}×</button>
            <button type="button" onClick={toggleClick} className={cn(tool, click && 'bg-white/12 text-stage-fg')}>
              {click ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}拍子声
            </button>
            <span className="mx-2 h-5 w-px bg-stage-line" />
            <button type="button" onClick={() => mark('one')} className={cn(tool, 'bg-stage-accent/90 font-medium text-white hover:bg-stage-accent hover:text-white')}>这拍是 1</button>
            <button type="button" onClick={() => mark('cut')} className={tool}>换歌</button>
            <button type="button" onClick={() => mark('off')} className={tool}>拍点不准</button>
            <button type="button" onClick={() => mark('note')} className={tool}>备注</button>
            <button type="button" onClick={undo} className={tool} aria-label="撤销"><Undo2 className="size-4" /></button>
            <span className="ml-auto text-xs text-stage-faint">
              {saving === 'saving' ? '正在保存' : saving === 'saved' ? '已保存' : saving === 'error' ? '没存上' : ''}
            </span>
          </div>
          <div className="mt-2">
            <LabRuler grid={grid} sections={sections} marks={labels.marks} getTime={getTime} onSeek={seek} />
          </div>
          <LabOverview grid={grid} marks={labels.marks} duration={duration} getTime={getTime} onSeek={seek} />
          <div className="flex items-center gap-4 text-[11px] text-stage-faint">
            <Legend color="rgba(120,220,160,0.9)" label="两个模型一致" />
            <Legend color="rgba(255,190,90,0.95)" label="意见不一" />
            <Legend color="rgba(255,255,255,0.28)" label="只有一个模型" />
          </div>
        </div>
      </div>

      <div className="flex w-[300px] shrink-0 flex-col border-l border-stage-line">
        <div className="px-4 pb-1 pt-3 text-xs text-stage-faint">标注</div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2">
          {labels.marks.length === 0 && <li className="px-2.5 py-2 text-[13px] text-stage-faint">还没有标注</li>}
          {labels.marks.map((m, i) => (
            <li key={`${m.kind}-${m.beat}`} className="group rounded-xl px-2.5 py-1.5 hover:bg-white/6">
              <div className="flex items-center gap-2 text-[13px]">
                <button type="button" onClick={() => seek(m.t)} className="font-mono text-xs tabular-nums text-stage-soft hover:text-stage-fg">
                  {formatTimecode(m.t, true)}
                </button>
                <span className={cn(m.kind === 'one' && 'text-stage-accent', m.kind === 'off' && 'text-red-300')}>{MARK_LABEL[m.kind]}</span>
                {m.kind === 'one' && <span className="text-[11px] text-stage-faint">原来数 {countOf(m.beat, grid.sections)}</span>}
                <button
                  type="button"
                  aria-label="删除"
                  onClick={() => setMarks(labels.marks.filter((_, j) => j !== i))}
                  className="ml-auto grid size-6 place-items-center rounded-full text-stage-faint opacity-0 hover:bg-white/10 hover:text-stage-fg group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <input
                data-mark={`${m.kind}-${m.beat}`}
                value={m.text}
                onChange={(e) => change({ ...labels, marks: labels.marks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                placeholder="说明"
                className="mt-1 w-full rounded-lg bg-white/6 px-2 py-1 text-xs text-stage-fg placeholder:text-stage-faint focus:bg-white/10 focus:outline-none"
              />
            </li>
          ))}
        </ul>
        <div className="shrink-0 space-y-2 border-t border-stage-line p-3">
          <textarea
            value={labels.note}
            onChange={(e) => change({ ...labels, note: e.target.value })}
            placeholder="这个视频整体的备注"
            rows={3}
            className="w-full resize-none rounded-xl bg-white/6 px-3 py-2 text-[13px] text-stage-fg placeholder:text-stage-faint focus:bg-white/10 focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => onStep(-1)} className="h-9 rounded-xl px-3 text-[13px] text-stage-soft hover:bg-white/10">上一个</button>
            <button type="button" onClick={finish} className="h-9 flex-1 rounded-xl bg-white text-[13px] font-medium text-black hover:bg-white/90">
              {labels.marks.length || labels.note.trim() ? '标完了，下一个' : '全对，下一个'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
