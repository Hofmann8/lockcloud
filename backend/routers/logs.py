"""/api/logs：操作日志和用量统计（管理员）。"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from auth.models import User
from database import get_db
from deps import arg, logs_admin
from errors import ApiError, error_response, json_response
from logs.models import OperationType
from logs.service import get_logs, get_quarterly_stats, get_usage_summary

router = APIRouter(prefix='/api/logs')


def _run(fn, failure: str):
    """ValueError（日期格式等）→ 400；其他 → 500，details 里带原因（Flask 版就这样）。"""
    try:
        return json_response({'success': True, 'data': fn()})
    except ApiError:
        raise
    except ValueError as e:
        return error_response('VALIDATION_001', f'输入数据无效: {e}', 400)
    except Exception as e:
        return error_response('INTERNAL_ERROR', failure, 500, details=str(e))


@router.get('')
def query_logs(request: Request, admin: User = Depends(logs_admin), db: Session = Depends(get_db)):
    """筛选：user_id、operation（upload/delete/access/update）、start_date、end_date；分页 page、per_page（最多 100）。"""
    def run():
        operation = arg(request, 'operation')
        if operation:
            valid = [op.value for op in OperationType]
            if operation not in valid:
                raise ApiError('VALIDATION_001', f'操作类型无效。必须是以下之一: {", ".join(valid)}')
        return get_logs(db, user_id=arg(request, 'user_id', type=int), operation=operation,
                        start_date=arg(request, 'start_date'), end_date=arg(request, 'end_date'),
                        page=arg(request, 'page', 1, type=int), per_page=min(arg(request, 'per_page', 50, type=int), 100))
    return _run(run, '查询日志时发生错误')


@router.get('/summary')
def usage_summary(request: Request, admin: User = Depends(logs_admin), db: Session = Depends(get_db)):
    return _run(lambda: get_usage_summary(db, start_date=arg(request, 'start_date'),
                                          end_date=arg(request, 'end_date')), '获取使用统计时发生错误')


@router.get('/quarterly/{year:int}/{quarter:int}')
def quarterly_stats(year: int, quarter: int, admin: User = Depends(logs_admin), db: Session = Depends(get_db)):
    if quarter < 1 or quarter > 4:
        return error_response('VALIDATION_001', '季度必须在 1 到 4 之间', 400)
    return _run(lambda: get_quarterly_stats(db, year, quarter), '获取季度统计时发生错误')
