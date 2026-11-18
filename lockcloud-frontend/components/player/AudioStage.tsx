'use client';

import { Music2 } from 'lucide-react';

/**
 * 播放器放音频时的画面：专辑封面（背后铺一层放大模糊的封面），下面是波形，放过的部分亮起来。
 * 没有封面时只有音符和波形。只是画面，点击、快捷键都交给播放器。
 */
export function AudioStage({ cover, waveform, progress }: { cover?: string | null; waveform?: number[] | null; progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-8 overflow-hidden px-6 pb-32 pt-16">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl" />
      )}
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="relative aspect-square w-[min(48vh,72%)] max-w-[400px] rounded-2xl object-cover shadow-2xl" />
      ) : (
        <span className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-white/[0.06] text-white/55">
          <Music2 className="h-12 w-12" strokeWidth={1.4} />
        </span>
      )}
      {!!waveform?.length && <Waveform values={waveform} progress={progress} />}
    </div>
  );
}

function Waveform({ values, progress }: { values: number[]; progress: number }) {
  const n = values.length;
  const played = Math.round(Math.min(1, Math.max(0, progress)) * n);
  return (
    <svg viewBox={`0 0 ${n * 4} 100`} preserveAspectRatio="none" className="relative h-14 w-full max-w-2xl" aria-hidden>
      {values.map((v, i) => {
        const h = Math.max(6, v);
        return (
          <rect
            key={i}
            x={i * 4 + 0.8}
            y={50 - h / 2}
            width={2.4}
            height={h}
            rx={1.2}
            className={i < played ? 'fill-white' : 'fill-white/25'}
          />
        );
      })}
    </svg>
  );
}
