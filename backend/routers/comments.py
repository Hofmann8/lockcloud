"""评论：/api/files/{id}/comments（列表、发表），/api/comments/{id}（删除：作者或管理员）。

t 是视频里的时刻（秒），可以没有。文件进回收站时评论跟着隐藏，彻底删除时一起删（services/file_cleanup.py）。
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.models import User
from database import get_db
from deps import Body, body, jwt_identity
from errors import ApiError, guarded, json_response
from files.models import Comment, File
from services import media

router = APIRouter()

MAX_BODY = 2000


def comment_json(c: Comment, viewer: User | None) -> dict:
    user = c.user
    return {
        'id': c.id, 'file_id': c.file_id, 'body': c.body, 't': c.t,
        'user': {'id': user.id, 'name': user.name, 'avatar_url': user.avatar_url} if user else None,
        'created_at': c.created_at.isoformat(), 'updated_at': c.updated_at.isoformat(),
        'can_delete': bool(viewer and (viewer.id == c.user_id or viewer.is_admin)),
    }


def _file(db: Session, file_id: int) -> File:
    file = db.get(File, file_id)
    if not file:
        raise ApiError('FILE_001', '文件不存在', 404)
    return file


@router.get('/api/files/{file_id:int}/comments')
@guarded('获取评论失败，请稍后重试')
def list_comments(file_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """按 t 正序（没有 t 的排最后），同 t 按时间正序。"""
    _file(db, file_id)
    viewer = db.get(User, int(identity))
    comments = db.query(Comment).filter(Comment.file_id == file_id).order_by(
        Comment.t.is_(None), Comment.t.asc(), Comment.created_at.asc(), Comment.id.asc()).all()
    return json_response({'comments': [comment_json(c, viewer) for c in comments]})


@router.post('/api/files/{file_id:int}/comments', status_code=201)
@guarded('发表评论失败，请稍后重试')
def create_comment(file_id: int, identity: str = Depends(jwt_identity), payload: Body = Depends(body),
                   db: Session = Depends(get_db)):
    file = _file(db, file_id)
    data = payload.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    text = data.get('body').strip() if isinstance(data.get('body'), str) else ''
    if not text:
        raise ApiError('VALIDATION_001', '评论不能为空')
    if len(text) > MAX_BODY:
        raise ApiError('VALIDATION_001', f'评论不能超过 {MAX_BODY} 字')

    t = data.get('t')
    if t is not None:
        if isinstance(t, bool) or not isinstance(t, (int, float)):
            raise ApiError('VALIDATION_001', 't 必须是数字（秒）')
        if not media.is_video(file):
            raise ApiError('VALIDATION_001', '只有视频的评论能带时刻')
        duration = media.media_info(file).get('duration')
        if t < 0 or (duration and t > float(duration)):
            raise ApiError('VALIDATION_001', '时刻超出视频长度')
        t = float(t)

    comment = Comment(file_id=file.id, user_id=int(identity), body=text, t=t)
    db.add(comment)
    db.commit()
    viewer = db.get(User, int(identity))
    return json_response({'comment': comment_json(comment, viewer)}, 201)


@router.delete('/api/comments/{comment_id:int}')
@guarded('删除评论失败，请稍后重试')
def delete_comment(comment_id: int, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    comment = db.get(Comment, comment_id)
    # 文件进了回收站的评论也当不存在
    if not comment or not db.get(File, comment.file_id):
        raise ApiError('COMMENT_001', '评论不存在', 404)
    viewer = db.get(User, int(identity))
    if not (viewer and (viewer.id == comment.user_id or viewer.is_admin)):
        raise ApiError('COMMENT_002', '只能删除自己的评论', 403)
    db.delete(comment)
    db.commit()
    return json_response({'success': True})
