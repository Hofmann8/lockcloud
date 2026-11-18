"""调媒体 FC 的 HTTP 触发器：打包下载（/jobs/zip）、重跑处理（/jobs/process）。

异步调用（X-Fc-Invocation-Type: Async）：FC 收下就回 202，跑完自己回调后端
（/api/files/internal/media-result、/api/files/internal/job-result）。鉴权用和回调同一个 MEDIA_CALLBACK_TOKEN。

环境变量：
  MEDIA_FC_ENDPOINT     媒体函数 HTTP 触发器的地址，如 https://lockcloud-media-xxxx.cn-hangzhou.fcapp.run
  MEDIA_CALLBACK_TOKEN  和 FC 同一个值
"""
from __future__ import annotations

import os

import requests

from config import settings

TIMEOUT = 10


class FCNotConfigured(RuntimeError):
    pass


def endpoint() -> str:
    return (os.environ.get('MEDIA_FC_ENDPOINT') or '').strip().rstrip('/')


def invoke(path: str, body: dict) -> None:
    """异步调用 FC。没配置或调用失败直接抛出，调用方决定怎么记。"""
    base = endpoint()
    token = settings.media_callback_token or ''
    if not base or not token:
        raise FCNotConfigured('MEDIA_FC_ENDPOINT / MEDIA_CALLBACK_TOKEN 未配置')
    r = requests.post(base + path, json=body, timeout=TIMEOUT,
                      headers={'X-Media-Token': token, 'X-Fc-Invocation-Type': 'Async'})
    if r.status_code >= 300:
        raise RuntimeError(f'FC 返回 {r.status_code}: {r.text[:200]}')
