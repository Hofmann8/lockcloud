'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PauseMark } from '@/components/brand/PauseMark';
import { Thumb } from '@/components/media/Thumb';
import type { Activity, ActivityCover, FileItem } from '@/lib/api/types';
import { formatDuration, splitDate, weekday } from '@/lib/format';
import { activityHref } from '@/lib/routes';

// 封面只用来显示，补齐 Thumb 需要的字段
function coverFile(c: ActivityCover): FileItem {
  return {
    id: c.id,
    filename: c.is_video ? 'cover.mp4' : 'cover.jpg',
    original_filename: null,
    directory: '',
    s3_key: '',
    size: 0,
    content_type: c.is_video ? 'video/mp4' : 'image/jpeg',
    uploader_id: 0,
    uploaded_at: null,
    activity_date: null,
    activity_type: null,
    activity_name: null,
    is_legacy: false,
    thumbhash: c.thumbhash,
    media_status: 'ready',
    width: c.width,
    height: c.height,
    free_tags: [],
  };
}

function Covers({ covers, width }: { covers: ActivityCover[]; width: number }) {
  const files = covers.slice(0, 4).map(coverFile);
  const cell = (f: FileItem, w: number, className?: string) => (
    <Thumb key={f.id} file={f} width={w} scrub={false} showBadges={false} className={cn('h-full w-full', className)} />
  );
  if (!files.length) {
    return (
      <div className="flex h-full items-center justify-center text-fg-faint/60">
        <PauseMark size={28} />
      </div>
    );
  }
  if (files.length === 1) return cell(files[0], width);
  if (files.length === 2) {
    return <div className="grid h-full grid-cols-2 gap-[3px]">{files.map((f) => cell(f, width / 2))}</div>;
  }
  const [first, ...rest] = files;
  return (
    <div className="grid h-full grid-cols-[2fr_1fr] gap-[3px]">
      {cell(first, (width * 2) / 3)}
      <div className="grid gap-[3px]" style={{ gridTemplateRows: `repeat(${rest.length}, 1fr)` }}>
        {rest.map((f) => cell(f, width / 3))}
      </div>
    </div>
  );
}

export function ActivityCard({ activity, width = 420 }: { activity: Activity; width?: number }) {
  const d = splitDate(activity.activity_date);
  const counts = [
    activity.image_count ? `${activity.image_count} 张照片` : null,
    activity.video_count ? `${activity.video_count} 段视频` : null,
    activity.audio_count ? `${activity.audio_count} 段音频` : null,
  ].filter(Boolean);

  return (
    <Link
      href={activityHref(activity)}
      className="group block rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
    >
      <div className="relative aspect-[3/2] overflow-hidden rounded-[18px] bg-frame">
        <div className="h-full transition-transform duration-500 [transition-timing-function:var(--ease-out)] group-hover:scale-[1.015]">
          <Covers covers={activity.covers} width={width} />
        </div>
        {activity.video_count > 0 && activity.duration ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10.5px] text-white backdrop-blur-sm tabular">
            {formatDuration(activity.duration)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-start gap-3.5 px-0.5">
        <div className="w-11 shrink-0 text-center">
          <div
            className="font-display text-[30px] leading-none tracking-tight text-fg tabular"
            style={{ fontVariationSettings: '"SOFT" 50, "opsz" 72' }}
          >
            {d?.dd}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            {d ? `${d.mm}月` : ''}
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-[15px] font-medium text-fg">
            {activity.activity_name || activity.activity_type_display}
          </h3>
          <p className="mt-1 truncate text-[12.5px] text-fg-faint">
            <span className="text-fg-soft">{activity.activity_type_display}</span>
            {activity.activity_date && <span> · {weekday(activity.activity_date)}</span>}
            {counts.length > 0 && <span> · {counts.join('、')}</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function ActivityCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[3/2] rounded-[18px]" />
      <div className="mt-3 flex gap-3.5 px-0.5">
        <div className="skeleton h-9 w-11 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-3.5 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>
  );
}
