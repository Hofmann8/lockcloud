"""ThumbHash 编码，照 https://github.com/evanw/thumbhash 的 JS 参考实现移植。

前端用 npm 的 thumbhash.thumbHashToDataURL 解码，这里输出 base64 字符串直接存 files.thumbhash。
"""
import base64
import math

import numpy as np
from PIL import Image


def image_to_thumbhash(img: Image.Image) -> str:
    """img 要已经转正（EXIF）。内部缩到 100x100 以内。"""
    img = img.convert('RGBA')
    img.thumbnail((100, 100), Image.Resampling.BILINEAR)
    w, h = img.size
    rgba = np.asarray(img, dtype=np.float64).reshape(h, w, 4) / 255.0
    return base64.b64encode(rgba_to_thumbhash(w, h, rgba)).decode('ascii')


def jround(v: float) -> int:
    """JS 的 Math.round：.5 往 +∞ 舍。Python 的 round 是银行家舍入，结果会差一位。"""
    return math.floor(v + 0.5)


def rgba_to_thumbhash(w: int, h: int, rgba: np.ndarray) -> bytes:
    """rgba: h×w×4，取值 0..1。"""
    alpha = rgba[..., 3]
    total_a = alpha.sum()
    if total_a:
        avg = [(alpha * rgba[..., c]).sum() / total_a for c in range(3)]
    else:
        avg = [0.0, 0.0, 0.0]

    has_alpha = total_a < w * h
    l_limit = 5 if has_alpha else 7
    lx = max(1, jround(l_limit * w / max(w, h)))
    ly = max(1, jround(l_limit * h / max(w, h)))

    # 透明部分铺平均色，再转成 LPQA
    r = avg[0] * (1 - alpha) + alpha * rgba[..., 0]
    g = avg[1] * (1 - alpha) + alpha * rgba[..., 1]
    b = avg[2] * (1 - alpha) + alpha * rgba[..., 2]
    l_ch = (r + g + b) / 3
    p_ch = (r + g) / 2 - b
    q_ch = r - g

    def encode_channel(channel, nx, ny):
        dc, ac, scale = 0.0, [], 0.0
        xs = np.arange(w) + 0.5
        ys = np.arange(h) + 0.5
        for cy in range(ny):
            cx = 0
            while cx * ny < nx * (ny - cy):
                fx = np.cos(math.pi / w * cx * xs)
                fy = np.cos(math.pi / h * cy * ys)
                f = float((channel * fy[:, None] * fx[None, :]).sum()) / (w * h)
                if cx or cy:
                    ac.append(f)
                    scale = max(scale, abs(f))
                else:
                    dc = f
                cx += 1
        if scale:
            ac = [0.5 + 0.5 / scale * v for v in ac]
        return dc, ac, scale

    l_dc, l_ac, l_scale = encode_channel(l_ch, max(3, lx), max(3, ly))
    p_dc, p_ac, p_scale = encode_channel(p_ch, 3, 3)
    q_dc, q_ac, q_scale = encode_channel(q_ch, 3, 3)
    if has_alpha:
        a_dc, a_ac, a_scale = encode_channel(alpha, 5, 5)

    is_landscape = w > h
    header24 = (jround(63 * l_dc) | (jround(31.5 + 31.5 * p_dc) << 6) | (jround(31.5 + 31.5 * q_dc) << 12)
                | (jround(31 * l_scale) << 18) | (int(has_alpha) << 23))
    header16 = ((ly if is_landscape else lx) | (jround(63 * p_scale) << 3) | (jround(63 * q_scale) << 9)
                | (int(is_landscape) << 15))
    out = [header24 & 255, (header24 >> 8) & 255, header24 >> 16, header16 & 255, header16 >> 8]
    ac_start = 6 if has_alpha else 5
    if has_alpha:
        out.append(jround(15 * a_dc) | (jround(15 * a_scale) << 4))

    ac_index = 0
    for ac in ([l_ac, p_ac, q_ac, a_ac] if has_alpha else [l_ac, p_ac, q_ac]):
        for f in ac:
            i = ac_start + (ac_index >> 1)
            while len(out) <= i:
                out.append(0)
            out[i] |= jround(15 * f) << ((ac_index & 1) << 2)
            ac_index += 1
    return bytes(out)
