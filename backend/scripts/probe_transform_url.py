"""
诊断:对单个 file_id,生成阶梯里每一档的签名 URL,HEAD / GET 看缤纷云怎么响应。

为什么需要:当 embed_worker 阶梯里某一档失败,要判断到底是
  (a) 签名被破坏 → 缤纷云返回 403 SignatureDoesNotMatch
  (b) style 没建/拼错 → 404 / 缤纷云错误页
  (c) 缤纷云压完了但仍然 > 5MB → 阿里云那侧会拒
  (d) 别的(content-type 不对、文件不存在等)

会做:
  - 取 file 的 s3_key + size
  - 调用 worker 的 build_url_ladder 拿到整条 URL 阶梯(小图就 1 条原图;大图 7 条)
  - 对每条 HEAD,打印 status / content-length / content-type
  - --get 模式下对每条 GET 完整字节,拿实际压缩后大小 + JPEG magic 校验

Usage:
  python scripts/probe_transform_url.py 49
  python scripts/probe_transform_url.py 49 --get
"""
import argparse
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from files.models import File  # noqa: E402
from services.s3_service import S3Service  # noqa: E402
from scripts.embed_worker import (  # noqa: E402
    build_url_ladder,
    IMAGE_SIZE_LIMIT,
    STYLE_LADDER,
)


def head(url):
    try:
        r = requests.head(url, allow_redirects=True, timeout=15)
        return r.status_code, dict(r.headers)
    except Exception as e:
        return -1, {"error": repr(e)}


def get_full(url):
    """完整 GET,返回 (status, content-type, total_bytes, first16_hex)。"""
    try:
        r = requests.get(url, stream=True, timeout=60)
        first = None
        total = 0
        for chunk in r.iter_content(65536):
            if first is None:
                first = chunk[:16]
            total += len(chunk)
        return r.status_code, r.headers.get("Content-Type"), total, (first.hex() if first else "")
    except Exception as e:
        return -1, None, 0, f"err:{e!r}"


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("file_id", type=int)
    p.add_argument("--get", action="store_true",
                   help="对每档 GET 完整字节,校验真实压缩后大小")
    args = p.parse_args()

    app = create_app()
    with app.app_context():
        f = File.query.get(args.file_id)
        if not f:
            print(f"file_id={args.file_id} 不存在")
            return 2

        size_mb = (f.size or 0) / (1024 * 1024)
        print(f"file_id={f.id} s3_key={f.s3_key}")
        print(f"size={f.size} ({size_mb:.2f} MB)  content_type={f.content_type}")
        print(f"status={f.embedding_status}")
        is_large = bool(f.size and f.size > IMAGE_SIZE_LIMIT)
        print(f"is_large(>5MB)={is_large}")
        print()

        s3 = S3Service()
        urls = build_url_ladder(s3, f)
        print(f"ladder size: {len(urls)} url(s)")
        if len(urls) == 1:
            labels = ["raw"]
        else:
            labels = STYLE_LADDER[:len(urls)]
        print()

        for idx, (label, url) in enumerate(zip(labels, urls)):
            print(f"[{idx}] style={label}")
            print(f"    url: {url}")
            st, h = head(url)
            print(f"    HEAD  status={st}  "
                  f"ct={h.get('Content-Type')}  cl={h.get('Content-Length')}")
            if st >= 400:
                print(f"    HEAD headers: {h}")
                try:
                    rg = requests.get(url, timeout=15)
                    print(f"    err body[:300]: {rg.text[:300]}")
                except Exception as e:
                    print(f"    err body fetch failed: {e}")

            if args.get:
                gst, gct, gtotal, gfirst = get_full(url)
                gmb = gtotal / (1024 * 1024) if gtotal else 0
                ok_jpeg = gfirst.startswith("ffd8ff")
                fit_5mb = gtotal <= IMAGE_SIZE_LIMIT
                print(f"    GET   status={gst}  ct={gct}  "
                      f"bytes={gtotal} ({gmb:.2f} MB)  "
                      f"jpeg={ok_jpeg}  fits_5mb={fit_5mb}  first16={gfirst}")
            print()

        return 0


if __name__ == "__main__":
    sys.exit(main())
