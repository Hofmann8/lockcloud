"""/api/tags：标签列表和前缀搜索（搜索每分钟 30 次，见 ratelimit.py）。"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database import get_db
from deps import arg, jwt_identity
from errors import ApiError, guarded, json_response
from services.tag_service import tag_service

router = APIRouter(prefix='/api/tags')


def _tags(tags):
    return json_response({'success': True, 'tags': [{'id': t.id, 'name': t.name, 'count': t.count} for t in tags]})


@router.get('')
@guarded('获取标签列表失败，请稍后重试')
def list_tags(identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """全部标签，用得多的在前。"""
    int(identity)
    return _tags(tag_service.get_all_tags_with_count(db))


@router.get('/search')
@guarded('搜索标签失败，请稍后重试')
def search_tags(request: Request, identity: str = Depends(jwt_identity), db: Session = Depends(get_db)):
    """前缀搜索，不分大小写。limit 默认 10，最多 50。"""
    int(identity)
    prefix = arg(request, 'q', '').strip()
    if not prefix:
        raise ApiError('VALIDATION_001', '缺少搜索关键词参数 (q)')
    limit = arg(request, 'limit', 10, type=int)
    if limit < 1:
        limit = 10
    if limit > 50:
        limit = 50
    return _tags(tag_service.search_tags(db, prefix, limit))
