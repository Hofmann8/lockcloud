import type { BBox, FileDims } from './api/types';

/**
 * 人脸框存的是原始像素坐标（没按 EXIF 转正），显示的图是转正过的。
 * 这里换算成转正后整图里的比例坐标（0–1）。
 */
export function uprightBox(b: BBox, dims: FileDims): { x: number; y: number; w: number; h: number } {
  const W = dims.raw_w;
  const H = dims.raw_h;
  let x = b.x;
  let y = b.y;
  let w = b.w;
  let h = b.h;
  let UW = W;
  let UH = H;
  switch (dims.orientation) {
    case 2: x = W - b.x - b.w; break;
    case 3: x = W - b.x - b.w; y = H - b.y - b.h; break;
    case 4: y = H - b.y - b.h; break;
    case 5: x = b.y; y = b.x; w = b.h; h = b.w; UW = H; UH = W; break;
    case 6: x = H - b.y - b.h; y = b.x; w = b.h; h = b.w; UW = H; UH = W; break;
    case 7: x = H - b.y - b.h; y = W - b.x - b.w; w = b.h; h = b.w; UW = H; UH = W; break;
    case 8: x = b.y; y = W - b.x - b.w; w = b.h; h = b.w; UW = H; UH = W; break;
    default: break;
  }
  return { x: x / UW, y: y / UH, w: w / UW, h: h / UH };
}
