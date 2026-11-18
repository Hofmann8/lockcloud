'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FlipHorizontal2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn, isTyping } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { MenuItem, MenuLabel, Popover } from '@/components/ui/Popover';
import { Tooltip } from '@/components/ui/Tooltip';
import { PauseMark } from '@/components/brand/PauseMark';
import { LockAIMark } from '@/components/lockai/LockAI';
import { mediaApi } from '@/lib/api/media';
import type { LockAIStatus, MediaDetail } from '@/lib/api/types';
import { formatTimecode } from '@/lib/format';
import { useUi } from '@/stores/uiStore';
import { AudioStage } from './AudioStage';
import { BeatRuler } from './BeatRuler';
import { ProgressBar, type Marker } from './ProgressBar';
import { useHlsSource } from './useHlsSource';
import { beatIndexAt, countOf, eightOf, eightRange, partAt, snapToBeat } from './beats';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const FRAME = 1 / 30;

export interface PlayerHandle {
  video: HTMLVideoElement | null;
  seek: (t: number) => void;
  play: () => void;
}

interface PlayerProps {
  fileId: number;
  media: MediaDetail;
  /** 发起 LockAI 分析（没分析过的视频，控制条上的按钮） */
  onAnalyze?: () => void;
  markers?: Marker[];
  /** 打开时跳到的时刻（搜索结果、评论点进来） */
  startAt?: number | null;
  autoPlay?: boolean;
  onTime?: (t: number) => void;
  onReady?: (handle: PlayerHandle) => void;
  className?: string;
  /** 播放器右上角的额外按钮（比如信息栏开关） */
  extra?: ReactNode;
}

export function Player({ fileId, media, onAnalyze, markers, startAt, autoPlay = true, onTime, onReady, className, extra }: PlayerProps) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  // 播放地址只取一次：详情重新拉回来时签名是新的，地址一换视频就从头放。只有从原片换成转码后的 HLS 才跟着换
  const [source, setSource] = useState(media.playback);
  if (media.playback && (!source || source.hls !== media.playback.hls)) setSource(media.playback);
  const { qualities, level, setLevel, error: hlsError } = useHlsSource(video, source?.url, !!source?.hls);

  const volume = useUi((s) => s.volume);
  const muted = useUi((s) => s.muted);
  const setVolume = useUi((s) => s.setVolume);
  const metronome = useUi((s) => s.metronome);
  const setMetronome = useUi((s) => s.setMetronome);

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(media.duration ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [rate, setRate] = useState(1);
  const [mirror, setMirror] = useState(false);
  // LockAI 分析过的视频才有节拍器和分段；镜像、循环、逐帧、变速是播放器本身的，谁都能用。
  // 音频（练舞的歌）不用分析：媒体处理时就算好了节拍，直接有节拍器；没有画面，镜像、画中画不出
  const isAudio = media.kind === 'audio';
  const lockai = media.lockai ?? null;
  const analyzed = lockai?.status === 'ready';
  const chapters = useMemo(() => (analyzed ? lockai.chapters : []), [analyzed, lockai]);
  const [loop, setLoop] = useState<[number, number] | null>(null);
  const [pendingA, setPendingA] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [flash, setFlash] = useState<{ key: number; side: 'left' | 'right' | 'center'; label: string } | null>(null);
  const [menu, setMenu] = useState<'speed' | 'quality' | null>(null);
  const speedAnchor = useRef<HTMLButtonElement>(null);
  const qualityAnchor = useRef<HTMLButtonElement>(null);
  const idleTimer = useRef<number | null>(null);
  const scrubWasPlaying = useRef(false);
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // 节拍：分析过才拉（节拍器、循环对齐到拍都用它）。八拍按分析结果分段，key 带上这次分析的完成时间，
  // 重新分析完就是新的 key，不会拿着上一次的缓存
  const beatsQuery = useQuery({
    queryKey: ['beats', fileId, lockai?.finished_at ?? null],
    queryFn: () => mediaApi.beats(fileId),
    enabled: (analyzed || isAudio) && !!media.beats?.count,
    staleTime: 10 * 60 * 1000,
    meta: { silent: true },
  });
  const beats = beatsQuery.data ?? null;
  // 串烧里每首歌的开头对到它的"1"上（后端按 LockAI 的换歌时刻分好的段落），标签、进度条和数拍同时切换
  const timeline = useMemo(() => {
    if (!beats) return chapters;
    const starts = beats.parts.map((i) => beats.times[i]);
    const snap = (t: number) => starts.filter((s) => Math.abs(s - t) <= 2.5).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0] ?? t;
    return chapters.map((c) => ({ ...c, songs: (c.songs ?? []).map(snap) }));
  }, [chapters, beats]);

  const getTime = useCallback(() => video.current?.currentTime ?? 0, []);

  // 当前时刻同时告诉外面（评论的时间点、复制链接用），暂停时拖动、逐帧也要算
  const onTimeRef = useRef(onTime);
  useEffect(() => {
    onTimeRef.current = onTime;
  }, [onTime]);
  const lastTime = useRef(0);
  const loaded = useRef(false);
  const report = useCallback((t: number) => {
    lastTime.current = t;
    setTime(t);
    onTimeRef.current?.(t);
  }, []);

  const seek = useCallback((t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, t), v.duration || t);
    report(v.currentTime);
  }, [report]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  useEffect(() => {
    onReady?.({ video: video.current, seek, play: () => void video.current?.play().catch(() => {}) });
  }, [onReady, seek]);

  // 音量跟着人走
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = rate;
  }, [rate]);

  // 播放时用 rAF 更新时间（timeupdate 只有 4Hz，AB 循环和计数不够准）
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const v = video.current;
      if (v) {
        const l = loopRef.current;
        if (l && v.currentTime >= l[1]) v.currentTime = l[0];
        if (now - last > 120) {
          last = now;
          report(v.currentTime);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, report]);

  // 全屏状态
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const pokeIdle = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 2600);
  }, []);

  const showFlash = (side: 'left' | 'right' | 'center', label: string) => setFlash({ key: Date.now(), side, label });

  const toggleFullscreen = useCallback(() => {
    const el = root.current;
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.();
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const v = video.current;
      if (!v) return;
      v.pause();
      seek(v.currentTime + dir * FRAME);
    },
    [seek],
  );

  const markLoop = useCallback(
    (which: 'a' | 'b') => {
      const v = video.current;
      if (!v) return;
      let t = v.currentTime;
      if (beats) t = snapToBeat(beats.times, t);
      if (which === 'a') {
        setPendingA(t);
        setLoop((l) => (l && l[1] > t ? [t, l[1]] : null));
        showFlash('center', `起点 ${formatTimecode(t, true)}`);
      } else {
        const a = pendingA ?? loop?.[0] ?? 0;
        if (t <= a + 0.1) {
          showFlash('center', '终点要在起点之后');
          return;
        }
        setLoop([a, t]);
        setPendingA(null);
        showFlash('center', `循环 ${formatTimecode(a, true)} – ${formatTimecode(t, true)}`);
      }
    },
    [beats, pendingA, loop],
  );

  const clearLoop = useCallback(() => {
    setLoop(null);
    setPendingA(null);
  }, []);

  /** 控制条上的循环按钮：点一下设起点，再点设终点，循环时点一下取消 */
  const cycleLoop = useCallback(() => {
    if (loop) {
      clearLoop();
      showFlash('center', '已取消循环');
    } else markLoop(pendingA == null ? 'a' : 'b');
  }, [loop, pendingA, clearLoop, markLoop]);

  const loopEight = useCallback(
    (beatIndex?: number) => {
      if (!beats) return;
      const i = beatIndex ?? Math.max(0, beatIndexAt(beats.times, video.current?.currentTime ?? 0));
      const [a, b] = eightRange(beats.times, beats.sections, i);
      setLoop([a, b]);
      setPendingA(null);
      seek(a);
      void video.current?.play().catch(() => {});
      showFlash('center', `循环第 ${Math.max(1, eightOf(i, beats.sections, beats.parts))} 个八拍`);
    },
    [beats, seek],
  );

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const v = video.current;
      if (!v) return;
      const k = e.key;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
        pokeIdle();
      };
      if (k === ' ' || k === 'k' || k === 'K') {
        handled();
        toggle();
      } else if (k === 'j' || k === 'J' || (k === 'ArrowLeft' && !e.shiftKey)) {
        handled();
        seek(v.currentTime - 5);
        showFlash('left', '− 5 秒');
      } else if (k === 'l' || k === 'L' || (k === 'ArrowRight' && !e.shiftKey)) {
        handled();
        seek(v.currentTime + 5);
        showFlash('right', '+ 5 秒');
      } else if (k === 'f' || k === 'F') {
        handled();
        toggleFullscreen();
      } else if (k === ',') {
        handled();
        step(-1);
      } else if (k === '.') {
        handled();
        step(1);
      } else if (k === 'm' || k === 'M') {
        handled();
        setMirror((m) => !m);
      } else if (k === '[') {
        handled();
        markLoop('a');
      } else if (k === ']') {
        handled();
        markLoop('b');
      } else if (k === '\\') {
        handled();
        clearLoop();
      } else if (k === '-' || k === '=') {
        handled();
        const i = SPEEDS.indexOf(rate);
        const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? 3 : i) + (k === '-' ? -1 : 1)))];
        setRate(next);
        showFlash('center', `${next}×`);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [toggle, seek, toggleFullscreen, step, markLoop, clearLoop, rate, pokeIdle]);

  // 手机：点一下显示 / 隐藏控制条，左右两侧双击快退快进
  const lastTap = useRef<{ t: number; x: number } | null>(null);
  const onSurfacePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      toggle();
      return;
    }
    const r = root.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const now = Date.now();
    if (lastTap.current && now - lastTap.current.t < 300) {
      lastTap.current = null;
      if (x < 0.35) {
        seek((video.current?.currentTime ?? 0) - 5);
        showFlash('left', '− 5 秒');
      } else if (x > 0.65) {
        seek((video.current?.currentTime ?? 0) + 5);
        showFlash('right', '+ 5 秒');
      } else toggle();
      return;
    }
    lastTap.current = { t: now, x };
    window.setTimeout(() => {
      if (lastTap.current?.t === now) {
        lastTap.current = null;
        if (idle || !started) pokeIdle();
        else setIdle(true);
      }
    }, 300);
  };

  const count = useMemo(() => {
    if (!beats) return null;
    const i = beatIndexAt(beats.times, time);
    if (i < 0) return null;
    return {
      count: countOf(i, beats.sections),
      eight: eightOf(i, beats.sections, beats.parts),
      part: beats.parts.length > 1 ? partAt(beats.parts, i) + 1 : 0,
    };
  }, [beats, time]);

  // 当前在 LockAI 理解出的哪一段（一支舞，或者中间的换场）
  const chapter = useMemo(() => timeline.find((c) => c.start <= time && time < c.end) ?? null, [timeline, time]);
  // 串烧的第几首（只有一首歌时不显示）
  const song = chapter?.songs?.length ? chapter.songs.filter((t) => t <= time).length + 1 : 0;

  const hideControls = idle && playing && menu === null;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const processing = media.status === 'pending';
  const showMetronome = metronome && !!beats;

  // 节拍器在控制条上面；控制条收起时它留下来，落到视频底边
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const el = bar.current;
    const box = root.current;
    if (!el || !box) return;
    const measure = () => setLift(box.getBoundingClientRect().bottom - el.getBoundingClientRect().top);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(box);
    measure();
    return () => ro.disconnect();
  }, []);

  const countLabel = [
    chapter?.title || (count && count.part > 0 ? `第 ${count.part} 段` : ''),
    song > 0 ? `第 ${song} 首` : '',
    count ? (count.eight >= 1 ? `第 ${count.eight} 个八拍` : '前奏') : '',
  ].filter(Boolean).join('　');

  return (
    <div
      ref={root}
      className={cn('stage group/player relative h-full w-full overflow-hidden bg-black text-stage-fg', hideControls && 'cursor-none', className)}
      onPointerMove={(e) => e.pointerType === 'mouse' && pokeIdle()}
      onPointerLeave={() => playing && setIdle(true)}
    >
      <video
        ref={video}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
        poster={isAudio ? undefined : media.poster_url ?? undefined}
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          pokeIdle();
        }}
        onPause={() => {
          setPlaying(false);
          setIdle(false);
          report(video.current?.currentTime ?? 0);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || media.duration || 0);
          // 第一次加载跳到指定时刻；中途换了地址（转码好了换成 HLS）接着刚才的位置放
          const at = loaded.current ? lastTime.current : startAt;
          loaded.current = true;
          if (at != null && at > 0) {
            e.currentTarget.currentTime = at;
            report(at);
          }
        }}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => !playing && report(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(e) => setVolume(e.currentTarget.volume, e.currentTarget.muted)}
      />

      {isAudio && <AudioStage cover={media.poster_url} waveform={media.waveform} progress={duration ? time / duration : 0} />}

      {/* 点击层 */}
      <div className="absolute inset-0" onPointerUp={onSurfacePointerUp} onDoubleClick={toggleFullscreen} />

      {(waiting || hlsError) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          {hlsError ? <p className="text-sm text-stage-soft">{hlsError}</p> : <PauseMark size={30} state="busy" className="text-white" />}
        </div>
      )}

      {!started && !playing && !waiting && (
        <button
          type="button"
          onClick={toggle}
          aria-label="播放"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-transform hover:scale-105"
        >
          <Play className="ml-1 h-7 w-7" fill="currentColor" />
        </button>
      )}

      {flash && (
        <span
          key={flash.key}
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[13px] text-white backdrop-blur-md tabular animate-[fade_0.9s_var(--ease-out)_reverse_both]',
            flash.side === 'left' ? 'left-[12%]' : flash.side === 'right' ? 'right-[12%]' : 'left-1/2 -translate-x-1/2',
          )}
        >
          {flash.label}
        </span>
      )}

      {processing && (
        <p className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white/85 backdrop-blur-md">
          正在处理，播放可能不流畅
        </p>
      )}

      {extra && (
        <div className={cn('absolute right-3 top-3 flex gap-1 transition-opacity duration-300', hideControls && 'opacity-0')}>{extra}</div>
      )}

      {/* 节拍器：控制条收起时留在视频底边 */}
      {showMetronome && (
        <>
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300',
              hideControls ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            className="absolute inset-x-0 z-10 flex items-center gap-3 px-3 transition-[bottom] duration-300 ease-out sm:px-4"
            style={{ bottom: hideControls ? 'calc(env(safe-area-inset-bottom) + 6px)' : lift }}
          >
            <div className="min-w-0 flex-1">
              <BeatRuler beats={beats} getTime={getTime} onSeek={seek} onLoopEight={loopEight} />
            </div>
            <div className="flex w-auto shrink-0 items-baseline gap-2 tabular" aria-live="off">
              {countLabel && (
                <span className="hidden max-w-[18rem] truncate whitespace-nowrap text-[11px] text-stage-soft sm:inline">{countLabel}</span>
              )}
              <span
                className={cn(
                  'w-5 text-center font-mono text-[20px] font-semibold leading-none',
                  count?.count === 1 ? 'text-stage-accent' : 'text-stage-fg',
                )}
              >
                {count?.count ?? '·'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* 控制条 */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transition-opacity duration-300 sm:px-4',
          showMetronome ? 'pt-24' : 'pt-14',
          hideControls && 'pointer-events-none opacity-0',
        )}
      >
        <div ref={bar}>
        <ProgressBar
          current={time}
          duration={duration}
          buffered={buffered}
          onSeek={seek}
          sprite={media.sprite}
          loop={loop}
          markers={markers}
          chapters={
            timeline.length
              ? timeline.flatMap((c) => [
                  { start: c.start, title: c.songs?.length ? `${c.title}　第 1 首` : c.title },
                  ...(c.songs ?? []).map((t, k) => ({ start: t, title: `${c.title}　第 ${k + 2} 首` })),
                ])
              : undefined
          }
          onScrubStart={() => {
            scrubWasPlaying.current = !!video.current && !video.current.paused;
            video.current?.pause();
          }}
          onScrubEnd={() => {
            if (scrubWasPlaying.current) void video.current?.play().catch(() => {});
          }}
        />

        <div className="mt-1 flex items-center gap-0.5">
          <IconButton tone="stage" label={playing ? '暂停' : '播放'} onClick={toggle}>
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </IconButton>
          <IconButton tone="stage" label="后退 5 秒" className="hidden sm:inline-flex" onClick={() => seek(time - 5)}>
            <RotateCcw className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton tone="stage" label="前进 5 秒" className="hidden sm:inline-flex" onClick={() => seek(time + 5)}>
            <RotateCw className="h-[18px] w-[18px]" />
          </IconButton>
          <VolumeControl icon={<VolumeIcon className="h-[18px] w-[18px]" />} volume={volume} muted={muted} onChange={(v, m) => {
            const el = video.current;
            if (!el) return;
            el.volume = v;
            el.muted = m;
          }} />
          <span className="ml-1.5 whitespace-nowrap font-mono text-[12px] text-stage-soft tabular">
            {formatTimecode(time)} <span className="text-stage-faint">/ {formatTimecode(duration)}</span>
          </span>

          <div className="flex-1" />

          <button
            ref={speedAnchor}
            type="button"
            onClick={() => setMenu(menu === 'speed' ? null : 'speed')}
            className={cn(
              'h-9 rounded-xl px-2 font-mono text-[12.5px] tabular transition-colors hover:bg-white/10',
              rate !== 1 ? 'text-stage-accent' : 'text-stage-soft',
            )}
            aria-label="播放速度"
          >
            {rate}×
          </button>
          <Popover open={menu === 'speed'} onOpenChange={(o) => setMenu(o ? 'speed' : null)} anchor={speedAnchor} placement="top-end" tone="stage" className="w-36">
            <MenuLabel>播放速度</MenuLabel>
            {SPEEDS.map((s) => (
              <MenuItem key={s} label={<span className="font-mono tabular">{s}×</span>} active={s === rate} onSelect={() => { setRate(s); setMenu(null); }} />
            ))}
          </Popover>

          {qualities.length > 1 && (
            <>
              <button
                ref={qualityAnchor}
                type="button"
                onClick={() => setMenu(menu === 'quality' ? null : 'quality')}
                className="hidden h-9 rounded-xl px-2 text-[12.5px] text-stage-soft transition-colors hover:bg-white/10 sm:block"
                aria-label="清晰度"
              >
                {level < 0 ? '自动' : `${qualities.find((q) => q.level === level)?.height}p`}
              </button>
              <Popover open={menu === 'quality'} onOpenChange={(o) => setMenu(o ? 'quality' : null)} anchor={qualityAnchor} placement="top-end" tone="stage" className="w-32">
                <MenuItem label="自动" active={level < 0} onSelect={() => { setLevel(-1); setMenu(null); }} />
                {qualities.map((q) => (
                  <MenuItem key={q.level} label={`${q.height}p`} active={level === q.level} onSelect={() => { setLevel(q.level); setMenu(null); }} />
                ))}
              </Popover>
            </>
          )}

          <Tooltip label={loop ? '取消循环' : pendingA != null ? '设循环终点' : '设循环起点'} shortcut={loop ? '\\' : pendingA != null ? ']' : '['}>
            <IconButton
              tone="stage"
              label={loop ? '取消循环' : pendingA != null ? '设循环终点' : '设循环起点'}
              active={!!loop || pendingA != null}
              className={cn((loop || pendingA != null) && 'text-stage-accent')}
              onClick={cycleLoop}
            >
              <Repeat className="h-[18px] w-[18px]" />
            </IconButton>
          </Tooltip>
          {!isAudio && (
            <Tooltip label="镜像" shortcut="M">
              <IconButton tone="stage" label="镜像" active={mirror} className={cn(mirror && 'text-stage-accent')} onClick={() => setMirror((m) => !m)}>
                <FlipHorizontal2 className="h-[18px] w-[18px]" />
              </IconButton>
            </Tooltip>
          )}
          {beats && (
            <Tooltip label={metronome ? '隐藏节拍器' : '显示节拍器'}>
              <IconButton
                tone="stage"
                label="节拍器"
                active={metronome}
                className={cn(metronome && 'text-stage-accent')}
                onClick={() => setMetronome(!metronome)}
              >
                <MetronomeIcon className="h-[18px] w-[18px]" />
              </IconButton>
            </Tooltip>
          )}

          <LockAIStatusButton status={lockai?.status ?? null} onAnalyze={onAnalyze} />

          {!isAudio && typeof document !== 'undefined' && document.pictureInPictureEnabled && (
            <IconButton
              tone="stage"
              label="画中画"
              className="hidden sm:inline-flex"
              onClick={() => {
                const v = video.current;
                if (!v) return;
                if (document.pictureInPictureElement) void document.exitPictureInPicture();
                else void v.requestPictureInPicture().catch(() => {});
              }}
            >
              <PictureInPicture2 className="h-[18px] w-[18px]" />
            </IconButton>
          )}
          <IconButton tone="stage" label={fullscreen ? '退出全屏' : '全屏'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
          </IconButton>
        </div>
        </div>
      </div>
    </div>
  );
}

/** 控制条右边的 LockAI：分析过的只亮着标，没分析过的发起分析，排队、分析中显示状态 */
function LockAIStatusButton({ status, onAnalyze }: { status: LockAIStatus | null; onAnalyze?: () => void }) {
  const base = 'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[12.5px] transition-colors';
  if (status === 'ready') {
    return (
      <Tooltip label="已由 LockAI 分析">
        <span className={cn(base, 'cursor-default')} role="img" aria-label="已由 LockAI 分析">
          <LockAIMark tone="stage" className="text-[14px]" />
        </span>
      </Tooltip>
    );
  }
  if (status === 'queued' || status === 'processing') {
    return (
      <span className={cn(base, 'text-stage-soft')} role="status">
        <PauseMark size={12} framed={false} state="busy" />
        <span className="hidden sm:inline">{status === 'queued' ? '排队中' : '正在分析'}</span>
      </span>
    );
  }
  if (!onAnalyze) return null;
  return (
    <Tooltip label={status === 'failed' ? '上次分析未完成' : '节拍器、分段、画面搜索和人物识别'}>
      <button type="button" onClick={onAnalyze} className={cn(base, 'text-stage-soft hover:bg-white/10 hover:text-stage-fg')}>
        <LockAIMark tone="stage" className="text-[14px]" />
        <span>{status === 'failed' ? '重新分析' : '分析'}</span>
      </button>
    </Tooltip>
  );
}

/** 节拍器（lucide 没有） */
function MetronomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9.2 3h5.6l4 18H5.2z" />
      <path d="M12 16.5 16.8 6.5" />
      <path d="M7 16.5h10" />
    </svg>
  );
}

function VolumeControl({ icon, volume, muted, onChange }: { icon: ReactNode; volume: number; muted: boolean; onChange: (v: number, muted: boolean) => void }) {
  return (
    <div className="group/vol hidden items-center sm:flex">
      <IconButton tone="stage" label={muted ? '取消静音' : '静音'} onClick={() => onChange(volume || 1, !muted)}>
        {icon}
      </IconButton>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => onChange(Number(e.target.value), Number(e.target.value) === 0)}
        aria-label="音量"
        className="h-1 w-0 cursor-pointer accent-white opacity-0 transition-[width,opacity] duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100"
      />
    </div>
  );
}

