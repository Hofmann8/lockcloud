import type { SpriteInfo } from './api/types';

/**
 * 预览雪碧图：第 i 张小图在第 i // (cols*rows) 张大图的列 i % cols、行 (i % (cols*rows)) // cols，
 * 对应时刻 i * interval。返回按显示宽度缩放好的 CSS 背景参数。
 */
export function spriteStyle(s: SpriteInfo, t: number, displayWidth: number): React.CSSProperties | null {
  if (!s.count || !s.sheets.length) return null;
  const i = Math.min(s.count - 1, Math.max(0, Math.floor(t / s.interval)));
  const per = s.cols * s.rows;
  const sheet = Math.floor(i / per);
  const url = s.sheets[sheet];
  if (!url) return null;
  const k = i % per;
  const col = k % s.cols;
  const row = Math.floor(k / s.cols);
  const inSheet = Math.min(per, s.count - sheet * per);
  const sheetRows = Math.ceil(inSheet / s.cols);
  // 大图的宽度永远是 cols 张小图（最后一张不满一行也是），高度按实际行数
  const scale = displayWidth / s.width;
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${s.cols * s.width * scale}px ${sheetRows * s.height * scale}px`,
    backgroundPosition: `${-col * s.width * scale}px ${-row * s.height * scale}px`,
    backgroundRepeat: 'no-repeat',
    width: displayWidth,
    height: s.height * scale,
  };
}
