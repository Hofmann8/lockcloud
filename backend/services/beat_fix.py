"""人改的八拍（files.models.BeatFix）：一个视频里哪些时刻是"1"。

上传者和管理员直接存（PUT /api/files/{id}/beats/ones），别人发修改申请（request_type = beats），同意后存进来。
怎么套到拍子上见 services/beat_grid.py 的 apply_ones。
"""
from __future__ import annotations

import math

from errors import ApiError
from files.models import BeatFix
from services import media

MAX_ONES = 200


def clean(value) -> list[float]:
    """请求里的 ones：非负秒数的数组，去重排好。格式不对抛 VALIDATION_001。"""
    if not isinstance(value, list) or len(value) > MAX_ONES:
        raise ApiError('VALIDATION_001', 'ones 必须是时刻的数组')
    out = set()
    for t in value:
        if isinstance(t, bool) or not isinstance(t, (int, float)) or not math.isfinite(t) or t < 0:
            raise ApiError('VALIDATION_001', 'ones 必须是时刻的数组')
        out.add(round(float(t), 3))
    return sorted(out)


def check_file(file) -> None:
    """能改八拍的：分析过、有节拍的视频（没分析过的视频播放器里没有节拍器），和有节拍的音频（不用分析）。"""
    audio = media.is_audio(file)
    if not (media.is_video(file) or audio) or not media.media_info(file).get('beats'):
        raise ApiError('MEDIA_002', '此视频没有节拍信息', 404)
    if not audio and file.lockai_status != 'ready':
        raise ApiError('BEATS_001', '此视频还没有经过 LockAI 分析')


def ones(db, file_id: int) -> list[float]:
    row = db.get(BeatFix, file_id)
    return list(row.ones or []) if row else []


def save(db, file_id: int, value: list[float], user_id: int) -> list[float]:
    """存下来（整份替换，空数组 = 回到算法的数法）。不 commit。"""
    row = db.get(BeatFix, file_id)
    if row is None:
        row = BeatFix(file_id=file_id)
        db.add(row)
    row.ones = list(value)
    row.updated_by = user_id
    return list(value)
