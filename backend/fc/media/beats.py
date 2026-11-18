"""节拍检测：beat_this 神经网络出每帧的"拍"和"小节重拍"概率，再按舞蹈数八拍的习惯整理成拍点。

模型是 Foscarin et al., "Beat this! Accurate beat tracking without DBN postprocessing"（ISMIR 2024）的
final0 权重，export_beat_model.py 导成 ONNX，这里只用 onnxruntime + numpy。

整理规则：
  - 只在模型认为有拍的地方出拍（开头没音乐、中间聊天的地方不硬凑）
  - 顺着局部速度把拍点串起来：漏掉的拍补上，中间冒出的反拍跳过，换歌、音乐停了就另起一段
  - 速度折进 75–150 BPM（模型按八分音符出的隔一拍取一拍，只出半拍的中间补一拍），和跳舞数拍一致
  - 小节位置按模型的重拍概率定；剪辑过的音乐接口处会有两拍、三拍的小节，小节位置变了就分段
  - "1"和"5"都是小节头，看哪组小节头前后的频谱变化大（乐句从"1"开始），定哪组是"1"

输出给前端的是：
  bpm            速度（最长一段的）
  times          每一拍的时间（秒）
  sections       [[这段第一拍在 times 里的下标, 这段第一个"1"的下标], ...]，段内每 8 拍一个"1"
  envelope       起音包络，uint8 base64，采样率 ENVELOPE_RATE，给并排对比做自动对齐
"""
import base64
import os

import numpy as np

SR = 22050

# 起音包络（并排对比对齐用）
N_FFT = 2048
HOP = 512
N_MELS = 128
ENVELOPE_RATE = SR / HOP  # ≈43.07

# beat_this 的输入：和训练时的 torchaudio MelSpectrogram 一致
NN_FFT = 1024
NN_HOP = 441
NN_FPS = SR / NN_HOP  # 50
NN_FMIN, NN_FMAX = 30.0, 11000.0
CHUNK = 1500  # 模型一次看 30 秒
BORDER = 6  # 每块两头各丢 6 帧，相邻块重叠这么多
MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'beat_this.onnx')

FOLD_LO, FOLD_HI = 75.0, 150.0  # 数八拍的速度范围
PRIOR_BPM = 115.0  # 两个八度都在范围里时（如 75 / 150）偏向这附近
TEMPO_WIN = 8.0  # 估局部速度的窗口（秒）
TOL = 0.15  # 下一拍离预期位置最多差几分之一拍
MAX_GAP = 8  # 最多连着补几拍
MIN_RUN = 8  # 少于 8 拍的段不要（说话声、杂音里偶尔的几个峰）
SWITCH_COST = 8.0  # 小节位置换一次的代价（对数似然），约等于两个小节清楚的重拍

_session = None


def _slaney_mel(f):
    f = np.asarray(f, dtype=np.float64)
    lin = f / (200.0 / 3)
    log = 15.0 + np.log(np.maximum(f, 1e-10) / 1000.0) / (np.log(6.4) / 27.0)
    return np.where(f >= 1000.0, log, lin)


def _slaney_hz(m):
    m = np.asarray(m, dtype=np.float64)
    lin = m * (200.0 / 3)
    log = 1000.0 * np.exp((np.log(6.4) / 27.0) * (m - 15.0))
    return np.where(m >= 15.0, log, lin)


def _mel_filters(n_fft: int, f_min: float, f_max: float, slaney_norm: bool) -> np.ndarray:
    freqs = np.linspace(0, SR / 2, n_fft // 2 + 1)
    pts = _slaney_hz(np.linspace(_slaney_mel(f_min), _slaney_mel(f_max), N_MELS + 2))
    diff = np.diff(pts)
    slopes = pts[None, :] - freqs[:, None]
    down = -slopes[:, :-2] / diff[:-1]
    up = slopes[:, 2:] / diff[1:]
    fb = np.maximum(0.0, np.minimum(down, up))
    if slaney_norm:
        fb *= 2.0 / (pts[2:] - pts[:-2])
    return fb.astype(np.float32)  # (频点, mel)


def _stft_mag(y: np.ndarray, n_fft: int, hop: int):
    """居中分帧的幅度谱，分块产出 (起始帧, 幅度)，十几分钟的音频也不会一下吃掉几 GB 内存。"""
    if len(y) < n_fft:
        y = np.pad(y, (0, n_fft - len(y)))
    y = np.ascontiguousarray(np.pad(y, n_fft // 2, mode='reflect'), dtype=np.float32)
    n_frames = 1 + (len(y) - n_fft) // hop
    window = np.hanning(n_fft + 1)[:-1].astype(np.float32)
    for start in range(0, n_frames, 2048):
        count = min(2048, n_frames - start)
        frames = np.lib.stride_tricks.as_strided(
            y[start * hop:], shape=(count, n_fft), strides=(y.strides[0] * hop, y.strides[0]))
        yield start, n_frames, np.abs(np.fft.rfft(frames * window, axis=1))


def envelope(y: np.ndarray) -> np.ndarray:
    """起音包络：对数 mel 谱的正向差分按频带平均，每帧一个值。"""
    fb = _mel_filters(N_FFT, 0.0, SR / 2, slaney_norm=True)
    env, prev = None, None
    for start, n, mag in _stft_mag(y, N_FFT, HOP):
        if env is None:
            env = np.zeros(n, dtype=np.float32)
        db = 10.0 * np.log10(np.maximum((mag ** 2) @ fb, 1e-10))
        full = np.vstack([db[:1] if prev is None else prev[None, :], db])
        env[start:start + len(db)] = np.maximum(0.0, np.diff(full, axis=0)).mean(axis=1)
        prev = db[-1]
    return env


def log_mel(y: np.ndarray) -> np.ndarray:
    """beat_this 的输入谱：(帧, 128)，50 帧每秒。"""
    fb = _mel_filters(NN_FFT, NN_FMIN, NN_FMAX, slaney_norm=False)
    out = None
    for start, n, mag in _stft_mag(y, NN_FFT, NN_HOP):
        if out is None:
            out = np.zeros((n, N_MELS), dtype=np.float32)
        out[start:start + len(mag)] = np.log1p(1000.0 * ((mag / np.sqrt(NN_FFT)) @ fb))
    return out


def _cpu_limit() -> int:
    """容器分到的核数。os.cpu_count() 在容器里报的是宿主机的核数（FC 上几十个），
    onnxruntime 按它开线程会在 4 核的配额里互相抢，10 分钟的音频从 18 秒拖到 150 秒。"""
    try:
        quota, period = open('/sys/fs/cgroup/cpu.max').read().split()  # cgroup v2
    except (OSError, ValueError):
        try:
            quota = open('/sys/fs/cgroup/cpu/cpu.cfs_quota_us').read().strip()  # cgroup v1
            period = open('/sys/fs/cgroup/cpu/cpu.cfs_period_us').read().strip()
        except OSError:
            quota, period = 'max', '1'
    cpus = os.cpu_count() or 1
    if quota not in ('max', '-1'):
        cpus = min(cpus, int(quota) // int(period))
    return max(1, cpus)


def _model():
    global _session
    if _session is None:
        import onnxruntime as ort
        options = ort.SessionOptions()
        options.intra_op_num_threads = _cpu_limit()
        options.inter_op_num_threads = 1
        print(f'[beats] onnxruntime {options.intra_op_num_threads} 线程（os.cpu_count={os.cpu_count()}）', flush=True)
        _session = ort.InferenceSession(MODEL, options, providers=['CPUExecutionProvider'])
    return _session


def activations(spect: np.ndarray) -> tuple:
    """按 beat_this 的方式切成 30 秒的块跑模型再拼回去，返回每帧的 (拍 logit, 重拍 logit)。"""
    n = len(spect)
    starts = np.arange(-BORDER, n - BORDER, CHUNK - 2 * BORDER)
    if n > CHUNK - 2 * BORDER:
        starts[-1] = n - (CHUNK - BORDER)
    beat = np.full(n, -1000.0, dtype=np.float32)
    down = np.full(n, -1000.0, dtype=np.float32)
    # 倒着写，前一块的结果盖住后一块的重叠部分
    for s in starts[::-1]:
        lo, hi = max(s, 0), min(s + CHUNK, n)
        chunk = np.pad(spect[lo:hi], ((max(0, -s), max(0, min(BORDER, s + CHUNK - n))), (0, 0)))
        b, d = _model().run(None, {'spect': chunk[None]})
        a, z = s + BORDER, s + BORDER + len(chunk) - 2 * BORDER
        beat[a:z] = b[0, BORDER:len(chunk) - BORDER]
        down[a:z] = d[0, BORDER:len(chunk) - BORDER]
    return beat, down


def _peaks(logit: np.ndarray) -> np.ndarray:
    """±70 ms 内的最大值、概率过半的帧，抛物线插值到帧以下，返回帧位置（小数）。"""
    padded = np.pad(logit, 3, constant_values=-np.inf)
    local_max = np.lib.stride_tricks.sliding_window_view(padded, 7).max(axis=1)
    idx = np.nonzero((logit == local_max) & (logit > 0))[0]
    if len(idx):
        idx = idx[np.concatenate([[True], np.diff(idx) > 1])]  # 并列的相邻两帧只留一个
    pos = idx.astype(np.float64)
    inner = (idx > 0) & (idx < len(logit) - 1)
    i = idx[inner]
    a, b, c = logit[i - 1], logit[i], logit[i + 1]
    denom = a - 2 * b + c
    with np.errstate(divide='ignore', invalid='ignore'):
        shift = np.where(denom != 0, 0.5 * (a - c) / denom, 0.0)
    pos[inner] += np.clip(shift, -0.5, 0.5)
    return pos


def local_period(beat_prob: np.ndarray) -> np.ndarray:
    """每帧的局部拍距（帧）：前后 4 秒拍概率的自相关，只在 FOLD_LO–FOLD_HI 对应的拍距里找峰，
    所以模型按八分音符出的拍、只出了半拍的都直接折到数八拍的速度上。"""
    n = len(beat_prob)
    win, hop = int(TEMPO_WIN * NN_FPS), int(NN_FPS)
    lags = np.arange(int(60 * NN_FPS / FOLD_HI) - 1, int(np.ceil(60 * NN_FPS / FOLD_LO)) + 2)
    prior = np.exp(-0.5 * (np.log2(60 * NN_FPS / lags / PRIOR_BPM) / 0.5) ** 2)
    centers, periods = [], []
    for s in range(0, max(1, n - win + 1), hop):
        x = beat_prob[s:s + win] - beat_prob[s:s + win].mean()
        if len(x) <= lags[-1]:
            break
        score = np.array([x[:-lag] @ x[lag:] for lag in lags]) * prior
        k = int(np.argmax(score[1:-1])) + 1
        a, b, c = score[k - 1], score[k], score[k + 1]
        denom = a - 2 * b + c
        centers.append(s + len(x) / 2)
        periods.append(lags[k] + (0.5 * (a - c) / denom if denom else 0.0))
    if not periods:
        return np.full(n, 60 * NN_FPS / PRIOR_BPM)
    periods = np.array(periods)
    # 前后各 2 秒取中位数，个别窗口跳八度不算
    smooth = np.array([np.median(periods[max(0, i - 2):i + 3]) for i in range(len(periods))])
    return np.interp(np.arange(n), centers, smooth)


def _same_tempo(p: float, ref: float) -> bool:
    return min(abs(p / (m * ref) - 1) for m in (0.5, 1.0, 2.0)) < 0.1


def _chain(pos: np.ndarray, period: np.ndarray) -> list:
    """顺着局部拍距把峰串成段：下一拍在 b + kP（k ≤ MAX_GAP）附近找，漏的补上，中间多出的峰跳过。
    往后 MAX_GAP 拍都找不到峰（音乐停了）、或者段里的拍距和局部速度对不上了（换歌），这段就结束。"""
    runs, i = [], 0
    while i < len(pos):
        run, last = [pos[i]], i
        while True:
            b = run[-1]
            p = float(np.median(np.diff(run[-9:]))) if len(run) >= 3 else float(period[int(b)])
            if len(run) >= 3 and not _same_tempo(p, float(period[int(b)])):
                break
            found = None
            for k in range(1, MAX_GAP + 1):
                target = b + k * p
                a = np.searchsorted(pos, target - TOL * p)
                z = np.searchsorted(pos, target + TOL * p, side='right')
                if a < z:
                    found = k, a + int(np.argmin(np.abs(pos[a:z] - target)))
                    break
                if target - TOL * p > pos[-1]:
                    break
            if found is None:
                break
            k, c = found
            run.extend(b + (pos[c] - b) * np.arange(1, k) / k)
            run.append(pos[c])
            last = c
        if len(run) >= MIN_RUN:
            runs.append(np.asarray(run))
            i = last + 1
        else:
            i += 1
    return runs


def _bar_votes(run: np.ndarray, down_prob: np.ndarray) -> np.ndarray:
    p = down_prob[np.clip(np.round(run).astype(int), 0, len(down_prob) - 1)]
    return np.array([p[k::4].mean() for k in range(4)])


def _on_beat(run: np.ndarray, down_prob: np.ndarray) -> np.ndarray:
    """模型按八分音符出拍时，段可能整段串在反拍上：挪到两拍中间重拍更明显的话就挪过去。"""
    mid = (run[:-1] + run[1:]) / 2
    return mid if _bar_votes(mid, down_prob).max() > 1.5 * _bar_votes(run, down_prob).max() else run


def bar_phases(p: np.ndarray) -> np.ndarray:
    """每拍的小节位置 φ（0..3，第 i 拍是小节第一拍当且仅当 (i - φ) % 4 == 0）。
    p 是每拍的重拍概率。剪辑过的音乐在接口处会出现两拍、三拍的小节，φ 跟着变；
    用维特比找分段常数的 φ，换一次扣 SWITCH_COST，几个小节的证据才够换。"""
    n = len(p)
    # 连着几拍都像重拍（过门、每拍一下的重音）等于没说哪拍是小节头，按相邻拍压下去，免得拖住分段点
    near = np.maximum(np.concatenate([[0.0], p[:-1]]), np.concatenate([p[1:], [0.0]]))
    p = p * (1 - near)
    lp = np.log(np.clip(p, 0.02, 0.98))
    lq = np.log(np.clip(1 - p, 0.02, 0.98))
    emit = np.where((np.arange(n)[:, None] - np.arange(4)[None, :]) % 4 == 0, lp[:, None], lq[:, None])
    score = emit[0].copy()
    back = np.zeros((n, 4), dtype=int)
    for i in range(1, n):
        best = int(np.argmax(score))
        stay = score >= score[best] - SWITCH_COST
        back[i] = np.where(stay, np.arange(4), best)
        score = np.where(stay, score, score[best] - SWITCH_COST) + emit[i]
    path = np.empty(n, dtype=int)
    path[-1] = int(np.argmax(score))
    for i in range(n - 1, 0, -1):
        path[i - 1] = back[i, path[i]]
    return path


def _phrase_start(spect: np.ndarray, frames: np.ndarray, heads: np.ndarray) -> int:
    """八拍的"1"和"5"都是小节头，模型分不出来。乐句从"1"开始，换段落、进新乐器、剪辑接口都在"1"上，
    所以看每个小节头前后各一小节的平均频谱差多少，单数小节头和双数小节头哪组变化大，哪组就是"1"。
    返回 0 或 1：heads[0] 还是 heads[1] 是"1"。"""
    if len(heads) < 3:
        return 0
    bar = max(1, int(round(4 * np.median(np.diff(frames)))))
    change = np.full(len(heads), np.nan)
    for k, h in enumerate(frames[heads]):
        if bar <= h <= len(spect) - bar:
            change[k] = np.linalg.norm(spect[h:h + bar].mean(axis=0) - spect[h - bar:h].mean(axis=0))
    even, odd = change[0::2], change[1::2]
    if np.isnan(even).all() or np.isnan(odd).all():
        return 0
    return int(np.nanmean(odd) > np.nanmean(even))


def track(beat_logit: np.ndarray, down_logit: np.ndarray, spect: np.ndarray) -> tuple:
    """返回 (拍点帧位置, 分段, bpm)。分段是 [[这段第一拍的下标, 这段里第一个"1"的下标], ...]，段内每 8 拍一个"1"。"""
    beat_prob = 1.0 / (1.0 + np.exp(-beat_logit.astype(np.float64)))
    down_prob = 1.0 / (1.0 + np.exp(-down_logit.astype(np.float64)))
    runs = [_on_beat(r, down_prob) for r in _chain(_peaks(beat_logit), local_period(beat_prob))]
    if not runs:
        return np.array([]), [], None
    sections, offset = [], 0
    for run in runs:
        frames = np.clip(np.round(run).astype(int), 0, len(down_prob) - 1)
        phase = bar_phases(down_prob[frames])
        bounds = np.concatenate([[0], np.nonzero(np.diff(phase))[0] + 1, [len(run)]])
        for s, e in zip(bounds[:-1], bounds[1:]):
            heads = np.arange(s + (phase[s] - s) % 4, e, 4)
            one = heads[_phrase_start(spect, frames, heads)] if len(heads) else s
            sections.append([offset + int(s), offset + int(one)])
        offset += len(run)
    longest = max(runs, key=lambda r: r[-1] - r[0])
    bpm = 60 * NN_FPS / float(np.polyfit(np.arange(len(longest)), longest, 1)[0])
    return np.concatenate(runs), sections, bpm


def analyze(y: np.ndarray) -> dict:
    """y：单声道 float32，采样率 SR。"""
    spect = log_mel(y)
    beat_logit, down_logit = activations(spect)
    pos, sections, bpm = track(beat_logit, down_logit, spect)
    env = envelope(y)
    peak = float(env.max()) or 1.0
    q = np.clip(np.round(env / peak * 255), 0, 255).astype(np.uint8)
    return {
        'bpm': round(bpm, 2) if bpm else None,
        'times': [round(float(p) / NN_FPS, 3) for p in pos],
        'sections': sections,
        'envelope_rate': round(ENVELOPE_RATE, 4),
        'envelope': base64.b64encode(q.tobytes()).decode(),
    }
