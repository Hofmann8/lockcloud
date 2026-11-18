"""媒体 FC 的节拍整理（fc/media/beats.py 的 track）：模型出的逐帧 logit → 拍点和八拍分段。

不跑模型，直接造 logit：拍点处 +6、其余 -6；小节第一拍的重拍 logit 也是 +6。
"""
import os
import sys

import numpy as np
import pytest

FC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fc', 'media')


@pytest.fixture(scope='module')
def beats():
    if FC_DIR not in sys.path:
        sys.path.insert(0, FC_DIR)
    import beats
    return beats


def _logits(n_frames, beat_frames, down_frames):
    beat = np.full(n_frames, -6.0, dtype=np.float32)
    down = np.full(n_frames, -6.0, dtype=np.float32)
    beat[np.round(beat_frames).astype(int)] = 6.0
    down[np.round(down_frames).astype(int)] = 6.0
    return beat, down


def _counts(sections, n):
    starts = [s for s, _ in sections] + [n]
    out = []
    for (s, one), e in zip(sections, starts[1:]):
        out += [(i - one) % 8 + 1 for i in range(s, e)]
    return out


def test_steady_4_4(beats):
    """120 BPM（25 帧一拍），小节从第 2 拍开始：一段，"1" 落在小节头上，不在第一拍。"""
    frames = 100 + 25 * np.arange(64)
    beat, down = _logits(1900, frames, frames[1::4])
    pos, sections, bpm = beats.track(beat, down, np.zeros((1900, 128), np.float32))
    assert len(pos) == 64 and abs(bpm - 120) < 0.5
    assert np.allclose(pos, frames, atol=0.5)
    assert sections == [[0, 1]]
    counts = _counts(sections, len(pos))
    assert all(counts[i] in (1, 5) for i in range(1, 64, 4))


def test_double_time_folds(beats):
    """模型按八分音符出拍（240 BPM）：隔一拍取一拍，留重拍所在的那一组，折回 120。"""
    frames = 100 + 12.5 * np.arange(128)
    beat, down = _logits(1800, frames, frames[1::8])
    pos, sections, bpm = beats.track(beat, down, np.zeros((1800, 128), np.float32))
    assert abs(bpm - 120) < 1
    assert np.allclose(np.diff(pos), 25, atol=0.6)
    assert np.isclose(pos, frames[1], atol=0.6).any()   # 重拍那一组留下了


def test_cut_with_three_beat_bar_starts_new_section(beats):
    """剪辑接口处有个三拍的小节：小节位置变了，另起一段，两段的"1"都落在各自的小节头上。"""
    frames = 100 + 25 * np.arange(80)
    heads = list(frames[0:40:4]) + list(frames[39::4])   # 第 36-38 拍是三拍小节，之后从第 39 拍起每 4 拍一个
    beat, down = _logits(2200, frames, heads)
    pos, sections, bpm = beats.track(beat, down, np.zeros((2200, 128), np.float32))
    assert len(pos) == 80 and len(sections) == 2
    counts = _counts(sections, len(pos))
    head_idx = [int(np.argmin(np.abs(frames - h))) for h in heads]
    assert all(counts[i] in (1, 5) for i in head_idx)


def test_silence_and_speech_give_no_beats(beats):
    beat, down = _logits(1500, [], [])
    pos, sections, bpm = beats.track(beat, down, np.zeros((1500, 128), np.float32))
    assert (len(pos), sections, bpm) == (0, [], None)
    # 说话声里零星几个峰，连不成 8 拍
    beat, down = _logits(1500, [100, 131, 170, 400, 437], [])
    assert beats.track(beat, down, np.zeros((1500, 128), np.float32))[1] == []


def test_phrase_start_picks_bigger_change(beats):
    """"1"和"5"都是小节头：哪组小节头前后频谱变化大（乐句开头），哪组是"1"。"""
    frames = 100 + 25 * np.arange(64)
    beat, down = _logits(1900, frames, frames[0::4])
    spect = np.zeros((1900, 128), np.float32)
    for k, f in enumerate(frames[4::8]):   # 从第 4 拍起每 8 拍换一次"音色"
        spect[int(f):] = k % 2
    pos, sections, bpm = beats.track(beat, down, spect)
    assert sections == [[0, 4]]
