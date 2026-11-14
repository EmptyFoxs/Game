# Геометрия: построитель сеток из «решёток» (тела вращения и протяжки) с готовой UV-развёрткой
import math, numpy as np
SEG = [1.0]; CRN = [1.0]      # множители детализации (для облегчённых вариантов моделей)

def cr(pts, n=12):
    """Сплайн Катмулла—Рома через точки (любой размерности)."""
    P = np.array(pts, float); out = []; n = max(2, int(round(n * CRN[0])))
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1]); return np.array(out)

def fil(pts, n=4):
    """Ломаная (r, z, радиус скругления) -> профиль со скруглёнными углами."""
    P = [np.array(p[:2], float) for p in pts]; out = [P[0]]; n = max(2, int(round(n * CRN[0])))
    for i in range(1, len(P) - 1):
        a, b, c, rad = P[i - 1], P[i], P[i + 1], pts[i][2]
        u1, u2 = a - b, c - b; l1, l2 = np.linalg.norm(u1), np.linalg.norm(u2)
        if rad <= 0 or l1 < 1e-9 or l2 < 1e-9: out.append(b); continue
        u1 /= l1; u2 /= l2; ang = math.acos(max(-1, min(1, float(u1 @ u2))))
        if ang > math.pi - 1e-3: out.append(b); continue
        d = min(rad / math.tan(ang / 2), 0.45 * l1, 0.45 * l2); s, e = b + u1 * d, b + u2 * d
        for t in np.linspace(0, 1, n + 1): out.append((1 - t) ** 2 * s + 2 * t * (1 - t) * b + t * t * e)
    out.append(P[-1]); return np.array(out)

def offset(poly, t):
    """Смещение ломаной (r, z) влево по ходу на t."""
    P = np.array(poly, float); d = np.gradient(P, axis=0); n = np.stack([-d[:, 1], d[:, 0]], 1); n /= np.linalg.norm(n, axis=1)[:, None]; return P + n * t

def shell(outer, t):
    """Тонкостенная оболочка: наружный профиль (против часовой) + внутренний обратным ходом."""
    return np.concatenate([outer, offset(outer, t)[::-1]])

def lathe(profile, seg=64, M=None, knurl=None):
    seg = max(8, int(round(seg * SEG[0]))); rows = []; th = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    for r, z in profile:
        if r < 1e-6: row = np.array([[0, 0, z]], float)
        else:
            rr = np.full(seg, r)
            if knurl and knurl[2] <= z <= knurl[3]: rr = rr * (1 - knurl[1] * (np.sin(th * knurl[0]) > 0))
            row = np.stack([rr * np.cos(th), rr * np.sin(th), np.full(seg, z)], 1)
        rows.append(row)
    if M is not None: rows = [r @ M[:3, :3].T + M[:3, 3] for r in rows]
    return rows

def circle(seg): th = np.linspace(0, 2 * math.pi, seg, endpoint=False); return np.stack([np.cos(th), np.sin(th)], 1)
def rrect(w, h, b, n=2):
    pts = []
    for cx, cy, a0 in ((w / 2 - b, h / 2 - b, 0), (-w / 2 + b, h / 2 - b, 90), (-w / 2 + b, -h / 2 + b, 180), (w / 2 - b, -h / 2 + b, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); pts.append((cx + b * math.cos(a), cy + b * math.sin(a)))
    return np.array(pts)

def sweep(path, radius=1.0, seg=12, caps=True, section=None, loop=False, up=(0, 0, 1)):
    """Протяжка сечения вдоль пути. radius — число или массив по точкам пути."""
    P = np.array(path, float); n = len(P); sec = circle(max(6, int(round(seg * SEG[0])))) if section is None else np.array(section, float)
    R = np.full(n, radius, float) if np.isscalar(radius) else np.array(radius, float)
    T = np.roll(P, -1, 0) - np.roll(P, 1, 0) if loop else np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1)[:, None]
    N = np.cross(T[0], np.array(up, float));
    if np.linalg.norm(N) < 1e-6: N = np.cross(T[0], np.array((1, 0, 0), float))
    N /= np.linalg.norm(N); rows = []
    if caps and not loop: rows.append(P[:1].copy())
    for i in range(n):
        N = N - T[i] * (N @ T[i]); N /= np.linalg.norm(N); B = np.cross(T[i], N)   # N x B = T
        rows.append(P[i] + R[i] * (sec[:, :1] * N + sec[:, 1:] * B))
    if caps and not loop: rows.append(P[-1:].copy())
    return rows

class Group:
    """Набор деталей одной текстурной развёртки."""
    def __init__(s, name): s.name = name; s.V = []; s.F = []; s.FC = []; s.FM = []; s.charts = []; s.mats = []; s.VT = []; s.FT = []; s.tags = ["_"]; s.offs = [(0, 0, 0)]; s.ti = 0; s.dens = 1.0; s.wmax = 0.26; s.hmax = 0.2
    def begin(s, tag, off=(0, 0, 0), dens=1.0):
        if tag not in s.tags: s.tags.append(tag); s.offs.append(off)
        s.ti = s.tags.index(tag); s.dens = dens
    def mat(s, m):
        if m not in s.mats: s.mats.append(m)
        return s.mats.index(m)
    def grid(s, rows, mat, loop=False, hmax=None, dens=1.0, wmax=None):
        hmax = hmax or s.hmax; wmax = wmax or s.wmax
        mi = s.mat(mat); base = []; nseg = max(len(r) for r in rows); dens = dens * s.dens
        for r in rows: base.append(len(s.V)); s.V.extend(map(tuple, r)); s.VT.extend([s.ti] * len(r))
        pt = lambda i, j: rows[i][j % len(rows[i])] if len(rows[i]) > 1 else rows[i][0]
        vid = lambda i, j: base[i] + (j % nseg if len(rows[i]) > 1 else 0)
        nr = len(rows); segs = list(range(nr if loop else nr - 1)); info = []
        for i in segs:
            k = (i + 1) % nr; a = np.array([pt(i, j) for j in range(nseg)]); b = np.array([pt(k, j) for j in range(nseg)])
            nrm = np.cross(np.roll(a, -1, 0) - a + np.roll(b, -1, 0) - b, b - a + np.roll(b, -1, 0) - np.roll(a, -1, 0)); ln = np.linalg.norm(nrm, axis=1); ok = ln > 1e-14
            per = lambda q: np.linalg.norm(np.roll(q, -1, 0) - q, axis=1).sum()
            mean = (nrm[ok] / ln[ok, None]).mean(0) if ok.any() else np.zeros(3)
            flat = np.linalg.norm(mean) > 0.9 and min(per(a), per(b)) < 0.5 * max(per(a), per(b))      # узкие кольца разворачиваем полосой, а не квадратом
            info.append(dict(i=i, k=k, flat=flat, ax=mean / (np.linalg.norm(mean) + 1e-12), d=float(np.linalg.norm(b - a, axis=1).mean()), w=max(per(a), per(b))))
        pieces = []
        for g in info:
            p = pieces[-1] if pieces else None
            if p and p["flat"] == g["flat"] and ((g["flat"] and p["ax"] @ g["ax"] > 0.92) or (not g["flat"] and p["h"] + g["d"] <= hmax)): p["segs"].append(g); p["h"] += g["d"]; p["w"] = max(p["w"], g["w"])
            else: pieces.append(dict(flat=g["flat"], ax=g["ax"], segs=[g], h=g["d"], w=g["w"]))
        for p in pieces:
            cid = len(s.charts)
            if p["flat"]:
                ax = p["ax"]; e1 = np.cross(ax, (0, 0, 1) if abs(ax[2]) < 0.9 else (1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
                pts = np.array([pt(r, j) for g in p["segs"] for r in (g["i"], g["k"]) for j in range(nseg)]); lo = np.array([(pts @ e1).min(), (pts @ e2).min()])
                size = np.array([(pts @ e1).max(), (pts @ e2).max()]) - lo; uv = lambda i, j, v0, col: (float(pt(i, j) @ e1 - lo[0]), float(pt(i, j) @ e2 - lo[1]))
            else: size = np.array([p["w"], p["h"]]); uv = lambda i, j, v0, col, W=p["w"]: (col / nseg * W, v0)
            ns = 1 if p["flat"] else max(1, math.ceil(p["w"] / wmax)); per = math.ceil(nseg / ns)
            for q in range(ns): s.charts.append(dict(size=np.maximum(size * ((min(nseg, (q + 1) * per) - q * per) / nseg if ns > 1 else 1, 1), 1e-4) * dens))
            v0 = 0.0
            for g in p["segs"]:
                i, k = g["i"], g["k"]; v1 = v0 + g["d"]
                if len(rows[i]) == 1 and len(rows[k]) == 1: v0 = v1; continue
                for j in range(nseg):
                    A, B, C, D = (i, j, v0, j), (i, j + 1, v0, j + 1), (k, j + 1, v1, j + 1), (k, j, v1, j)
                    if len(rows[i]) == 1: quad = [(i, j, v0, j + 0.5), C, D]
                    elif len(rows[k]) == 1: quad = [A, B, (k, j, v1, j + 0.5)]
                    else: quad = [A, B, C, D]
                    q = j // per if ns > 1 else 0
                    s.F.append([vid(a, b) for a, b, _, _ in quad]); s.FC.append([(cid + q,) + tuple(np.array(uv(a, b, c, d - q * per)) * dens) for a, b, c, d in quad]); s.FM.append(mi); s.FT.append(s.ti)
                v0 = v1
    def pack(s, margin=0.004):
        order = sorted(range(len(s.charts)), key=lambda i: -s.charts[i]["size"][1])
        def place(sc):
            shelves = []; pos = {}; ytop = margin                       # «первый подходящий» по полкам
            for i in order:
                w, h = s.charts[i]["size"] * sc
                if w > 1 - 2 * margin: return None
                for sh in shelves:
                    if sh[2] + w <= 1 - margin and h <= sh[1] + 1e-9: pos[i] = (sh[2], sh[0]); sh[2] += w + margin; break
                else:
                    if ytop + h > 1 - margin: return None
                    shelves.append([ytop, h, margin + w + margin]); pos[i] = (margin, ytop); ytop += h + margin
            return pos
        lo, hi = 0.0, 1.0 / max(1e-6, max(c["size"].max() for c in s.charts)) * 4
        for _ in range(40):
            mid = (lo + hi) / 2
            if place(mid): lo = mid
            else: hi = mid
        s.scale = lo; s.pos = place(lo); return lo
