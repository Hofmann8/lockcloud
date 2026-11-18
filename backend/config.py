"""配置：全部来自环境变量（backend/.env），变量名沿用 Flask 版，线上 .env 不用改。"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.split("#", 1)[0].strip().lower() in ("1", "true", "yes", "on")


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


@dataclass
class Settings:
    # 旧版用 FLASK_ENV 区分环境，没配时是 development（报错里带 details），和旧版一致
    env: str = field(default_factory=lambda: os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development")

    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY") or "dev-secret-key")
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL") or "sqlite:///lockcloud.db")

    # 和 LockAuth 同一把钥匙：LockAuth 签的令牌这边也认
    jwt_secret_key: str = field(default_factory=lambda: os.getenv("JWT_SECRET_KEY") or "jwt-secret-key")
    jwt_expires_seconds: int = field(default_factory=lambda: int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "604800")))

    # 对象存储：阿里云 OSS（杭州），说明见 services/storage.py
    oss_access_key_id: str | None = field(default_factory=lambda: os.getenv("OSS_ACCESS_KEY_ID"))
    oss_access_key_secret: str | None = field(default_factory=lambda: os.getenv("OSS_ACCESS_KEY_SECRET"))
    oss_region: str = field(default_factory=lambda: os.getenv("OSS_REGION", "cn-hangzhou"))
    oss_bucket: str = field(default_factory=lambda: os.getenv("OSS_BUCKET", "lock-cloud"))
    # 给浏览器 / App 的签名地址用外网 endpoint；服务器自己读写走内网（Lock001 在杭州）
    oss_endpoint: str = field(default_factory=lambda: os.getenv("OSS_ENDPOINT", "https://oss-cn-hangzhou.aliyuncs.com"))
    oss_internal_endpoint: str | None = field(default_factory=lambda: os.getenv("OSS_INTERNAL_ENDPOINT") or None)

    # 媒体 FC 处理完回调 /api/files/internal/media-result 时带的密钥
    media_callback_token: str | None = field(default_factory=lambda: os.getenv("MEDIA_CALLBACK_TOKEN"))

    cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS", "http://localhost:3000"))

    # Funk & Love 统一登录（LockAuth）
    sso_auth_api_url: str = field(default_factory=lambda: os.getenv("SSO_AUTH_API_URL", "https://auth.funk-and.love"))
    sso_auth_frontend_url: str = field(default_factory=lambda: os.getenv(
        "SSO_AUTH_FRONTEND_URL", "https://auth.funk-and.love"))
    # 头像归 LockAuth：用这个密钥调它的 /api/auth/service/avatars（见 lockauth/REQUESTS.md）；不配就不显示头像
    lockauth_service_key: str = field(default_factory=lambda: os.getenv("LOCKAUTH_SERVICE_KEY", ""))

    # 限流：每个接口每个 IP 每分钟 100 次，测试里关掉
    ratelimit_enabled: bool = field(default_factory=lambda: _bool("RATELIMIT_ENABLED", True))

    @property
    def debug(self) -> bool:
        return self.env != "production"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


settings = Settings()
