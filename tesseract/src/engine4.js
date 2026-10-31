/* Тессеракт — движок 4D-мира (X, Z — пол, Y — высота, W — четвёртое измерение).
   Мир хранится как карта высот H(x, z, w). Игрок видит 3D-срез: X–Z при фиксированном w
   или W–Z при фиксированном x («поворот в 4D»). Работает в браузере и в Node. */
(function (root) {
"use strict";
const DIRS = { XP: [1, 0, 0], XM: [-1, 0, 0], ZP: [0, 1, 0], ZM: [0, -1, 0], WP: [0, 0, 1], WM: [0, 0, -1], WAIT: [0, 0, 0] };

// Уровень: { nx, nz, nw, h: [w][z] строки по x ('.'=0, '1','2'=высота, '#'=стена 3, '_'=пустота),
//   start, portal, crystals: [], buddy, drones: [{ path: [[x,z,w],..] }], plates: [{ c, id }], gates: [{ c, id }] }
function parse(lv) {
  const { nx, nz, nw } = lv, N = nx * nz * nw;
  const H = new Int8Array(N);
  const idx = (x, z, w) => (w * nz + z) * nx + x;
  for (let w = 0; w < nw; w++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const ch = ((lv.h[w] || [])[z] || "")[x] || ".";
    H[idx(x, z, w)] = ch === "#" ? 3 : ch === "_" ? -1 : ch >= "0" && ch <= "9" ? +ch : 0;
  }
  const gate = new Int8Array(N).fill(-1), plate = new Int8Array(N).fill(-1);
  (lv.gates || []).forEach(g => { gate[idx(...g.c)] = g.id; });
  (lv.plates || []).forEach(p => { plate[idx(...p.c)] = p.id; });
  const crystals = (lv.crystals || []).map(c => idx(...c));
  const drones = (lv.drones || []).map(d => d.path.map(c => idx(...c)));
  let period = 1; const gcd = (a, b) => b ? gcd(b, a % b) : a;
  drones.forEach(p => { period = period * p.length / gcd(period, p.length); });
  const L = { nx, nz, nw, N, H, gate, plate, crystals, drones, period, idx,
    portal: idx(...lv.portal), buddy: lv.buddy ? idx(...lv.buddy) : -1, hasWait: drones.length > 0 };
  const S = { x: lv.start[0], z: lv.start[1], w: lv.start[2], t: 0, got: 0, bud: 0, gm: 0 };
  return { L, S };
}
const coords = (L, i) => [i % L.nx, Math.floor(i / L.nx) % L.nz, Math.floor(i / (L.nx * L.nz))];
function height(L, S, i) {
  const g = L.gate[i];
  if (g >= 0 && !((S.gm >> g) & 1)) return 3;   // врата закрыты — столб
  return L.H[i];
}
const dronePos = (L, d, t) => L.drones[d][t % L.drones[d].length];
const allGot = L => (1 << L.crystals.length) - 1;

function step(L, S, dir) {
  const [dx, dz, dw] = DIRS[dir];
  const ev = { dir };
  if (dir === "WAIT") {
    if (!L.hasWait) return { S, ev: { t: "blocked", why: "nowait" }, moved: false };
    const N = Object.assign({}, S, { t: S.t + 1 });
    return finish(L, S, N, { t: "wait" });
  }
  const x = S.x + dx, z = S.z + dz, w = S.w + dw;
  if (x < 0 || z < 0 || w < 0 || x >= L.nx || z >= L.nz || w >= L.nw) return { S, ev: { t: "blocked", why: "edge", dir }, moved: false };
  const ci = L.idx(S.x, S.z, S.w), ti = L.idx(x, z, w);
  const hc = height(L, S, ci), ht = height(L, S, ti);
  if (ht < 0) return { S, ev: { t: "blocked", why: "void", dir }, moved: false };
  if (ht > hc + 1) return { S, ev: { t: "blocked", why: "high", dir }, moved: false };
  const N = Object.assign({}, S, { x, z, w, t: S.t + 1 });
  const e = { t: "move", dir, from: ci, to: ti, dh: ht - hc };
  const k = L.crystals.indexOf(ti);
  if (k >= 0 && !((N.got >> k) & 1)) { N.got |= 1 << k; e.crystal = k; }
  if (ti === L.buddy && !N.bud) { N.bud = 1; e.buddy = true; }
  if (L.plate[ti] >= 0) { N.gm ^= 1 << L.plate[ti]; e.plate = L.plate[ti]; }
  return finish(L, S, N, e);
}
function finish(L, S, N, e) {
  const me = L.idx(N.x, N.z, N.w), prev = L.idx(S.x, S.z, S.w);
  let caught = -1;
  for (let d = 0; d < L.drones.length; d++) {
    const a = dronePos(L, d, N.t), b = dronePos(L, d, S.t);
    if (a === me || (a === prev && b === me)) { caught = d; break; }
  }
  const win = caught < 0 && me === L.portal && N.got === allGot(L);
  return { S: N, ev: e, moved: true, caught, win };
}
const key = (L, S) => S.x + "," + S.z + "," + S.w + "," + (S.t % L.period) + "," + S.got + "," + S.bud + "," + S.gm;

// Поиск в ширину. opts: { noW: запретить шаги по W, needBuddy: обязательно спасти малыша, cap }
function solve(L, S0, opts) {
  opts = opts || {};
  const cap = opts.cap || 300000;
  const acts = ["XP", "XM", "ZP", "ZM"].concat(opts.noW ? [] : ["WP", "WM"]).concat(L.hasWait ? ["WAIT"] : []);
  const goal = (r) => r.win && (!opts.needBuddy || r.S.bud);
  const seen = new Set([key(L, S0)]); const nodes = [S0], par = [-1], act = [""];
  for (let i = 0; i < nodes.length; i++) {
    for (const a of acts) {
      const r = step(L, nodes[i], a);
      if (!r.moved || r.caught >= 0) continue;
      if (r.win && !goal(r)) continue;            // портал без малыша — не считаем финалом в режиме needBuddy
      const k = key(L, r.S); if (seen.has(k)) continue;
      seen.add(k); nodes.push(r.S); par.push(i); act.push(a);
      if (goal(r)) { const path = []; let j = nodes.length - 1; while (j > 0) { path.push(act[j]); j = par[j]; } path.reverse(); return { len: path.length, path, explored: nodes.length }; }
      if (nodes.length > cap) return { fail: "cap", explored: nodes.length };
    }
  }
  return { fail: "none", explored: nodes.length };
}
// сколько раз нужно повернуть срез: смены между шагами по X и по W
function rotations(path) {
  let mode = "X", n = 0;
  for (const a of path) { if (a[0] === "X" && mode !== "X") { mode = "X"; n++; } else if (a[0] === "W" && a !== "WAIT" && mode !== "W") { mode = "W"; n++; } }
  return n;
}

// ---------- Генератор ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function generate(R, sp) {
  const ri = r => Array.isArray(r) ? r[0] + Math.floor(R() * (r[1] - r[0] + 1)) : (r || 0);
  const nx = ri(sp.nx), nz = ri(sp.nz), nw = ri(sp.nw);
  const H = []; for (let w = 0; w < nw; w++) { const s = []; for (let z = 0; z < nz; z++) s.push(new Array(nx).fill(0)); H.push(s); }
  const box = (v, opts = {}) => {
    const ax = R() < 0.5; // стена вдоль z (фикс. x) или вдоль x (фикс. z)
    let x0, x1, z0, z1;
    if (opts.wall) {
      if (ax) { x0 = x1 = 1 + Math.floor(R() * (nx - 2)); z0 = Math.floor(R() * 2); z1 = nz - 1 - Math.floor(R() * 2); }
      else { z0 = z1 = 1 + Math.floor(R() * (nz - 2)); x0 = Math.floor(R() * 2); x1 = nx - 1 - Math.floor(R() * 2); }
    } else {
      const sx = ri(opts.size || [1, 3]), sz = ri(opts.size || [1, 3]);
      x0 = Math.floor(R() * (nx - sx + 1)); z0 = Math.floor(R() * (nz - sz + 1)); x1 = x0 + sx - 1; z1 = z0 + sz - 1;
    }
    const wl = 1 + Math.floor(R() * Math.max(1, nw - 1)); const w0 = Math.floor(R() * (nw - wl + 1));
    for (let w = w0; w < w0 + wl; w++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) H[w][z][x] = typeof v === "function" ? v(H[w][z][x]) : v;
  };
  for (let k = 0, n = ri(sp.plateaus); k < n; k++) box(ri(sp.ph || [1, 2]), { size: [2, 3] });
  for (let k = 0, n = ri(sp.walls); k < n; k++) box(3, { wall: true });
  for (let k = 0, n = ri(sp.blocks); k < n; k++) box(3, { size: [1, 2] });
  for (let k = 0, n = ri(sp.voids); k < n; k++) box(-1, { size: [1, 2] });
  const cells = []; for (let w = 0; w < nw; w++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) if (H[w][z][x] >= 0 && H[w][z][x] < 3) cells.push([x, z, w]);
  const used = new Set();
  const take = (pred) => { const c = cells.filter(c => !used.has(c.join()) && (!pred || pred(c))); if (!c.length) return null; const p = c[Math.floor(R() * c.length)]; used.add(p.join()); return p; };
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const start = take(); if (!start) return null;
  const portal = take(c => dist(c, start) >= Math.min(5, nx + nz - 3)); if (!portal) return null;
  const crystals = []; for (let k = 0, n = ri(sp.crystals || [1, 2]); k < n; k++) { const c = take(c => dist(c, start) >= 3 && dist(c, portal) >= 2); if (c) crystals.push(c); }
  const buddy = R() < (sp.buddy ?? 0.6) ? take(c => dist(c, start) >= 3) : null;
  const plates = [], gates = [];
  for (let id = 0, n = ri(sp.gates); id < n; id++) {
    const p = take(c => dist(c, start) >= 2); if (!p) break; plates.push({ c: p, id });
    // врата — столбик поперёк пути: несколько клеток рядом с порталом или кристаллом
    const target = R() < 0.5 ? portal : (crystals[0] || portal);
    const around = cells.filter(c => !used.has(c.join()) && dist(c, target) === 1 && c[2] === target[2]);
    const ng = Math.min(around.length, 1 + Math.floor(R() * 3));
    for (let k = 0; k < ng; k++) { const g = around.splice(Math.floor(R() * around.length), 1)[0]; used.add(g.join()); gates.push({ c: g, id }); }
  }
  const drones = [];
  for (let k = 0, n = ri(sp.drones); k < n; k++) {
    const axis = [0, 1, 2][Math.floor(R() * 3)], len = 3 + Math.floor(R() * 2);
    const base = take(c => dist(c, start) >= 3); if (!base) break;
    const lim = [nx, nz, nw][axis]; const s = Math.max(0, Math.min(lim - len, base[axis] - Math.floor(R() * len)));
    if (lim < 3) continue;
    const line = []; for (let i = 0; i < Math.min(len, lim); i++) { const c = base.slice(); c[axis] = s + i; line.push(c); }
    const path = line.concat(line.slice(1, -1).reverse());
    drones.push({ path });
  }
  const h = H.map(s => s.map(r => r.map(v => v === -1 ? "_" : v === 3 ? "#" : String(v)).join("")));
  return { nx, nz, nw, h, start, portal, crystals, buddy, plates, gates, drones };
}

const api = { DIRS, parse, coords, height, dronePos, allGot, step, key, solve, rotations, mulberry32, generate };
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.Engine4 = api;
})(typeof self !== "undefined" ? self : this);
