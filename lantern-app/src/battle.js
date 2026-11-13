// Пошаговый бой: чистая логика без графики (работает и в игре, и в симуляторе)
import { HEROES, SK, FOES, ITEMS, STATUS } from "./data.js";

export function mkRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const MAXLVL = 14;
export const TUNE = { hp: 1, atk: 1, spd: 0.45, boss: 1 };
export const xpNeed = l => Math.round(20 + 15 * Math.pow(l, 1.55));

export function heroStats(id, lvl, eq) {
  const H = HEROES[id], k = lvl - 1, b = H.base, g = H.grow;
  const s = { mhp: b.hp + g.hp * k, mmp: b.mp + g.mp * k, atk: b.atk + g.atk * k, mag: b.mag + g.mag * k, def: b.def + g.def * k, spd: b.spd + g.spd * k, crit: H.crit, regen: 0 };
  for (const slot of ["w", "a", "c"]) { const it = eq && ITEMS[eq[slot]]; if (it && it.eq) for (const key in it.eq) s[key] = (s[key] || 0) + it.eq[key]; }
  for (const key of ["mhp", "mmp", "atk", "mag", "def"]) s[key] = Math.round(s[key]);
  return s;
}
export const heroSkills = (id, lvl) => HEROES[id].skills.filter(([l]) => l <= lvl).map(([, s]) => s);
const mkUnit = o => Object.assign({ st: {}, ct: 0, alive: true, weak: [], resist: [], cd: {}, used: {}, crit: 0.05, regen: 0 }, o);
export function heroUnit(h) {
  const s = heroStats(h.id, h.lvl, h.eq), H = HEROES[h.id];
  const u = mkUnit(Object.assign({ uid: h.id, side: "hero", key: h.id, name: H.name, lvl: h.lvl, skills: heroSkills(h.id, h.lvl), basic: H.basic }, s));
  u.hp = Math.min(h.hp === undefined ? s.mhp : h.hp, s.mhp); u.mp = Math.min(h.mp === undefined ? s.mmp : h.mp, s.mmp); u.alive = u.hp > 0;
  return u;
}
export function foeUnit(key, lvl, n, mul = 1) {
  const T = globalThis.__tune || TUNE, F = FOES[key], k = lvl - 1, hm = (1 + 0.3 * k + 0.07 * k * k) * (1 + 0.22 * k) * mul * T.hp * (F.boss ? T.boss : 1), am = (1 + 0.14 * k) * (1 + 0.1 * k) * mul * T.atk;
  const hp = Math.round(F.hp * hm * (F.boss ? 1.1 : 1));
  return mkUnit({ uid: "f" + n, side: "foe", key, name: F.name, lvl, boss: !!F.boss, mhp: hp, hp, mmp: 0, mp: 0, atk: Math.round(F.atk * am), mag: Math.round(F.mag * am), def: Math.round(F.def * (1 + 0.12 * k)),
    spd: F.spd + T.spd * k, weak: F.weak, resist: F.resist, xp: Math.round(F.xp * (1 + 0.28 * k)), gold: Math.round(F.gold * (1 + 0.15 * k)) });
}
export function createBattle({ party, foes, lvl, seed = 1, flame = 0, inv = {}, mul = 1 }) {
  const B = { rng: mkRng(seed), units: [], flame, inv, over: null, xp: 0, gold: 0, turn: 0, n: 0, mul, lvl, cur: null, stole: 0 };
  party.forEach(h => B.units.push(heroUnit(h)));
  foes.forEach(k => B.units.push(foeUnit(k, lvl, B.n++, mul)));
  for (const u of B.units) u.ct = B.rng() * 30 + (u.side === "hero" ? 12 : 0);
  return B;
}
export const living = (B, side) => B.units.filter(u => u.alive && u.side === side);
const other = s => s === "hero" ? "foe" : "hero";
const speed = u => u.spd * (u.st.chill ? 0.7 : 1);

function checkOver(B) { if (!living(B, "hero").length) B.over = "lose"; else if (!living(B, "foe").length) B.over = "win"; return B.over; }
function ko(B, u, ev) {
  u.alive = false; u.hp = 0; u.st = {}; u.ct = 0; ev.push({ t: "ko", u });
  if (u.side === "foe") { B.xp += u.xp || 0; B.gold += u.gold || 0; addFlame(B, 12, ev); }
  checkOver(B);
}
function addFlame(B, n, ev) { const v = Math.min(100, B.flame + n); if (v !== B.flame) { B.flame = v; ev.push({ t: "flame", v }); } }
function addStatus(B, src, tgt, a, ev, sk) {
  if (!tgt.alive) return;
  let ch = a.ch === undefined ? 1 : a.ch; if (tgt.boss && a.s === "stun") ch *= 0.35;
  if (B.rng() > ch) return;
  const o = { t: a.t }; const stat = sk && sk.stat === "mag" ? src.mag : Math.max(src.atk, src.mag * 0.8);
  if (a.s === "burn" || a.s === "bleed") o.v = Math.max(2, Math.round(stat * 0.42));
  if (a.s === "shield") o.v = Math.round(src.mag * a.shield + 6);
  if (tgt === B.cur) o.fresh = true;
  tgt.st[a.s] = o; ev.push({ t: "st", u: tgt, s: a.s });
}
function hit(B, src, tgt, sk, ev, fixed) {
  let dmg, crit = false; const weak = tgt.weak.includes(sk.type), res = tgt.resist.includes(sk.type);
  if (fixed) dmg = fixed; else {
    const stat = sk.stat === "mag" ? src.mag : sk.stat === "best" ? Math.max(src.atk, src.mag) : src.atk;
    const am = (src.st.atkUp ? 1.3 : 1) * (src.st.atkDown ? 0.7 : 1) * (src.st.rage ? 1.5 : 1);
    const def = tgt.def * (tgt.st.defUp ? 1.5 : 1) * (tgt.st.defDown ? 0.6 : 1) * (tgt.st.rage ? 0.75 : 1);
    dmg = stat * am * sk.pow * 2 * 60 / (60 + def) * (0.92 + B.rng() * 0.16);
    crit = B.rng() < src.crit + (sk.crit || 0); if (crit) dmg *= 1.6;
  }
  if (weak) dmg *= 1.5; if (res) dmg *= 0.5;
  if (tgt.st.mark) dmg *= 1.3; if (tgt.st.guard) dmg *= 0.5;
  dmg = Math.max(1, Math.round(dmg));
  let abs = 0; if (tgt.st.shield) { abs = Math.min(tgt.st.shield.v, dmg); tgt.st.shield.v -= abs; dmg -= abs; if (tgt.st.shield.v <= 0) delete tgt.st.shield; }
  tgt.hp = Math.max(0, tgt.hp - dmg);
  ev.push({ t: "dmg", u: tgt, src, n: dmg, crit, weak, res, type: sk.type, abs, guard: !!tgt.st.guard });
  if (src.side === "hero") addFlame(B, weak ? 9 : 5, ev); else addFlame(B, 4, ev);
  if (tgt.hp <= 0) ko(B, tgt, ev);
  else if (tgt.boss && !tgt.phase2 && tgt.hp <= tgt.mhp * 0.5) { tgt.phase2 = true; ev.push({ t: "phase", u: tgt, text: FOES[tgt.key].bark2 }); }
}
function heal(B, tgt, n, ev) { if (!tgt.alive) return; n = Math.min(Math.round(n), tgt.mhp - tgt.hp); tgt.hp += n; ev.push({ t: "heal", u: tgt, n }); }
function endTurn(B, u) {
  for (const k in u.st) { const x = u.st[k]; if (x.fresh) { delete x.fresh; continue; } if (k === "guard") continue; if (--x.t <= 0) delete u.st[k]; }
  for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--;
  u.ct = 0; B.cur = null;
}

// Кто ходит следующим. Возвращает { u, ev }
export function advance(B) {
  const ev = [];
  for (let i = 0; i < 300 && !B.over; i++) {
    const live = B.units.filter(u => u.alive); let best = null, bt = Infinity;
    for (const u of live) { const t = (100 - u.ct) / speed(u); if (t < bt - 1e-9) { bt = t; best = u; } }
    for (const u of live) u.ct += speed(u) * bt;
    const u = best; B.turn++; B.cur = u; delete u.st.guard;
    for (const s of ["burn", "bleed"]) if (u.st[s] && u.alive) { const n = u.st[s].v; u.hp = Math.max(0, u.hp - n); ev.push({ t: "tick", u, s, n }); if (u.hp <= 0) ko(B, u, ev); }
    if (!u.alive) { B.cur = null; continue; }
    if (u.regen) heal(B, u, u.mhp * u.regen, ev);
    if (u.st.regen) heal(B, u, u.mhp * 0.08, ev);
    if (u.st.stun) { ev.push({ t: "skip", u }); endTurn(B, u); continue; }
    return { u, ev };
  }
  return { u: null, ev };
}
export function skillTargets(B, u, sk) { return sk.tg === "foe" ? living(B, other(u.side)) : sk.tg === "ally" ? living(B, u.side) : null; }
export function canUse(B, u, id) { const sk = SK[id]; return sk && u.mp >= (sk.mp || 0) && !(u.cd[id] > 0) && !(sk.once && u.used[id]); }

// a: {k:'skill',id,target} | {k:'guard'} | {k:'item',id,target} | {k:'flash'}
export function perform(B, u, a) {
  const ev = []; const foes = () => living(B, other(u.side)), allies = () => living(B, u.side);
  if (a.k === "guard") { u.st.guard = { t: 1 }; if (u.side === "hero") u.mp = Math.min(u.mmp, u.mp + 3 + Math.floor(u.lvl / 2)); ev.push({ t: "use", u, an: "block", name: "Защита" }, { t: "st", u, s: "guard" }); }
  else if (a.k === "flash") {
    const sk = SK.flash; B.flame = 0; ev.push({ t: "use", u, sk, an: sk.an, name: sk.name, flash: true }, { t: "flame", v: 0 });
    for (const t of foes()) hit(B, u, t, sk, ev);
    for (const h of living(B, "hero")) { heal(B, h, h.mhp * 0.25, ev); for (const s in h.st) if (!STATUS[s].good) delete h.st[s]; }
  } else if (a.k === "item") {
    const it = ITEMS[a.id]; B.inv[a.id]--; ev.push({ t: "use", u, an: it.use === "bomb" ? "throw" : "item", name: it.n, item: a.id, target: a.target });
    if (it.use === "heal") heal(B, a.target, a.target.mhp * it.v + 12, ev);
    else if (it.use === "mp") { const n = Math.min(Math.round(a.target.mmp * it.v + 6), a.target.mmp - a.target.mp); a.target.mp += n; ev.push({ t: "mp", u: a.target, n }); }
    else if (it.use === "revive") { const t = a.target; t.alive = true; t.hp = Math.round(t.mhp * it.v); t.ct = 0; t.st = {}; ev.push({ t: "revive", u: t }); }
    else if (it.use === "bomb") for (const t of foes()) hit(B, u, t, { type: "light" }, ev, Math.round(it.v * (1 + 0.14 * (u.lvl - 1))));
  } else {
    const sk = SK[a.id]; u.mp -= sk.mp || 0; if (sk.cd) u.cd[sk.id] = sk.cd + 1; if (sk.once) u.used[sk.id] = 1;
    let tg;
    if (sk.tg === "foe") { tg = [a.target]; if (u.side === "foe") { const t = foes().find(h => h.st.taunt); if (t) tg = [t]; } if (!tg[0] || !tg[0].alive) tg = foes().slice(0, 1); }
    else if (sk.tg === "foes") tg = foes(); else if (sk.tg === "ally") tg = [a.target && a.target.alive ? a.target : u]; else if (sk.tg === "allies") tg = allies(); else if (sk.tg === "self") tg = [u];
    else if (sk.tg === "rand3") { tg = []; for (let i = 0; i < 3; i++) { const f = foes(); if (f.length) tg.push(f[Math.floor(B.rng() * f.length)]); } }
    ev.push({ t: "use", u, sk, an: sk.an, name: sk.name, target: tg[0], tg: tg.slice() });
    for (const t of tg) {
      if (sk.pow && t.alive) hit(B, u, t, sk, ev);
      if (sk.heal) heal(B, t, u.mag * sk.heal * 2 + 8, ev);
      if (sk.ap) addStatus(B, u, t, sk.ap, ev, sk);
      if (B.over) break;
    }
    if (sk.self) for (const s of sk.self) addStatus(B, u, u, s, ev, sk);
    if (sk.steal && !tg[0].stolen) { tg[0].stolen = 1; const g = 6 + u.lvl * 2; B.gold += g; B.stole += g; ev.push({ t: "steal", u, n: g }); }
    if (sk.summon) for (const k of sk.summon) if (living(B, u.side).length < 4) { const s = foeUnit(k, Math.max(1, u.lvl - 1), B.n++, B.mul); s.xp = 0; s.gold = 0; s.ct = 20; s.summoned = true; B.units.push(s); ev.push({ t: "summon", u: s }); }
  }
  if (u.alive) endTurn(B, u); else B.cur = null;
  checkOver(B);
  return ev;
}

// ---------- ИИ врагов ----------
function pick(B, list) { let s = 0; for (const x of list) s += x.w; let r = B.rng() * s; for (const x of list) { r -= x.w; if (r <= 0) return x; } return list[list.length - 1]; }
export function foeChoose(B, u) {
  const F = FOES[u.key], ai = u.phase2 && F.ai2 ? F.ai2 : F.ai, allies = living(B, "foe"), heroes = living(B, "hero"); const opts = [];
  for (const [id, w, cond] of ai) {
    if (!canUse(B, u, id)) continue; const sk = SK[id];
    if (cond === "hurt" && !allies.some(a => a.hp < a.mhp * 0.55)) continue;
    if (cond === "nobuff" && u.st.defUp) continue;
    if ((cond === "few" || sk.summon) && allies.length >= 3) continue;
    opts.push({ id, w });
  }
  if (!opts.length) return { k: "skill", id: ai[0][0], target: heroes[0] };
  const id = pick(B, opts).id, sk = SK[id]; let target = null;
  if (sk.tg === "foe") target = pick(B, heroes.map(h => ({ h, w: 1 + (1 - h.hp / h.mhp) * 1.2 + (h.st.mark ? 0.8 : 0) }))).h;
  if (sk.tg === "ally") target = allies.slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
  return { k: "skill", id, target };
}

// ---------- автобой героев (кнопка «Авто» и симулятор) ----------
function estimate(u, t, sk) {
  if (!sk.pow) return 0;
  const stat = sk.stat === "mag" ? u.mag : u.atk, am = (u.st.atkUp ? 1.3 : 1) * (u.st.atkDown ? 0.7 : 1) * (u.st.rage ? 1.5 : 1);
  let d = stat * am * sk.pow * 2 * 60 / (60 + t.def * (t.st.defUp ? 1.5 : 1) * (t.st.defDown ? 0.6 : 1));
  if (t.weak.includes(sk.type)) d *= 1.5; if (t.resist.includes(sk.type)) d *= 0.5; if (t.st.mark) d *= 1.3; if (t.st.guard) d *= 0.5;
  return Math.min(d * (1 + (u.crit + (sk.crit || 0)) * 0.6), t.hp + (t.st.shield ? t.st.shield.v : 0)) + (d >= t.hp ? 8 : 0);
}
export function autoChoose(B, u, opt = {}) {
  const foes = living(B, "foe"), heroes = living(B, "hero"), inv = B.inv, boss = foes.some(f => f.boss);
  const dead = B.units.find(x => x.side === "hero" && !x.alive);
  const low = heroes.slice().sort((a, b) => a.hp / a.mhp - b.hp / b.mhp)[0];
  if (B.flame >= 100 && (foes.length >= 2 || boss || low.hp < low.mhp * 0.4)) return { k: "flash" };
  if (dead && inv.root > 0 && !opt.noItems) return { k: "item", id: "root", target: dead };
  if (low.hp < low.mhp * 0.38) {
    if (u.skills.includes("r_heal") && canUse(B, u, "r_heal")) return { k: "skill", id: "r_heal", target: low };
    if (inv.potion > 0 && !opt.noItems && (low === u || low.hp < low.mhp * 0.25)) return { k: "item", id: "potion", target: low };
  }
  let best = { k: "skill", id: u.basic, target: foes[0] }, bs = -1;
  const consider = (id) => {
    if (!canUse(B, u, id)) return; const sk = SK[id]; const cost = (sk.mp || 0) * 0.55;
    if (sk.tg === "foe") for (const t of foes) { let s = estimate(u, t, sk) - cost; if (sk.ap && sk.ap.s === "mark") s = t.boss && !t.st.mark ? 26 : -1; else if (sk.ap && !t.st[sk.ap.s]) s += 4; if (s > bs) { bs = s; best = { k: "skill", id, target: t }; } }
    else if (sk.tg === "foes" || sk.tg === "rand3") { let s = -cost; if (sk.pow) for (const t of foes) s += estimate(u, t, sk) * (sk.tg === "rand3" ? 3 / foes.length : 1); else if (sk.ap) s += foes.filter(t => !t.st[sk.ap.s]).length >= 2 || boss && !foes[0].st[sk.ap.s] ? 16 : -5; if (s > bs) { bs = s; best = { k: "skill", id }; } }
    else if (sk.tg === "allies") { const s = heroes.filter(h => !h.st[sk.ap.s]).length >= 2 && (boss || foes.length >= 3) ? 22 - cost : -1; if (s > bs) { bs = s; best = { k: "skill", id }; } }
    else if (sk.tg === "self") { const st = sk.self[0].s; let s = -1; if (st === "taunt") s = !u.st.taunt && heroes.length > 1 && u.hp > u.mhp * 0.5 && (boss || foes.length >= 2) ? 15 : -1; if (st === "rage") s = !u.st.rage && u.hp > u.mhp * 0.6 && boss ? 20 : -1; if (s > bs) { bs = s; best = { k: "skill", id }; } }
    else if (sk.tg === "ally" && sk.ap && sk.ap.s === "shield") { const t = heroes.find(h => h.st.taunt && !h.st.shield) || (low.hp < low.mhp * 0.6 && !low.st.shield ? low : null); if (t && boss && 14 > bs) { bs = 14; best = { k: "skill", id, target: t }; } }
  };
  consider(u.basic); for (const id of u.skills) consider(id);
  if (u.mp < 4 && u.mmp >= 18 && bs < 12 && inv.ether > 0 && boss && !opt.noItems) return { k: "item", id: "ether", target: u };
  return best;
}

// ---------- опыт ----------
export function grantXp(h, xp) { const ups = []; h.xp += xp; while (h.lvl < MAXLVL && h.xp >= xpNeed(h.lvl)) { h.xp -= xpNeed(h.lvl); h.lvl++; ups.push(h.lvl); } return ups; }
