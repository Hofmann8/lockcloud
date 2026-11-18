"""/api/lab/beats：节拍标注试验（只在本地用）。数据在 instance/beat_lab/，没有这个目录时全部 404。
规则见 services/beat_lab.py。"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from deps import Body, body, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import File
from services import beat_lab, media

router = APIRouter(prefix='/api/lab/beats')
log = logging.getLogger(__name__)


def _need_lab() -> None:
    if not beat_lab.enabled():
        raise ApiError('LAB_001', '没有标注样本', 404)


def _need_sample(file_id: int) -> None:
    _need_lab()
    if file_id not in beat_lab.sample_ids():
        raise ApiError('LAB_002', '这个视频不在样本里', 404)


@router.get('')
@guarded('获取样本失败')
def list_samples(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """样本列表：{"samples": [{file_id, name, activity_name, activity_date, duration, bpm, ready, has_allin1,
    status, marks}]}。ready 是原料取回来了没有。"""
    _need_lab()
    ids = beat_lab.sample_ids()
    files = {f.id: f for f in db.query(File).filter(File.id.in_(ids)).all()} if ids else {}
    out = []
    for i in ids:
        f = files.get(i)
        if not f:
            continue
        info = media.media_info(f)
        raw = beat_lab.load_raw(i)
        labels = beat_lab.load_labels(i)
        out.append({
            'file_id': i, 'name': media.display_name(f), 'activity_name': f.activity_name,
            'activity_date': f.activity_date.isoformat() if f.activity_date else None,
            'duration': info.get('duration'), 'bpm': (info.get('beats') or {}).get('bpm'),
            'ready': bool(raw and (raw.get('beats') or {}).get('times')),
            'has_allin1': bool(raw and (raw.get('allin1') or {}).get('downbeats')),
            'status': labels.get('status'), 'marks': len(labels.get('marks') or []),
        })
    return json_response({'samples': out})


@router.get('/{file_id:int}')
@guarded('获取样本失败')
def get_sample(file_id: int, identity: str = Depends(jwt_identity)):
    """一个样本的网格和已有标注：{"grid": {times, sections, parts, blocks, …}, "labels": {status, note, marks}}。"""
    _need_sample(file_id)
    raw = beat_lab.load_raw(file_id)
    if not raw or not (raw.get('beats') or {}).get('times'):
        raise ApiError('LAB_003', '这个视频的节拍还没取回来', 404)
    grid = beat_lab.build(raw)
    labels = beat_lab.load_labels(file_id)
    times = grid['times']
    for m in labels.get('marks') or []:    # 标的时候的下标按当时的拍点；算法改了拍点会变，按时刻重新对到最近的拍
        m['beat'] = min(range(len(times)), key=lambda i: abs(times[i] - m['t']))
    return json_response({'grid': grid, 'labels': labels})


@router.put('/{file_id:int}/labels')
@guarded('保存标注失败')
def put_labels(file_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body)):
    _need_sample(file_id)
    data = payload.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError('LAB_004', '标注格式不对')
    saved = beat_lab.save_labels(file_id, beat_lab.clean_labels(data), int(identity))
    return json_response({'labels': saved})
