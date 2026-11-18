'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Columns2, FlipHorizontal2, Layers, Pause, Play, Repeat } from 'lucide-react';
import { cn, isTyping } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { PauseMark } from '@/components/brand/PauseMark';
import { BeatRuler } from '@/components/player/BeatRuler';
import { ProgressBar } from '@/components/player/ProgressBar';
import { useHlsSource } from '@/components/player/useHlsSource';
import { beatIndexAt, countOf, eightRange } from '@/components/player/beats';
import { filesApi } from '@/lib/api/files';
import { mediaApi } from '@/lib/api/media';
import type { MediaDetail } from '@/lib/api/types';
import { formatTimecode } from '@/lib/format';
import { useQueryState } from '@/lib/hooks';
import { displayName } from '@/lib/urls';

const SPEEDS = [0.25, 0.5, 0.75, 1];
const FRAME = 1 / 30;

function Side({
  media,
  videoRef,
  mirror,
  className,
  style,
  label,
  muted,
}: {
  media: MediaDetail;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mirror: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  muted?: boolean;
}) {
  // 播放地址只取一次：详情重新拉回来签名是新的，地址一换两边都会从头放
  const [source] = useState(media.playback);
  useHlsSource(videoRef, source?.url, !!source?.hls);
  return (
    <div className={cn('relative min-h-0 min-w-0 overflow-hidden bg-black', className)} style={style}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
        poster={media.poster_url ?? undefined}
        playsInline
        muted={muted}
        preload="auto"
      />
      {label && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white/85 backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}

function ComparePage() {
  const router = useRouter();
  const [params, set] = useQueryState();
  const a = Number(params.get('a'));
  const b = Number(params.get('b'));
  const mode = params.get('mode') === 'overlay' ? 'overlay' : 'side';

  const va = useRef<HTMLVideoElement>(null);
  const vb = useRef<HTMLVideoElement>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [mirrorA, setMirrorA] = useState(false);
  const [mirrorB, setMirrorB] = useState(false);
  const [opacity, setOpacity] = useState(0.5);
  const [loop, setLoop] = useState<[number, number] | null>(null);

  const ma = useQuery({ queryKey: ['media', a], queryFn: () => mediaApi.detail(a), enabled: !!a, staleTime: 30 * 60 * 1000 });
  const mb = useQuery({ queryKey: ['media', b], queryFn: () => mediaApi.detail(b), enabled: !!b, staleTime: 30 * 60 * 1000 });
  const fa = useQuery({ queryKey: ['file', a], queryFn: () => filesApi.get(a), enabled: !!a, meta: { silent: true } });
  const fb = useQuery({ queryKey: ['file', b], queryFn: () => filesApi.get(b), enabled: !!b, meta: { silent: true } });
  const align = useQuery({ queryKey: ['align', a, b], queryFn: () => mediaApi.align(a, b), enabled: !!a && !!b && a !== b, meta: { silent: true }, retry: false });
  const beatsA = useQuery({ queryKey: ['beats', a], queryFn: () => mediaApi.beats(a), enabled: !!ma.data?.beats?.count, meta: { silent: true } });

  // 自动对齐信得过才用；没对上（把握不到三成）就从 0 开始手动调，不然 B 会被挪到一个莫名其妙的位置
  const trusted = !!align.data && align.data.confidence >= 0.3;
  const effective = offset ?? (trusted ? align.data!.offset : 0);
  const offsetRef = useRef(effective);
  const loopRef = useRef(loop);
  useEffect(() => {
    offsetRef.current = effective;
    loopRef.current = loop;
  });

  const period = beatsA.data?.bpm ? 60 / beatsA.data.bpm : 0.5;

  const seek = useCallback((t: number) => {
    const A = va.current;
    const B = vb.current;
    if (!A) return;
    A.currentTime = Math.max(0, t);
    if (B) B.currentTime = Math.max(0, t + offsetRef.current);
    setTime(A.currentTime);
  }, []);

  const toggle = useCallback(() => {
    const A = va.current;
    const B = vb.current;
    if (!A) return;
    if (A.paused) {
      if (B) B.currentTime = Math.max(0, A.currentTime + offsetRef.current);
      void A.play().catch(() => {});
      void B?.play().catch(() => {});
    } else {
      A.pause();
      B?.pause();
    }
  }, []);

  // A 是主，B 跟着：偏差超过 80ms 就拉回来
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const A = va.current;
      const B = vb.current;
      if (A && B && !A.paused) {
        const l = loopRef.current;
        if (l && A.currentTime >= l[1]) {
          A.currentTime = l[0];
          B.currentTime = Math.max(0, l[0] + offsetRef.current);
        }
        const want = A.currentTime + offsetRef.current;
        if (want < 0 || want > (B.duration || Infinity)) {
          if (!B.paused) B.pause();
        } else {
          if (B.paused) void B.play().catch(() => {});
          if (Math.abs(B.currentTime - want) > 0.08) B.currentTime = want;
        }
        if (now - last > 120) {
          last = now;
          setTime(A.currentTime);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (va.current) va.current.playbackRate = rate;
    if (vb.current) vb.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const A = va.current;
    if (!A) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      vb.current?.pause();
    };
    const onMeta = () => setDuration(A.duration || 0);
    // 暂停时的跳转（画中画、系统媒体键）也要同步时间
    const onSeeked = () => setTime(A.currentTime);
    A.addEventListener('play', onPlay);
    A.addEventListener('pause', onPause);
    A.addEventListener('loadedmetadata', onMeta);
    A.addEventListener('seeked', onSeeked);
    return () => {
      A.removeEventListener('play', onPlay);
      A.removeEventListener('pause', onPause);
      A.removeEventListener('loadedmetadata', onMeta);
      A.removeEventListener('seeked', onSeeked);
    };
  }, [ma.data, mb.data, mode]);

  const nudge = (d: number) => {
    const next = effective + d;
    setOffset(next);
    offsetRef.current = next;
    if (vb.current && va.current) vb.current.currentTime = Math.max(0, va.current.currentTime + next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === ',' || e.key === '.') {
        e.preventDefault();
        va.current?.pause();
        seek((va.current?.currentTime ?? 0) + (e.key === ',' ? -FRAME : FRAME));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        seek((va.current?.currentTime ?? 0) + (e.key === 'ArrowLeft' ? -5 : 5));
      } else if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seek, router]);

  const getTime = useCallback(() => va.current?.currentTime ?? 0, []);

  if (!a || !b) {
    return (
      <div className="flex h-dvh items-center justify-center text-fg-faint">请选择两段视频进行对比</div>
    );
  }

  const count = beatsA.data ? (() => {
    const i = beatIndexAt(beatsA.data.times, time);
    return i >= 0 ? countOf(i, beatsA.data.sections) : null;
  })() : null;

  const pill = (active: boolean) =>
    cn('flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] transition-colors', active ? 'bg-white/16 text-stage-fg' : 'text-stage-soft hover:bg-white/10 hover:text-stage-fg');

  return (
    <div className="stage dark fixed inset-0 z-[200] flex flex-col bg-stage text-stage-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 sm:px-3">
        <IconButton tone="stage" label="返回" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] text-stage-fg">
            <span className="font-mono text-stage-faint">A</span> {fa.data ? displayName(fa.data) : ''}
            <span className="mx-2 text-stage-faint">·</span>
            <span className="font-mono text-stage-faint">B</span> {fb.data ? displayName(fb.data) : ''}
          </p>
          <p className="truncate text-[11.5px] text-stage-faint">
            {align.isPending
              ? '正在对齐…'
              : align.data
                ? !trusted
                  ? '无法自动对齐，请手动调整'
                  : offset != null
                    ? `已手动对齐，B 比 A ${effective >= 0 ? '晚' : '早'} ${Math.abs(effective).toFixed(2)} 秒`
                    : `已按音乐对齐，B 比 A ${effective >= 0 ? '晚' : '早'} ${Math.abs(effective).toFixed(2)} 秒`
                : '无法自动对齐，请手动调整'}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/6 p-0.5">
          <button type="button" className={pill(mode === 'side')} onClick={() => set({ mode: null })} aria-pressed={mode === 'side'}>
            <Columns2 className="h-4 w-4" />
            <span className="hidden sm:inline">并排</span>
          </button>
          <button type="button" className={pill(mode === 'overlay')} onClick={() => set({ mode: 'overlay' })} aria-pressed={mode === 'overlay'}>
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">叠加</span>
          </button>
        </div>
      </header>

      <div className={cn('relative min-h-0 flex-1', mode === 'side' ? 'grid grid-rows-2 gap-1 landscape:grid-cols-2 landscape:grid-rows-1 md:grid-cols-2 md:grid-rows-1' : '')}>
        {ma.data && mb.data ? (
          mode === 'side' ? (
            <>
              <Side media={ma.data} videoRef={va} mirror={mirrorA} label="A" />
              <Side media={mb.data} videoRef={vb} mirror={mirrorB} label="B" muted />
            </>
          ) : (
            <>
              <Side media={ma.data} videoRef={va} mirror={mirrorA} className="absolute inset-0" />
              <Side media={mb.data} videoRef={vb} mirror={mirrorB} className="absolute inset-0" style={{ opacity }} muted />
            </>
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <PauseMark size={30} state="busy" className="text-white" />
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 sm:px-4">
        {beatsA.data && <BeatRuler beats={beatsA.data} getTime={getTime} onSeek={seek} onLoopEight={(i) => {
          const r = eightRange(beatsA.data!.times, beatsA.data!.sections, i);
          setLoop(r);
          seek(r[0]);
        }} />}
        <ProgressBar current={time} duration={duration} buffered={duration} onSeek={seek} sprite={ma.data?.sprite} loop={loop} />
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <IconButton tone="stage" label={playing ? '暂停' : '播放'} onClick={toggle}>
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </IconButton>
          <span className="whitespace-nowrap font-mono text-[12px] text-stage-soft tabular">
            {formatTimecode(time)} <span className="text-stage-faint">/ {formatTimecode(duration)}</span>
          </span>
          {count && (
            <span className={cn('ml-2 w-4 text-center font-mono text-[17px] font-semibold tabular', count === 1 ? 'text-stage-accent' : 'text-stage-fg')}>
              {count}
            </span>
          )}
          <div className="flex-1" />
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={cn(pill(rate === s), 'hidden sm:flex')} onClick={() => setRate(s)}>
              <span className="font-mono tabular">{s}×</span>
            </button>
          ))}
          {/* 手机上放不下四个，点一下换一档 */}
          <button
            type="button"
            className={cn(pill(rate !== 1), 'sm:hidden')}
            onClick={() => setRate(SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length])}
            aria-label="播放速度"
          >
            <span className="font-mono tabular">{rate}×</span>
          </button>
          {loop && (
            <button type="button" className={pill(true)} onClick={() => setLoop(null)}>
              <Repeat className="h-3.5 w-3.5" />
              取消循环
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap border-t border-white/10 pt-2 no-scrollbar sm:flex-wrap [&>*]:shrink-0">
          <span className="px-1 text-[12px] text-stage-faint">调整 B</span>
          <button type="button" className={pill(false)} onClick={() => nudge(-period)}>− 1 拍</button>
          <button type="button" className={pill(false)} onClick={() => nudge(-FRAME)}>− 1 帧</button>
          <span className="w-16 text-center font-mono text-[12px] text-stage-soft tabular">{effective >= 0 ? '+' : ''}{effective.toFixed(2)}s</span>
          <button type="button" className={pill(false)} onClick={() => nudge(FRAME)}>+ 1 帧</button>
          <button type="button" className={pill(false)} onClick={() => nudge(period)}>+ 1 拍</button>
          {offset != null && (
            <button
              type="button"
              className={pill(false)}
              onClick={() => {
                const auto = trusted ? align.data!.offset : 0;
                setOffset(null);
                offsetRef.current = auto;
                if (vb.current && va.current) vb.current.currentTime = Math.max(0, va.current.currentTime + auto);
              }}
            >
              {trusted ? '恢复自动' : '重置'}
            </button>
          )}
          <span className="mx-1 h-4 w-px bg-white/15" />
          <button type="button" className={pill(mirrorA)} onClick={() => setMirrorA((m) => !m)}>
            <FlipHorizontal2 className="h-3.5 w-3.5" />A 镜像
          </button>
          <button type="button" className={pill(mirrorB)} onClick={() => setMirrorB((m) => !m)}>
            <FlipHorizontal2 className="h-3.5 w-3.5" />B 镜像
          </button>
          {mode === 'overlay' && (
            <label className="ml-2 flex items-center gap-2 text-[12px] text-stage-faint">
              B 透明度
              <input type="range" min={0.1} max={0.9} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-28 accent-white" />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ComparePage />
    </Suspense>
  );
}
