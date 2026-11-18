"""试验：让能看视频、听音频的大模型（默认 qwen3.8-omni-flash）把一个视频按"一支舞"分段，
和音频算法自动分的段落（services/beat_grid.py 的 default_parts）放在一起对照。

只读：不写数据库、不写 OSS。会调百炼的付费接口（每个视频一次），用量逐个记日志。

    conda activate lockcloud
    cd backend
    python scripts/segment_trial.py --dry-run              # 只列视频和音频摘要、估算用量，不调模型
    python scripts/segment_trial.py --ids 282 --limit 1    # 先跑一个看看
    python scripts/segment_trial.py                        # 默认那几个视频

结果在 --out（默认 instance/segment_trial/）：每个视频一份 {file_id}.json（已有就跳过，断了重跑接着来），
run.log 是完整日志，report.html 是对照页（点时间跳到本地前端的播放器）。

视频直接给模型 OSS 原文件的签名地址（模型自己下载，最大 2 GB，最长 2 小时）。
接口地址默认 https://dashscope.aliyuncs.com/compatible-mode/v1，百炼控制台给了专属地址就在 .env 里设 DASHSCOPE_BASE_URL。
"""
from __future__ import annotations

import argparse
import html
import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import load_only  # noqa: E402

import database  # noqa: E402
from files.models import File  # noqa: E402
from services import beat_grid, media  # noqa: E402
from services.storage import is_file_key, storage  # noqa: E402

# 时长三分钟以上、可能一个视频里有好几支舞的：排练合集、审核、快闪练习、商演、表演赛、battle
DEFAULT_IDS = [282, 3898, 2399, 86, 17, 39, 330, 11]
DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
URL_SECONDS = 3 * 3600

log = logging.getLogger('segment_trial')

from services.lockai import PROMPT, call_model, fmt, music_spans, parse_json  # noqa: E402  提示词和调用跟正式的一致


def audio_summary(data: dict | None) -> tuple[str, dict]:
    """给模型的音频说明，和对照页要画的音乐区间、算法段落。"""
    from services.lockai import audio_hint
    if not data or not data.get('times'):
        return audio_hint(data), {'music': [], 'boundaries': [], 'parts': []}
    times, sections = data['times'], [list(x) for x in data['sections']]
    return audio_hint(data), {'music': music_spans(times), 'boundaries': [times[x] for x, _ in sections[1:]],
                              'parts': [times[i] for i in beat_grid.default_parts(times, sections)]}


def snap_parts(segments: list, data: dict | None) -> list:
    """模型给的每支舞的开头吸附到最近的拍点（2 秒内），得到建议的段落起点（秒）。"""
    if not data or not data.get('times'):
        return []
    times = data['times']
    out = []
    for s in segments or []:
        if s.get('type') != 'dance':
            continue
        t = float(s.get('start') or 0)
        i = min(range(len(times)), key=lambda k: abs(times[k] - t))
        if abs(times[i] - t) <= 2.0 and (not out or times[i] - out[-1] > 4):
            out.append(times[i])
    return out


# ---------------------------------------------------------------- 对照页


COLORS = {'dance': '#3b6cf6', 'talk': '#b8bcc6', 'other': '#dfe1e6'}


def report(results: list, out_dir: str, app_url: str) -> str:
    rows = []
    for r in results:
        dur = r['duration'] or 1
        fid = r['file_id']

        def bar(items, color_of, label_of, height=22):
            cells = []
            for it in items:
                a, b = float(it['start']), float(it.get('end', it['start']))
                left, width = 100 * a / dur, max(0.4, 100 * (b - a) / dur)
                cells.append(
                    f'<a class="seg" href="{app_url}/f/{fid}?t={a:.1f}" title="{html.escape(label_of(it))}" '
                    f'style="left:{left:.2f}%;width:{width:.2f}%;background:{color_of(it)};height:{height}px">'
                    f'<span>{html.escape(label_of(it))}</span></a>')
            return '<div class="track">' + ''.join(cells) + '</div>'

        def ticks(ts, color):
            return '<div class="track thin">' + ''.join(
                f'<a class="tick" href="{app_url}/f/{fid}?t={t:.1f}" title="{fmt(t)}" style="left:{100 * t / dur:.2f}%;background:{color}"></a>'
                for t in ts) + '</div>'

        segs = (r.get('result') or {}).get('segments') or []
        usage = r.get('usage') or {}
        rows.append(f'''
<section>
  <h2><a href="{app_url}/f/{fid}">{html.escape(r["name"])}</a> <small>{html.escape(r["activity"])}　{fmt(dur)}</small></h2>
  <div class="row"><label>音乐</label>{bar(r["audio"]["music"], lambda m: "#cfd8ff", lambda m: f'{fmt(m["start"])}–{fmt(m["end"])}' + (f'  {m["bpm"]} BPM' if m.get("bpm") else ''), 10)}</div>
  <div class="row"><label>算法段落</label>{ticks(r["audio"]["parts"], "#111")}</div>
  <div class="row"><label>模型分段</label>{bar(segs, lambda s: COLORS.get(s.get("type"), "#dfe1e6"), lambda s: f'{fmt(s.get("start", 0))} {s.get("piece") or ""} {s.get("label") or ""}'.strip())}</div>
  <div class="row"><label>建议段落</label>{ticks(r.get("snapped") or [], "#3b6cf6")}</div>
  <p class="notes">{html.escape((r.get("result") or {}).get("notes") or r.get("error") or "")}</p>
  <p class="meta">首字 {r.get("first_token_s") or 0:.1f}s　耗时 {r.get("elapsed_s") or 0:.0f}s　用量 {html.escape(json.dumps(usage, ensure_ascii=False))}</p>
</section>''')
    page = f'''<!doctype html><meta charset="utf-8"><title>分段试验</title>
<style>
body{{font:14px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:1100px;margin:32px auto;padding:0 24px;color:#1d1d1f}}
h1{{font-size:22px}} h2{{font-size:15px;margin:0 0 8px}} h2 small{{color:#86868b;font-weight:400}}
section{{border-top:1px solid #e5e5ea;padding:18px 0}}
.row{{display:flex;align-items:center;gap:12px;margin:5px 0}} .row label{{width:64px;flex:none;color:#86868b;font-size:12px}}
.track{{position:relative;flex:1;height:22px;background:#f5f5f7;border-radius:4px}} .track.thin{{height:12px}}
.seg{{position:absolute;top:0;border-radius:3px;overflow:hidden;color:#fff;font-size:11px;text-decoration:none;box-shadow:inset -1px 0 #fff}}
.seg span{{padding:0 4px;white-space:nowrap;line-height:22px;mix-blend-mode:difference}}
.tick{{position:absolute;top:0;bottom:0;width:3px;margin-left:-1px;border-radius:1px}}
.notes{{margin:8px 0 0 76px;color:#424245}} .meta{{margin:2px 0 0 76px;color:#86868b;font-size:12px}}
</style>
<h1>分段试验</h1>
<p class="meta" style="margin:0">蓝色是舞蹈段（同一支舞字母相同），灰色是聊天或其他。点任意一段跳到本地播放器（前端要开着）。</p>
{"".join(rows)}'''
    path = os.path.join(out_dir, 'report.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(page)
    return path


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--ids', nargs='+', type=int, default=DEFAULT_IDS)
    p.add_argument('--limit', type=int, help='最多调几次模型（已有结果的不算）')
    p.add_argument('--workers', type=int, default=8, help='同时调几个（默认 8）')
    p.add_argument('--model', default='qwen3.8-omni-flash')
    p.add_argument('--no-audio-hint', action='store_true', help='不把音频分析结果告诉模型（对照用）')
    p.add_argument('--dry-run', action='store_true', help='不调模型，只列视频和音频摘要')
    p.add_argument('--out', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                                 'instance', 'segment_trial'))
    p.add_argument('--app-url', default='http://localhost:3001', help='对照页里跳转用的前端地址')
    args = p.parse_args()

    os.makedirs(args.out, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s', datefmt='%H:%M:%S',
                        handlers=[logging.StreamHandler(sys.stdout),
                                  logging.FileHandler(os.path.join(args.out, 'run.log'), encoding='utf-8')])
    for noisy in ('httpx', 'openai', 'botocore', 'urllib3'):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    client = None
    if not args.dry_run:
        from openai import OpenAI
        key = os.environ.get('DASHSCOPE_API_KEY')
        if not key:
            sys.exit('没有 DASHSCOPE_API_KEY（backend/.env）')
        client = OpenAI(api_key=key, base_url=os.environ.get('DASHSCOPE_BASE_URL') or DEFAULT_BASE_URL, timeout=900)

    database.import_models()
    results, todo = {}, []
    with database.session() as db:
        cols = (File.id, File.filename, File.original_filename, File.s3_key, File.size, File.content_type,
                File.activity_date, File.activity_name, File.media_info)
        files = {f.id: f for f in db.query(File).options(load_only(*cols)).filter(File.id.in_(args.ids)).all()}
        for n, fid in enumerate(args.ids, 1):
            f = files.get(fid)
            if not f or not media.is_video(f) or not is_file_key(f.s3_key):
                log.info(f'[{n}/{len(args.ids)}] #{fid} 不是可用的视频，跳过')
                continue
            info = media.media_info(f)
            name = media.display_name(f)
            data = media.load_beats(f)
            hint, audio = audio_summary(data)
            dur = float(info.get('duration') or 0)
            base = {'file_id': fid, 'name': name, 'activity': f'{f.activity_date} {f.activity_name or ""}'.strip(),
                    'duration': dur, 'size_mb': round((f.size or 0) / 1e6), 'audio': audio}
            cache = os.path.join(args.out, f'{fid}.json')
            log.info(f'[{n}/{len(args.ids)}] #{fid} {name}  {fmt(dur)}  {base["size_mb"]} MB  算法段落 {len(audio["parts"])} 个')

            if os.path.exists(cache):
                with open(cache, encoding='utf-8') as fh:
                    results[fid] = json.load(fh)
                log.info('  已有结果，跳过')
                continue
            if args.dry_run:
                log.info('  ' + hint.replace('\n', '\n  '))
                results[fid] = base
                continue
            if args.limit is not None and len(todo) >= args.limit:
                log.info('  到 --limit 了，不调')
                continue
            prompt = PROMPT.format(duration=fmt(dur), audio='' if args.no_audio_hint else hint)
            todo.append((fid, base, data, prompt, storage.sign_get(f.s3_key, URL_SECONDS), cache))

    def run(job):
        fid, base, data, prompt, url, cache = job
        tag = f'#{fid}'
        try:
            out = call_model(url, prompt, tag, client=client, model=args.model)
        except Exception as e:  # 接口报错：记下来，不写缓存（重跑会再试）
            log.error(f'{tag} 失败：{type(e).__name__}: {e}')
            return {**base, 'error': f'{type(e).__name__}: {e}'}
        parsed = parse_json(out['text'])
        if parsed is None:
            log.warning(f'{tag} 没解析出 JSON，原文已存')
        rec = {**base, **out, 'model': args.model, 'audio_hint': not args.no_audio_hint,
               'result': parsed, 'snapped': snap_parts((parsed or {}).get('segments'), data)}
        with open(cache, 'w', encoding='utf-8') as fh:
            json.dump(rec, fh, ensure_ascii=False, indent=1)
        lines = [f'{tag} {base["name"]} 分段：'] + [
            f'    {fmt(x.get("start", 0))}–{fmt(x.get("end", 0))}  {x.get("type")}  {x.get("piece") or ""}  {x.get("label") or ""}'
            for x in (parsed or {}).get('segments') or []]
        log.info('\n'.join(lines))
        return rec

    if todo:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        from tqdm import tqdm
        log.info(f'调模型：{len(todo)} 个视频，同时 {min(args.workers, len(todo))} 个')
        with ThreadPoolExecutor(max_workers=max(1, min(args.workers, len(todo)))) as pool:
            futures = {pool.submit(run, job): job[0] for job in todo}
            for fut in tqdm(as_completed(futures), total=len(futures), desc='分段', unit='个', file=sys.stderr):
                results[futures[fut]] = fut.result()
    called = len(todo)
    results = [results[i] for i in args.ids if i in results]

    path = report(results, args.out, args.app_url.rstrip('/'))
    total = {}
    for r in results:
        for k, v in (r.get('usage') or {}).items():
            if isinstance(v, (int, float)):
                total[k] = total.get(k, 0) + v
    log.info(f'本次调用 {called} 次；结果里合计用量 {json.dumps(total, ensure_ascii=False)}')
    log.info(f'对照页：{path}')


if __name__ == '__main__':
    main()
