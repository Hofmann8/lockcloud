"""
对象存储：阿里云 OSS 的 lock-cloud 桶（杭州，私有）。

桶里的目录：
    files/{uuid}{.ext}             原文件。上传时定下，之后永远不变；文件名、活动、日期只存在数据库里
    media/{uuid}/poster.jpg        视频封面（媒体 FC 生成）
    media/{uuid}/hls/…             HLS：master.m3u8 + 1080p/ 720p/ 各一套 index.m3u8 和分片
    media/{uuid}/media.json        媒体 FC 的结果：时长、尺寸、清晰度、thumbhash
    backups/db/{YYYY}/{MM}/…      数据库备份，桶的生命周期规则 30 天后删
    tmp/                           调试和中转，生命周期规则 1 天后删

原文件和派生文件分两个前缀：OSS 触发器只能按前缀过滤，媒体 FC 只挂在 files/ 上，
自己写 media/ 不会再触发自己。

服务器和 FC 都在杭州：读写走内网 endpoint（不收流量费）；
给浏览器 / App 的签名地址走外网 endpoint。
签名用 OSS 原生 V4（oss2），这样图片处理参数 x-oss-process 可以一起签进去。
"""
from __future__ import annotations

import os
import re
import uuid
from typing import Iterator, Optional
from urllib.parse import quote

import oss2

FILES_PREFIX = 'files/'
MEDIA_PREFIX = 'media/'
BACKUP_PREFIX = 'backups/db/'
TMP_PREFIX = 'tmp/'

# 和 config.py 的默认值一致
DEFAULT_BUCKET = 'lock-cloud'
DEFAULT_ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com'

# 签名地址有效期上限：客户端传多少都不超过这个
MAX_SIGN_SECONDS = 24 * 3600


def _config(name: str, default: Optional[str] = None) -> Optional[str]:
    """读环境变量。导入 config 时已经加载了 backend/.env；迁移脚本自己 load_dotenv。"""
    return os.environ.get(name, default)


# ---------------------------------------------------------------- key 规则

_FILE_KEY = re.compile(r'^files/([0-9a-f]{32})(\.[a-z0-9]{1,8})?$')
_MEDIA_DIR = re.compile(r'^media/[0-9a-f]{32}/$')


def new_file_key(extension: str) -> str:
    """新上传文件的 key。extension 带点，如 '.mp4'；统一小写。"""
    ext = (extension or '').lower()
    if ext and not ext.startswith('.'):
        ext = '.' + ext
    return f'{FILES_PREFIX}{uuid.uuid4().hex}{ext}'


def is_file_key(key: str) -> bool:
    return bool(_FILE_KEY.match(key or ''))


def media_prefix(key: str) -> str:
    """原文件 key → 它的派生文件目录 media/{uuid}/。"""
    m = _FILE_KEY.match(key or '')
    if not m:
        raise ValueError(f'不是原文件 key: {key}')
    return f'{MEDIA_PREFIX}{m.group(1)}/'


def derived_key(key: str, name: str) -> str:
    """原文件的派生文件：poster.jpg、media.json、hls/master.m3u8 …"""
    return media_prefix(key) + name


# ---------------------------------------------------------------- 服务

class Storage:
    def __init__(self):
        self._ops: Optional[oss2.Bucket] = None
        self._signer: Optional[oss2.Bucket] = None

    # 两个 Bucket 对象：内网做读写，外网只用来签名
    def _auth(self):
        key_id = _config('OSS_ACCESS_KEY_ID')
        secret = _config('OSS_ACCESS_KEY_SECRET')
        if not key_id or not secret:
            raise RuntimeError('OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 未配置')
        return oss2.AuthV4(key_id, secret)

    def _bucket(self, endpoint: str) -> oss2.Bucket:
        return oss2.Bucket(
            self._auth(),
            endpoint,
            self.bucket_name,
            region=_config('OSS_REGION', 'cn-hangzhou'),
            connect_timeout=30,
        )

    @property
    def bucket_name(self) -> str:
        return _config('OSS_BUCKET', DEFAULT_BUCKET)

    @property
    def ops(self) -> oss2.Bucket:
        if self._ops is None:
            endpoint = _config('OSS_INTERNAL_ENDPOINT') or _config('OSS_ENDPOINT', DEFAULT_ENDPOINT)
            self._ops = self._bucket(endpoint)
        return self._ops

    @property
    def signer(self) -> oss2.Bucket:
        if self._signer is None:
            self._signer = self._bucket(_config('OSS_ENDPOINT', DEFAULT_ENDPOINT))
        return self._signer

    # ------------------------------------------------------------ 签名

    def sign_get(self, key: str, expires: int = 3600, process: Optional[str] = None,
                 filename: Optional[str] = None, disposition: str = 'inline', internal: bool = False) -> str:
        """签名下载地址。process 是 OSS 图片 / 视频处理参数；filename 让保存时用原文件名。

        internal=True 签内网地址：给同在杭州的 FC 用，不走外网、不收流出流量费。
        """
        params = {}
        if process:
            params['x-oss-process'] = process
        if filename:
            params['response-content-disposition'] = f"{disposition}; filename*=UTF-8''{quote(filename)}"
        bucket = self.ops if internal else self.signer
        return bucket.sign_url('GET', key, min(max(int(expires), 60), MAX_SIGN_SECONDS),
                               params=params or None, slash_safe=True)

    def sign_put(self, key: str, content_type: str, expires: int = 3600) -> str:
        """浏览器直传用的签名 PUT。Content-Type 签进去，客户端必须带同样的头。"""
        return self.signer.sign_url('PUT', key, expires, headers={'Content-Type': content_type}, slash_safe=True)

    # ------------------------------------------------------------ 读写（内网）

    def head(self, key: str) -> Optional[int]:
        """对象存在返回大小，不存在返回 None。"""
        try:
            return self.ops.head_object(key).content_length
        except oss2.exceptions.NotFound:
            return None

    def exists(self, key: str) -> bool:
        return self.head(key) is not None

    def put_bytes(self, key: str, data: bytes, content_type: str = 'application/octet-stream') -> None:
        self.ops.put_object(key, data, headers={'Content-Type': content_type})

    def put_file(self, key: str, path: str, content_type: str = 'application/octet-stream') -> None:
        oss2.resumable_upload(self.ops, key, path, headers={'Content-Type': content_type})

    def get_bytes(self, key: str) -> Optional[bytes]:
        try:
            return self.ops.get_object(key).read()
        except oss2.exceptions.NotFound:
            return None

    def get_text(self, key: str) -> Optional[str]:
        data = self.get_bytes(key)
        return data.decode('utf-8') if data is not None else None

    def delete(self, key: str) -> None:
        self.ops.delete_object(key)

    def list_keys(self, prefix: str) -> Iterator[oss2.models.SimplifiedObjectInfo]:
        yield from oss2.ObjectIterator(self.ops, prefix=prefix)

    def delete_prefix(self, prefix: str) -> int:
        """删掉一个目录下的全部对象。只允许 media/{uuid}/ 和 tmp/ 下面，防止误删整桶。"""
        if not (prefix.startswith(TMP_PREFIX) or _MEDIA_DIR.match(prefix)):
            raise ValueError(f'不允许整目录删除: {prefix}')
        keys = [o.key for o in self.list_keys(prefix)]
        for i in range(0, len(keys), 1000):
            self.ops.batch_delete_objects(keys[i:i + 1000])
        return len(keys)

    def delete_file(self, key: str) -> None:
        """删原文件和它的全部派生文件。老 key（迁移前的路径）没有派生文件，只删自己。"""
        self.delete(key)
        if is_file_key(key):
            self.delete_prefix(media_prefix(key))


storage = Storage()
