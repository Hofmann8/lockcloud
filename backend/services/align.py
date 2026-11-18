"""两段视频按音乐对齐：起音包络（beats.json 的 envelope）做互相关。

offset 的含义：b 的第 t + offset 秒对应 a 的第 t 秒。
每个错位上用重叠部分的能量归一化（相当于那一段的相关系数），只看 ±60 秒、且重叠够长的错位，
峰值附近抛物线插值到亚帧精度。confidence 就是峰值的相关系数（0–1）。
"""
from __future__ import annotations

import base64

import numpy as np

MAX_LAG_SECONDS = 60.0
MIN_OVERLAP_SECONDS = 4.0
MIN_OVERLAP_RATIO = 0.3   # 重叠至少是短的那段的 30%，太短的重叠相关系数不可信


def decode_envelope(data: dict) -> tuple[np.ndarray, float]:
    raw = base64.b64decode(data.get('envelope') or '')
    rate = float(data.get('envelope_rate') or 0)
    return np.frombuffer(raw, dtype=np.uint8).astype(np.float64), rate


def _resample(x: np.ndarray, rate: float, target: float) -> np.ndarray:
    if abs(rate - target) < 1e-6 or len(x) < 2:
        return x
    n = max(2, int(round(len(x) * target / rate)))
    return np.interp(np.arange(n) / target, np.arange(len(x)) / rate, x)


def align(a: np.ndarray, rate_a: float, b: np.ndarray, rate_b: float) -> tuple[float, float]:
    """返回 (offset 秒, confidence)。"""
    if rate_a <= 0 or rate_b <= 0 or len(a) < 2 or len(b) < 2:
        return 0.0, 0.0
    rate = rate_a
    b = _resample(b, rate_b, rate)
    a = a - a.mean()
    b = b - b.mean()
    na, nb = len(a), len(b)

    # c[k] = Σ a[n]·b[n+k]，k ∈ (-na, nb)，用 FFT 算
    size = 1 << int(np.ceil(np.log2(na + nb)))
    spec = np.fft.rfft(b, size) * np.conj(np.fft.rfft(a, size))
    full = np.fft.irfft(spec, size)
    lags = np.arange(-(na - 1), nb)
    corr = np.concatenate([full[size - (na - 1):], full[:nb]]) if na > 1 else full[:nb]

    # 每个错位上重叠部分的能量：a[lo:hi]、b[lo+k:hi+k]
    ca = np.concatenate([[0.0], np.cumsum(a * a)])
    cb = np.concatenate([[0.0], np.cumsum(b * b)])
    lo = np.maximum(0, -lags)
    hi = np.minimum(na, nb - lags)
    overlap = hi - lo
    ea = ca[hi] - ca[lo]
    eb = cb[hi + lags] - cb[lo + lags]
    with np.errstate(divide='ignore', invalid='ignore'):
        score = corr / np.sqrt(ea * eb)
    min_overlap = max(MIN_OVERLAP_SECONDS * rate, MIN_OVERLAP_RATIO * min(na, nb))
    ok = (np.abs(lags) <= MAX_LAG_SECONDS * rate) & (overlap >= min(min_overlap, min(na, nb))) & (ea > 0) & (eb > 0)
    if not ok.any():
        return 0.0, 0.0
    score = np.where(ok, score, -np.inf)
    i = int(np.argmax(score))
    peak = float(score[i])

    # 抛物线插值
    delta = 0.0
    if 0 < i < len(score) - 1 and np.isfinite(score[i - 1]) and np.isfinite(score[i + 1]):
        y0, y1, y2 = score[i - 1], score[i], score[i + 1]
        denom = y0 - 2 * y1 + y2
        if denom < 0:
            delta = float(np.clip(0.5 * (y0 - y2) / denom, -0.5, 0.5))
    offset = (lags[i] + delta) / rate
    return round(float(offset), 3), round(float(np.clip(peak, 0.0, 1.0)), 3)
