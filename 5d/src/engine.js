/* 5D: Ветви — движок правил, решатель и генератор уровней.
   Работает и в браузере (self.Engine), и в Node (module.exports). */
(function (root) {
"use strict";
const DV = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
const FLIPX = { U: "U", D: "D", L: "R", R: "L", W: "W" };
const FLIPY = { U: "D", D: "U", L: "L", R: "R", W: "W" };
const T = { FLOOR: 0, WALL: 1, VOID: 2, GOAL: 3, RIFT: 4, BTN: 5, GATE: 6 };

// ---------- Разбор уровня ----------
// lv = { w, h, lines: [ { rows: ["....."], mx, my, d } ] }
// # стена · пол ~ пустота * маяк @ копия o ящик 0-3 разлом в ветвь N  a-e кнопка  A-E врата
function parse(lv) {
  const w = lv.w, h = lv.h, A = w * h;
  const P = { w, h, A, n: lv.lines.length, lines: [], goals: [], maxD: 0 };
  const S = { copies: [], boxes: [], filled: [], hist: [] };
  let cid = 0, bid = 0;
  lv.lines.forEach((ln, l) => {
    const tile = new Uint8Array(A), ext = new Int8Array(A).fill(-1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = (ln.rows[y] || "")[x] || "#", c = y * w + x;
      if (ch === "#") tile[c] = T.WALL;
      else if (ch === "~") tile[c] = T.VOID;
      else if (ch === "*") { tile[c] = T.GOAL; P.goals.push(l * A + c); }
      else if (ch === "@") S.copies.push({ id: cid++, l, c });
      else if (ch === "o") S.boxes.push({ id: bid++, l, c });
      else if (ch >= "0" && ch <= "9") { tile[c] = T.RIFT; ext[c] = +ch; }
      else if (ch >= "a" && ch <= "e") { tile[c] = T.BTN; ext[c] = ch.charCodeAt(0) - 97; }
      else if (ch >= "A" && ch <= "E") { tile[c] = T.GATE; ext[c] = ch.charCodeAt(0) - 65; }
    }
    const d = ln.d | 0; if (d > P.maxD) P.maxD = d;
    P.lines.push({ tile, ext, mx: !!ln.mx, my: !!ln.my, d });
  });
  return { P, S };
}
function clone(S) {
  return { copies: S.copies.map(o => ({ id: o.id, l: o.l, c: o.c })), boxes: S.boxes.map(o => ({ id: o.id, l: o.l, c: o.c })),
           filled: S.filled.slice(), hist: S.hist.slice() };
}
function effAction(P, S, l, a) {
  const ln = P.lines[l]; let act = a;
  if (ln.d > 0) { const k = S.hist.length - ln.d; act = k >= 0 ? S.hist[k] : "W"; }
  if (ln.mx) act = FLIPX[act];
  if (ln.my) act = FLIPY[act];
  return act;
}
function pressedMask(P, copies, boxes) {
  let m = 0;
  for (const o of copies) { const ln = P.lines[o.l]; if (ln.tile[o.c] === T.BTN) m |= 1 << ln.ext[o.c]; }
  for (const o of boxes) { const ln = P.lines[o.l]; if (ln.tile[o.c] === T.BTN) m |= 1 << ln.ext[o.c]; }
  return m;
}

// ---------- Один ход ----------
function step(P, S, a, noEv) {
  const A = P.A, w = P.w, h = P.h;
  const copies = S.copies.map(o => ({ id: o.id, l: o.l, c: o.c, moved: false, gone: false }));
  const boxes = S.boxes.map(o => ({ id: o.id, l: o.l, c: o.c, gone: false }));
  const filled = S.filled.slice();
  const ev = noEv ? null : [];
  const E = e => { if (ev) ev.push(e); };
  const occC = new Int16Array(P.n * A).fill(-1), occB = new Int16Array(P.n * A).fill(-1);
  copies.forEach((o, i) => { occC[o.l * A + o.c] = i; });
  boxes.forEach((o, i) => { occB[o.l * A + o.c] = i; });
  const mask = pressedMask(P, S.copies, S.boxes);
  const blocked = (l, c, m) => {
    const ln = P.lines[l], t = ln.tile[c];
    if (t === T.WALL) return true;
    if (t === T.GATE) return !((m >> ln.ext[c]) & 1);
    return false;
  };
  const acts = [];
  for (let l = 0; l < P.n; l++) {
    const act = effAction(P, S, l, a); acts.push(act);
    if (act === "W") continue;
    const dx = DV[act][0], dy = DV[act][1];
    const idx = [];
    for (let i = 0; i < copies.length; i++) if (copies[i].l === l) idx.push(i);
    const pr = o => (o.c % w) * dx + ((o.c / w) | 0) * dy;
    idx.sort((i, j) => pr(copies[j]) - pr(copies[i]));
    for (const i of idx) {
      const o = copies[i], x = o.c % w, y = (o.c / w) | 0, nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { E({ t: "bump", id: o.id, l, c: o.c, dir: act }); continue; }
      const nc = ny * w + nx, g = l * A + nc;
      if (blocked(l, nc, mask) || occC[g] >= 0) { E({ t: "bump", id: o.id, l, c: o.c, dir: act }); continue; }
      const bi = occB[g];
      if (bi >= 0) {
        const bx = nx + dx, by = ny + dy;
        if (bx < 0 || by < 0 || bx >= w || by >= h) { E({ t: "bump", id: o.id, l, c: o.c, dir: act }); continue; }
        const bc = by * w + bx, bg = l * A + bc;
        if (blocked(l, bc, mask) || occC[bg] >= 0 || occB[bg] >= 0) { E({ t: "bump", id: o.id, l, c: o.c, dir: act }); continue; }
        occB[g] = -1;
        if (P.lines[l].tile[bc] === T.VOID && filled.indexOf(bg) < 0) {
          filled.push(bg); boxes[bi].gone = true; E({ t: "boxfall", id: boxes[bi].id, l, from: nc, c: bc });
        } else { boxes[bi].c = bc; occB[bg] = bi; E({ t: "push", id: boxes[bi].id, l, from: nc, c: bc }); }
      }
      occC[l * A + o.c] = -1; E({ t: "move", id: o.id, l, from: o.c, c: nc, dir: act });
      o.c = nc; o.moved = true; occC[g] = i;
    }
  }
  // разломы
  const live = boxes.filter(b => !b.gone);
  const mask2 = pressedMask(P, copies, live);
  for (let i = 0; i < copies.length; i++) {
    const o = copies[i]; if (!o.moved || o.gone) continue;
    const ln = P.lines[o.l]; if (ln.tile[o.c] !== T.RIFT) continue;
    const t = ln.ext[o.c]; if (t < 0 || t >= P.n || t === o.l) continue;
    const tg = t * A + o.c, tt = P.lines[t].tile[o.c];
    if (tt === T.WALL || (tt === T.GATE && !((mask2 >> P.lines[t].ext[o.c]) & 1)) || occB[tg] >= 0) {
      E({ t: "riftblock", id: o.id, l: o.l, c: o.c, to: t }); continue;
    }
    occC[o.l * A + o.c] = -1;
    if (occC[tg] >= 0) { const other = copies[occC[tg]]; o.gone = true; E({ t: "merge", id: o.id, into: other.id, from: o.l, l: t, c: o.c }); continue; }
    E({ t: "teleport", id: o.id, from: o.l, l: t, c: o.c });
    o.l = t; occC[tg] = i;
  }
  const nc = copies.filter(o => !o.gone).map(o => ({ id: o.id, l: o.l, c: o.c }));
  const nb = live.map(o => ({ id: o.id, l: o.l, c: o.c }));
  const hist = P.maxD > 0 ? S.hist.concat([a]).slice(-P.maxD) : [];
  let dead = false;
  for (const o of nc) {
    const g = o.l * A + o.c;
    if (P.lines[o.l].tile[o.c] === T.VOID && filled.indexOf(g) < 0) { dead = true; E({ t: "fall", id: o.id, l: o.l, c: o.c }); }
  }
  let win = false;
  if (!dead) {
    const occ = new Set(nc.map(o => o.l * A + o.c));
    win = P.goals.length > 0 && P.goals.every(g => occ.has(g));
  }
  return { S: { copies: nc, boxes: nb, filled, hist }, ev, dead, win, acts };
}
function key(S) {
  const c = S.copies.map(o => o.l * 256 + o.c).sort((a, b) => a - b).join(",");
  const b = S.boxes.map(o => o.l * 256 + o.c).sort((a, b) => a - b).join(",");
  const f = S.filled.length ? S.filled.slice().sort((a, b) => a - b).join(",") : "";
  return c + "|" + b + "|" + f + "|" + S.hist.join("");
}
function isWin(P, S) {
  const occ = new Set(S.copies.map(o => o.l * P.A + o.c));
  return P.goals.length > 0 && P.goals.every(g => occ.has(g));
}

// ---------- Решатель (поиск в ширину) ----------
function solve(P, S0, cap) {
  cap = cap || 200000;
  if (isWin(P, S0)) return { len: 0, path: [], explored: 1 };
  const acts = P.maxD > 0 ? ["U", "D", "L", "R", "W"] : ["U", "D", "L", "R"];
  const seen = new Set([key(S0)]);
  const nodes = [S0], par = [-1], act = [""];
  for (let i = 0; i < nodes.length; i++) {
    for (const a of acts) {
      const r = step(P, nodes[i], a, true);
      if (r.dead) continue;
      const k = key(r.S); if (seen.has(k)) continue;
      seen.add(k); nodes.push(r.S); par.push(i); act.push(a);
      if (r.win) {
        const path = []; let j = nodes.length - 1;
        while (j > 0) { path.push(act[j]); j = par[j]; }
        path.reverse();
        return { len: path.length, path, explored: nodes.length };
      }
      if (nodes.length > cap) return { fail: "cap", explored: nodes.length };
    }
    nodes[i] = null; // освобождаем память
  }
  return { fail: "none", explored: nodes.length };
}
function replay(P, S0, path) {
  let S = S0; const evs = []; let res = null;
  for (const a of path) { res = step(P, S, a); evs.push(res.ev); S = res.S; if (res.dead) break; }
  return { S, evs, win: res ? res.win : isWin(P, S0), dead: res ? res.dead : false };
}

// ---------- Генератор ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function generate(R, sp) {
  const ri = r => Array.isArray(r) ? r[0] + Math.floor(R() * (r[1] - r[0] + 1)) : (r || 0);
  const rf = r => Array.isArray(r) ? r[0] + R() * (r[1] - r[0]) : (r || 0);
  const N = ri(sp.N), w = ri(sp.W); let h = ri(sp.H);
  while (N * h + (N - 1) * 1.4 > (sp.maxStack || 19.5) && h > 3) h--;
  const g = [];
  for (let l = 0; l < N; l++) { const grid = []; for (let y = 0; y < h; y++) grid.push(new Array(w).fill(".")); g.push(grid); }
  const free = (l, pred) => { const out = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pred ? pred(g[l][y][x], x, y) : g[l][y][x] === ".") out.push([x, y]); return out; };
  const pick = (l, pred) => { const f = free(l, pred); return f.length ? f[Math.floor(R() * f.length)] : null; };
  const put = (l, ch, pred) => { const p = pick(l, pred); if (!p) return null; g[l][p[1]][p[0]] = ch; return p; };
  for (let l = 0; l < N; l++) {
    const nw = Math.round(w * h * rf(sp.wall));
    for (let k = 0; k < nw; k++) put(l, "#");
    const nv = ri(sp.voids);
    for (let k = 0; k < nv; k++) put(l, "~");
  }
  // копии
  const cnt = new Array(N).fill(1);
  let donor = -1, recv = -1;
  if (sp.transfer && N >= 2) {
    donor = Math.floor(R() * N); recv = (donor + 1 + Math.floor(R() * (N - 1))) % N;
    cnt[donor] = 2; cnt[recv] = 0;
  }
  for (let l = 0; l < N; l++) for (let k = 0; k < cnt[l]; k++) put(l, "@");
  for (let l = 0; l < N; l++) put(l, "*");
  // разломы
  const nr = ri(sp.rifts);
  for (let k = 0; k < nr; k++) {
    let l = donor >= 0 && (k === 0 || R() < 0.5) ? donor : Math.floor(R() * N);
    let t = recv >= 0 && l === donor && (k === 0 || R() < 0.6) ? recv : (l + 1 + Math.floor(R() * (N - 1))) % N;
    if (N < 2) break;
    const p = pick(l); if (!p) continue;
    g[l][p[1]][p[0]] = String(t);
    if (g[t][p[1]][p[0]] === "#") g[t][p[1]][p[0]] = ".";
  }
  // кнопки и врата
  const nbt = ri(sp.buttons);
  for (let k = 0; k < nbt; k++) {
    const lb = Math.floor(R() * N); const lg = N > 1 && R() < 0.85 ? (lb + 1 + Math.floor(R() * (N - 1))) % N : lb;
    if (!put(lb, String.fromCharCode(97 + k))) continue;
    // врата ставим рядом с маяком чаще — так они важнее
    const goal = free(lg, ch => ch === "*")[0];
    let gp = null;
    if (goal && R() < 0.6) {
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [goal[0] + dx, goal[1] + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h && g[lg][y][x] === ".");
      if (nb.length) gp = nb[Math.floor(R() * nb.length)];
    }
    if (!gp) gp = pick(lg);
    if (gp) g[lg][gp[1]][gp[0]] = String.fromCharCode(65 + k);
  }
  // ящики
  for (let l = 0; l < N; l++) {
    const nb = ri(sp.boxes);
    for (let k = 0; k < nb; k++) put(l, "o", (ch, x, y) => ch === "." && (sp.boxEdge || (x > 0 && y > 0 && x < w - 1 && y < h - 1)));
  }
  const lines = g.map(grid => ({ rows: grid.map(r => r.join("")), mx: false, my: false, d: 0 }));
  // зеркала
  const nm = Math.min(N, ri(sp.mirror));
  const order = lines.map((_, i) => i).sort(() => R() - 0.5);
  for (let k = 0; k < nm; k++) { const ln = lines[order[k]]; if (R() < 0.6) ln.mx = true; else ln.my = true; if (sp.mirrorBoth && R() < 0.25) { ln.mx = true; ln.my = true; } }
  // эхо
  const nd = Math.min(N - 1, ri(sp.delay));
  const order2 = lines.map((_, i) => i).sort(() => R() - 0.5);
  for (let k = 0; k < nd; k++) lines[order2[k]].d = ri(sp.dval || [1, 2]);
  return { w, h, lines };
}

const api = { T, DV, FLIPX, FLIPY, parse, clone, step, key, isWin, solve, replay, effAction, pressedMask, mulberry32, generate };
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.Engine = api;
})(typeof self !== "undefined" ? self : this);
