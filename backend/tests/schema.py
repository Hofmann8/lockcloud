"""响应 JSON 结构断言。

spec 的写法：
    str / int / float / bool     对应 JSON 类型（int 不接受 bool，float 接受整数）
    None                          值必须是 null
    Nullable(spec)                null 或 spec
    Absent(spec)                  这个键可以没有，有的话要符合 spec
    [spec]                        数组，每个元素符合 spec
    {键: spec}                    对象，键集合必须完全一致（多了少了都算不兼容）
    Loose({键: spec})             对象，只检查列出来的键，允许多出别的键
    Any                           不检查
    Const(v)                      值必须等于 v
    Regex(r'...')                 字符串且匹配
"""

from __future__ import annotations

import re


class Nullable:
    def __init__(self, spec):
        self.spec = spec


class Absent:
    def __init__(self, spec):
        self.spec = spec


class Loose:
    def __init__(self, spec: dict):
        self.spec = spec


class Const:
    def __init__(self, value):
        self.value = value


class Regex:
    def __init__(self, pattern: str):
        self.pattern = re.compile(pattern)


class _AnyType:
    pass


Any = _AnyType()


def _fail(path, msg, value):
    raise AssertionError(f'{path}: {msg}，实际值 {value!r}')


def check(value, spec, path='$'):
    if spec is Any:
        return
    if spec is None:
        if value is not None:
            _fail(path, '应为 null', value)
        return
    if isinstance(spec, Nullable):
        if value is not None:
            check(value, spec.spec, path)
        return
    if isinstance(spec, Const):
        if value != spec.value:
            _fail(path, f'应等于 {spec.value!r}', value)
        return
    if isinstance(spec, Regex):
        if not isinstance(value, str) or not spec.pattern.search(value):
            _fail(path, f'应匹配 {spec.pattern.pattern}', value)
        return
    if spec is bool:
        if not isinstance(value, bool):
            _fail(path, '应为 bool', value)
        return
    if spec is int:
        if isinstance(value, bool) or not isinstance(value, int):
            _fail(path, '应为整数', value)
        return
    if spec is float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            _fail(path, '应为数字', value)
        return
    if spec is str:
        if not isinstance(value, str):
            _fail(path, '应为字符串', value)
        return
    if isinstance(spec, list):
        if not isinstance(value, list):
            _fail(path, '应为数组', value)
        for i, item in enumerate(value):
            check(item, spec[0], f'{path}[{i}]')
        return
    if isinstance(spec, (dict, Loose)):
        strict = isinstance(spec, dict)
        fields = spec if strict else spec.spec
        if not isinstance(value, dict):
            _fail(path, '应为对象', value)
        required = {k for k, s in fields.items() if not isinstance(s, Absent)}
        missing = required - set(value)
        if missing:
            _fail(path, f'缺少键 {sorted(missing)}', value)
        if strict:
            extra = set(value) - set(fields)
            if extra:
                _fail(path, f'多出键 {sorted(extra)}', value)
        for k, s in fields.items():
            if k in value:
                check(value[k], s.spec if isinstance(s, Absent) else s, f'{path}.{k}')
        return
    raise TypeError(f'不认识的 spec: {spec!r}')


def assert_shape(value, spec):
    check(value, spec)
    return value


def assert_error(resp, status: int, code: str, message: str | None = None):
    """统一错误格式：{"error": {"code", "message", ...}}。details 等附加键不强求。"""
    assert resp.status == status, (resp.status, resp.text[:500])
    body = resp.json()
    check(body, {'error': Loose({'code': str, 'message': str})})
    assert body['error']['code'] == code, body
    if message is not None:
        assert body['error']['message'] == message, body
    return body['error']


# ------------------------------------------------------------------
# 常用结构
# ------------------------------------------------------------------

ISO_DATETIME = Regex(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')
ISO_DATE = Regex(r'^\d{4}-\d{2}-\d{2}$')

USER = {
    'id': int,
    'email': str,
    'name': str,
    'avatar_url': Nullable(str),
    'created_at': Nullable(ISO_DATETIME),
    'last_login': Nullable(ISO_DATETIME),
    'is_active': bool,
    'is_admin': bool,
}

UPLOADER = {
    'id': int,
    'name': str,
    'email': str,
    'avatar_url': Nullable(str),
}

TAG = {'id': int, 'name': str}
TAG_WITH_COUNT = {'id': int, 'name': str, 'count': int}

# File.to_dict()；duration / width / height 只在有 media_info 时出现
FILE_BASE = {
    'id': int,
    'filename': str,
    'directory': str,
    's3_key': str,
    'size': int,
    'content_type': Nullable(str),
    'uploader_id': int,
    'uploaded_at': Nullable(ISO_DATETIME),
    'original_filename': Nullable(str),
    'activity_date': Nullable(ISO_DATE),
    'activity_type': Nullable(str),
    'activity_name': Nullable(str),
    'is_legacy': bool,
    'thumbhash': Nullable(str),
    'media_status': str,
    'lockai_status': Nullable(str),
    'taken_at': Nullable(str),     # 2026-09：拍摄时间
    'orientation': int,            # 2026-09：EXIF 方向 1-8，视频永远 1
    'duration': Absent(Nullable(float)),
    'width': Absent(Nullable(int)),
    'height': Absent(Nullable(int)),
    'live': bool,                  # 2026-11：Live Photo（动态部分挂在这张照片名下）
    'cover': Absent(bool),         # 2026-11：音频才有，有没有专辑封面
    'waveform': Absent(Nullable([int])),   # 2026-11：音频才有，波形 0–100
    'free_tags': [TAG],
}

FILE_WITH_UPLOADER = {**FILE_BASE, 'uploader': UPLOADER}

# 列表 / 详情 / 更新接口在 to_dict 之外补一个 activity_type_display
FILE_DISPLAY = {**FILE_WITH_UPLOADER, 'activity_type_display': Absent(str)}

PAGINATION = {
    'page': int,
    'per_page': int,
    'total': int,
    'pages': int,
    'has_next': bool,
    'has_prev': bool,
}

BATCH_RESULTS = {
    'succeeded': [int],
    'failed': [{'file_id': Any, 'error': str}],
}

FILE_REQUEST = {
    'id': int,
    'file_id': Nullable(int),
    'requester_id': int,
    'owner_id': int,
    'request_type': str,
    'status': str,
    'proposed_changes': Any,
    'directory_info': Any,
    'message': Nullable(str),
    'response_message': Nullable(str),
    'created_at': ISO_DATETIME,
    'updated_at': ISO_DATETIME,
}

FILE_REQUEST_FULL = {
    **FILE_REQUEST,
    'file': Absent({
        'id': int,
        'filename': str,
        'activity_date': Nullable(ISO_DATE),
        'activity_type': Nullable(str),
        'activity_name': Nullable(str),
    }),
    'requester': Absent({'id': int, 'name': str}),
    'owner': Absent({'id': int, 'name': str}),
}

LOG = {
    'id': int,
    'user_id': int,
    'file_id': Nullable(int),
    'operation': str,
    'file_path': Nullable(str),
    'timestamp': ISO_DATETIME,
    'ip_address': Nullable(str),
    'user_agent': Nullable(str),
    'user': Absent({'id': int, 'name': str, 'email': str}),
    'file': Absent({'id': int, 'filename': str, 'directory': str}),
}

USAGE_SUMMARY = {
    'total_storage': int,
    'total_storage_formatted': str,
    'total_files': int,
    'upload_count': int,
    'active_users': int,
    'operation_stats': {'upload': int, 'delete': int, 'access': int, 'update': int},
    'period': {'start_date': Nullable(str), 'end_date': Nullable(str)},
}

BBOX = {'x': int, 'y': int, 'w': int, 'h': int}
