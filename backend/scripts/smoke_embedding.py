"""快速验证 embedding API 是否通。

Usage:
  python scripts/smoke_embedding.py                 # 只测文本
  python scripts/smoke_embedding.py <image_url>     # 文本 + 公网图片 URL
  python scripts/smoke_embedding.py -f <file_path>  # 文本 + 本地图片(base64)

打印向量维度、前 8 个分量、input_tokens(用于成本测算)。
"""
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.embedding_service import EmbeddingClient  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")


def main():
    client = EmbeddingClient.from_env()
    print(f"model={client.model}\ndim={client.dimension}\n")

    # ---- text ----
    text = "舞队 locking 训练 — 八拍卡点 popping"
    print(f"[text] {text!r}")
    r = client.embed_text(text)
    print(
        f"  -> dim={r.dim}, input_tokens={r.input_tokens}, "
        f"first8={[round(v, 4) for v in r.vector[:8]]}"
    )
    print(f"  raw usage: {r.raw.get('usage')}\n")

    # ---- image ----
    args = sys.argv[1:]
    if not args:
        print("(传图片地址即可同时测图: python scripts/smoke_embedding.py https://...)")
        return

    if args[0] == "-f" and len(args) >= 2:
        path = args[1]
        with open(path, "rb") as f:
            data = f.read()
        mime = (
            "image/jpeg"
            if path.lower().endswith((".jpg", ".jpeg"))
            else "image/png"
            if path.lower().endswith(".png")
            else "image/webp"
            if path.lower().endswith(".webp")
            else "image/jpeg"
        )
        print(f"[image bytes] {path} ({len(data)} bytes, {mime})")
        r = client.embed_image_bytes(data, mime=mime)
    else:
        url = args[0]
        print(f"[image url] {url}")
        r = client.embed_image_url(url)

    print(
        f"  -> dim={r.dim}, input_tokens={r.input_tokens}, "
        f"first8={[round(v, 4) for v in r.vector[:8]]}"
    )


if __name__ == "__main__":
    main()
