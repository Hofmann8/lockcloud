"""/api/compare：并排对比。align 用两边 beats.json 里的起音包络做互相关，算法见 services/align.py。"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database import get_db
from deps import arg, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import File
from services import align, media

router = APIRouter(prefix='/api/compare')


def _envelope(db: Session, file_id: int):
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    data = media.load_beats(file)
    if not data or not data.get('envelope') or not data.get('envelope_rate'):
        raise ApiError('MEDIA_002', f'「{media.display_name(file)}」没有节拍信息', 404)
    return align.decode_envelope(data)


@router.get('/align')
@guarded('对齐失败')
def align_videos(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """offset：b 的第 t + offset 秒对应 a 的第 t 秒。confidence < 0.3 前端提示手动调。"""
    a_id = arg(request, 'a', type=int)
    b_id = arg(request, 'b', type=int)
    if not a_id or not b_id:
        raise ApiError('VALIDATION_001', '缺少参数 a、b（视频 id）')
    if a_id == b_id:
        raise ApiError('VALIDATION_001', '请选择两段不同的视频')
    env_a, rate_a = _envelope(db, a_id)
    env_b, rate_b = _envelope(db, b_id)
    offset, confidence = align.align(env_a, rate_a, env_b, rate_b)
    return json_response({'offset': offset, 'confidence': confidence, 'method': 'onset'})
