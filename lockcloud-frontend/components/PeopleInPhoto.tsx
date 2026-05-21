'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listPeopleInFile, PersonInFile, FileDims, StylePreset } from '@/lib/api/files';
import { useSignedUrl } from '@/lib/hooks/useSignedUrl';
import { useDeviceDetect } from '@/lib/hooks/useDeviceDetect';

/**
 * 文件详情页里展示"这张图里出现的人物"。
 *
 * 渲染策略(优先级从高到低):
 *  1) 后端给了 file_dims + 该 person 有 best_face_in_file + 跟 ImagePreview 共享了
 *     signed URL(同 fileId+previewStyle,React Query 自动 dedupe)
 *     → chip 用 background-image 复用大图 bitmap,raw→exif 变换 + 计算 CSS 百分比裁切
 *     零额外网络 + 零额外解码,首屏立即出图
 *  2) 否则走 thumb_url(公开桶 ?rect= cover) —— 旧 file 还没补 raw_w/raw_h/orientation
 *     的情况兜底
 *  3) thumb_url 也没有(file 没 mirror)→ 首字母占位
 *
 * 见 [[gotcha_bitiful_rect_raw_coord]]:bbox 存的是 raw(磁盘字节)系,显示用 EXIF 系。
 */
interface PeopleInPhotoProps {
  fileId: number;
}

export function PeopleInPhoto({ fileId }: PeopleInPhotoProps) {
  // 跟 ImagePreview 用同样的 previewStyle,确保走同一个 React Query 缓存
  // → 同一个 signed URL → 浏览器 bitmap 缓存命中 → 零额外网络
  const { isMobile, isTablet } = useDeviceDetect();
  const previewStyle: StylePreset = useMemo(() => {
    if (isMobile) return 'previewmobile';
    if (isTablet) return 'previewtablet';
    return 'previewdesktop';
  }, [isMobile, isTablet]);
  const { url: imageUrl } = useSignedUrl(fileId, previewStyle, !!fileId);

  const { data, isLoading } = useQuery({
    queryKey: ['people-in-file', fileId],
    queryFn: () => listPeopleInFile(fileId),
    enabled: !!fileId,
    staleTime: 60_000,
    refetchOnMount: 'always',
  });

  if (isLoading) return null;
  if (!data) return null;
  const { people, unidentified_count, file_dims } = data;
  if (people.length === 0 && unidentified_count === 0) return null;

  return (
    <div className="bg-primary-white rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-800">这张图里的人</h3>
        {people.length > 0 && (
          <span className="text-xs text-gray-400">{people.length} 人</span>
        )}
      </div>

      {people.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <PersonChip
              key={p.id}
              person={p}
              imageUrl={imageUrl}
              fileDims={file_dims}
            />
          ))}
        </div>
      )}

      {unidentified_count > 0 && (
        <p className="text-xs text-gray-400">
          + {unidentified_count} 张未识别人脸
          <span
            className="ml-1 text-gray-300"
            title="可能是脸太小 / 不清楚,或这个人在全部照片里出现次数太少没法成组"
          >
            (出现次数少 / 质量不足)
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * raw bbox + EXIF orientation → EXIF 应用后坐标系的 bbox 百分比(0..1)。
 *
 * Orientation 语义(EXIF 标准):
 *   1 = 正常 / 2 = 水平翻转 / 3 = 180°
 *   4 = 垂直翻转 / 5 = 转置 / 6 = CW90°
 *   7 = 反转置 / 8 = CCW90°
 * 我们的库里 95%+ 是 1 / 6 / 8(手机拍摄 vertical 几乎全是 6 或 8)。
 * 这里完整覆盖 8 种 case,顺手做了 flip 分量。
 */
function rawBboxToExifPct(
  bbox: { x: number; y: number; w: number; h: number },
  rawW: number,
  rawH: number,
  orientation: number
): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = bbox;
  switch (orientation) {
    case 1:                    // identity
      return { x: x / rawW, y: y / rawH, w: w / rawW, h: h / rawH };
    case 2:                    // 水平翻转
      return { x: (rawW - x - w) / rawW, y: y / rawH, w: w / rawW, h: h / rawH };
    case 3:                    // 180°
      return { x: (rawW - x - w) / rawW, y: (rawH - y - h) / rawH, w: w / rawW, h: h / rawH };
    case 4:                    // 垂直翻转
      return { x: x / rawW, y: (rawH - y - h) / rawH, w: w / rawW, h: h / rawH };
    case 5:                    // 转置(沿主对角线翻转)
      // 显示宽 = rawH,显示高 = rawW
      return { x: y / rawH, y: x / rawW, w: h / rawH, h: w / rawW };
    case 6:                    // CW90°(竖拍照最常见)
      return { x: (rawH - y - h) / rawH, y: x / rawW, w: h / rawH, h: w / rawW };
    case 7:                    // 反转置
      return { x: (rawH - y - h) / rawH, y: (rawW - x - w) / rawW, w: h / rawH, h: w / rawW };
    case 8:                    // CCW90°
      return { x: y / rawH, y: (rawW - x - w) / rawW, w: h / rawH, h: w / rawW };
    default:
      return { x: x / rawW, y: y / rawH, w: w / rawW, h: h / rawH };
  }
}

function PersonChip({
  person,
  imageUrl,
  fileDims,
}: {
  person: PersonInFile;
  imageUrl?: string | null;
  fileDims: FileDims | null;
}) {
  const display = person.name || `#${person.id}`;
  // 走 CSS 裁切快路径需要三件套同时具备:大图 URL / file 尺寸 / 该 person 在本图的最佳脸 bbox
  const canCrop = imageUrl && fileDims && person.best_face_in_file;

  return (
    <Link
      href={`/files?person=${person.id}`}
      className="group flex items-center gap-2 pl-1 pr-2.5 py-1 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-full transition-colors"
      title={`查看 ${display} 的所有照片(共 ${person.face_count} 张)`}
    >
      <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center shrink-0">
        {canCrop ? (
          <CropAvatar
            imageUrl={imageUrl!}
            bbox={person.best_face_in_file!.bbox}
            fileDims={fileDims!}
            alt={display}
          />
        ) : person.thumb_url ? (
          <img
            src={person.thumb_url}
            alt={display}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xs font-bold text-orange-600/80">
            {display.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-sm text-gray-700 group-hover:text-orange-600 max-w-[120px] truncate">
        {display}
      </span>
    </Link>
  );
}

/**
 * CSS 裁切头像 —— 共享同一 URL 的 bitmap,零额外网络。
 *
 * 原理:把 background 设成整张大图,然后 background-size 放大到使 bbox 区域刚好填满
 * 容器,再用 background-position 把 bbox 推到容器左上角。
 *
 * 设 bbox 在 EXIF 应用图上的百分比为 (bx, by, bw, bh),容器宽高 = 1(归一化):
 *   background-size = (1/bw, 1/bh)   //  bbox 占容器的整个面积
 *   background-position = (bx/(1-bw), by/(1-bh))  // 把 bbox 顶点推到容器原点
 *                                                  // (1-bw) 是 CSS background-position
 *                                                  // 百分比的分母约定,见 MDN
 */
function CropAvatar({
  imageUrl,
  bbox,
  fileDims,
  alt,
}: {
  imageUrl: string;
  bbox: { x: number; y: number; w: number; h: number };
  fileDims: FileDims;
  alt: string;
}) {
  const exifPct = rawBboxToExifPct(bbox, fileDims.raw_w, fileDims.raw_h, fileDims.orientation);

  // 边界保护:bbox 占满整张图时分母 0,直接 background-size cover
  const denomX = exifPct.w >= 1 ? 1 : 1 - exifPct.w;
  const denomY = exifPct.h >= 1 ? 1 : 1 - exifPct.h;
  const posX = (exifPct.x / Math.max(denomX, 1e-6)) * 100;
  const posY = (exifPct.y / Math.max(denomY, 1e-6)) * 100;
  const sizeX = (1 / Math.max(exifPct.w, 1e-6)) * 100;
  const sizeY = (1 / Math.max(exifPct.h, 1e-6)) * 100;

  return (
    <div
      role="img"
      aria-label={alt}
      className="w-full h-full"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${sizeX}% ${sizeY}%`,
        backgroundPosition: `${posX}% ${posY}%`,
      }}
    />
  );
}
