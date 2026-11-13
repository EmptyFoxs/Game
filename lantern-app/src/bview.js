// Бой: 3D-сцена, анимации событий и интерфейс
import { THREE, V3, Actor, foeSpec, buildArena, fitCamera, render } from "./gfx.js";
import { HEROES, SK, FOES, ENC, ITEMS, STATUS, TYPE_IC, TYPES, WHO } from "./data.js";
import { createBattle, advance, perform, foeChoose, autoChoose, living, canUse, grantXp, xpNeed } from "./battle.js";
import { $, G, CFG, saveCfg, sleep, tween, ease, sfx, music, toast, stats, norm } from "./core.js";

export const BV = { active: false, cam: new THREE.PerspectiveCamera(36, 1, 0.1, 200), acts: new Map(), shake: 0 };
const ANIM = { slash: ["1H_Melee_Attack_Slice_Diagonal", .4], chop: ["1H_Melee_Attack_Chop", .45], chop2: ["2H_Melee_Attack_Chop", .5], stab: ["1H_Melee_Attack_Stab", .32], spin: ["2H_Melee_Attack_Spin", .35], cast: ["Spellcast_Shoot", .5],
  raise: ["Spellcast_Raise", .5], block: ["Block", .3], cheer: ["Cheer", .35], throw: ["Throw", .5], item: ["Use_Item", .5], summon: ["Spellcast_Summon", .3], taunt: ["Taunt", .5] };
const COL = { slash: 0xffffff, blunt: 0xffd9a0, pierce: 0xd0e8ff, fire: 0xff7a30, frost: 0x7fd8ff, light: 0xfff0a0, dark: 0xa060ff, heal: 0x7dff9a, buff: 0xffd24d };
const ZS = { 1: [0.3], 2: [-0.8, 1.2], 3: [-1.7, 0.2, 2.0], 4: [-2.3, -0.8, 0.7, 2.2] };
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export function fade(on, ms = 260) { $("fade").style.transition = `opacity ${G.turbo ? 0 : ms}ms`; $("fade").style.opacity = on ? 1 : 0; return sleep(ms); }

function addActor(u, home) {
  const hero = u.side === "hero";
  const fs = hero ? null : foeSpec(u.key); if (fs && u.boss) fs.scale = (fs.scale || 1) * 1.25;
  const a = new Actor(hero ? Object.assign({}, WHO[u.key], HEROES[u.key].two ? { idle: "2H_Melee_Idle" } : {}) : Object.assign(fs, { idle: "Idle_Combat" }));
  a.root.position.copy(home); a.inner.rotation.y = hero ? Math.PI / 2 : -Math.PI / 2; BV.arena.scene.add(a.root);
  const A = { a, home, u, h: 1.75 * (a.scale / 0.72) }; BV.acts.set(u.uid, A);
  if (!hero) { const d = document.createElement("div"); d.className = "flab"; d.dataset.t = u.uid; $("bLabels").appendChild(d); A.label = d; }
  if (!u.alive) a.play("Death_A", { once: true, hold: true, fade: 0 });
  return A;
}
function layout() {
  const portrait = innerWidth < innerHeight * 0.85, k = BV.sx || 1;
  const box = new THREE.Box3(new V3(-4.7 * k, 0, -2.9), new V3(4.9 * k, 3.0, 2.9));
  for (const A of BV.acts.values()) if (A.u.boss) box.max.y = Math.max(box.max.y, A.h + 0.9);
  BV.cam.fov = portrait ? 46 : 36;
  fitCamera(BV.cam, box, portrait ? 1.08 : 0.42, portrait ? 0.46 : 0.4, $("bTop").offsetHeight + (portrait ? 58 : 34), $("bParty").offsetHeight + (portrait ? $("bMenu").offsetHeight + $("bSheet").offsetHeight + 30 : 22), portrait ? 1.02 : 0.9);
  BV.camPos = BV.cam.position.clone();
  if (BV.arena) { const d = BV.camPos.length(), f = BV.arena.scene.fog; f.near = d + 6; f.far = d + 32; }
}
const proj = (p, dy = 0) => { const v = p.clone(); v.y += dy; v.project(BV.cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };

function num(A, text, cls, sub) {
  if (G.turbo || !A) return; const [x, y] = proj(A.a.root.position, A.h * 0.8); const d = document.createElement("div"); d.className = "num " + cls;
  d.style.left = (x + (Math.random() - .5) * 30) + "px"; d.style.top = y + "px"; d.innerHTML = (sub ? `<small>${sub}</small>` : "") + esc(text); $("bLabels").appendChild(d); setTimeout(() => d.remove(), 1100);
}
let bannerT = null;
function banner(text, side) { const b = $("bBanner"); b.textContent = text; b.className = "on " + side; clearTimeout(bannerT); bannerT = setTimeout(() => b.className = "", 1300 / CFG.speed); }

// ---------- интерфейс ----------
function knownHtml(key) { const k = G.S.known[key] || {}; return Object.keys(k).map(t => `<i class="${k[t] > 0 ? "wk" : "rs"}" title="${TYPES[t]}">${TYPE_IC[t]}</i>`).join(""); }
function updateBars() {
  const B = BV.B; if (!B) return;
  $("bParty").innerHTML = B.units.filter(u => u.side === "hero").map(u => `<div class="hc${u === BV.cur ? " cur" : ""}${u.alive ? "" : " ko"}" data-t="${u.uid}" style="--c:${HEROES[u.key].color}">
    <img src="${G.port[u.key]}" alt=""><b>${u.name}</b><div class="bar hp"><i style="width:${u.hp / u.mhp * 100}%"></i><span>${u.hp}</span></div><div class="bar mp"><i style="width:${u.mp / u.mmp * 100}%"></i><span>${u.mp}</span></div>
    <div class="sts">${Object.keys(u.st).map(s => STATUS[s].ic).join("")}</div></div>`).join("");
  for (const A of BV.acts.values()) if (A.label && !A.gone) { const u = A.u; A.label.innerHTML = `<b>${esc(u.name)}</b><div class="bar hp"><i style="width:${u.hp / u.mhp * 100}%"></i></div><div class="sts">${knownHtml(u.key)}${Object.keys(u.st).map(s => STATUS[s].ic).join("")}</div>`; A.label.style.display = u.alive ? "" : "none"; }
  const f = $("bFlame"); f.firstElementChild.style.width = B.flame + "%"; f.classList.toggle("full", B.flame >= 100);
  // очередь ходов
  const sim = B.units.filter(u => u.alive).map(u => ({ u, ct: u.ct, sp: u.spd * (u.st.chill ? 0.7 : 1) })), ord = [];
  for (let i = 0; i < 7 && sim.length; i++) { let b = null, bt = 1e9; for (const s of sim) { const t = (100 - s.ct) / s.sp; if (t < bt) { bt = t; b = s; } } for (const s of sim) s.ct += s.sp * bt; b.ct = 0; ord.push(b.u); }
  $("bOrder").innerHTML = (BV.cur ? [BV.cur] : []).concat(ord).slice(0, 7).map((u, i) => u.side === "hero" ? `<img class="${i ? "" : "now"}" src="${G.port[u.key]}" style="border-color:${HEROES[u.key].color}">` : `<span class="${i ? "" : "now"}${u.boss ? " boss" : ""}">💀</span>`).join("");
}
function showMain(u) {
  const B = BV.B; BV.pick = null; $("bSheet").innerHTML = "";
  $("bMenu").innerHTML = `<button data-a="atk"><i>⚔️</i>Атака</button><button data-a="sk"><i>✨</i>Умения</button><button data-a="guard"><i>🛡</i>Защита</button><button data-a="item"><i>🎒</i>Сумка</button>` + (B.flame >= 100 ? `<button data-a="flash" class="hot"><i>🔥</i>Вспышка</button>` : "");
  layout();
}
function sheet(html) { $("bSheet").innerHTML = html + `<button class="back" data-a="back">‹ Назад</button>`; layout(); }
function pickTarget(action, list, title) {
  if (list.length === 1 && list[0].side === "foe") return BV.resolve(Object.assign(action, { target: list[0] }));
  BV.pick = { action, list };
  sheet(`<div class="hint">${title}</div>` + list.map(t => `<button class="tg" data-t="${t.uid}"><b>${esc(t.name)}</b><span class="bar hp"><i style="width:${t.hp / t.mhp * 100}%"></i></span><span class="sts">${t.side === "foe" ? knownHtml(t.key) : t.hp + "/" + t.mhp}</span></button>`).join(""));
}
function onUi(e) {
  const b = e.target.closest("[data-a],[data-s],[data-i],[data-t]"); if (!b || !BV.resolve || !BV.cur) return; const B = BV.B, u = BV.cur; sfx("click");
  if (b.dataset.t) { if (!BV.pick) return; const t = BV.pick.list.find(x => x.uid === b.dataset.t); if (t) BV.resolve(Object.assign(BV.pick.action, { target: t })); return; }
  if (b.dataset.s) { const id = b.dataset.s, sk = SK[id]; if (!canUse(B, u, id)) return; const act = { k: "skill", id };
    if (sk.tg === "foe") pickTarget(act, living(B, "foe"), `${sk.name}: выбери цель`); else if (sk.tg === "ally") pickTarget(act, living(B, "hero"), `${sk.name}: кому?`); else BV.resolve(act); return; }
  if (b.dataset.i) { const id = b.dataset.i, it = ITEMS[id], act = { k: "item", id };
    if (it.use === "bomb") return BV.resolve(act);
    const list = it.use === "revive" ? B.units.filter(x => x.side === "hero" && !x.alive) : living(B, "hero"); if (!list.length) return toast("Сейчас это не нужно"); pickTarget(act, list, `${it.n}: кому?`); return; }
  const a = b.dataset.a;
  if (a === "back") showMain(u);
  else if (a === "atk") pickTarget({ k: "skill", id: u.basic }, living(B, "foe"), "Атака: выбери цель");
  else if (a === "guard") BV.resolve({ k: "guard" }); else if (a === "flash") BV.resolve({ k: "flash" });
  else if (a === "sk") sheet(u.skills.map(id => { const s = SK[id]; return `<button class="sk" data-s="${id}" ${canUse(B, u, id) ? "" : "disabled"}><b>${s.type ? TYPE_IC[s.type] + " " : ""}${s.name}</b><em>${s.mp} дух</em><small>${s.d}</small></button>`; }).join("") || `<div class="hint">Умений пока нет</div>`);
  else if (a === "item") { const ids = ["potion", "ether", "root", "water"].filter(id => B.inv[id] > 0); sheet(ids.map(id => `<button class="sk" data-i="${id}"><b>${ITEMS[id].n}</b><em>×${B.inv[id]}</em><small>${ITEMS[id].d}</small></button>`).join("") || `<div class="hint">Сумка пуста</div>`); }
}
function playerChoose(u) { return new Promise(res => { BV.resolve = a => { BV.resolve = null; BV.pick = null; $("bMenu").innerHTML = ""; $("bSheet").innerHTML = ""; res(a); }; showMain(u); }); }
export function initBattleUi() {
  $("bBottom").addEventListener("click", onUi); $("bLabels").addEventListener("click", onUi);
  $("bAuto").onclick = () => { CFG.auto = !CFG.auto; saveCfg(); $("bAuto").classList.toggle("on", CFG.auto); if (CFG.auto && BV.resolve && BV.cur) BV.resolve(autoChoose(BV.B, BV.cur)); };
  $("bSpeed").onclick = () => { CFG.speed = CFG.speed >= 3 ? 1 : CFG.speed + 1; saveCfg(); $("bSpeed").textContent = "×" + CFG.speed; };
}

// ---------- проигрывание событий ----------
function hitFx(A, type, crit) {
  const fx = BV.arena.fx, p = A.a.root.position.clone(); p.y += A.h * 0.55; const c = COL[type] || 0xffffff;
  if (type === "slash") fx.arc(p, c, Math.random() * 2); else if (type === "blunt") { fx.burst(p, c, 8, { spd: 3.5, life: 0.35, size: 0.35 }); fx.ring(A.a.root.position.clone().setY(0.1), c, 1.5, 0.35); }
  else if (type === "pierce") { fx.burst(p, c, 6, { spd: 5, life: 0.25, size: 0.2 }); fx.flash(p, c, 1.6); }
  else if (type === "fire") { fx.burst(p, c, 16, { spd: 2.5, up: 1.5, grav: -1, life: 0.7, size: 0.45 }); fx.flash(p, c, 3.5); }
  else if (type === "frost") { fx.burst(p, c, 14, { spd: 3, life: 0.6, size: 0.3 }); fx.ring(A.a.root.position.clone().setY(0.1), c, 1.8); }
  else if (type === "light") { fx.beam(A.a.root.position.clone(), c, 6, 0.55); fx.burst(p, c, 10, { spd: 2, up: 2, grav: -2, life: 0.7 }); }
  else if (type === "dark") { fx.burst(p, c, 14, { spd: 2.5, life: 0.7, size: 0.4, down: 1 }); fx.flash(p, c, 3); }
  if (crit) fx.flash(p, 0xffffff, 4);
}
async function showEv(e) {
  const A = e.u && BV.acts.get(e.u.uid), fx = BV.arena.fx, pos = A ? A.a.root.position.clone() : new V3();
  switch (e.t) {
    case "dmg": { if (!A) break; A.a.flash(e.weak ? 0xffe060 : 0xffffff); hitFx(A, e.type, e.crit); sfx(e.crit ? "crit" : e.type || "slash"); if (e.weak) sfx("weak");
      num(A, e.n, A.u.side === "hero" ? "hurt" : e.crit ? "crit" : "dmg", e.weak ? "Слабость!" : e.res ? "Стойкость" : e.crit ? "Крит!" : e.guard ? "Блок" : e.abs ? "Барьер" : "");
      if (e.u.alive) A.a.play(e.guard ? "Block" : "Hit_A", { once: true, fade: 0.05, speed: 1.4 });
      if (e.u.side === "foe" && (e.weak || e.res) && e.type) { const k = G.S.known[e.u.key] || (G.S.known[e.u.key] = {}); k[e.type] = e.weak ? 1 : -1; }
      BV.shake = Math.max(BV.shake, e.crit ? 0.3 : 0.14); updateBars(); await sleep(150); break; }
    case "heal": if (e.n > 0) { fx.burst(pos.setY(0.4), COL.heal, 10, { up: 1.6, grav: -1.5, spd: 1.2, life: 0.8 }); sfx("heal"); num(A, "+" + e.n, "heal"); updateBars(); await sleep(140); } break;
    case "mp": num(A, "+" + e.n + " дух", "mp"); sfx("buff"); updateBars(); await sleep(140); break;
    case "st": { const s = STATUS[e.s]; num(A, s.ic + " " + s.n, s.good ? "buff" : "debuff"); fx.ring(pos.setY(0.1), s.good ? COL.buff : 0xb060ff, 1.4); sfx(s.good ? "buff" : "debuff"); updateBars(); await sleep(110); break; }
    case "tick": num(A, e.n, A.u.side === "hero" ? "hurt" : "dmg", STATUS[e.s].ic); A.a.flash(0xff6030); sfx("fire"); updateBars(); await sleep(260); break;
    case "skip": num(A, "💫 пропуск хода", "debuff"); await sleep(420); break;
    case "ko": { sfx("ko"); if (e.u.side === "foe") { A.a.play("Death_C_Skeletons", { once: true, hold: true, fade: 0.05, speed: 1.3 }); fx.burst(pos.setY(1), 0xcfd8ff, 14, { spd: 2.5 }); tween(1000, k => A.a.setFade(1 - Math.max(0, k - 0.5) * 2)).then(() => { A.gone = true; A.a.root.visible = false; }); if (A.label) A.label.style.display = "none"; }
      else A.a.play("Death_A", { once: true, hold: true, fade: 0.05 }); updateBars(); await sleep(380); break; }
    case "revive": A.a.play(A.a.idle, { fade: 0.3 }); fx.beam(pos, COL.heal); sfx("heal"); num(A, "Встаёт!", "heal"); updateBars(); await sleep(400); break;
    case "summon": { const used = new Set(); for (const X of BV.acts.values()) if (X.u.side === "foe" && X.u.alive && !X.gone) used.add(X.home.z); const z = ZS[4].find(v => !used.has(v)) ?? 0; const S = addActor(e.u, new V3(4.1 * (BV.sx || 1), 0, z));
      S.a.play("Skeletons_Awaken_Floor", { once: true, fade: 0, speed: 1.6 }); fx.burst(S.home.clone().setY(0.3), COL.dark, 16, { spd: 2, up: 1 }); fx.ring(S.home.clone().setY(0.1), COL.dark, 2); sfx("summon"); updateBars(); await sleep(650); break; }
    case "phase": banner(e.text || "…", "boss"); BV.shake = 0.5; fx.ring(pos.setY(0.1), 0xff3050, 3.5, 0.9); A.a.flash(0xff3050, 0.8); A.a.play("Taunt", { once: true }); sfx("dkn"); await sleep(1100); break;
    case "flame": updateBars(); break;
    case "steal": num(A, "+" + e.n + " 💰", "buff"); break;
  }
}
async function playUse(e, res) {
  const A = BV.acts.get(e.u.uid), a = A.a, sk = e.sk, dir = e.u.side === "hero" ? 1 : -1, fx = BV.arena.fx; banner(`${e.u.name} · ${e.name}`, e.u.side);
  const [clip, at] = ANIM[e.an] || ANIM.slash, single = e.tg && e.tg.length === 1 && BV.acts.get(e.tg[0].uid);
  const melee = sk && sk.pow && !sk.ranged && sk.stat !== "mag" && !["cast", "raise", "throw"].includes(e.an);
  let spot = null;
  if (e.flash) { sfx("flame"); fx.flash(new V3(0, 2, 0), 0xfff0a0, 18); BV.shake = 0.4; }
  if (melee) { spot = single ? single.home.clone().add(new V3(-dir * (1.2 + single.h * 0.25), 0, 0.05)) : new V3(dir * 0.6, 0, A.home.z * 0.3); a.play("Running_A", { speed: 1.6, fade: 0.08 }); await tween(210, k => a.root.position.lerpVectors(A.home, spot, ease(k))); }
  const dur = a.play(clip, { once: true, speed: 1.4, fade: 0.08 }) * 1000; await sleep(dur * at);
  if (sk && sk.pow && !melee && single && !G.turbo) { const from = a.root.position.clone().add(new V3(dir * 0.6, 1.3, 0)), to = single.a.root.position.clone().add(new V3(0, single.h * 0.55, 0)); await new Promise(r => fx.orb(from, to, COL[sk.type] || 0xffffff, 0.2 / CFG.speed, r)); }
  if (e.item === "water") fx.flash(new V3(3, 1.5, 0), 0xfff0a0, 10);
  if (sk && sk.fx === "smoke") for (const t of e.tg) { const T = BV.acts.get(t.uid); T && fx.burst(T.a.root.position.clone().setY(0.8), 0x9a9a9a, 10, { spd: 1.2, grav: -0.5, life: 1, size: 0.7 }); }
  for (const r of res) await showEv(r);
  await sleep(Math.max(140, dur * (1 - at) * 0.45));
  if (melee) { if (e.u.alive) a.play("Running_A", { speed: 1.6, fade: 0.08 }); await tween(190, k => a.root.position.lerpVectors(spot, A.home, ease(k))); a.root.position.copy(A.home); }
  if (e.u.alive) a.play(a.idle, { fade: 0.2 });
}
async function playEvents(evs) { let i = 0; while (i < evs.length) { const e = evs[i]; if (e.t === "use") { let j = i + 1; while (j < evs.length && evs[j].t !== "use") j++; await playUse(e, evs.slice(i + 1, j)); i = j; } else { await showEv(e); i++; } } updateBars(); }

function panel(html) { return new Promise(res => { const m = $("bResult"); m.innerHTML = `<div class="card">${html}</div>`; m.classList.add("on"); m.onclick = e => { const b = e.target.closest("[data-r]"); if (b) { sfx("click"); m.classList.remove("on"); res(b.dataset.r); } }; if (G.turbo) { m.classList.remove("on"); res(G.dbgDefeat || "ok"); } }); }

export async function startBattle(encId, opt = {}) {
  const S = G.S, e = ENC[encId], prev = G.mode;
  for (;;) {
    sfx("encounter"); await fade(1, 200); G.mode = "battle"; BV.active = true; BV.acts.clear(); $("bLabels").innerHTML = ""; $("battle").classList.add("on"); $("bAuto").classList.toggle("on", CFG.auto); $("bSpeed").textContent = "×" + CFG.speed;
    BV.arena = buildArena(e.bg); music(e.boss ? "boss" : "battle");
    const inv0 = JSON.stringify(S.inv), mul = Math.max(0.5, 1 - 0.12 * (S.losses[encId] || 0)) * (CFG.easy ? 0.8 : 1);
    for (const id of S.party) { const h = norm(id); if (h.hp <= 0) h.hp = 1; }
    const B = BV.B = createBattle({ party: S.party.map(id => { const h = S.heroes[id]; return { id, lvl: h.lvl, hp: h.hp, mp: h.mp, eq: h.eq }; }), foes: e.foes, lvl: e.lvl, seed: (Math.random() * 1e9) | 0, flame: S.flame, inv: S.inv, mul });
    const hs = B.units.filter(u => u.side === "hero"), fs = B.units.filter(u => u.side === "foe");
    BV.sx = innerWidth < innerHeight * 0.85 ? 0.8 : 1;
    hs.forEach((u, i) => addActor(u, new V3((-3.1 - (i % 2) * 0.9) * BV.sx, 0, ZS[hs.length][i])));
    fs.forEach((u, i) => addActor(u, new V3((3.1 + (i % 2) * 0.9 + (u.boss ? 0.3 : 0)) * BV.sx, 0, ZS[fs.length][i])));
    BV.cur = null; $("bMenu").innerHTML = ""; $("bSheet").innerHTML = ""; updateBars(); layout(); await fade(0, 250);
    if (mul < 1 && !G.turbo) toast(`Упрямство: враги слабее на ${Math.round((1 - mul) * 100)}%`);
    while (!B.over) {
      const { u, ev } = advance(B); await playEvents(ev); if (!u || B.over) break;
      BV.cur = u; updateBars(); let a;
      if (u.side === "foe") { await sleep(260); a = foeChoose(B, u); } else a = (CFG.auto || G.turbo) ? (await sleep(200), autoChoose(B, u)) : await playerChoose(u);
      await playEvents(perform(B, u, a)); BV.cur = null;
    }
    $("bMenu").innerHTML = ""; $("bSheet").innerHTML = ""; let out;
    if (B.over === "win") {
      sfx("win"); for (const A of BV.acts.values()) if (A.u.side === "hero" && A.u.alive) A.a.play("Cheer", { fade: 0.2 }); await sleep(700);
      const ups = [];
      for (const id of S.party) { const h = S.heroes[id], u = B.units.find(x => x.uid === id); h.hp = Math.max(1, u.hp); h.mp = u.mp; const before = h.lvl; if (grantXp(h, B.xp).length) { const st = stats(id); h.hp = st.mhp; h.mp = st.mmp; ups.push(`<div class="up"><img src="${G.port[id]}"><span><b>${HEROES[id].name}</b> — уровень ${h.lvl}` + HEROES[id].skills.filter(([l]) => l > before && l <= h.lvl).map(([, s]) => `<br>Новое умение: <b>${SK[s].name}</b>`).join("") + `</span></div>`); } }
      S.gold += B.gold; S.flame = B.flame; S.losses[encId] = 0; if (ups.length) sfx("level");
      await panel(`<h3>Победа</h3><div class="row"><span>Опыт</span><b>+${B.xp}</b></div><div class="row"><span>Медяки</span><b>+${B.gold} 💰</b></div>${ups.join("")}<button class="btn main" data-r="ok">Дальше</button>`); out = "win";
    } else {
      sfx("lose"); S.inv = JSON.parse(inv0); S.losses[encId] = (S.losses[encId] || 0) + 1; await sleep(500);
      out = await panel(`<h3>Отряд пал</h3><p>Но фонарщики упрямы. В следующей попытке враги в этом бою будут слабее на ${Math.min(50, 12 * S.losses[encId])}%.</p><button class="btn main" data-r="retry">Ещё раз</button>` + (opt.script ? "" : `<button class="btn" data-r="retreat">Отступить к фонарю</button>`));
      if (out !== "retreat") out = "retry"; if (opt.script) out = "retry";
    }
    await fade(1, 200); BV.active = false; BV.B = null; $("battle").classList.remove("on"); $("bLabels").innerHTML = ""; BV.arena.fx.clear(); BV.arena = null; G.mode = prev;
    if (out === "retry") continue;
    return out;
  }
}
export function battleFrame(dt, t) {
  if (!BV.active || !BV.arena) return false;
  BV.arena.update(dt, t); for (const A of BV.acts.values()) if (!A.gone) A.a.update(dt);
  if (BV.camPos) { BV.shake = Math.max(0, BV.shake - dt * 1.4); BV.cam.position.copy(BV.camPos).add(new V3((Math.random() - .5) * BV.shake, (Math.random() - .5) * BV.shake, 0)); }
  const placed = [];
  for (const A of [...BV.acts.values()].filter(A => A.label && !A.gone).sort((p, q) => q.home.z - p.home.z || p.home.x - q.home.x)) { let [x, y] = proj(A.home, A.h + 0.25);
    for (let n = 0; n < 6 && placed.some(p => Math.abs(p[0] - x) < 96 && Math.abs(p[1] - y) < 42); n++) y -= 42;
    placed.push([x, y]); A.label.style.left = x + "px"; A.label.style.top = y + "px"; A.label.classList.toggle("pick", !!(BV.pick && BV.pick.list.includes(A.u))); A.label.classList.toggle("cur", BV.cur === A.u); }
  render(BV.arena.scene, BV.cam); return true;
}
export const relayout = () => { if (BV.active) layout(); };
