"""build 时跑一次：用一段合成的节拍声把 All-In-One 和 Demucs 的权重都下载进镜像，顺便确认能跑通。"""
import os
import tempfile
import time

import numpy as np
import soundfile as sf

from allin1_infer import AllInOneSession

SR = 44100
t = np.arange(20 * SR) / SR
y = 0.1 * np.sin(2 * np.pi * 220 * t)
for k in range(int(20 / 0.5)):                      # 120 BPM 的咔嗒声
    a = int(k * 0.5 * SR)
    y[a:a + 2000] += np.hanning(4000)[2000:] * (0.8 if k % 4 == 0 else 0.4)
work = tempfile.mkdtemp()
path = os.path.join(work, 'warmup.wav')
sf.write(path, np.stack([y, y], axis=1).astype(np.float32), SR)

t0 = time.monotonic()
r = AllInOneSession(model='harmonix-all', device='cpu').load().infer(
    path, demix_dir=os.path.join(work, 'demix'), spec_dir=os.path.join(work, 'spec'))
print(f'warmup ok {time.monotonic() - t0:.1f}s bpm={r.bpm} beats={len(r.beats)} downbeats={len(r.downbeats)} '
      f'segments={len(r.segments)}', flush=True)
