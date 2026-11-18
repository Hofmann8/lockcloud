"""/api/auth：SSO 登录（LockAuth）、当前用户；头像归 LockAuth，这里只剩给老版 App 的提示。"""
import logging
import os
from datetime import datetime

import requests
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.models import User
from config import settings
from database import get_db
from deps import Body, body, jwt_identity
from errors import ApiError, error_response, guarded, json_response
from security import create_access_token

router = APIRouter(prefix='/api/auth')
log = logging.getLogger(__name__)


# ---------------------------------------------------------------- SSO 登录


@router.post('/sso/login')
@guarded('登录失败，请稍后重试')
def sso_login(payload: Body = Depends(body), db: Session = Depends(get_db)):
    """用 LockAuth 签的令牌换本地令牌；本地没有这个用户就建一个。"""
    data = payload.get_json()
    if not data or 'token' not in data:
        raise ApiError('VALIDATION_001', '请提供 SSO token')
    sso_token = data['token']

    try:
        verify_response = requests.post(f'{settings.sso_auth_api_url}/api/auth/verify-token',
                                        json={'token': sso_token}, timeout=10)
    except requests.RequestException as e:
        log.error(f'SSO verification request failed: {e}')
        raise ApiError('SSO_ERROR', '账号服务暂不可用，请稍后再试', 503)

    if verify_response.status_code != 200:
        raise ApiError('AUTH_INVALID_TOKEN', '登录已过期，请重新登录', 401)
    sso_data = verify_response.json()
    if not sso_data.get('valid'):
        raise ApiError('AUTH_INVALID_TOKEN', '登录验证失败，请重新登录', 401)

    sso_user = sso_data.get('user', {})
    email = sso_user.get('email', '').lower()
    name = sso_user.get('name', '')
    sso_user_id = sso_user.get('id')
    if not email:
        raise ApiError('SSO_ERROR', '账号信息不完整，请联系管理员')

    user = db.query(User).filter_by(email=email).first()
    if not user:
        user = User(email=email, name=name or email.split('@')[0], created_at=datetime.utcnow(), is_active=True)
        db.add(user)
        log.info(f'New user auto-created from SSO: {email}')
    elif name and user.name != name:
        user.name = name

    if not user.is_active:
        raise ApiError('AUTH_006', '账号已被禁用，请联系管理员', 401)

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(str(user.id), {'email': user.email, 'name': user.name, 'sso_user_id': sso_user_id})
    log.info(f'User logged in via SSO: {email}')
    return json_response({'success': True, 'message': '登录成功', 'token': token, 'user': user.to_dict()})


@router.get('/sso/config')
def get_sso_config():
    return json_response({'success': True, 'sso_login_url': settings.sso_auth_frontend_url,
                          'sso_frontend_url': settings.sso_auth_frontend_url})


@router.post('/dev/login')
def dev_login(payload: Body = Depends(body), db: Session = Depends(get_db)):
    """开发用的免密登录，.env 里 DEV_LOGIN_ENABLED=true 才开。"""
    if os.environ.get('DEV_LOGIN_ENABLED', 'false').lower() != 'true':
        return error_response('DEV_LOGIN_DISABLED', '开发登录已禁用，请在 .env 中设置 DEV_LOGIN_ENABLED=true', 403)
    return _dev_login(payload=payload, db=db)


@guarded('登录失败')
def _dev_login(payload: Body, db: Session):
    data = payload.get_json()
    email = data.get('email', 'dev@localhost.com').lower()
    name = data.get('name', email.split('@')[0])
    user = db.query(User).filter_by(email=email).first()
    if not user:
        user = User(email=email, name=name, created_at=datetime.utcnow(), is_active=True)
        db.add(user)
        log.warning(f'[DEV] Created dev user: {email}')
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_access_token(str(user.id), {'email': user.email, 'name': user.name, 'dev_login': True})
    log.warning(f'[DEV] Dev login used: {email}')
    return json_response({'success': True, 'message': '[开发模式] 登录成功', 'token': token, 'user': user.to_dict()})


# ---------------------------------------------------------------- 当前用户


@router.post('/refresh')
@guarded('令牌刷新失败，请重新登录')
def refresh(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    user = db.get(User, int(identity))
    if not user:
        raise ApiError('AUTH_001', '账号不存在', 401)
    if not user.is_active:
        raise ApiError('AUTH_006', '账号已被禁用，请联系管理员', 401)
    token = create_access_token(str(user.id), {'email': user.email, 'name': user.name})
    return json_response({'success': True, 'message': '令牌刷新成功', 'token': token, 'user': user.to_dict()})


@router.get('/me')
@guarded('获取用户信息失败')
def get_current_user(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    user = db.get(User, int(identity))
    if not user:
        raise ApiError('AUTH_001', '账号不存在', 404)
    if not user.is_active:
        raise ApiError('AUTH_006', '账号已被禁用，请联系管理员', 401)
    return json_response({'success': True, 'user': user.to_dict()})


# ---------------------------------------------------------------- 头像：归 LockAuth 管，这里只剩提示


def _avatar_moved():
    return error_response('AVATAR_MOVED', '头像请在 Funk & Love 账号中修改', 410,
                          manage_url=settings.sso_auth_frontend_url + '/dashboard/profile')


@router.post('/avatar/upload-url')
def get_avatar_upload_url(identity: str = Depends(jwt_identity)):
    return _avatar_moved()


@router.post('/avatar/confirm')
def confirm_avatar_upload(identity: str = Depends(jwt_identity)):
    return _avatar_moved()


@router.delete('/avatar')
def delete_avatar(identity: str = Depends(jwt_identity)):
    return _avatar_moved()

