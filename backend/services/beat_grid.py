"""八拍网格：分段、每段的"1"、段落。

beats.json（媒体 FC 算的）里有 times（每拍时刻）和 sections（[这段第一拍的下标, 这段里一个"1"的下标]）。
sections 是"拍子的相位段"：换歌、音乐停顿、剪辑接口处小节位置变了就另起一段，段内每 8 拍一个"1"。

在它上面再加一层 parts（段落）：一个视频里常有好几支舞，八拍按段落各自从 1 数。parts 是段落第一拍的下标，
第一个永远是 0，每个都必须是某个 section 的起点。

分工：哪里是一支舞、串烧里哪里换了歌，是 LockAI 看视频听出来的（chapters）；拍点、小节头是节拍算法的。
  - LockAI 分析过的视频：按每支舞（chapters 里 kind = dance 的）的开头、串烧里每首歌的开头分段落（chapter_grid）
  - 没分析过的：在音乐停了一阵（≥ 4 拍且 ≥ 2 秒没拍）的地方分（default_parts）

grid() 的顺序：拍点归位到等距格子（regularize）→ 和 All-In-One 的拍点互相校验（reconcile）→ 切成连续音乐块、
每块定一个小节位置（analyze）→ 按 LockAI 的分段分段落（chapter_grid）→ 套上人改的"1"（apply_ones）。
"""
from __future__ import annotations

from bisect import bisect_left
from collections import Counter
from statistics import median

GAP_BEATS = 4      # 这么多拍没有拍点，算两支舞之间
GAP_SECONDS = 2.0


def default_parts(times: list, sections: list) -> list:
    parts = [0]
    for start, _ in sections[1:]:
        if not 0 < start < len(times) or start in parts:
            continue
        prev = times[max(0, start - 9):start]
        period = median(b - a for a, b in zip(prev, prev[1:])) if len(prev) >= 2 else 0.5
        if times[start] - times[start - 1] >= max(GAP_SECONDS, GAP_BEATS * period):
            parts.append(start)
    return parts


SNAP_SECONDS = 2.0  # 舞、歌的开头离拍点（或算法测到的小节位置突变）不超过这么多就对上去


def _section_of(sections: list, i: int) -> int:
    k = 0
    while k + 1 < len(sections) and sections[k + 1][0] <= i:
        k += 1
    return k


def split_at(sections: list, i: int) -> list:
    """在第 i 拍切开相位段（数拍不变）；已经是段首就原样返回。"""
    k = _section_of(sections, i)
    if sections[k][0] == i:
        return sections
    return sections[:k + 1] + [[i, sections[k][1]]] + sections[k + 1:]


def _nearest(times: list, t: float) -> int:
    return min(range(len(times)), key=lambda k: abs(times[k] - t))


def _song_one(times: list, sections: list, t: float) -> int | None:
    """串烧里换歌的时刻 t（LockAI 听出来的，精确到半秒）对应的"1"。

    接歌都接在乐句开头，新歌的第一个小节头就是"1"。算法分得清哪拍是小节头，但分不清"1"和"5"（都是小节头），
    这里用 LockAI 给的时刻定：
      - 附近有算法测到的小节位置突变（接口处一般都有），取突变后的第一个小节头
      - 没有就取离 t 最近的小节头"""
    near = [s for s, _ in sections[1:] if 0 < s < len(times) and abs(times[s] - t) <= SNAP_SECONDS]
    if near:
        s = min(near, key=lambda s: abs(times[s] - t))
        one = sections[_section_of(sections, s)][1]
        return s + (one - s) % 4
    i = _nearest(times, t)
    if abs(times[i] - t) > SNAP_SECONDS:
        return None
    one = sections[_section_of(sections, i)][1]
    head = i - (i - one) % 4
    return min((h for h in (head, head + 4) if 0 <= h < len(times)), key=lambda h: abs(times[h] - t))


def chapter_grid(times: list, sections: list, chapters: list) -> dict:
    """按 LockAI 理解出的每支舞分段落，第一支舞前面的部分（开场、准备）单独成一段。

    舞的开头：吸附到最近的拍（SNAP_SECONDS 内），没有就取这支舞里的第一拍；"1"用算法的（舞可能从前奏的"5 6 7 8"起跳）。
    串烧里第 2、3…首歌：从新歌的"1"（_song_one）另起一段，八拍从 1 数。"""
    sections = [list(s) for s in sections]
    parts = [0]
    if not times:
        return {'sections': sections, 'parts': parts}
    for c in sorted(chapters or [], key=lambda c: c.get('start', 0)):
        if c.get('kind') != 'dance':
            continue
        start, end = float(c['start']), float(c['end'])
        i = _nearest(times, start)
        if abs(times[i] - start) > SNAP_SECONDS:
            inside = [k for k in range(len(times)) if start <= times[k] < end]
            i = inside[0] if inside else None
        if i is not None and i > parts[-1]:
            sections = split_at(sections, i)
            parts.append(i)
        for t in sorted(float(t) for t in c.get('songs') or []):
            h = _song_one(times, sections, t)
            if h is None or h <= parts[-1]:
                continue
            # 小节头不变，只把"5"换成"1"：从这里起按新歌数
            sections = split_at(sections, h)
            k = _section_of(sections, h)
            sections[k][1] = h
            if k > 0 and h - 4 < sections[k - 1][0] < h:
                # 接口处到"1"之间不到一小节的几拍（算法从这里起就换了相位）：数成新歌前面的 …7 8
                sections[k - 1][1] = h
            parts.append(h)
    return {'sections': sections, 'parts': parts}


# ---------------------------------------------------------------- 拍点归位到等距格子

# 放克里正拍、反拍都很响，beat_this 偶尔会在一首歌中间跳到反拍上跟一阵（两拍间突然只隔半拍），再跳回来，
# 或者在换歌前后拍长忽长忽短地追。表现是：前后的"1"都对，中间那个八拍 2 3 4 5 6 7 长短不一。
# 一首歌的速度是稳的，对的拍点都落在同一套等距格子上，所以：
#   1. 按"突然隔半拍 / 拍长变了"把拍点切成小段；够长（ANCHOR_BEATS）、拍长稳的是锚
#   2. 速度相同的相邻锚归成一首歌，按格子相位分两拨，拍子多的那拨是正拍，少的那拨也当成要修的
#   3. 两个锚之间跑偏的拍子换成格子：同一首歌就在两锚之间等分；换了歌就前一首往后铺、后一首往前铺，
#      在 beat_this 对得上的地方交接（交接那一下可能本来就是剪辑点，不管）
# 锚里的拍点原样保留（beat_this 的拍点本身准），只换掉中间跑偏的。"1"在被换掉的地方跟着前面的数下去。
ANCHOR_BEATS = 16      # 至少这么多拍连着稳才算锚
JUMP = 0.2             # 两拍间隔和附近的拍长差这么多（比例）就算跳了
SAME_TEMPO = 0.025     # 两个锚拍长差不到这么多算同一首歌的速度
ON_GRID = 0.2          # 离格子不到这么多拍算在格子上
SEAM_GRID = 0.08       # 找换歌点时更严：后一首的拍点（beat_this 在稳的地方误差几十毫秒）离格子不到这么多拍才算接上


def _period(times: list, a: int, b: int) -> float:
    """[a, b) 这段拍子的拍长（线性拟合的斜率）。"""
    n = b - a
    xs = range(n)
    mx, my = (n - 1) / 2, sum(times[a:b]) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (times[a + x] - my) for x in xs) / sxx if sxx else 0.0


def _runs(times: list) -> list:
    """按跳拍、拍长变化切成小段 [(a, b)]。"""
    n = len(times)
    ioi = [times[i + 1] - times[i] for i in range(n - 1)]

    def around(i: int, k: int = 8) -> float:
        return median(ioi[max(0, i - k):i + k + 1])

    cuts = [0]
    for i in range(1, n):
        p = around(i - 1)
        before = median(ioi[max(cuts[-1], i - 9):i - 1]) if i - 1 > cuts[-1] else p
        after = median(ioi[i:i + 8]) if i < n - 1 else p
        jumped = abs(ioi[i - 1] / p - 1) > JUMP
        drifted = i - cuts[-1] >= 8 and i + 8 < n and abs(after / before - 1) > 2 * SAME_TEMPO
        if jumped or drifted:
            cuts.append(i)
    cuts.append(n)
    return [(a, b) for a, b in zip(cuts, cuts[1:]) if b > a]


def _phase(times: list, ref_t: float, period: float, a: int, b: int) -> float:
    """[a, b) 的拍子相对"ref_t 起每 period 一拍"的格子偏多少拍，-0.5..0.5。"""
    offs = [((times[i] - ref_t) / period + 0.5) % 1 - 0.5 for i in range(a, b)]
    return median(offs)


def regularize(times: list, sections: list) -> tuple[list, list]:
    """把跑到反拍上、拍长乱掉的拍点换成等距格子。返回新的 times 和对应的 sections。"""
    n = len(times)
    if n < 2 * ANCHOR_BEATS:
        return list(times), [list(s) for s in sections]
    runs = _runs(times)
    anchors = [(a, b, _period(times, a, b)) for a, b in runs if b - a >= ANCHOR_BEATS]
    if not anchors:
        return list(times), [list(s) for s in sections]

    # 速度相同的相邻锚归成一首歌；歌里按相位分两拨，少的那拨不当锚
    good = []
    group = [anchors[0]]

    def settle(group: list) -> None:
        ref = max(group, key=lambda g: g[1] - g[0])
        p = ref[2]
        side = {g: abs(_phase(times, times[ref[0]], p, g[0], g[1])) < 0.25 for g in group}
        on = sum(g[1] - g[0] for g in group if side[g])
        off = sum(g[1] - g[0] for g in group if not side[g])
        keep = (lambda g: side[g]) if on >= off else (lambda g: not side[g])
        good.extend(g for g in group if keep(g))

    def paused(i: int, j: int, p: float) -> bool:
        """第 i 到第 j 拍之间音乐停过（和 default_parts 同一个标准）。"""
        return any(times[k + 1] - times[k] >= max(GAP_SECONDS, GAP_BEATS * p) for k in range(i, j))

    for g in anchors[1:]:
        # 拍长一样、中间没停过才算同一首歌；停过再放，相位重新算
        if abs(g[2] / group[-1][2] - 1) <= SAME_TEMPO and not paused(group[-1][1] - 1, g[0], g[2]):
            group.append(g)
        else:
            settle(group)
            group = [g]
    settle(group)
    good.sort()

    new: list[float] = []
    where: list[int] = [0] * n    # 原来第 i 拍在新 times 里的下标（被换掉的拍子：时间上最近的格子）
    replaced = [False] * n

    def put(i: int) -> None:
        where[i] = len(new)
        new.append(times[i])

    def fill(slots: list, lo: int, hi: int) -> None:
        """原来 [lo, hi) 这些拍子换成 slots。"""
        base = len(new)
        new.extend(slots)
        for i in range(lo, hi):
            replaced[i] = True
            where[i] = base + min(range(len(slots)), key=lambda k: abs(slots[k] - times[i])) if slots else max(0, base - 1)

    # 第一个锚之前、最后一个锚之后的拍子不动（前奏、尾声，没有可靠的格子可以对）
    for i in range(0, good[0][0]):
        put(i)
    for k, (a, b, p) in enumerate(good):
        for i in range(a, b):
            put(i)
        if k + 1 == len(good):
            for i in range(b, n):
                put(i)
            break
        na, nb, np_ = good[k + 1]
        if b == na:
            continue
        if paused(b - 1, na, max(p, np_)):
            # 中间音乐停过（和 default_parts 同一个标准：≥ 4 拍且 ≥ 2 秒没拍）：不是同一段音乐，原样不动；
            # 两三拍的空是 beat_this 漏了，照样补
            for i in range(b, na):
                put(i)
            continue
        gap = times[na] - times[b - 1]
        if abs(np_ / p - 1) <= SAME_TEMPO and abs(_phase(times, times[b - 1], (p + np_) / 2, na, na + 1)) < 0.25:
            # 同一首歌：两锚之间等分
            m = max(1, round(gap / ((p + np_) / 2)))
            if all(abs((times[i] - times[b - 1]) / (gap / m) - round((times[i] - times[b - 1]) / (gap / m))) < ON_GRID
                   for i in range(b, na)) and na - b == m - 1:
                for i in range(b, na):    # 中间的拍子本来就在格子上，不动
                    put(i)
            else:
                fill([times[b - 1] + gap * j / m for j in range(1, m)], b, na)
            continue
        # 换了歌（前后两个锚拍长不同）：后一首的格子往前铺，铺到 beat_this 的拍点不再连着对得上为止，那里就是换歌；
        # 再往前（beat_this 在追拍、跑到反拍上的那几秒）都还在前一首里，换成前一首的格子。
        # 交接那一下本来就可能是剪辑点，长短不齐不管
        cut = na
        while cut - 1 >= b and abs((times[na] - times[cut - 1]) / np_ - round((times[na] - times[cut - 1]) / np_)) < SEAM_GRID:
            cut -= 1
        t_cut = times[cut]
        q = median(times[i + 1] - times[i] for i in range(max(a, b - 9), b - 1))   # 锚末尾的拍长，速度可能有一点点漂
        if all(abs((times[i] - times[b - 1]) / q - round((times[i] - times[b - 1]) / q)) < ON_GRID
               and round((times[i] - times[b - 1]) / q) == i - b + 1 for i in range(b, cut)):
            for i in range(b, cut):    # 本来就在格子上，不动
                put(i)
        else:
            fill([times[b - 1] + q * j for j in range(1, 10_000) if times[b - 1] + q * j < t_cut - 0.5 * q], b, cut)
        for i in range(cut, na):
            put(i)

    # 相位段搬到新下标；"1"落在被换掉的拍子上的，跟着前一段的数
    out: list[list[int]] = []
    for s, one in sections:
        ns = where[s] if s < n else len(new)
        if replaced[one] if 0 <= one < n else False:
            if not out:
                no = where[one]
            else:
                no = out[-1][1]
        else:
            no = where[one] if 0 <= one < n else one
        if out and out[-1][0] == ns:
            out[-1] = [ns, no]
        else:
            out.append([ns, no])
    return new, out


# ---------------------------------------------------------------- 两个模型的拍点互相校验

# LockAI 分析时还跑了 All-In-One（backend/fc/allin1，先分离鼓和贝斯再判断），它也出一套拍点。
# 两个模型都会在一段连续的音乐里自己滑半拍、或者换歌后好几秒没跟上新速度（15 个标注样本里各有一次），
# 之后一直错到这段音乐结束。连续的音乐里拍点的格子不会自己挪，所以：
#   1. 找出两套拍点对得上的段（连着 AGREE_BEATS 拍都对得上）：这些地方的格子两个模型都认
#   2. 对不上的一段夹在中间（或在开头、结尾）时，看每个模型在这一段里的拍点是不是顺着旁边认定的格子接下去的
#   3. All-In-One 的全接得上、beat_this 的接不上，这一段就换成 All-In-One 的拍点；其他情况照旧用 beat_this 的
# 其他情况（包括 All-In-One 滑了、两个都说不清）拍点照旧用 beat_this 的。
SAME_BEAT = 0.2       # 两个模型的拍点差不到这么多拍算同一拍
AGREE_BEATS = 8       # 连着这么多拍对得上才算两个模型都认；对不上的一段至少这么多拍才判谁对
EXPLAINED = 0.9       # 一段里这么多的拍点顺着旁边的格子接得上，算这个模型没乱
UNEXPLAINED = 0.6     # 不到这么多，算它乱了
REANCHOR = 16         # 顺着格子走这么多拍重新对一次：速度慢慢漂的跟得上，滑了半拍、换了速度的跟不上


def _nearest_in(sorted_times: list, t: float) -> int:
    i = bisect_left(sorted_times, t)
    return min((k for k in (i - 1, i) if 0 <= k < len(sorted_times)), key=lambda k: abs(sorted_times[k] - t))


def _fit_period(ts: list) -> float:
    """一串在同一套格子上的拍子（中间可以漏拍）的拍长。"""
    if len(ts) < 2:
        return 0.0
    p0 = median(b - a for a, b in zip(ts, ts[1:]))
    if len(ts) < 4 or p0 <= 0:
        return p0
    ks = [round((t - ts[0]) / p0) for t in ts]
    mk, mt = sum(ks) / len(ks), sum(ts) / len(ts)
    sxx = sum((k - mk) ** 2 for k in ks)
    return sum((k - mk) * (t - mt) for k, t in zip(ks, ts)) / sxx if sxx else p0


def _follow(beats: list, anchor: float, period: float) -> int:
    """beats（按离 anchor 由近到远排）里，从头起连着有多少拍落在"anchor 起每 period 一拍"的格子上。"""
    if period <= 0:
        return 0
    n, base, last = 0, anchor, 0
    for t in beats:
        k = abs(t - base) / period
        step = round(k) - last
        if step < 1 or step > 2 or abs(k - round(k)) > ON_GRID:   # 最多漏一拍；再多就不算接着的
            break
        n, last = n + 1, round(k)
        if last >= REANCHOR:
            period, base, last = abs(t - base) / last, t, 0
    return n


def reconcile(times: list, sections: list, other: list) -> tuple[list, list, list]:
    """用 All-In-One 的拍点（other）校验 beat_this 的拍点。返回 (times, sections, spliced)：
    spliced 是换成了 All-In-One 拍点的时间段 [(t0, t1)]，这些段里 beat_this 对小节位置的意见不算数。"""
    n = len(times)
    same = (list(times), [list(s) for s in sections], [])
    if n < 2 * AGREE_BEATS or len(other) < 2 * AGREE_BEATS:
        return same
    ioi = [times[i + 1] - times[i] for i in range(n - 1)]
    match: list[int | None] = []
    for i, t in enumerate(times):
        j = _nearest_in(other, t)
        p = median(ioi[max(0, i - 4):i + 4])
        match.append(j if abs(other[j] - t) <= SAME_BEAT * p else None)

    runs, a = [], None    # 连着对得上的段 [a, b)
    for i in range(n + 1):
        cont = i < n and match[i] is not None and a is not None and match[i] == match[i - 1] + 1
        if not cont:
            if a is not None and i - a >= AGREE_BEATS:
                runs.append((a, i))
            a = i if i < n and match[i] is not None else None
    if not runs:
        return same
    delta = median(times[i] - other[match[i]] for a, b in runs for i in range(a, b))   # All-In-One 的拍点整体早几十毫秒

    splices = []
    for prev, nxt in zip([None] + runs, runs + [None]):
        lo, hi = (prev[1] if prev else 0), (nxt[0] if nxt else n)
        jlo, jhi = (match[lo - 1] + 1 if prev else 0), (match[hi] if nxt else len(other))
        mine, theirs = times[lo:hi], other[jlo:jhi]
        if len(mine) < AGREE_BEATS or len(theirs) < AGREE_BEATS:
            continue     # beat_this 在这里没几拍（多半是音乐停了）：没有它错了的证据，不动
        pl = _fit_period(times[max(prev[0], prev[1] - REANCHOR):prev[1]]) if prev else 0.0
        pr = _fit_period(times[nxt[0]:min(nxt[1], nxt[0] + REANCHOR)]) if nxt else 0.0

        def explained(beats: list, left: float | None, right: float | None) -> float:
            f = _follow(beats, left, pl) if left is not None else 0
            b = _follow(beats[::-1], right, pr) if right is not None else 0
            return min(1.0, (f + b) / len(beats))

        e_mine = explained(mine, times[lo - 1] if prev else None, times[hi] if nxt else None)
        e_theirs = explained(theirs, other[jlo - 1] if prev else None, other[jhi] if nxt else None)
        if e_theirs >= EXPLAINED and e_mine < UNEXPLAINED:
            splices.append((lo, hi, [round(t + delta, 3) for t in theirs]))
    if not splices:
        return same

    new: list[float] = []
    out: list[list[int]] = []
    spliced = []
    pos = shift = 0
    edges = []    # (旧下标 lo, hi, 之前的位移, 之后的位移)
    for lo, hi, beats in splices:
        new += times[pos:lo]
        new += beats
        spliced.append((beats[0], beats[-1]))
        edges.append((lo, hi, shift, shift + len(beats) - (hi - lo)))
        pos, shift = hi, shift + len(beats) - (hi - lo)
    new += times[pos:]

    def shift_at(i: int) -> int:
        return next((after for lo, hi, before, after in reversed(edges) if hi <= i), 0)

    starts: dict[int, int] = {}
    for s, one in sections:
        if any(lo <= s < hi for lo, hi, _, _ in edges):
            continue
        starts[s + shift_at(s)] = one + shift_at(s)
    for lo, hi, before, after in edges:
        starts[lo + before] = sections[_section_of(sections, max(lo - 1, 0))][1] + before   # 换掉的这段接着前面数
        if hi < n:
            starts[hi + after] = sections[_section_of(sections, hi)][1] + after
    out = [[s, starts[s]] for s in sorted(starts)]
    return new, out, spliced


# ---------------------------------------------------------------- 连续音乐块、每块的小节位置

# beat_this 的小节头在有些曲子上会放错（差半个小节、差一拍），还会在一首歌中间自己改口；All-In-One 也一样会错。
# 人工标注（2026-11，15 个视频）说明了两件事：一段连续的音乐里小节位置不会变（每段只标一次就全对）；
# 两个模型一致时都对，意见不一时谁对没有规律。所以：
#   1. 把拍子切成"连续音乐块"：音乐停过、速度变了、剪辑接口（两个模型的小节位置在同一处都变了）处切开
#   2. 每块只定一个小节位置：两个模型各算一份意见（按占比算，All-In-One 漏几个小节头不吃亏），加起来高的赢，
#      打平听 All-In-One 的。两个模型不一致的块标成 split，留给人改（八拍修改申请）
#   3. "1"还是"5"：听 beat_this 在这一块里和选中的小节位置一致的那些拍
DOWNBEAT_TOLERANCE = 0.07   # 小节头离拍点不超过这么多秒才算对得上
TEMPO_CHANGE = 0.05     # 前后 TEMPO_SPAN 拍的拍长差这么多算换了速度
TEMPO_SPAN = 12         # 现场录的音乐拍点有几十毫秒的抖动，窗口短了会把抖动当成变速
AIO_MIN = 3             # All-In-One 在一块里至少对上这么多个小节头才算它有意见
EDIT_NEAR = 4           # 两个模型的小节位置在这么多拍之内先后变了，算剪辑接口
EDIT_IOI = 0.06         # 接口处拍长异常超过这么多，就把接口定在那一拍
SOLO_IOI = 0.09         # 只有一个模型变了小节位置时，要有这么大的拍长异常才算接口
MIN_BLOCK = 4           # 两个切点至少隔这么多拍
STEADY = 0.8            # 一个模型在一块里这么多的票都投给同一个位置，算它拿得稳
LOST_SHARE = 0.25       # 一块里 All-In-One 的拍点有这么多和定下来的拍点对不上，它在这一块判的小节头不算票


def _bt_phase(times: list, sections: list, spliced: list) -> tuple[list, list]:
    """beat_this 的意见：每拍所在相位段的"1"模 4（小节位置）、模 8。换成 All-In-One 拍点的地方它没有意见（None）。"""
    n = len(times)
    four: list[int | None] = [None] * n
    eight: list[int | None] = [None] * n
    for k, (s, one) in enumerate(sections):
        e = sections[k + 1][0] if k + 1 < len(sections) else n
        for i in range(max(0, s), min(n, e)):
            if not any(t0 - 1e-6 <= times[i] <= t1 + 1e-6 for t0, t1 in spliced):
                four[i], eight[i] = one % 4, one % 8
    return four, eight


def _aio_matches(times: list, downbeats: list) -> list[tuple[int, int]]:
    """All-In-One 的小节头里和拍点对得上的：[(拍的下标, 下标模 4)]。"""
    out: list[tuple[int, int]] = []
    if not times:
        return out
    for d in downbeats:
        i = _nearest_in(times, d)
        if abs(times[i] - d) <= DOWNBEAT_TOLERANCE and (not out or out[-1][0] != i):
            out.append((i, i % 4))
    return out


def _aio_there(times: list, other: list) -> list:
    """每一拍上 All-In-One 的拍点：True 对得上、False 它有拍但不在这（差着半拍之类）、None 它在这附近没出拍。"""
    out: list[bool | None] = [None] * len(times)
    if not other or len(times) < 2:
        return out
    ioi = [times[i + 1] - times[i] for i in range(len(times) - 1)]
    for i, t in enumerate(times):
        p = median(ioi[max(0, i - 4):i + 4])
        d = abs(other[_nearest_in(other, t)] - t)
        out[i] = True if d <= SAME_BEAT * p else False if d <= 0.75 * p else None
    return out


def _cuts(times: list, bt: list, matches: list[tuple[int, int]]) -> list[tuple[int, str]]:
    """连续音乐块的起点 [(拍的下标, 原因)]：pause 音乐停过、tempo 速度变了、edit 剪辑接口（两个模型都变了小节位置）、
    edit? 只有一个模型变了、但那里拍长也异常。"""
    n = len(times)
    ioi = [times[i + 1] - times[i] for i in range(n - 1)]
    if not ioi:
        return []

    def around(i: int) -> float:
        return median(ioi[max(0, i - 8):i + 8])

    found: dict[int, str] = {}

    def add(i: int, why: str) -> None:
        if 0 < i < n and i not in found:
            found[i] = why

    for i in range(1, n):
        if ioi[i - 1] >= max(GAP_SECONDS, GAP_BEATS * around(i - 1)):
            add(i, 'pause')
    # 速度变了：前后一段的拍长差得多的地方连成一片，变速点是把这一片分成"前面都像旧拍长、后面都像新拍长"分得最干净的那一拍
    def change_point(lo: int, hi: int) -> int:
        a, b = max(0, lo - TEMPO_SPAN), min(n - 1, hi + TEMPO_SPAN)
        before, after = median(ioi[a:lo]) if lo > a else ioi[a], median(ioi[hi:b]) if b > hi else ioi[b - 1]

        def cost(i: int) -> float:    # 第 i 拍是新速度的第一拍；它前面那一个间隔（两首歌之间）不算
            return sum(abs(ioi[k] - before) for k in range(a, i - 1)) + sum(abs(ioi[k] - after) for k in range(i, b))

        return min(range(max(1, lo - TEMPO_SPAN + 1), min(n - 1, hi + TEMPO_SPAN)), key=cost)

    cand = []
    for i in range(TEMPO_SPAN, n - TEMPO_SPAN):
        ratio = abs(median(ioi[i:i + TEMPO_SPAN]) / median(ioi[i - TEMPO_SPAN:i]) - 1)
        if ratio > TEMPO_CHANGE:
            cand.append((i, ratio))
    group: list[tuple[int, float]] = []
    for c in cand + [(n + 99, 0.0)]:
        if group and c[0] - group[-1][0] > TEMPO_SPAN:
            i = change_point(group[0][0], group[-1][0])
            # 停顿前后速度不同，窗口跨着停顿也会报变速：那是同一个切点，不重复切
            if not any(why == 'pause' and abs(i - k) <= TEMPO_SPAN for k, why in found.items()):
                add(i, 'tempo')
            group = []
        group.append(c)

    def odd(lo: int, hi: int) -> tuple[int, float]:
        """[lo, hi] 里哪一拍前面的间隔最反常，反常多少。"""
        span = range(max(1, lo), min(n - 1, hi) + 1)
        if not span:
            return lo, 0.0
        best = max(span, key=lambda k: abs(ioi[k - 1] / around(k - 1) - 1))
        return best, abs(ioi[best - 1] / around(best - 1) - 1)

    bt_changes = [i for i in range(1, n) if bt[i] is not None and bt[i - 1] is not None and bt[i] != bt[i - 1]]
    aio_changes = [(j1, j2) for (j1, r1), (j2, r2) in zip(matches, matches[1:]) if r1 != r2 and j2 - j1 <= 12]
    used = set()
    for i in bt_changes:
        near = [(j1, j2) for j1, j2 in aio_changes if j1 - EDIT_NEAR <= i <= j2 + EDIT_NEAR]
        if near:
            j1, j2 = near[0]
            used.add((j1, j2))
            k, dev = odd(min(i, j1 + 1), max(i, j2))
            add(k if dev >= EDIT_IOI else i, 'edit')
        else:
            k, dev = odd(i - 2, i + 2)
            if dev >= SOLO_IOI:
                add(k, 'edit?')
    for j1, j2 in aio_changes:
        if (j1, j2) not in used:
            k, dev = odd(j1 + 1, j2)
            if dev >= SOLO_IOI:
                add(k, 'edit?')

    # 挨得太近的只留一个：停顿 > 速度 > 接口
    rank = {'pause': 0, 'tempo': 1, 'edit': 2, 'edit?': 3}
    kept: list[tuple[int, str]] = []
    for i, why in sorted(found.items(), key=lambda x: (rank[x[1]], x[0])):
        if all(abs(i - k) >= MIN_BLOCK for k, _ in kept) and i >= MIN_BLOCK:
            kept.append((i, why))
    return sorted(kept)


def _top(votes: Counter):
    return max(votes, key=lambda r: (votes[r], -r)) if votes else None


def analyze(data: dict, allin1: dict | None = None) -> dict:
    """拍点和每段连续音乐的小节位置：{times, sections, blocks, spliced}。

    data 是 beats.json；allin1 是 All-In-One 的结果 {beats, downbeats}（没有就只用 beat_this）。
    sections 每块一段 [块的第一拍, 块里一个"1"]；blocks 每块一条，带两个模型各自的意见（标注评估、排查用）：
    {start, end, t0, t1, why, phase, flag: agree 一致 | split 意见不一 | single 只有一个模型, votes, candidates}。"""
    allin1 = allin1 or {}
    times, sections = regularize(data['times'], data['sections'])
    spliced: list = []
    if allin1.get('beats'):
        times, sections, spliced = reconcile(times, sections, allin1['beats'])
        if spliced:    # 换上去的拍点和前后接上以后，中间漏的一两拍才补得上
            times, sections = regularize(times, sections)
    n = len(times)
    matches = _aio_matches(times, allin1.get('downbeats') or [])
    bt, bt8 = _bt_phase(times, sections, spliced)
    starts = [(0, 'start')] + _cuts(times, bt, matches)
    there = _aio_there(times, allin1.get('beats') or [])

    blocks, out = [], []
    for k, (a, why) in enumerate(starts):
        b = starts[k + 1][0] if k + 1 < len(starts) else n
        bt_votes = Counter(r for r in bt[a:b] if r is not None)
        bt_total = sum(bt_votes.values())
        aio_votes = Counter(r for j, r in matches if a <= j < b)
        aio_total = sum(aio_votes.values())
        on, off = there[a:b].count(True), there[a:b].count(False)
        # 零星对上的一两个不算数（这一块它没出拍）；它的拍点在这一块里有一截对不上的也不算：
        # 拍点都没跟住的模型，在这段音乐里判的小节头不可信
        if aio_total < AIO_MIN or off >= LOST_SHARE * max(on + off, 1):
            aio_votes, aio_total = Counter(), 0
        score = {r: (bt_votes[r] / bt_total if bt_total else 0) + (aio_votes[r] / aio_total if aio_total else 0)
                 for r in range(4)}
        phase = max(range(4), key=lambda r: (round(score[r], 6), aio_votes[r], bt_votes[r]))
        bt_major, aio_major = _top(bt_votes), _top(aio_votes)
        bt_steady = bt_major is not None and bt_votes[bt_major] >= STEADY * bt_total
        aio_steady = aio_major is not None and aio_votes[aio_major] >= STEADY * aio_total
        if bt_major is None or aio_major is None:
            flag = 'single' if (bt_steady or aio_steady) else 'split'
        else:
            flag = 'agree' if bt_steady and aio_steady and bt_major == aio_major else 'split'
        # "1"还是"5"：听 beat_this 在这一块里和选中的小节位置一致的那些拍；一拍都不一致就把它的"1"挪过去
        agree = Counter(bt8[i] for i in range(a, b) if bt[i] == phase)
        if agree:
            eight = _top(agree)
        else:
            base = _top(Counter(v for v in bt8[a:b] if v is not None)) or 0
            shift = (phase - base) % 4
            eight = (base + (shift if shift <= 2 else shift - 4)) % 8
        if not bt_total and not aio_total and out:
            # 两个模型在这一块都没有意见（结尾零星的几拍）：接着前一块数
            phase, eight, flag = out[-1][1] % 4, out[-1][1] % 8, 'single'
        out.append([a, a + (eight - a) % 8])
        blocks.append({
            'start': a, 'end': b, 't0': times[a] if n else 0.0, 't1': times[b - 1] if n else 0.0, 'why': why,
            'phase': phase, 'flag': flag,
            'votes': {'bt': dict(sorted(bt_votes.items())), 'aio': dict(sorted(aio_votes.items()))},
            'candidates': {'bt_major': bt_major,
                           'bt_entry': _top(Counter(r for r in bt[a:min(b, a + 16)] if r is not None)),
                           'aio': aio_major},
        })
    return {'times': times, 'sections': out, 'blocks': blocks, 'spliced': [list(x) for x in spliced]}


# ---------------------------------------------------------------- 人改的"1"


def fix_bounds(times: list, sections: list, block_starts: list) -> list:
    """人改"1"时"一段"的边界（第一拍的下标）：连续音乐块的起点，和数法本来就变了的地方（串烧里换歌）。"""
    return sorted({0} | {b for b in block_starts if 0 < b < len(times)}
                  | {s for k, (s, one) in enumerate(sections) if k and (one - sections[k - 1][1]) % 8})


def apply_ones(times: list, sections: list, bounds: list, ones: list | None) -> list:
    """把人标的"这一拍是 1"（时刻，秒）套上去；bounds 见 fix_bounds。

    一段连续的音乐里数法不变：标一个，这一段从头到尾都跟着它数；同一段里后面又标了一个，从那一拍起按新的数
    （中间有算法没切开的接口）。前端的修改八拍工作台（components/beats/ones.ts）是同一套规则。"""
    sections = [list(s) for s in sections]
    if not ones or not times:
        return sections
    marks = sorted({_nearest(times, float(t)) for t in ones})
    for k, lo in enumerate(bounds):
        hi = bounds[k + 1] if k + 1 < len(bounds) else len(times)
        inside = [m for m in marks if lo <= m < hi]
        if not inside:
            continue
        for m in inside[1:]:
            sections = split_at(sections, m)
        for s in sections:
            if lo <= s[0] < hi:
                s[1] = max(m for m in inside if m <= s[0] or m == inside[0])
    return sections


def grid(data: dict, chapters: list | None = None, allin1: dict | list | None = None, ones: list | None = None) -> dict:
    """现在的八拍网格：{times, sections, parts, base_sections, bounds, blocks, spliced}。
    base_sections 是套上人改的"1"之前的数法，bounds 是人改"1"时每一段的边界。

    chapters 是 LockAI 的分段（没分析过是 None）；allin1 是 LockAI 时 All-In-One 的结果 {beats, downbeats}
    （老的分析只存了小节头，传列表也行）；ones 是人改过的"1"的时刻。下标都按返回的 times。"""
    if isinstance(allin1, list):
        allin1 = {'downbeats': allin1}
    a = analyze(data, allin1)
    times = a['times']
    if chapters:
        g = chapter_grid(times, a['sections'], chapters)
    else:
        g = {'sections': a['sections'], 'parts': default_parts(times, a['sections'])}
    bounds = fix_bounds(times, g['sections'], [b['start'] for b in a['blocks']])
    return {'times': times, 'sections': apply_ones(times, g['sections'], bounds, ones), 'parts': g['parts'],
            'base_sections': g['sections'], 'bounds': bounds, 'blocks': a['blocks'], 'spliced': a['spliced']}
