// Баланс-симулятор кампании и проверка данных
import { HEROES, SK, FOES, ENC, CAMPAIGN, ITEMS, MAPS, DLG, WHO, TABLETS, SHOP } from "../src/data.js";
import { createBattle, advance, perform, foeChoose, autoChoose, grantXp, xpNeed, heroStats } from "../src/battle.js";

const N = +(process.argv[2] || 300);
if (process.env.T) { const [hp, atk, spd, boss] = process.env.T.split(",").map(Number); globalThis.__tune = { hp, atk, spd, boss }; }
const brief = !!process.env.T;
const order = ["ren", "velena", "soroka", "bjorn"];
const heroes = Object.fromEntries(order.map(id => [id, { id, lvl: 1, xp: 0, eq: { w: HEROES[id].w } }]));
heroes.ren.eq.a = "a_1";
const GEAR = { c1_2: h => { h.soroka.eq.c = "c_atk"; }, boss1: h => { h.ren.eq.a = "a_3"; h.velena.eq.w = "w_v2"; h.ren.eq.w = "w_r2"; h.velena.eq.c = "c_hp"; h.soroka.eq.a = "a_1"; }, c2_4: h => { h.bjorn.eq.a = "a_2"; }, ulf: h => { h.bjorn.eq.w = "w_b3"; },
  boss2: h => { h.soroka.eq.w = "w_s3"; h.velena.eq.a = "a_4"; }, c3_4: h => { h.ren.eq.c = "c_hp"; h.velena.eq.c = "c_mag"; }, boss3: h => { h.velena.eq.w = "w_v3"; h.soroka.eq.a = "a_5"; }, c4_1: h => { h.ren.eq.w = "w_r3"; } };

export function runBattle(party, encId, seed, inv, mul = 1) {
  const e = ENC[encId];
  const B = createBattle({ party: party.map(h => ({ id: h.id, lvl: h.lvl, eq: h.eq })), foes: e.foes, lvl: e.lvl, seed, inv: Object.assign({}, inv), mul });
  let acts = 0;
  while (!B.over && acts < 400) { const { u } = advance(B); if (!u) break; perform(B, u, u.side === "hero" ? autoChoose(B, u) : foeChoose(B, u)); acts++; }
  const hs = B.units.filter(u => u.side === "hero");
  return { win: B.over === "win", acts, hp: hs.reduce((a, u) => a + u.hp / u.mhp, 0) / hs.length, dead: hs.filter(u => !u.alive).length, xp: B.xp, gold: B.gold, pot: (inv.potion || 0) - (B.inv.potion || 0) };
}
let gold = 0, warn = [];
console.log("бой        ур.врага  отряд(ур)  побед%  ходов  ост.HP%  павших  зелий");
for (const [id, size] of CAMPAIGN) {
  const party = order.slice(0, size).map(k => heroes[k]);
  for (const h of party) if (h.lvl < heroes.ren.lvl) { h.lvl = heroes.ren.lvl; h.xp = heroes.ren.xp; }
  const e = ENC[id], inv = e.boss ? { potion: 4, ether: 2, root: 1 } : { potion: 1 };
  let w = 0, acts = 0, hp = 0, dead = 0, pot = 0, xp = 0, g = 0;
  for (let s = 1; s <= N; s++) { const r = runBattle(party, id, s * 7919 + id.length, inv); w += r.win; acts += r.acts; hp += r.win ? r.hp : 0; dead += r.dead; pot += r.pot; if (r.win) { xp = r.xp; g = r.gold; } }
  const wr = w / N * 100;
  console.log(id.padEnd(10), String(e.lvl).padStart(5), "    ", party.map(h => h.lvl).join(","), "  ", wr.toFixed(0).padStart(5), (acts / N).toFixed(0).padStart(6), (hp / Math.max(1, w) * 100).toFixed(0).padStart(7), (dead / N).toFixed(2).padStart(7), (pot / N).toFixed(1).padStart(6), e.boss ? " БОСС" : "");
  if (!e.boss && wr < 96) warn.push(`${id}: обычный бой слишком тяжёлый (${wr.toFixed(0)}%)`);
  if (e.boss && (wr < 75 || wr > 99.7)) warn.push(`${id}: босс вне коридора 75–99% (${wr.toFixed(0)}%)`);
  for (const h of party) grantXp(h, xp);
  gold += g; if (GEAR[id]) GEAR[id](heroes);
}
console.log("уровни в конце:", order.map(k => heroes[k].lvl).join(","), "золото с боёв:", gold, "| xpNeed:", [1, 3, 5, 8, 10].map(l => l + "→" + xpNeed(l)).join(" "));

// ---------- проверка данных ----------
const err = [];
for (const [id, e] of Object.entries(ENC)) for (const f of e.foes) if (!FOES[f]) err.push(`ENC ${id}: нет врага ${f}`);
for (const [k, f] of Object.entries(FOES)) { for (const a of [...f.ai, ...(f.ai2 || [])]) if (!SK[a[0]]) err.push(`FOE ${k}: нет умения ${a[0]}`); for (const s of Object.values(SK)) if (s.summon) for (const x of s.summon) if (!FOES[x]) err.push(`нет призываемого ${x}`); }
for (const [k, h] of Object.entries(HEROES)) { for (const [, s] of h.skills) if (!SK[s]) err.push(`HERO ${k}: нет умения ${s}`); if (!SK[h.basic] || !ITEMS[h.w]) err.push(`HERO ${k}: basic/weapon`); }
for (const [it] of [...SHOP({ boss1: 1, boss2: 1, boss3: 1 })]) if (!ITEMS[it]) err.push(`SHOP: нет предмета ${it}`);
const walk = ch => ch !== "#" && ch !== " " && !"poxru+gyafl=".includes(ch);
const dlgRefs = new Set(["intro", "end_true", "end_choice", "ulf_dead"]);
function scanDlg(id, arr) { for (const x of arr) { if (Array.isArray(x)) { if (x[0] && !WHO[x[0]]) err.push(`DLG ${id}: нет говорящего ${x[0]}`); continue; }
  if (x.goto && !DLG[x.goto]) err.push(`DLG ${id}: goto ${x.goto}`); if (x.battle && !ENC[x.battle]) err.push(`DLG ${id}: battle ${x.battle}`); if (x.give) for (const k in x.give) if (!ITEMS[k]) err.push(`DLG ${id}: give ${k}`);
  if (x.tablet && !TABLETS[x.tablet]) err.push(`DLG ${id}: tablet`); if (x.join && !HEROES[x.join]) err.push(`DLG ${id}: join`); if (x.ch) for (const c of x.ch) scanDlg(id, c[1]); if (x.then) scanDlg(id, x.then); if (x.else) scanDlg(id, x.else); } }
for (const [id, d] of Object.entries(DLG)) scanDlg(id, d);
const tabs = new Set(); const scanTab = arr => { for (const x of arr) if (!Array.isArray(x)) { if (x.tablet) tabs.add(x.tablet); if (x.ch) x.ch.forEach(c => scanTab(c[1])); if (x.then) scanTab(x.then); if (x.else) scanTab(x.else); } }; Object.values(DLG).forEach(scanTab);
const flagSets = [{}, { prologue: 1, marta: 1, boss1: 1, tab1: 1, gate1: 1, soroka_seen: 1, galen_found: 1, boss3: 1, agnia_done: 1 }, { boss1: 1 }, { tab1: 1 }, { galen_found: 1 }, { amu: 1 }];
for (const [mid, m] of Object.entries(MAPS)) {
  const W = m.rows[0].length, Hh = m.rows.length; let start = null; const seen = {};
  m.rows.forEach((r, z) => { if (r.length !== W) err.push(`MAP ${mid}: строка ${z} длиной ${r.length}, нужно ${W}`);
    [...r].forEach((ch, x) => { if (ch === "@") start = [x, z]; if (/[0-9A-Z]/.test(ch)) { if (!m.o[ch]) err.push(`MAP ${mid}: нет объекта «${ch}» в словаре`); if (seen[ch]) err.push(`MAP ${mid}: объект «${ch}» дважды`); seen[ch] = [x, z]; }
      if ("tbk".includes(ch) && (z === 0 || m.rows[z - 1][x] !== "#")) err.push(`MAP ${mid}: «${ch}» в ${x},${z} без стены с севера`);
      if (!"#., ~@tbkcspoxru+gyafl=".includes(ch) && !/[0-9A-Z]/.test(ch)) err.push(`MAP ${mid}: неизвестный символ «${ch}»`); }); });
  for (const k in m.o) { const o = m.o[k]; if (!seen[k]) err.push(`MAP ${mid}: объект «${k}» не стоит на карте`);
    if (o.t === "exit" && (!MAPS[o.to] || !MAPS[o.to].o[o.at])) err.push(`MAP ${mid}: выход ${k} ведёт в никуда`); if (o.t === "enemy" && (!ENC[o.enc] || !FOES[o.foe])) err.push(`MAP ${mid}: враг ${k}`);
    if (o.t === "npc") { if (!WHO[o.who]) err.push(`MAP ${mid}: npc ${k}`); for (const f of flagSets) { const d = o.talk(Object.assign({ s: { inv: f.amu ? { amulet: 1 } : {}, tab: [] } }, f)); if (!DLG[d]) err.push(`MAP ${mid}: npc ${k} → нет диалога ${d}`); dlgRefs.add(d); } }
    for (const d of [o.dlg, o.pre, o.post]) if (d) { if (!DLG[d]) err.push(`MAP ${mid}: нет диалога ${d}`); dlgRefs.add(d); } if (o.t === "tablet") tabs.add(o.n);
    if (o.loot) for (const it in o.loot) if (!ITEMS[it]) err.push(`MAP ${mid}: сундук ${k}: ${it}`); }
  if (m.enter) dlgRefs.add(m.enter);
  if (!start) { err.push(`MAP ${mid}: нет старта`); continue; }
  // достижимость (решётки считаем открываемыми)
  const q = [start], vis = new Set([start.join()]);
  while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= Hh) continue; const ch = m.rows[nz][nx];
    const o = m.o[ch]; const pass = walk(ch) && !(o && (o.t === "set")); if (!pass || vis.has(nx + "," + nz)) continue; vis.add(nx + "," + nz); if (o && ["npc", "chest", "lantern", "altar", "tablet", "exit", "enemy"].includes(o.t) && o.t !== "enemy" ) { if (o.t !== "exit") continue; else continue; } q.push([nx, nz]); } }
  for (const k in seen) { const o = m.o[k]; if (!o || o.t === "set") continue; const [x, z] = seen[k]; const ok = vis.has(x + "," + z) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => vis.has((x + dx) + "," + (z + dz))); if (!ok) err.push(`MAP ${mid}: объект «${k}» недостижим`); }
}
for (let i = 1; i < TABLETS.length; i++) if (!tabs.has(i)) err.push(`табличка ${i} нигде не выдаётся`);
for (const id in DLG) if (!dlgRefs.has(id) && ![...Object.values(DLG)].some(d => JSON.stringify(d).includes(`"goto":"${id}"`))) err.push(`диалог ${id} не используется`);
if (!brief) console.log(err.length ? "ОШИБКИ ДАННЫХ:\n " + err.join("\n ") : "данные: ошибок нет");
if (!brief) console.log(warn.length ? "БАЛАНС:\n " + warn.join("\n ") : "баланс: в коридоре");
