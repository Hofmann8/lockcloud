'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react';
import { cn, isTyping } from '@/lib/cn';
import { PauseMark } from '@/components/brand/PauseMark';
import { applyOnes } from '@/components/beats/ones';
import { LabOverview, LabRuler, type RulerGrid } from '@/components/lab/LabRuler';
import { beatIndexAt, countOf, nearestBeat } from '@/components/player/beats';
import { useHlsSource } from '@/components/player/useHlsSource';
import { toast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api/client';
import { filesApi } from '@/lib/api/files';
import type { LabMark } from '@/lib/api/lab';
import { mediaApi, requestsApi } from '@/lib/api/media';
import type { Beats, FileRequest, MediaDetail } from '@/lib/api/types';
import { formatTimecode } from '@/lib/format';
import { fileHref } from '@/lib/routes';
import { displayName } from '@/lib/urls';

const SPEEDS = [1, 0.75, 0.5];

// 修改八拍的工作台：/beats?file=<id>。上传者、管理员改完直接保存，别人改完发申请；
// 带 &request=<id> 是看一条申请改成了什么（上传者在这里同意、拒绝）。规则见 components/beats/ones.ts。
export default function Page() {
  return (
    <Suspense>
      <BeatFixPage />
    </Suspense>
  );
}

function BeatFixPage() {
  const params = useSearchParams();
  const fileId = Number(params.get('file')) || 0;
  const requestId = Number(params.get('request')) || 0;
  const file = useQuery({ queryKey: ['file', fileId], queryFn: () => filesApi.get(fileId), enabled: fileId > 0 });
  const media = useQuery({ queryKey: ['beat-fix-media', fileId], queryFn: () => mediaApi.detail(fileId), enabled: fileId > 0, refetchOnWindowFocus: false });
  // 不留缓存：每次进来都拿现在生效的那份
  const beats = useQuery({ queryKey: ['beat-fix', fileId], queryFn: () => mediaApi.beats(fileId), enabled: fileId > 0, gcTime: 0, refetchOnWindowFocus: false, retry: false });
  const request = useQuery({
    queryKey: ['requests', 'one', requestId],
    queryFn: async () => {
      const [received, sent] = await Promise.all([requestsApi.received(), requestsApi.sent()]);
      return [...received, ...sent].find((r) => r.id === requestId && r.request_type === 'beats' && r.file_id === fileId) ?? null;
    },
    enabled: requestId > 0,
    refetchOnWindowFocus: false,
  });

  const error = !fileId ? '没有指定视频' : file.error ?? media.error ?? beats.error ?? request.error;
  const waiting = !file.data || !media.data || !beats.data || (requestId > 0 && request.data === undefined);
  const missing = requestId > 0 && request.data === null;

  return (
    <div className="stage fixed inset-0 z-40 flex flex-col bg-stage text-stage-fg">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-stage-line px-4">
        <Link
          href={requestId ? '/requests' : fileId ? fileHref(fileId) : '/'}
          aria-label="返回"
          className="grid size-8 place-items-center rounded-full text-stage-soft hover:bg-white/10 hover:text-stage-fg"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-sm font-medium">修改八拍</h1>
        {file.data && <span className="min-w-0 truncate text-sm text-stage-soft">{displayName(file.data)}</span>}
      </header>
      {error || missing ? (
        <div className="grid flex-1 place-items-center text-sm text-stage-soft">
          {missing ? '这条申请不存在' : typeof error === 'string' ? error : errorMessage(error)}
        </div>
      ) : waiting ? (
        <div className="grid flex-1 place-items-center"><PauseMark size={28} state="busy" /></div>
      ) : (
        <Editor key={`${fileId}-${requestId}`} fileId={fileId} media={media.data!} beats={beats.data!} request={request.data ?? null} />
      )}
    </div>
  );
}

function Editor({ fileId, media, beats, request }: { fileId: number; media: MediaDetail; beats: Beats; request: FileRequest | null }) {
  const qc = useQueryClient();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const countEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const history = useRef<number[][]>([]);
  const [saved, setSaved] = useState<number[]>(beats.ones);
  const [ones, setOnesState] = useState<number[]>(request ? request.proposed_changes?.ones ?? [] : beats.ones);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'save' | 'approve' | 'reject' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [click, setClick] = useState(false);
  const { error: playError } = useHlsSource(video, media.playback?.url, !!media.playback?.hls);

  const reviewing = !!request;
  const canDecide = reviewing && request.status === 'pending' && beats.editable;
  const times = beats.times;
  const duration = Math.max(media.duration ?? 0, (times[times.length - 1] ?? 0) + 1);
  const getTime = useCallback(() => video.current?.currentTime ?? 0, []);
  const sections = useMemo(() => applyOnes(times, beats.base_sections, beats.bounds, ones), [times, beats, ones]);
  const grid = useMemo<RulerGrid>(
    () => ({
      times,
      bpm: beats.bpm,
      sections: beats.base_sections,
      envelope_rate: beats.envelope_rate,
      envelope: beats.envelope,
      blocks: beats.bounds.map((start, k) => ({
        start,
        t0: times[start] ?? 0,
        t1: times[(beats.bounds[k + 1] ?? times.length) - 1] ?? 0,
      })),
    }),
    [times, beats],
  );
  const marks = useMemo<LabMark[]>(() => ones.map((t) => ({ t, beat: nearestBeat(times, t), kind: 'one', text: '' })), [ones, times]);
  const dirty = ones.length !== saved.length || ones.some((t, i) => t !== saved[i]);

  const setOnes = (next: number[]) => {
    history.current.push(ones);
    setOnesState([...next].sort((a, b) => a - b));
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

  // ---- 改
  const markOne = () => {
    if (reviewing || !times.length) return;
    const t = times[nearestBeat(times, getTime())];
    setOnes(ones.includes(t) ? ones.filter((x) => x !== t) : [...ones, t]);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev && !reviewing) setOnesState(prev);
  };

  const refreshPlayers = () => {
    void qc.invalidateQueries({ queryKey: ['beats', fileId] });
    void qc.invalidateQueries({ queryKey: ['requests'] });
  };
  const save = async () => {
    setBusy('save');
    try {
      if (beats.editable) {
        const next = await mediaApi.saveBeatOnes(fileId, ones);
        setSaved(next.ones);
        setOnesState(next.ones);
        refreshPlayers();
        toast('已保存');
      } else {
        await requestsApi.create({ file_id: fileId, request_type: 'beats', proposed_changes: { ones }, message: message.trim() || undefined });
        toast('申请已发送，上传者同意后生效');
        router.push(fileHref(fileId));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const decide = async (approve: boolean) => {
    if (!request) return;
    setBusy(approve ? 'approve' : 'reject');
    try {
      if (approve) await requestsApi.approve(request.id);
      else await requestsApi.reject(request.id);
      refreshPlayers();
      toast(approve ? '已同意，更改已生效' : '已拒绝');
      router.push('/requests');
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  // ---- 当前第几拍的大字、时间、拍子声：每帧直接写 DOM，不走 React
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const period = 60 / (beats.bpm || 120);
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
  }, [beats.bpm, times, sections, duration, click, getTime]);
  useEffect(() => () => void audio.current?.close(), []);

  // ---- 快捷键（每次渲染重新挂，里面用到的都是最新的）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
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
      else if (k === '1') run(markOne);
      else if (k === 'z' || e.key === 'Backspace') run(undo);
      else if (k === 's') run(nextSpeed);
      else if (k === 'm') run(toggleClick);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tool = 'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-stage-soft transition-colors hover:bg-white/10 hover:text-stage-fg';
  const solid = 'h-9 flex-1 rounded-xl bg-white text-[13px] font-medium text-black transition-opacity hover:bg-white/90 disabled:opacity-40';
  const quiet = 'h-9 rounded-xl px-3 text-[13px] text-stage-soft transition-opacity hover:bg-white/10 disabled:opacity-40';

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
            {!reviewing && (
              <>
                <span className="mx-2 h-5 w-px bg-stage-line" />
                <button type="button" onClick={markOne} className={cn(tool, 'bg-stage-accent/90 font-medium text-white hover:bg-stage-accent hover:text-white')}>这拍是 1</button>
                <button type="button" onClick={undo} className={tool} aria-label="撤销"><Undo2 className="size-4" /></button>
              </>
            )}
          </div>
          <div className="mt-2">
            <LabRuler grid={grid} sections={sections} marks={marks} getTime={getTime} onSeek={seek} />
          </div>
          <LabOverview grid={grid} marks={marks} duration={duration} getTime={getTime} onSeek={seek} />
        </div>
      </div>

      <div className="flex w-[300px] shrink-0 flex-col border-l border-stage-line">
        <div className="px-4 pt-3 text-[13px] leading-relaxed text-stage-soft">
          {reviewing ? (
            <>
              <span className="font-medium text-stage-fg">{request.requester?.name ?? '成员'}</span> 申请这样数。
              {request.message && <span className="mt-1 block text-stage-faint">“{request.message}”</span>}
            </>
          ) : (
            '放到真正的「1」，按 1。同一段音乐标一次，整段跟着改。'
          )}
        </div>
        <div className="px-4 pb-1 pt-3 text-xs text-stage-faint">改动</div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2">
          {ones.length === 0 && <li className="px-2.5 py-2 text-[13px] text-stage-faint">{reviewing ? '恢复成原来的数法' : '还没有改动'}</li>}
          {marks.map((m) => (
            <li key={m.t} className="group flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] hover:bg-white/6">
              <button type="button" onClick={() => seek(m.t)} className="font-mono text-xs tabular-nums text-stage-soft hover:text-stage-fg">
                {formatTimecode(m.t, true)}
              </button>
              <span className="text-stage-accent">这拍是 1</span>
              <span className="text-[11px] text-stage-faint">原来数 {countOf(m.beat, beats.base_sections)}</span>
              {!reviewing && (
                <button
                  type="button"
                  aria-label="删除"
                  onClick={() => setOnes(ones.filter((t) => t !== m.t))}
                  className="ml-auto grid size-6 place-items-center rounded-full text-stage-faint opacity-0 hover:bg-white/10 hover:text-stage-fg group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="shrink-0 space-y-2 border-t border-stage-line p-3">
          {reviewing ? (
            canDecide ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => void decide(false)} disabled={!!busy} className={quiet}>拒绝</button>
                <button type="button" onClick={() => void decide(true)} disabled={!!busy} className={solid}>同意</button>
              </div>
            ) : (
              <p className="px-1 text-[13px] text-stage-faint">
                {request.status === 'pending' ? '等待上传者处理' : request.status === 'approved' ? '已同意' : '已拒绝'}
              </p>
            )
          ) : (
            <>
              {!beats.editable && (
                <>
                  <p className="px-1 text-xs text-stage-faint">此视频由他人上传，更改需经上传者同意。</p>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="给上传者的留言（可选）"
                    rows={2}
                    maxLength={500}
                    className="w-full resize-none rounded-xl bg-white/6 px-3 py-2 text-[13px] text-stage-fg placeholder:text-stage-faint focus:bg-white/10 focus:outline-none"
                  />
                </>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setOnes([])} disabled={!ones.length || !!busy} className={quiet}>恢复原样</button>
                <button type="button" onClick={() => void save()} disabled={!dirty || !!busy} className={solid}>
                  {beats.editable ? '保存' : '发送申请'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
