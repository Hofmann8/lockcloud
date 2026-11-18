"""把 beat_this 的 final0 权重导成 ONNX，给媒体 FC 的 beats.py 用。build 镜像前跑一次，产物不进 git。

    E:/conda/envs/music_analysis/python.exe export_beat_model.py

需要装了 beat_this、torch、onnx 的环境（music_analysis 有）。权重第一次会从 JKU 下到 torch hub 缓存。
导完用 onnxruntime 跑一遍，和 torch 的输出对一下。
"""
import os

import numpy as np
import onnxruntime as ort
import torch
from beat_this.inference import load_model

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'beat_this.onnx')


class Logits(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, spect):
        out = self.model(spect)
        return out['beat'], out['downbeat']


def main():
    model = Logits(load_model('final0', 'cpu')).eval()
    with torch.no_grad():
        torch.onnx.export(model, (torch.randn(1, 1500, 128),), OUT, input_names=['spect'],
                          output_names=['beat', 'downbeat'], opset_version=17, dynamo=False,
                          dynamic_axes={'spect': {1: 'time'}, 'beat': {1: 'time'}, 'downbeat': {1: 'time'}})
    session = ort.InferenceSession(OUT, providers=['CPUExecutionProvider'])
    for frames in (1500, 700):
        x = torch.randn(1, frames, 128)
        with torch.no_grad():
            beat, down = model(x)
        got_beat, got_down = session.run(None, {'spect': x.numpy()})
        diff = max(np.abs(got_beat - beat.numpy()).max(), np.abs(got_down - down.numpy()).max())
        print(f'{frames} 帧：和 torch 最大差 {diff:.1e}')
        assert diff < 1e-3
    print(f'写好了 {OUT}（{os.path.getsize(OUT) / 1e6:.0f} MB）')


if __name__ == '__main__':
    main()
