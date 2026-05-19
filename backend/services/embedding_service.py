"""
阿里云多模态 embedding 客户端封装(tongyi-embedding-vision-flash-2026-03-06)。

设计:
- 纯模块,不依赖 Flask 上下文 —— worker 离线脚本也能 import
- 用官方 dashscope SDK(已加入 requirements),不自己拼 HTTP
- 配置从环境变量读,from_env() 工厂方法
- 重试:网络错误 / 429 / 5xx,指数退避(最多 4 次)
- 返回 EmbeddingResult(vector + input_tokens),便于成本追踪
- 文本 / 图片 URL / 图片字节(base64)三种入口

接口约定(2026 价表所示):
  input: 扁平 list,如 [{"text": "..."}] 或 [{"image": "url 或 data:image/..."}]
  parameters: model + dimension(flash 默认 768);**flash 不支持 image_resolution_level**
  output 形态:resp.output["embeddings"][i]["embedding"]
  usage 形态:resp.usage["input_tokens"]

环境变量:
  DASHSCOPE_API_KEY       (必填) 阿里云百炼平台 API Key
  EMBEDDING_MODEL         (默认 tongyi-embedding-vision-flash-2026-03-06)
  EMBEDDING_DIMENSION     (默认 768) flash 支持 768/512/256/128/64

用法:
  client = EmbeddingClient.from_env()
  r = client.embed_text("舞队 locking 训练")
  r = client.embed_image_url("https://...s3-signed-url...")
  r = client.embed_image_bytes(jpeg_bytes, "image/jpeg")
  # r.vector / r.input_tokens / r.dim
"""
import base64
import logging
import os
import random
import time
from dataclasses import dataclass
from http import HTTPStatus
from typing import Optional

import dashscope

logger = logging.getLogger(__name__)


DEFAULT_MODEL = "tongyi-embedding-vision-flash-2026-03-06"
DEFAULT_DIM = 768
DEFAULT_MAX_RETRIES = 4

# 视为可重试的瞬时错误。其它非 200 状态(认证、参数错)立刻抛。
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


@dataclass
class EmbeddingResult:
    vector: list[float]
    input_tokens: int
    model: str
    raw: dict

    @property
    def dim(self) -> int:
        return len(self.vector)


class EmbeddingError(Exception):
    """所有 embedding 调用相关错误的基类。"""


class EmbeddingConfigError(EmbeddingError):
    """配置错误(缺 API key 等)。"""


class EmbeddingAPIError(EmbeddingError):
    """API 业务错误(非 transient 4xx),不重试。"""

    def __init__(self, message: str, status_code: int = 0, code: str = "", body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.body = body


class EmbeddingClient:
    def __init__(
        self,
        api_key: str,
        *,
        model: str = DEFAULT_MODEL,
        dimension: int = DEFAULT_DIM,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ):
        if not api_key:
            raise EmbeddingConfigError("api_key is required (set DASHSCOPE_API_KEY)")
        self.api_key = api_key
        self.model = model
        self.dimension = dimension
        self.max_retries = max_retries

    @classmethod
    def from_env(cls) -> "EmbeddingClient":
        api_key = os.environ.get("DASHSCOPE_API_KEY")
        if not api_key:
            raise EmbeddingConfigError(
                "DASHSCOPE_API_KEY not set — add it to backend/.env"
            )
        return cls(
            api_key=api_key,
            model=os.environ.get("EMBEDDING_MODEL", DEFAULT_MODEL),
            dimension=int(os.environ.get("EMBEDDING_DIMENSION", DEFAULT_DIM)),
        )

    # ---------- 公开接口 ----------

    def embed_text(self, text: str) -> EmbeddingResult:
        if not text or not text.strip():
            raise ValueError("text must be non-empty")
        return self._call([{"text": text}])

    def embed_image_url(self, url: str) -> EmbeddingResult:
        if not url:
            raise ValueError("url must be non-empty")
        return self._call([{"image": url}])

    def embed_image_bytes(
        self, data: bytes, mime: str = "image/jpeg"
    ) -> EmbeddingResult:
        if not data:
            raise ValueError("data must be non-empty bytes")
        b64 = base64.b64encode(data).decode("ascii")
        return self._call([{"image": f"data:{mime};base64,{b64}"}])

    # ---------- 内部 ----------

    def _call(self, input_data: list[dict]) -> EmbeddingResult:
        resp = self._call_with_retry(input_data)
        return self._parse(resp)

    def _call_with_retry(self, input_data: list[dict]):
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                resp = dashscope.MultiModalEmbedding.call(
                    api_key=self.api_key,
                    model=self.model,
                    input=input_data,
                    dimension=self.dimension,
                )
            except Exception as e:
                # SDK 内部网络/超时通常抛 Exception,统一按可重试处理
                last_exc = e
                if attempt == self.max_retries:
                    break
                sleep_s = min(2 ** attempt + random.random(), 30)
                logger.warning(
                    "embedding SDK exception %s, retry %d/%d in %.1fs",
                    type(e).__name__,
                    attempt + 1,
                    self.max_retries,
                    sleep_s,
                )
                time.sleep(sleep_s)
                continue

            status = getattr(resp, "status_code", None)
            if status == HTTPStatus.OK:
                return resp
            if status in _RETRYABLE_STATUS and attempt < self.max_retries:
                sleep_s = min(2 ** attempt + random.random(), 30)
                logger.warning(
                    "embedding API HTTP %s (code=%s), retry %d/%d in %.1fs",
                    status,
                    getattr(resp, "code", ""),
                    attempt + 1,
                    self.max_retries,
                    sleep_s,
                )
                time.sleep(sleep_s)
                continue
            raise EmbeddingAPIError(
                f"embedding API failed: status={status} code={getattr(resp, 'code', '')} "
                f"message={getattr(resp, 'message', '')}",
                status_code=int(status or 0),
                code=str(getattr(resp, "code", "") or ""),
                body=str(getattr(resp, "message", "") or ""),
            )
        raise EmbeddingError(
            f"embedding exhausted {self.max_retries} retries: {last_exc}"
        )

    def _parse(self, resp) -> EmbeddingResult:
        output = getattr(resp, "output", None) or {}
        usage = getattr(resp, "usage", None) or {}
        # output 预期形态(基于阿里云多模态 embedding 文档惯例):
        #   {"embeddings": [{"index": 0, "embedding": [...], "type": "text"|"image"}, ...]}
        # 如果实测发现 output 是 dict-like 但 key 不同,在这里调整。
        if isinstance(output, dict):
            embeddings = output.get("embeddings") or output.get("embedding") or []
        else:
            embeddings = []
        if not embeddings:
            raise EmbeddingError(
                f"empty embeddings in response: output={output} usage={usage}"
            )
        first = embeddings[0]
        if isinstance(first, dict):
            vector = first.get("embedding") or first.get("vector") or []
        else:
            vector = first
        if not vector:
            raise EmbeddingError(
                f"could not extract vector from response: {output}"
            )
        input_tokens = int((usage or {}).get("input_tokens", 0))
        if self.dimension and len(vector) != self.dimension:
            logger.warning(
                "embedding dim mismatch: got %d, expected %d",
                len(vector),
                self.dimension,
            )
        return EmbeddingResult(
            vector=list(vector),
            input_tokens=input_tokens,
            model=self.model,
            raw={"output": output, "usage": usage},
        )
