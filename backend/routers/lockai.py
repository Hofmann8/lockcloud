"""/api/files/{id}/lockai、/api/lockai：发起 LockAI 分析、查本月额度。规则见 services/lockai.py。"""
import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from auth.models import User
from database import get_db
from deps import Body, body, client_ip, jwt_identity, user_agent
from errors import ApiError, guarded, json_response
from files.models import File
from logs.models import FileLog, OperationType
from services import lockai, media

router = APIRouter()
log = logging.getLogger(__name__)


def _user(db: Session, identity: str) -> User:
    user = db.get(User, int(identity))
    if not user:
        raise ApiError('AUTH_001', '账号不存在', 401)
    return user


@router.get('/api/lockai/quota')
@guarded('获取额度失败')
def get_quota(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """本月还能发起几次：{"limit": 3, "used": 1, "remaining": 2, "resets_at": "..."}；管理员 limit、remaining 是 null。"""
    return json_response(lockai.quota(db, _user(db, identity)))


@router.post('/api/files/{file_id:int}/lockai')
@guarded('发起分析失败')
def request_analysis(file_id: int, request: Request, identity: str = Depends(jwt_identity),
                     payload: Body = Depends(body), db: Session = Depends(get_db)):
    """发起分析，进队列。管理员可以 {"force": true} 重新分析已经分析过的视频。"""
    user = _user(db, identity)
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    data = payload.get_json(silent=True) or {}
    lockai.request(db, file, user, force=data.get('force') is True)
    db.add(FileLog.create_log(user_id=user.id, operation=OperationType.UPDATE, file_id=file.id,
                              file_path=f'LockAI 分析: {media.display_name(file)}',
                              ip_address=client_ip(request), user_agent=user_agent(request)))
    db.commit()
    log.info(f'User {user.id} requested LockAI analysis for file {file.id}')
    lockai.kick()
    return json_response({'lockai': lockai.info(db, file), 'quota': lockai.quota(db, user)}, 201)
