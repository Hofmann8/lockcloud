"""LockAI 分析：成员挑选视频交给 LockAI，排队跑完一整套理解流程。

一个视频分析一次，所有人共享结果：
  1. 视频理解：能看画面、听声音的大模型把视频按"一支舞"分段（chapters），每段有类型、标题、是不是同一支舞；
     一支舞用了几首歌串烧的，songs 记第 2、3…首歌开始的时刻
  2. 完成后（files.lockai_status = 'ready'）放行抽帧 embedding（画面搜索）和抽帧人脸（人物），
     见 scripts/embed_worker.py、scripts/face_worker.py 的 fetch_pending_videos
分工：视频的"意思"（哪里是一支舞、换没换歌）全听模型的；节拍算法只出拍点和小节头，八拍按 chapters 分段落、
新歌从"1"数（services/beat_grid.py 的 chapter_grid）。播放器只对分析过的视频显示节拍器和分段。
  3. 和第 1 步同时调 All-In-One 函数（backend/fc/allin1）拿它的拍点和小节头，存进 result.allin1_beats、
     result.downbeats，读八拍时和 beat_this 的互相校验（beat_grid.analyze）。没配地址、调失败都不影响分析，
     只是八拍只有 beat_this 一个模型的意见。

额度：每人每个自然月（北京时间）发起 MONTHLY_QUOTA 次，管理员不限；失败的不算。发起人和上传者可以不是同一个人。

队列：进程内一个调度线程，最多同时 CONCURRENCY 个；视频还没转好（media_status = pending）的先等着，
媒体 FC 回调时会再踢一下。认领用 UPDATE ... WHERE status = 'queued'，多个进程不会重复跑同一个。
重启时把 processing 的放回 queued。模型失败重试 MAX_ATTEMPTS 次，还不行记 failed（不占额度，可以重新发起）。

环境变量：DASHSCOPE_API_KEY（必填，没有就不开队列）、DASHSCOPE_BASE_URL（百炼专属地址，可选）、
LOCKAI_MODEL（默认 qwen3.8-omni-flash）、LOCKAI_MONTHLY_QUOTA（默认 3）、LOCKAI_CONCURRENCY（默认 3）、
LOCKAI_ALLIN1_URL（All-In-One 函数的 HTTP 触发器地址，可选；调用带 MEDIA_CALLBACK_TOKEN）。
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timedelta, timezone
from statistics import median

import requests
import sqlalchemy as sa

import database
from config import settings
from errors import ApiError
from files.models import File, LockAIJob
from services import beat_grid, media
from services.storage import is_file_key, storage

log = logging.getLogger(__name__)

MODEL = os.getenv('LOCKAI_MODEL', 'qwen3.8-omni-flash')
MONTHLY_QUOTA = int(os.getenv('LOCKAI_MONTHLY_QUOTA', '3'))
CONCURRENCY = max(1, int(os.getenv('LOCKAI_CONCURRENCY', '3')))
MAX_ATTEMPTS = 2
DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
URL_SECONDS = 3 * 3600
POLL_SECONDS = 30
BEIJING = timezone(timedelta(hours=8))
KINDS = ('dance', 'talk', 'other')
ALLIN1_URL = os.getenv('LOCKAI_ALLIN1_URL', '').strip().rstrip('/')
ALLIN1_TIMEOUT = 1500   # 冷启动拉镜像 + 分离音轨 + 分析，长视频十几分钟

# ---------------------------------------------------------------- 提示词和解析

SYSTEM = '你是街舞视频的剪辑助理，只依据画面和声音里真实出现的内容作答，不确定就说不确定，不编造。'

PROMPT = """这是一个 Locking 街舞舞队的视频，时长 {duration}。请把它按"一支舞"分段。

分段规则：
- 一段 = 一支舞从开始到结束（或同一支舞完整跑一遍）。同一支舞练了好几遍，每一遍单独成段。
- 两支舞之间的聊天、讲解、等待、走位准备、换场，单独成段，类型标 talk 或 other。
- 舞蹈中途的剪辑接口、镜头切换、换机位，只要还是同一支舞，就不切开。
- 一支舞用了几首歌串烧（换了一首歌，但还是同一套编排在继续），不切开成几段，而是在这一段的 songs 里写出第 2、3……首歌开始的时刻。
  听旋律、速度、配器判断是不是换了歌；同一首歌里的间奏、变奏、Break 不算。只有一首歌就是 []。
- 时间精确到 0.5 秒。所有段首尾相接，覆盖整个视频。

{audio}

只输出一个 JSON，不要其他文字：
{{"segments": [{{"start": 秒, "end": 秒, "type": "dance" | "talk" | "other", "piece": "同一支舞用同一个字母，A、B、C……，非舞蹈段为 null", "label": "十个字以内的描述", "songs": [这支舞里第 2、3……首歌开始的秒数，非舞蹈段为 []], "confidence": 0 到 1}}],
 "notes": "一句话说明判断依据或拿不准的地方"}}"""


def fmt(t: float) -> str:
    t = max(0.0, float(t))
    return f'{int(t // 60)}:{t % 60:04.1f}'


def music_spans(times: list) -> list:
    """有音乐节拍的区间：拍点之间隔得远（≥ 2 秒且 ≥ 4 拍）就断开。"""
    spans, start = [], 0
    for i in range(1, len(times) + 1):
        if i < len(times):
            prev = times[max(start, i - 9):i]
            period = median(b - a for a, b in zip(prev, prev[1:])) if len(prev) >= 3 else 0.5
            gap = times[i] - times[i - 1] >= max(beat_grid.GAP_SECONDS, beat_grid.GAP_BEATS * period)
        else:
            gap = True
        if gap:
            seg = times[start:i]
            bpm = 60 * (len(seg) - 1) / (seg[-1] - seg[0]) if len(seg) > 1 and seg[-1] > seg[0] else None
            spans.append({'start': seg[0], 'end': seg[-1], 'bpm': round(bpm) if bpm else None})
            start = i
    return spans


def audio_hint(data: dict | None) -> str:
    """节拍检测的结果写成给模型的一段话：哪里有音乐、哪里小节位置突变。"""
    if not data or not data.get('times'):
        return '音频分析：没有检测到音乐节拍。'
    lines = ['音频分析（节拍检测算法的结果，时间精确，可作为参考；画面才是判断是否在跳舞的依据）：',
             '- 有音乐节拍的区间：' + '；'.join(
                 f'{fmt(m["start"])}–{fmt(m["end"])}' + (f'（约 {m["bpm"]} BPM）' if m['bpm'] else '')
                 for m in music_spans(data['times']))]
    boundaries = []
    for b in section_tempos(data['times'], data['sections']):
        tempo = f'（约 {b["before"]:.0f} → {b["after"]:.0f} BPM）' if b['before'] and b['after'] else ''
        boundaries.append(fmt(b['t']) + tempo)
    if boundaries:
        lines.append('- 小节位置突变的时刻（可能是换歌、剪辑接口或音乐重新开始；前后速度差得多通常是换了歌）：' + '、'.join(boundaries))
    return '\n'.join(lines)


TEMPO_WINDOW = 16       # 分界前后各取这么多拍估速度（只写进给模型的音频说明）


def section_tempos(times: list, sections: list) -> list:
    """每个相位段分界前后的速度（BPM）；拍不够估不出来的是 None。"""
    out = []
    for s, _ in sections[1:]:
        if not 0 < s < len(times):
            continue
        before, after = times[max(0, s - TEMPO_WINDOW):s], times[s:s + TEMPO_WINDOW]
        bpm = lambda seg: 60 / median(b - a for a, b in zip(seg, seg[1:])) if len(seg) >= 8 else None  # noqa: E731
        out.append({'t': times[s], 'before': bpm(before), 'after': bpm(after)})
    return out


def parse_json(text: str) -> dict | None:
    m = re.search(r'\{.*\}', text or '', re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except ValueError:
        return None


def chapters_of(parsed: dict | None, duration: float) -> list:
    """模型输出整理成 chapters：时间夹在视频内、按开始排好、丢掉不成形的。"""
    out = []
    for s in (parsed or {}).get('segments') or []:
        if not isinstance(s, dict):
            continue
        try:
            start, end = float(s.get('start')), float(s.get('end'))
        except (TypeError, ValueError):
            continue
        if duration:
            start, end = min(max(0.0, start), duration), min(max(0.0, end), duration)
        if end <= start:
            continue
        kind = s.get('type') if s.get('type') in KINDS else 'other'
        piece = s.get('piece') if kind == 'dance' and isinstance(s.get('piece'), str) else None
        title = s.get('label') if isinstance(s.get('label'), str) else ''
        songs = []
        for t in s.get('songs') or [] if kind == 'dance' and isinstance(s.get('songs'), list) else []:
            try:
                t = float(t)
            except (TypeError, ValueError):
                continue
            if start < t < end:
                songs.append(round(t, 2))
        out.append({'start': round(start, 2), 'end': round(end, 2), 'kind': kind,
                    'title': title.strip()[:40], 'piece': piece[:4] if piece else None, 'songs': sorted(set(songs))})
    return sorted(out, key=lambda c: c['start'])


# ---------------------------------------------------------------- 调模型


def _client():
    from openai import OpenAI
    key = os.environ.get('DASHSCOPE_API_KEY')
    if not key:
        raise RuntimeError('DASHSCOPE_API_KEY 没配')
    return OpenAI(api_key=key, base_url=os.environ.get('DASHSCOPE_BASE_URL') or DEFAULT_BASE_URL, timeout=900)


def call_model(url: str, prompt: str, tag: str = '', client=None, model: str = MODEL) -> dict:
    """流式调用，记首字时间、心跳字数、用量、结束原因。"""
    client = client or _client()
    t0 = time.monotonic()
    first = None
    text, reasoning = [], []
    usage, finish = None, None
    last_beat = t0
    stream = client.chat.completions.create(
        model=model,
        messages=[{'role': 'system', 'content': SYSTEM},
                  {'role': 'user', 'content': [{'type': 'video_url', 'video_url': {'url': url}},
                                               {'type': 'text', 'text': prompt}]}],
        modalities=['text'],
        stream=True,
        stream_options={'include_usage': True},
    )
    for chunk in stream:
        if chunk.usage:
            usage = chunk.usage.model_dump() if hasattr(chunk.usage, 'model_dump') else dict(chunk.usage)
        for c in chunk.choices or []:
            delta = c.delta
            piece = getattr(delta, 'content', None) or ''
            think = getattr(delta, 'reasoning_content', None) or ''
            if (piece or think) and first is None:
                first = time.monotonic() - t0
                log.info(f'{tag} 首字 {first:.1f}s')
            text.append(piece)
            reasoning.append(think)
            if c.finish_reason:
                finish = c.finish_reason
        if time.monotonic() - last_beat > 15:
            last_beat = time.monotonic()
            log.info(f'{tag} …思考 {sum(map(len, reasoning))} 字，输出 {sum(map(len, text))} 字')
    elapsed = time.monotonic() - t0
    log.info(f'{tag} 完成 {elapsed:.1f}s，结束原因 {finish}，用量 {json.dumps(usage, ensure_ascii=False)}')
    return {'text': ''.join(text), 'reasoning': ''.join(reasoning), 'usage': usage, 'finish_reason': finish,
            'first_token_s': first, 'elapsed_s': elapsed}


# ---------------------------------------------------------------- 额度和发起


def month_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """这个自然月（北京时间）的起止，返回 UTC 的 naive 时间（库里存的是 UTC）。"""
    local = (now or datetime.utcnow()).replace(tzinfo=timezone.utc).astimezone(BEIJING)
    start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start + timedelta(days=32)).replace(day=1)
    to_utc = lambda d: d.astimezone(timezone.utc).replace(tzinfo=None)  # noqa: E731
    return to_utc(start), to_utc(end)


def quota(db, user) -> dict:
    start, end = month_bounds()
    used = db.query(sa.func.count(LockAIJob.id)).filter(
        LockAIJob.requested_by == user.id, LockAIJob.requested_at >= start, LockAIJob.status != 'failed').scalar() or 0
    if user.is_admin:
        return {'limit': None, 'used': used, 'remaining': None, 'resets_at': end.isoformat()}
    return {'limit': MONTHLY_QUOTA, 'used': used, 'remaining': max(0, MONTHLY_QUOTA - used), 'resets_at': end.isoformat()}


def info(db, file) -> dict | None:
    """播放器、信息栏用：状态、谁发起的、完成后的分段。"""
    job = db.query(LockAIJob).filter_by(file_id=file.id).first()
    if not job:
        return None
    from auth.models import User
    user = db.get(User, job.requested_by)
    return {
        'status': job.status,
        'requested_by': {'id': user.id, 'name': user.name} if user else None,
        'requested_at': job.requested_at.isoformat() if job.requested_at else None,
        'finished_at': job.finished_at.isoformat() if job.finished_at else None,
        'chapters': (job.result or {}).get('chapters') or [] if job.status == 'ready' else [],
    }


def result_for(db, file) -> dict:
    """分析完的结果（chapters、downbeats、allin1_beats）；没分析完是空 dict。"""
    job = db.query(LockAIJob).filter_by(file_id=file.id, status='ready').first()
    return (job.result or {}) if job else {}


def allin1_of(file, result: dict) -> dict | None:
    """分析时 All-In-One 的结果 {beats, downbeats}，给 beat_grid.grid 用；没有是 None。
    老的分析只存了小节头，拍点去桶里那份 allin1.json 找（函数分析时自己写的），找不到就只用小节头。"""
    down = result.get('downbeats')
    if not down:
        return None
    beats = result.get('allin1_beats')
    if beats is None:
        beats = (media.load_allin1(file) or {}).get('beats')
    return {'downbeats': down, 'beats': beats or []}


def call_allin1(key: str, tag: str = '') -> dict | None:
    """调 All-In-One 函数拿拍点和小节头（秒）：{beats, downbeats}。没配地址或失败返回 None：不影响分析，
    只是八拍少一个模型的意见。"""
    if not ALLIN1_URL:
        return None
    t0 = time.monotonic()
    try:
        r = requests.post(f'{ALLIN1_URL}/analyze', json={'key': key},
                          headers={'X-Media-Token': settings.media_callback_token or ''}, timeout=ALLIN1_TIMEOUT)
        r.raise_for_status()
        body = r.json()
        down = [round(float(x), 3) for x in body.get('downbeats') or []]
        beats = [round(float(x), 3) for x in body.get('beats') or []]
    except Exception as e:  # noqa: BLE001
        log.warning(f'{tag} All-In-One 失败，八拍不校正：{type(e).__name__}: {e}')
        return None
    log.info(f'{tag} All-In-One {len(beats)} 拍、{len(down)} 个小节头，{time.monotonic() - t0:.0f}s')
    return {'downbeats': down, 'beats': beats}


def request(db, file, user, force: bool = False) -> LockAIJob:
    """发起分析。不 commit。"""
    if not media.is_video(file):
        raise ApiError('LOCKAI_001', '只能分析视频')
    if file.media_status == 'failed':
        raise ApiError('LOCKAI_002', '此视频无法分析')
    job = db.query(LockAIJob).filter_by(file_id=file.id).first()
    if job and job.status in ('queued', 'processing'):
        raise ApiError('LOCKAI_003', '此视频正在分析', 409)
    if job and job.status == 'ready' and not (force and user.is_admin):
        raise ApiError('LOCKAI_004', '此视频已分析', 409)
    if not user.is_admin and quota(db, user)['remaining'] <= 0:
        raise ApiError('LOCKAI_005', '本月的 LockAI 分析次数已用完', 403)
    if job is None:
        job = LockAIJob(file_id=file.id)
        db.add(job)
    job.requested_by = user.id
    job.requested_at = datetime.utcnow()
    job.status = 'queued'
    job.attempts = 0
    job.started_at = job.finished_at = job.error = None
    file.lockai_status = 'queued'
    return job


# ---------------------------------------------------------------- 处理一个


def _set(db, job, file, status: str, **fields) -> None:
    job.status = status
    for k, v in fields.items():
        setattr(job, k, v)
    if file is not None:
        file.lockai_status = status


def process_job(job_id: int, client=None) -> str:
    """认领并跑完一个排队的分析，返回最后的状态；没认领到（别人在跑、不在排队）返回 'skipped'。"""
    with database.session() as db:
        claimed = db.execute(sa.update(LockAIJob).where(LockAIJob.id == job_id, LockAIJob.status == 'queued').values(
            status='processing', started_at=datetime.utcnow(), attempts=LockAIJob.attempts + 1))
        if claimed.rowcount != 1:
            db.rollback()
            return 'skipped'
        job = db.get(LockAIJob, job_id)
        file = db.get(File, job.file_id)
        if file is None:   # 进了回收站：放回去等，恢复了再跑
            job.status, job.attempts = 'queued', job.attempts - 1
            db.commit()
            return 'queued'
        file.lockai_status = 'processing'
        db.commit()
        attempts = job.attempts
        tag = f'[lockai #{file.id}]'
        duration = float(media.media_info(file).get('duration') or 0)
        try:
            prompt = PROMPT.format(duration=fmt(duration), audio=audio_hint(media.load_beats(file)))
            url = storage.sign_get(file.s3_key, URL_SECONDS)
            key = file.s3_key if is_file_key(file.s3_key) else None   # 老路径的文件 All-In-One 函数不认
        except Exception as e:  # noqa: BLE001 桶读不到之类：走下面同样的重试 / 失败
            prompt = url = key = None
            prep_error = f'{type(e).__name__}: {e}'
        else:
            prep_error = None

    # 调模型要几分钟，不占着数据库连接；All-In-One 同时跑
    pool = ThreadPoolExecutor(max_workers=1)
    bars = pool.submit(call_allin1, key, tag) if key and not prep_error else None
    allin1 = None
    try:
        if prep_error:
            raise RuntimeError(prep_error)
        out = call_model(url, prompt, tag, client=client)
        parsed = parse_json(out['text'])
        chapters = chapters_of(parsed, duration)
        if not chapters:
            raise ValueError(f'没解析出分段（结束原因 {out.get("finish_reason")}）：{out["text"][:200]}')
        allin1 = bars.result() if bars else None
        error = None
    except Exception as e:  # noqa: BLE001 记下来，按次数决定重试还是失败
        log.exception(f'{tag} 分析失败（第 {attempts} 次）')
        error = f'{type(e).__name__}: {e}'
    finally:
        pool.shutdown(wait=False)

    with database.session() as db:
        job = db.get(LockAIJob, job_id)
        file = db.get(File, job.file_id)
        if error is None:
            _set(db, job, file, 'ready', finished_at=datetime.utcnow(), error=None, model=MODEL,
                 result={'chapters': chapters, 'notes': (parsed or {}).get('notes'),
                         **({'downbeats': allin1['downbeats'], 'allin1_beats': allin1.get('beats') or []}
                            if allin1 and allin1.get('downbeats') else {})}, usage=out.get('usage'))
        elif attempts < MAX_ATTEMPTS:
            _set(db, job, file, 'queued', error=error)
        else:
            _set(db, job, file, 'failed', finished_at=datetime.utcnow(), error=error)
        db.commit()
        status = job.status
    if status == 'ready':
        # 放行抽帧 embedding 和人脸（两个 worker 只挑分析过的视频）
        from services import embed_trigger, face_trigger
        embed_trigger.kick_videos()
        face_trigger.kick_videos()
    return status


def _claimable(db, limit: int) -> tuple[list[int], bool]:
    """能开跑的排队任务（视频已经处理好），以及还有没有在等视频处理的。顺手把视频处理失败的记 failed。"""
    rows = (db.query(LockAIJob.id, File.media_status)
            .join(File, File.id == LockAIJob.file_id)
            .filter(LockAIJob.status == 'queued', File.deleted_at.is_(None))
            .order_by(LockAIJob.requested_at.asc()).all())
    ready, waiting = [], False
    for job_id, media_status in rows:
        if media_status == 'failed':
            job = db.get(LockAIJob, job_id)
            _set(db, job, db.get(File, job.file_id), 'failed', finished_at=datetime.utcnow(), error='视频处理失败')
        elif media_status == 'ready':
            ready.append(job_id)
        else:
            waiting = True
    db.commit()
    return ready[:limit], waiting


# ---------------------------------------------------------------- 调度线程

_lock = threading.Lock()
_running = False
_dirty = False
_enabled = False


def init_lockai() -> None:
    """app.py 的 lifespan 里调一次：没配 key 就不开；上次没跑完的放回队列，开跑。"""
    global _enabled
    if not os.environ.get('DASHSCOPE_API_KEY'):
        log.warning('LockAI 队列未启用（DASHSCOPE_API_KEY 未设）')
        return
    _enabled = True
    with database.session() as db:
        stuck = db.query(LockAIJob).filter(LockAIJob.status == 'processing').all()
        for job in stuck:
            job.status, job.attempts = 'queued', max(0, job.attempts - 1)
            file = db.get(File, job.file_id)
            if file is not None:
                file.lockai_status = 'queued'
        db.commit()
    log.info('LockAI 队列已启用（%s，最多同时 %d 个；放回队列 %d 个）', MODEL, CONCURRENCY, len(stuck))
    kick()


def kick() -> None:
    """有新的排队、或者视频处理好了：调度线程没在跑就起一个，在跑就让它再看一轮。"""
    global _running, _dirty
    if not _enabled:
        return
    with _lock:
        if _running:
            _dirty = True
            return
        _running = True
    threading.Thread(target=_loop, daemon=True, name='lockai').start()


def _loop() -> None:
    global _running, _dirty
    futures = set()
    try:
        with ThreadPoolExecutor(max_workers=CONCURRENCY, thread_name_prefix='lockai-job') as pool:
            while True:
                with _lock:
                    _dirty = False
                with database.session() as db:
                    ready, waiting = _claimable(db, CONCURRENCY - len(futures))
                for job_id in ready:
                    futures.add(pool.submit(process_job, job_id))
                if not futures and not ready and not waiting:
                    with _lock:
                        if not _dirty:
                            _running = False
                            return
                    continue
                done, futures = wait(futures, timeout=POLL_SECONDS, return_when=FIRST_COMPLETED) if futures \
                    else (set(), futures)
                if not done and not futures:
                    time.sleep(POLL_SECONDS)   # 只剩等视频处理的
    except Exception:
        log.exception('LockAI 调度线程崩溃')
        with _lock:
            _running = False
            _dirty = False
