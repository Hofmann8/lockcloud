"""
配置两个 OSS 桶。改权限的操作，手动跑；默认只打印要做什么，加 --apply 才写。

lock-cloud（私有）
  - CORS：网页直传（PUT）、hls.js 拉分片（GET）
  - 生命周期：backups/ 30 天删，tmp/ 和 media/_downloads/（打包下载的 zip）1 天删，没传完的分片 7 天清

lock-publicfiles（公共资源）
  - 关掉“阻止公共访问”，桶策略只放开 avatars/ 的匿名读；其他目录仍然私有
  - CORS：LockAuth 网页直传头像（PUT）

Usage:
    python scripts/setup_oss_buckets.py [--apply]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import oss2  # noqa: E402
from oss2.models import (  # noqa: E402
    AbortMultipartUpload, BucketCors, BucketLifecycle, CorsRule, LifecycleExpiration, LifecycleRule,
)

# 本机 3000 被别的服务占着，前端开发用 3001
CLOUD_ORIGINS = ['https://cloud.funk-and.love', 'http://localhost:3000', 'http://localhost:3001']
AUTH_ORIGINS = ['https://auth.funk-and.love', 'http://localhost:3000', 'http://localhost:3001']


def bucket(name):
    key_id, secret = os.environ.get('OSS_ACCESS_KEY_ID'), os.environ.get('OSS_ACCESS_KEY_SECRET')
    if not key_id or not secret:
        sys.exit('.env 里缺 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET（lock-service 的密钥）')
    auth = oss2.AuthV4(key_id, secret)
    # 配置接口走外网 endpoint，本机也能跑
    endpoint = os.environ.get('OSS_ENDPOINT', 'https://oss-cn-hangzhou.aliyuncs.com')
    return oss2.Bucket(auth, endpoint, name, region=os.environ.get('OSS_REGION', 'cn-hangzhou'))


def cloud_config(name):
    cors = BucketCors([CorsRule(
        allowed_origins=CLOUD_ORIGINS,
        allowed_methods=['GET', 'HEAD', 'PUT'],
        allowed_headers=['*'],
        expose_headers=['ETag', 'Content-Length', 'Content-Range'],
        max_age_seconds=86400,
    )])
    lifecycle = BucketLifecycle([
        LifecycleRule('backups-30d', 'backups/', status=LifecycleRule.ENABLED,
                      expiration=LifecycleExpiration(days=30)),
        LifecycleRule('tmp-1d', 'tmp/', status=LifecycleRule.ENABLED,
                      expiration=LifecycleExpiration(days=1)),
        LifecycleRule('downloads-1d', 'media/_downloads/', status=LifecycleRule.ENABLED,
                      expiration=LifecycleExpiration(days=1)),
        LifecycleRule('abort-multipart-7d', '', status=LifecycleRule.ENABLED,
                      abort_multipart_upload=AbortMultipartUpload(days=7)),
    ])
    return cors, lifecycle


def public_config(name):
    account = os.environ.get('ALIYUN_ACCOUNT_ID', '*')
    policy = {
        'Version': '1',
        'Statement': [{
            'Effect': 'Allow',
            'Principal': ['*'],
            'Action': ['oss:GetObject'],
            'Resource': [f'acs:oss:*:{account}:{name}/avatars/*'],
        }],
    }
    cors = BucketCors([CorsRule(
        allowed_origins=AUTH_ORIGINS,
        allowed_methods=['GET', 'HEAD', 'PUT'],
        allowed_headers=['*'],
        expose_headers=['ETag'],
        max_age_seconds=86400,
    )])
    return policy, cors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    cloud_name = os.environ.get('OSS_BUCKET', 'lock-cloud')
    public_name = os.environ.get('OSS_PUBLIC_BUCKET', 'lock-publicfiles')

    cors, lifecycle = cloud_config(cloud_name)
    print(f'[{cloud_name}]')
    print(f'  CORS: {CLOUD_ORIGINS} GET/HEAD/PUT')
    for rule in lifecycle.rules:
        print(f'  生命周期: {rule.id} prefix={rule.prefix!r}')

    policy, public_cors = public_config(public_name)
    print(f'[{public_name}]')
    print('  关闭阻止公共访问')
    print(f'  桶策略: {json.dumps(policy, ensure_ascii=False)}')
    print(f'  CORS: {AUTH_ORIGINS} GET/HEAD/PUT')

    if not args.apply:
        print('dry-run：加 --apply 写入')
        return 0

    b = bucket(cloud_name)
    b.put_bucket_cors(cors)
    b.put_bucket_lifecycle(lifecycle)
    print(f'{cloud_name} 完成')

    p = bucket(public_name)
    # 阻止公共访问开着的时候，放开匿名读的桶策略写不进去
    p.put_bucket_public_access_block(False)
    p.put_bucket_policy(json.dumps(policy))
    p.put_bucket_cors(public_cors)
    print(f'{public_name} 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
