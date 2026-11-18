"""LockCloud 节拍结构试验 FC：All-In-One（先分离鼓、贝斯、人声再判断拍、小节头、段落）。

试验用的独立函数，不挂 OSS 触发器，不影响 lockcloud-media。只在调用时算：
  POST /analyze  {"key": "files/{uuid}.mp4"}，要带 X-Media-Token（= MEDIA_CALLBACK_TOKEN）
  → 从桶里（内网）读原文件的音轨，跑 All-In-One，结果写 media/{uuid}/allin1.json 并原样返回：
    {"bpm", "beats": [秒], "downbeats": [秒], "beat_positions": [1..4], "segments": [{"start", "end", "label"}],
     "elapsed": {"audio", "analyze"}}

用的是 openmirlab/all-in-one-infer（原版 mir-aidj/all-in-one 的重新打包：纯 PyTorch，不要 NATTEN），
模型 harmonix-all，权重在 build 时下好放进镜像（运行时不连外网）。

环境变量：ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET（和 lockcloud-media 同一个 RAM 用户：files/ 只读、media/ 可写）、
MEDIA_CALLBACK_TOKEN、OSS_BUCKET（默认 lock-cloud）、OSS_ENDPOINT（默认杭州内网）。
"""
import hmac
import json
import os
import re
import shutil
import subprocess
import tempfile
import time

import oss2
from flask import Flask, jsonify, request
from oss2.credentials import StaticCredentialsProvider

PORT = int(os.environ.get('FC_SERVER_PORT', os.environ.get('PORT', '9000')))
BUCKET = os.environ.get('OSS_BUCKET', 'lock-cloud')
REGION = os.environ.get('OSS_REGION', 'cn-hangzhou')
ENDPOINT = os.environ.get('OSS_ENDPOINT', 'https://oss-cn-hangzhou-internal.aliyuncs.com')
TOKEN = os.environ.get('MEDIA_CALLBACK_TOKEN', '')
FILE_KEY = re.compile(r'^files/([0-9a-f]{32})(\.[a-z0-9]{1,8})?$')

app = Flask(__name__)
_session = None


def _bucket() -> oss2.Bucket:
    h = request.headers
    key_id = h.get('x-fc-access-key-id') or os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_ID')
    secret = h.get('x-fc-access-key-secret') or os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
    token = h.get('x-fc-security-token') or os.environ.get('ALIBABA_CLOUD_SECURITY_TOKEN')
    if not key_id or not secret:
        raise RuntimeError('没有 OSS 凭据')
    auth = oss2.ProviderAuthV4(StaticCredentialsProvider(key_id, secret, token))
    return oss2.Bucket(auth, ENDPOINT, BUCKET, region=REGION, connect_timeout=30)


def _model():
    """模型只加载一次，同一个实例后面的调用复用。"""
    global _session
    if _session is None:
        from allin1_infer import AllInOneSession
        _session = AllInOneSession(model='harmonix-all', device='cpu').load()
    return _session


def _plain(x):
    if hasattr(x, 'tolist'):
        return x.tolist()
    return x


def analyze(key: str) -> dict:
    uid = FILE_KEY.match(key).group(1)
    bucket = _bucket()
    work = tempfile.mkdtemp(prefix='allin1-')
    try:
        t0 = time.monotonic()
        url = bucket.sign_url('GET', key, 3600, slash_safe=True)
        wav = os.path.join(work, f'{uid}.wav')
        proc = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', url, '-vn', '-ac', '2', '-ar', '44100', wav],
                              capture_output=True, timeout=900)
        if proc.returncode != 0:
            raise RuntimeError('音轨解不开: ' + proc.stderr.decode(errors='replace')[-300:])
        t1 = time.monotonic()
        r = _model().infer(wav, demix_dir=os.path.join(work, 'demix'), spec_dir=os.path.join(work, 'spec'))
        t2 = time.monotonic()
        out = {
            'key': key,
            'bpm': _plain(r.bpm),
            'beats': _plain(r.beats),
            'downbeats': _plain(r.downbeats),
            'beat_positions': _plain(r.beat_positions),
            'segments': [{'start': _plain(s.start), 'end': _plain(s.end), 'label': s.label} for s in r.segments],
            'elapsed': {'audio': round(t1 - t0, 1), 'analyze': round(t2 - t1, 1)},
        }
        bucket.put_object(f'media/{uid}/allin1.json', json.dumps(out).encode(),
                          headers={'Content-Type': 'application/json'})
        print(f'[allin1] {key} 音轨 {t1 - t0:.1f}s 分析 {t2 - t1:.1f}s', flush=True)
        return out
    finally:
        shutil.rmtree(work, ignore_errors=True)


@app.get('/healthz')
def healthz():
    return jsonify({'ok': True})


@app.post('/analyze')
def analyze_route():
    if not TOKEN or not hmac.compare_digest(request.headers.get('X-Media-Token', ''), TOKEN):
        return jsonify({'error': 'invalid token'}), 401
    body = request.get_json(silent=True) or {}
    key = body.get('key')
    if not isinstance(key, str) or not FILE_KEY.match(key):
        return jsonify({'error': 'key 必须是 files/{uuid}.ext'}), 400
    return jsonify(analyze(key))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, threaded=False)
