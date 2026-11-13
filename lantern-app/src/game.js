// «Последний фонарь» — мир, сюжетные сценарии, интерфейс, главный цикл
import { THREE, V3, CS, Q, initRenderer, resize as gResize, render, loadAssets, Actor, makePortraits, buildLevel, bloom, renderer } from "./gfx.js";
import { HEROES, SK, ITEMS, SHOP, TABLETS, TAB_TOTAL, MAPS, LANTERNS, DLG, ENDINGS, WHO, FOES, objective, epilogue } from "./data.js";
import { heroSkills, xpNeed } from "./battle.js";
import { $, G, CFG, saveCfg, sleep, tween, tickTweens, newState, fl, stats, norm, fullHeal, addItem, join, addTablet, tabText, save, loadSave, toast, initAudio, sfx, music } from "./core.js";
import { startBattle, battleFrame, initBattleUi, fade, relayout } from "./bview.js";

let L = null, P = null, followers = [], trail = [], lamp = null, pool = [], nearObj = null, poolT = 0;
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 300), camT = new V3(), pl = { x: 0, z: 0, y: 0 }, joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, keys = {};
const ABORT = { abort: 1 };
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function saveGame() { if (!G.S || G.mode === "title" || G.mode === "ending") return; G.S.pos = [pl.x, pl.z]; save(); }

// ---------- карта и отряд ----------
function buildParty() {
  const S = G.S; for (const a of [P, ...followers]) if (a) a.root.removeFromParent();
  P = new Actor(WHO.ren); L.scene.add(P.root); followers = S.party.slice(1).map((id, i) => { const a = new Actor(Object.assign({}, WHO[id], HEROES[id].two ? { idle: "2H_Melee_Idle" } : {})); const c = [[[-1.1, 0.7], [1.1, 0.7], [0, 1.5]][i], [0, -0.9 * (i + 1)], [0, 0.9 * (i + 1)], [0.9 * (i + 1), 0], [-0.9 * (i + 1), 0], [0, 0]].find(([x, z]) => !blocked(pl.x + x, pl.z + z)) || [0, 0]; a.root.position.set(pl.x + c[0], 0, pl.z + c[1]); L.scene.add(a.root); a.pid = id; return a; });
  P.root.position.set(pl.x, 0, pl.z);
}
function syncParty() { if (L && P && followers.length !== G.S.party.length - 1) buildParty(); }
async function loadMap(mapId, atKey, pos) {
  G.S.map = mapId; L = buildLevel(mapId, { f: fl });
  const o = atKey && L.objs.find(x => x.key === atKey);
  if (pos) { pl.x = pos[0]; pl.z = pos[1]; } else if (o) { pl.x = (o.x + o.near[0]) * CS; pl.z = (o.z + o.near[1]) * CS; } else { pl.x = L.start[0] * CS; pl.z = L.start[1] * CS; }
  trail = []; P = null; followers = []; buildParty();
  lamp = new THREE.PointLight(L.theme.lamp, 26, 20, 1.6); L.scene.add(lamp);
  pool = [0, 1, 2].map(() => { const p = new THREE.PointLight(0xffffff, 0, 14, 2); L.scene.add(p); return p; }); poolT = 0;
  camT.set(pl.x, 0, pl.z); music(MAPS[mapId].music); updateHud();
}
async function travel(mapId, atKey) {
  await fade(1); await loadMap(mapId, atKey); await fade(0);
  const m = MAPS[mapId]; toast(`<b>${m.name}</b>`, 1800);
  if (m.enter && !G.S.flags["in_" + mapId]) { G.S.flags["in_" + mapId] = 1; await runScript(m.enter); }
  saveGame();
}
function blocked(x, z) { const r = 0.4; for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (L.solid(Math.round((x + dx) / CS), Math.round((z + dz) / CS))) return true; return false; }
function actLabel(o) { const t = o.def.t; return t === "npc" ? "Говорить" : t === "chest" ? (o.done ? null : "Открыть") : t === "lantern" ? "Отдохнуть" : t === "altar" ? (o.done ? null : "Зажечь") : t === "tablet" ? (o.done ? null : "Прочесть") : t === "exit" ? o.def.label : t === "gate" ? "Осмотреть" : null; }

function worldUpdate(dt) {
  const S = G.S; S.time += dt;
  let ix = joy.x + (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), iz = joy.y + (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  let len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; len = 1; }
  const moving = len > 0.18 && !G.busy, wade = L.water(Math.round(pl.x / CS), Math.round(pl.z / CS));
  if (moving) {
    const sp = 5.6 * (wade ? 0.82 : 1) * Math.min(1, len * 1.2), nx = pl.x + ix / len * sp * dt * len, nz = pl.z + iz / len * sp * dt * len;
    if (!blocked(nx, pl.z)) pl.x = nx; if (!blocked(pl.x, nz)) pl.z = nz;
    P.inner.rotation.y = Math.atan2(ix, iz); P.play("Running_A", { speed: 1.25 });
    const lt = trail[trail.length - 1]; if (!lt || Math.hypot(lt[0] - pl.x, lt[1] - pl.z) > 0.4) { trail.push([pl.x, pl.z]); if (trail.length > 40) trail.shift(); if (trail.length % 3 === 0) sfx("step"); }
  } else P.play(P.idle);
  pl.y += ((wade ? -0.34 : 0) - pl.y) * Math.min(1, dt * 10); P.root.position.set(pl.x, pl.y, pl.z);
  followers.forEach((a, i) => { const t = trail[trail.length - 1 - (i + 1) * 4]; const p = a.root.position; if (!t) { a.play(a.idle); return; }
    const dx = t[0] - p.x, dz = t[1] - p.z, d = Math.hypot(dx, dz); if (d > 0.25) { const st = Math.min(d, 6.4 * dt); p.x += dx / d * st; p.z += dz / d * st; a.inner.rotation.y = Math.atan2(dx, dz); a.play("Running_A", { speed: 1.25 }); } else a.play(a.idle);
    p.y += ((L.water(Math.round(p.x / CS), Math.round(p.z / CS)) ? -0.34 : 0) - p.y) * Math.min(1, dt * 10); });
  // взаимодействия
  nearObj = null; let bd = 1e9;
  if (!G.busy) for (const o of L.objs) { if (!o.on) continue; const d = Math.hypot(o.pos.x - pl.x, o.pos.z - pl.z), t = o.def.t;
    if (o.actor && d < 7 && t !== "npc") o.actor.inner.rotation.y = Math.atan2(pl.x - o.pos.x, pl.z - o.pos.z);
    if (t === "trigger") { if (d < 2.4) { interact(o); break; } continue; }
    if (t === "enemy") { if (d < 1.9 + (FOES[o.def.foe].scale || 1) * 0.5) { interact(o); break; } continue; }
    if (t === "set") continue;
    if (d < (o.def.range || 2.6) && d < bd && actLabel(o)) { bd = d; nearObj = o; } }
  const ab = $("act"); if (nearObj && !G.busy) { ab.textContent = actLabel(nearObj); ab.classList.add("on"); } else ab.classList.remove("on");
}
function cameraUpdate(dt, snap) {
  const k = snap ? 1 : 1 - Math.exp(-dt * 6); camT.x += (pl.x - camT.x) * k; camT.z += (pl.z - camT.z) * k;
  const z = innerWidth < innerHeight ? 1.4 : 0.92; cam.position.set(camT.x, 12.2 * z, camT.z + 10 * z); cam.lookAt(camT.x, 0.9, camT.z - 0.4);
  const dir = L.scene.userData.dir; dir.position.set(camT.x - 5, 12, camT.z + 7); dir.target.position.set(camT.x, 0, camT.z);
  lamp.position.set(pl.x, 3.5, pl.z + 1.2);
  if ((poolT -= dt) <= 0) { poolT = 0.25; const ls = L.lights.filter(l => l.int > 0).map(l => [l, (l.pos.x - pl.x) ** 2 + (l.pos.z - pl.z) ** 2]).sort((a, b) => a[1] - b[1]);
    pool.forEach((p, i) => { const l = ls[i] && ls[i][0]; if (l) { p.position.copy(l.pos); p.color.set(l.color); p.intensity = l.int * 22; } else p.intensity = 0; }); }
}

// ---------- диалоги и сценарии ----------
let dlgNext = null;
function say(sp, text) {
  if (G.turbo) return Promise.resolve();
  return new Promise(res => { const d = $("dlg"); d.className = "on" + (sp ? "" : " narr"); $("dCh").innerHTML = ""; $("dPic").style.display = sp ? "" : "none"; if (sp) $("dPic").src = G.port[sp]; $("dWho").textContent = sp ? WHO[sp].n : "";
    const el = $("dTxt"); let i = 0, done = false; el.textContent = "";
    const tm = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i % 8 === 0) sfx("talk"); if (i >= text.length) { done = true; clearInterval(tm); } }, 16);
    dlgNext = () => { if (!done) { done = true; clearInterval(tm); el.textContent = text; return; } dlgNext = null; res(); }; });
}
function choose(labels) {
  if (G.turbo) return Promise.resolve(G.dbgChoice ? G.dbgChoice(labels) : 0);
  return new Promise(res => { $("dlg").className = "on choice" + ($("dWho").textContent ? "" : " narr"); dlgNext = null; $("dCh").innerHTML = labels.map((l, i) => `<button data-c="${i}">${esc(l)}</button>`).join("");
    $("dCh").onclick = e => { const b = e.target.closest("[data-c]"); if (!b) return; sfx("click"); $("dCh").innerHTML = ""; res(+b.dataset.c); }; });
}
const hideDlg = () => { $("dlg").className = ""; dlgNext = null; };
function autoEquip(id) {
  const it = ITEMS[id], S = G.S; if (!it.slot) return null;
  const pref = it.slot === "w" ? [it.who] : id === "a_4" || id === "c_mag" || id === "c_mp" ? ["velena", "ren", "soroka", "bjorn"] : id === "c_atk" || id === "c_spd" || id === "a_5" ? ["soroka", "bjorn", "ren", "velena"] : ["ren", "bjorn", "soroka", "velena"];
  for (const h of pref) { if (!S.party.includes(h)) continue; const eq = S.heroes[h].eq; if (it.slot === "w" || !eq[it.slot]) { if (eq[it.slot]) addItem(eq[it.slot]); eq[it.slot] = id; S.inv[id]--; norm(h); return h; } }
  return null;
}
function giveItems(o) { const out = []; for (const id in o) { addItem(id, o[id]); const h = autoEquip(id); out.push(ITEMS[id].n + (o[id] > 1 ? " ×" + o[id] : "") + (h ? ` → ${HEROES[h].name}` : "")); } return out; }
async function exec(arr) {
  const S = G.S;
  for (const x of arr) {
    if (Array.isArray(x)) await say(x[0], x[1]);
    else if (x.ch) { const i = await choose(x.ch.map(c => c[0])); await exec(x.ch[i][1]); }
    else if (x.set) Object.assign(S.flags, x.set);
    else if (x.give) giveItems(x.give);
    else if (x.join) { join(x.join); syncParty(); sfx("lantern"); }
    else if (x.tablet) { if (addTablet(x.tablet)) { sfx("tablet"); await say("", "Табличка: " + tabText(x.tablet)); } }
    else if (x.battle) { hideDlg(); await startBattle(x.battle, { script: true }); S.flags["e_" + x.battle] = 1; await fade(0); }
    else if (x.goto) { await exec(DLG[x.goto]); return; }
    else if (x.if) await exec(x.if(fl()) ? x.then : (x.else || []));
    else if (x.fx) { if (x.fx === "dark") { sfx("dkn"); L && L.refresh(); await fade(1, 500); await sleep(300); await fade(0, 700); } else { sfx("gate"); const c = $("gl"); c.classList.add("shake"); await sleep(450); c.classList.remove("shake"); } }
    else if (x.shop) { hideDlg(); await openShop(); }
    else if (x.save) saveGame();
    else if (x.end) { hideDlg(); await ending(x.end); throw ABORT; }
    if (x.set || x.give || x.join) { L && L.refresh(); updateHud(); }
  }
}
async function runScript(id) { G.busy++; try { await exec(DLG[id]); } catch (e) { if (e !== ABORT) throw e; } finally { G.busy--; hideDlg(); if (L) L.refresh(); syncParty(); updateHud(); } }

async function interact(o) {
  if (G.busy || G.mode !== "world") return; const d = o.def, S = G.S, f = fl(); G.busy++; $("act").classList.remove("on");
  try {
    if (o.actor && d.t === "npc" && d.pose !== "sit") o.actor.inner.rotation.y = Math.atan2(pl.x - o.pos.x, pl.z - o.pos.z);
    if (d.t === "npc" || d.t === "trigger") await runScript(d.t === "npc" ? d.talk(f) : d.dlg);
    else if (d.t === "chest") { S.flags["ch_" + d.id] = 1; sfx("open"); if (o.lid) await tween(350, k => { o.lid.rotation.x = -1.2 * k; }); if (d.gold) S.gold += d.gold; const got = giveItems(d.loot || {}); if (d.gold) got.push(d.gold + " 💰"); L.fx.burst(o.pos.clone().setY(1), 0xffd24d, 14, { up: 2, spd: 2 }); await say("", "В сундуке: " + got.join(", ") + "."); }
    else if (d.t === "tablet") { addTablet(d.n); sfx("tablet"); L.fx.beam(o.pos.clone(), 0xffd870, 4, 0.8); await say("", "Табличка: " + tabText(d.n)); if (d.dlg) await runScript(d.dlg); }
    else if (d.t === "altar") { S.flags[d.sets] = 1; sfx("lantern"); L.refresh(); await runScript(d.dlg); }
    else if (d.t === "gate") await say("", d.deny || "Заперто.");
    else if (d.t === "lantern") await lantern(o);
    else if (d.t === "exit") { if (d.need && !d.need(f)) await say("", d.deny); else { hideDlg(); await travel(d.to, d.at); } }
    else if (d.t === "enemy") {
      if (d.pre) await runScript(d.pre);
      const r = await startBattle(d.enc); await fade(0);
      if (r === "win") { S.flags["e_" + d.enc] = 1; L.refresh(); if (d.post) await runScript(d.post); saveGame(); }
      else { fullHeal(); await travel(S.last.map, S.last.key); toast("Отряд пришёл в себя у фонаря"); }
    }
  } catch (e) { if (e !== ABORT) console.error(e); } finally { G.busy--; hideDlg(); if (G.S && L) { L.refresh(); syncParty(); updateHud(); } }
}
async function lantern(o) {
  const S = G.S, id = o.def.id; fullHeal(); S.last = { map: S.map, key: o.key }; if (!S.lit.includes(id)) S.lit.push(id); sfx("lantern"); L.fx.beam(o.pos.clone(), 0x7fc8ff, 5, 0.9); updateHud(); saveGame();
  await say("", (o.def.big && S.flags.prologue ? "Фонарь погас, но камень ещё тёплый. " : "") + "Отряд отдохнул. Игра сохранена.");
  const others = S.lit.filter(x => x !== id); if (!others.length) return;
  const i = await choose(others.map(x => "Перейти: " + LANTERNS[x][1]).concat(["Остаться здесь"])); if (i < others.length) { hideDlg(); await travel(LANTERNS[others[i]][0], "L"); }
}

// ---------- интерфейс мира ----------
function updateHud() {
  const S = G.S; if (!S) return;
  $("objv").textContent = objective(fl(), S.map); $("gold").textContent = S.gold + " 💰";
  $("pcards").innerHTML = S.party.map(id => { const h = norm(id), st = stats(id); return `<div class="mc"><img src="${G.port[id]}" style="border-color:${HEROES[id].color}"><div class="bar hp"><i style="width:${h.hp / st.mhp * 100}%"></i></div><div class="bar mp"><i style="width:${h.mp / st.mmp * 100}%"></i></div></div>`; }).join("");
}
let menuTab = "party", picker = null;
const bar = (cls, v, m, txt) => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v / m * 100))}%"></i><span>${txt ?? v + " / " + m}</span></div>`;
function renderMenu() {
  const S = G.S; let h = "";
  if (menuTab === "party") h = S.party.map(id => { const p = norm(id), st = stats(id), H = HEROES[id];
    return `<div class="pc" style="--c:${H.color}"><img src="${G.port[id]}"><div class="pi"><b>${H.name}</b> <small>${H.cls} · уровень ${p.lvl}</small>${bar("hp", p.hp, st.mhp)}${bar("mp", p.mp, st.mmp)}${bar("xp", p.xp, xpNeed(p.lvl), "опыт " + p.xp + " / " + xpNeed(p.lvl))}
      <div class="stt"><span>⚔ сила ${st.atk}</span><span>✨ чары ${st.mag}</span><span>🛡 защита ${st.def}</span><span>💨 скорость ${Math.round(st.spd)}</span></div>
      <div class="eqs">${[["w", "🗡"], ["a", "🥋"], ["c", "📿"]].map(([sl, ic]) => `<button data-eq="${id}:${sl}">${ic} ${p.eq[sl] ? ITEMS[p.eq[sl]].n : "— пусто —"}</button>`).join("")}</div>
      ${picker && picker.id === id ? `<div class="pick">${picker.list.map(x => `<button data-put="${x}"><b>${ITEMS[x].n}</b><small>${ITEMS[x].d}</small></button>`).join("") || "<small>В сумке нет подходящих вещей</small>"}${p.eq[picker.sl] && picker.sl !== "w" ? `<button data-put="">Снять</button>` : ""}</div>` : ""}
      <details><summary>Умения (${heroSkills(id, p.lvl).length + 1})</summary>${[H.basic, ...heroSkills(id, p.lvl)].map(s => `<p><b>${SK[s].name}</b>${SK[s].mp ? " · " + SK[s].mp + " дух" : ""}<br><small>${SK[s].d}</small></p>`).join("")}${H.skills.filter(([l]) => l > p.lvl).slice(0, 1).map(([l, s]) => `<p class="lock">🔒 ${SK[s].name} — на уровне ${l}</p>`).join("")}</details></div></div>`; }).join("");
  else if (menuTab === "bag") { const ids = Object.keys(S.inv).filter(id => S.inv[id] > 0);
    h = `<div class="goldrow">Медяки: <b>${S.gold} 💰</b></div>` + (ids.map(id => { const it = ITEMS[id]; return `<div class="it"><div><b>${it.n}</b> ${it.key ? "" : "×" + S.inv[id]}<br><small>${it.d}</small></div>${it.use === "heal" || it.use === "mp" ? `<button data-use="${id}">Применить</button>` : ""}</div>` +
      (picker && picker.use === id ? `<div class="pick">${S.party.map(p => `<button data-on="${p}">${HEROES[p].name} · ${norm(p).hp}/${stats(p).mhp} · дух ${norm(p).mp}/${stats(p).mmp}</button>`).join("")}</div>` : ""); }).join("") || "<p class='hintp'>Сумка пуста.</p>"); }
  else if (menuTab === "names") h = `<p class="hintp">Найдено табличек: <b>${S.tab.length} из ${TAB_TOTAL}</b>. Имя — единственное, что остаётся.</p>` + TABLETS.map((t, n) => n ? (S.tab.includes(n) ? `<div class="tb"><b>${t[0]}</b><br><small>${t[1]}</small></div>` : `<div class="tb no">· · ·</div>`) : "").join("");
  else h = cfgHtml() + `<button class="btn" data-m="save">Сохранить и выйти в меню</button>`;
  $("mBody").innerHTML = h; document.querySelectorAll("#mTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === menuTab));
}
const cfgHtml = () => [["sound", "Звуки"], ["music", "Музыка"], ["high", "Красивая графика (свечение, тени)"], ["easy", "Лёгкий режим (враги слабее на 20%)"]].map(([k, n]) => `<div class="set"><span>${n}</span><button class="tg${CFG[k] ? " on" : ""}" data-cfg="${k}"></button></div>`).join("");
function onCfg(k) { CFG[k] = !CFG[k]; saveCfg(); if (k === "high") { Q.high = CFG.high; Q.cap = 0; perf.lvl = CFG.high ? 0 : 2; perf.t = perf.n = 0; gResize(); } if (k === "music") { const m = L && G.mode === "world" ? MAPS[G.S.map].music : "title"; music(null); if (CFG.music) music(m); } }
function openMenu(tab) { if (G.busy || G.mode !== "world") return; sfx("click"); G.busy++; menuTab = tab || "party"; picker = null; renderMenu(); $("menu").classList.add("on"); }
function closeMenu() { $("menu").classList.remove("on"); G.busy = Math.max(0, G.busy - 1); updateHud(); saveGame(); }
function onMenu(e) {
  const S = G.S, b = e.target.closest("button"); if (!b) return; const d = b.dataset; sfx("click");
  if (d.tab) { menuTab = d.tab; picker = null; }
  else if (d.eq) { const [id, sl] = d.eq.split(":"); picker = picker && picker.id === id && picker.sl === sl ? null : { id, sl, list: Object.keys(S.inv).filter(x => S.inv[x] > 0 && ITEMS[x].slot === sl && (!ITEMS[x].who || ITEMS[x].who === id)) }; }
  else if (d.put !== undefined && picker) { const eq = S.heroes[picker.id].eq; if (eq[picker.sl]) addItem(eq[picker.sl]); if (d.put) { eq[picker.sl] = d.put; S.inv[d.put]--; } else delete eq[picker.sl]; norm(picker.id); picker = null; }
  else if (d.use) picker = picker && picker.use === d.use ? null : { use: d.use };
  else if (d.on && picker) { const it = ITEMS[picker.use], p = norm(d.on), st = stats(d.on); if (it.use === "heal") p.hp = Math.min(st.mhp, Math.round(p.hp + st.mhp * it.v + 12)); else p.mp = Math.min(st.mmp, Math.round(p.mp + st.mmp * it.v + 6)); S.inv[picker.use]--; sfx("heal"); if (!S.inv[picker.use]) picker = null; }
  else if (d.cfg) onCfg(d.cfg);
  else if (d.m === "save") { closeMenu(); saveGame(); return title(); }
  else if (d.m === "close") return closeMenu();
  renderMenu();
}
function openShop() {
  return new Promise(res => { const S = G.S; const draw = () => { $("sBody").innerHTML = `<div class="goldrow">Медяки: <b>${S.gold} 💰</b></div>` + SHOP(fl()).map(([id, pr]) => { const it = ITEMS[id], own = (S.inv[id] || 0) + S.party.filter(p => Object.values(S.heroes[p].eq).includes(id)).length;
      return `<div class="it"><div><b>${it.n}</b>${own ? ` <small>(есть: ${own})</small>` : ""}<br><small>${it.d}${it.who ? " · " + HEROES[it.who].name : ""}</small></div><button data-buy="${id}:${pr}" ${S.gold < pr || (it.slot && own) ? "disabled" : ""}>${pr} 💰</button></div>`; }).join(""); };
    draw(); $("shop").classList.add("on");
    $("shop").onclick = e => { const b = e.target.closest("button"); if (!b) return; sfx("click"); if (b.dataset.buy) { const [id, pr] = b.dataset.buy.split(":"); if (S.gold >= +pr) { S.gold -= +pr; addItem(id); const h = autoEquip(id); toast(`Куплено: ${ITEMS[id].n}` + (h ? ` → ${HEROES[h].name}` : "")); draw(); updateHud(); } } else if (b.dataset.m === "close") { $("shop").classList.remove("on"); res(); } };
    if (G.turbo) { const want = ["w_v2", "w_r2", "w_s2", "a_4", "w_b2", "a_5", "c_regen", "potion", "potion", "ether", "root"]; for (const id of want) { const row = SHOP(fl()).find(r => r[0] === id); if (row && S.gold >= row[1] + 40 && !(ITEMS[id].slot && ((S.inv[id] || 0) || S.party.some(p => Object.values(S.heroes[p].eq).includes(id))))) { S.gold -= row[1]; addItem(id); autoEquip(id); } } $("shop").classList.remove("on"); res(); } });
}

// ---------- финал ----------
async function ending(id) {
  const S = G.S, E = ENDINGS[id]; S.flags.ending = id; saveGame(); G.ended = id;
  try { const e = JSON.parse(localStorage.getItem("lantern_ends") || "[]"); if (!e.includes(id)) e.push(id); localStorage.setItem("lantern_ends", JSON.stringify(e)); } catch (e) {}
  if (G.turbo) return;
  await fade(1, 900); G.mode = "ending"; $("hud").classList.remove("on"); const el = $("ending"); $("eBody").innerHTML = ""; el.classList.add("on");
  if (id !== "C") { await loadMap("hub"); for (const a of [P, ...followers]) a.root.visible = false; lamp.intensity = 0; const big = L.objs.find(o => o.def.t === "lantern" && o.def.big);
    if (id === "A") { const c = new THREE.Color(0x8a5a52); L.scene.background = c; L.scene.fog.color.copy(c); L.scene.traverse(o => { if (o.isHemisphereLight) { o.color.set(0xffd9b0); o.groundColor.set(0x5a4038); o.intensity = 2.1; } }); L.scene.userData.dir.color.set(0xffc48a); L.scene.userData.dir.intensity = 3; }
    else if (big) { big.glow.visible = true; big.lightRef.int = 1.6; } }
  music("title"); await fade(0, 600);
  const pages = [`<h2>${E.title}</h2>`].concat(E.slides.map(s => `<p>${s}</p>`), [epilogue(S.flags, S).map(s => `<p class="epi">${s}</p>`).join(""), `<h2>Конец</h2><p class="epi">Финал «${E.title}» — один из четырёх.<br>Табличек найдено: ${S.tab.length} из ${TAB_TOTAL}.</p><p class="epi">Спасибо за игру.</p>`]);
  for (let i = 0; i < pages.length; i++) { $("eBody").innerHTML = pages[i]; $("eBody").classList.remove("in"); void $("eBody").offsetWidth; $("eBody").classList.add("in"); $("eNext").textContent = i === pages.length - 1 ? "В главное меню" : "Дальше"; await new Promise(r => { $("eNext").onclick = () => { sfx("click"); r(); }; }); }
  el.classList.remove("on"); await title();
}

// ---------- титульный экран ----------
async function title() {
  G.mode = "title"; ["hud", "menu", "shop", "battle", "ending"].forEach(x => $(x).classList.remove("on")); hideDlg(); G.busy = 0;
  const sv = loadSave(); G.S = newState(); await loadMap("hub"); P.root.visible = false; lamp.intensity = 0;
  $("tCont").style.display = sv ? "" : "none"; if (sv) $("tCont").innerHTML = `Продолжить<small>${MAPS[sv.map].name} · уровень ${sv.heroes.ren.lvl}</small>`;
  let ends = []; try { ends = JSON.parse(localStorage.getItem("lantern_ends") || "[]"); } catch (e) {} $("tEnds").textContent = ends.length ? `Открыто финалов: ${ends.length} из 4` : "";
  $("title").classList.add("on"); music("title"); await fade(0, 500);
}
async function startGame(cont) {
  initAudio(); sfx("click"); await fade(1); $("title").classList.remove("on");
  const sv = cont && loadSave(); G.S = sv || newState(); G.busy = 0;
  await loadMap(G.S.map, null, sv ? sv.pos : null); G.mode = "world"; $("hud").classList.add("on"); updateHud(); await fade(0);
  if (!sv) { await runScript("intro"); const g = L.objs.find(o => o.key === "G"); if (g) await interact(g); }
}

// ---------- ввод ----------
function bindInput() {
  const c = $("gl");
  c.addEventListener("pointerdown", e => { initAudio(); if (G.mode !== "world" || joy.id !== null) return; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; const j = $("joy"); j.style.left = e.clientX + "px"; j.style.top = e.clientY + "px"; j.classList.add("on"); $("knob").style.transform = ""; });
  addEventListener("pointermove", e => { if (e.pointerId !== joy.id) return; let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), m = 52; if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; $("knob").style.transform = `translate(${dx}px,${dy}px)`; });
  const up = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; $("joy").classList.remove("on"); }; addEventListener("pointerup", up); addEventListener("pointercancel", up);
  addEventListener("keydown", e => { keys[e.code] = true; if (["Space", "Enter", "KeyE"].includes(e.code)) { e.preventDefault(); if (dlgNext) dlgNext(); else if (nearObj && G.mode === "world") interact(nearObj); } if (e.code === "Escape") { if ($("menu").classList.contains("on")) closeMenu(); else openMenu(); } });
  addEventListener("keyup", e => { keys[e.code] = false; });
  $("act").addEventListener("click", () => { initAudio(); if (nearObj) interact(nearObj); });
  $("dlg").addEventListener("click", e => { if (e.target.closest("#dCh")) return; if (dlgNext) { sfx("click"); dlgNext(); } });
  $("mBtn").onclick = () => openMenu(); $("menu").addEventListener("click", onMenu);
  $("tNew").onclick = () => { if (loadSave() && !$("tNew").dataset.sure) { $("tNew").dataset.sure = 1; $("tNew").innerHTML = "Новая игра<small>Сохранение будет перезаписано — нажми ещё раз</small>"; return; } delete $("tNew").dataset.sure; $("tNew").textContent = "Новая игра"; startGame(false); };
  $("tCont").onclick = () => startGame(true);
  $("tAbout").onclick = () => { sfx("click"); $("about").classList.add("on"); }; $("about").onclick = e => { if (e.target.closest("[data-m]") || e.target === $("about")) $("about").classList.remove("on"); };
  $("tSet").onclick = () => { sfx("click"); $("tCfg").innerHTML = cfgHtml(); $("tCfgWrap").classList.toggle("on"); }; $("tCfg").onclick = e => { const b = e.target.closest("[data-cfg]"); if (b) { initAudio(); onCfg(b.dataset.cfg); $("tCfg").innerHTML = cfgHtml(); } };
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveGame(); });
  addEventListener("resize", () => { gResize(); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); relayout(); });
}

// ---------- цикл ----------
let last = performance.now();
// если телефон не тянет — ступенчато снижаем разрешение и эффекты, чтобы игра оставалась плавной
const perf = { t: 0, n: 0, lvl: 0 };
function adapt(raw) {
  if (G.turbo || G.noAdapt || raw > 0.5 || (G.mode !== "world" && G.mode !== "battle")) return; perf.t += raw; if (++perf.n < 70) return;
  const avg = perf.t / perf.n; perf.t = perf.n = 0; if (avg < 1 / 24 || perf.lvl >= 3) return; perf.lvl++;
  if (perf.lvl === 1) Q.cap = 1.5; else if (perf.lvl === 2) { Q.high = CFG.high = false; Q.cap = 1.25; saveCfg(); toast("Графика упрощена, чтобы игра шла плавно.<br><small>Вернуть можно в настройках</small>", 3600); } else Q.cap = 1;
  gResize();
}
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now; G.T += dt; tickTweens(dt); adapt(raw);
  if (!battleFrame(dt, G.T) && L) {
    if (G.mode === "world") { worldUpdate(dt); cameraUpdate(dt); }
    else if (G.mode === "title" || G.mode === "ending") { const a = G.T * 0.07; pl.x = 11 * CS + Math.sin(a) * 3; pl.z = 6 * CS + Math.cos(a) * 2; cameraUpdate(dt); cam.position.set(camT.x + Math.sin(a) * 9, 7.5, camT.z + 12); cam.lookAt(11 * CS, 1.6, 5 * CS); }
    P.update(dt); for (const a of followers) a.update(dt); L.update(dt, G.T); render(L.scene, cam);
  }
  requestAnimationFrame(frame);
}

// ---------- автотест: бот проходит игру через те же функции, что и игрок ----------
const ORDER = ["hub", "crypt", "flood", "archive", "throne"];
async function bot(opt = {}) {
  G.turbo = true; CFG.auto = true; G.dbgChoice = opt.choice || (() => 0); const talked = new Set(), log = [], rested = new Set(); let guard = 0;
  $("title").classList.remove("on"); G.S = newState(); G.busy = 0; G.ended = null; await loadMap("hub"); G.mode = "world"; $("hud").classList.add("on");
  await runScript("intro"); await interact(L.objs.find(o => o.key === "G"));
  while (!G.ended && guard++ < 500) {
    const S = G.S, f = fl(), start = [Math.round(pl.x / CS), Math.round(pl.z / CS)], dist = new Map([[start.join(), 0]]), q = [start];
    const foeAt = (x, z) => L.objs.some(o => o.on && o.def.t === "enemy" && o.x === x && o.z === z);
    while (q.length) { const [x, z] = q.shift(), d = dist.get(x + "," + z); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + "," + (z + dz); if (dist.has(k) || L.solid(x + dx, z + dz) || foeAt(x + dx, z + dz)) continue; dist.set(k, d + 1); q.push([x + dx, z + dz]); } }
    const hpAvg = S.party.reduce((a, id) => a + norm(id).hp / stats(id).mhp, 0) / S.party.length;
    const c = L.objs.filter(o => o.on).map(o => { const t = o.def.t; let pr = -1;
      if (t === "trigger") pr = 9; else if (t === "enemy") pr = FOES[o.def.foe].boss ? 4 : 6; else if ((t === "chest" || t === "tablet") && !o.done) pr = 7; else if (t === "altar" && !o.done) pr = 8;
      else if (t === "npc") { const id = o.def.talk(f); if (!talked.has(L.mapId + o.key + id)) pr = o.def.who === "king" ? 0.5 : 8; }
      else if (t === "lantern") pr = hpAvg < 0.6 ? 10 : rested.has(L.mapId) ? -1 : 5;
      else if (t === "exit" && ORDER.indexOf(o.def.to) > ORDER.indexOf(L.mapId) && (!o.def.need || o.def.need(f))) pr = 1;
      const cell = pr >= 0 && [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]].map(([dx, dz]) => [o.x + dx, o.z + dz]).filter(p => dist.has(p.join())).sort((a, b) => dist.get(a.join()) - dist.get(b.join()))[0];
      return { o, pr, cell }; }).filter(x => x.pr >= 0 && x.cell).sort((a, b) => b.pr - a.pr || dist.get(a.cell.join()) - dist.get(b.cell.join()));
    if (!c.length) { log.push("ТУПИК на карте " + L.mapId); break; }
    const { o, cell } = c[0]; pl.x = cell[0] * CS; pl.z = cell[1] * CS; if (o.def.t === "npc") talked.add(L.mapId + o.key + o.def.talk(f)); if (o.def.t === "lantern") rested.add(L.mapId);
    const m0 = L.mapId; await interact(o); if (o.def.t === "enemy" && FOES[o.def.foe].boss) log.push(`${o.def.enc}: ур.${S.heroes.ren.lvl}`); if (L.mapId !== m0) { log.push(`→ ${L.mapId} (шаг ${guard}, ур.${S.heroes.ren.lvl}, золото ${S.gold}, табл. ${S.tab.length})`); if (o.def.t === "lantern") rested.add(L.mapId); }
  }
  const S = G.S; G.turbo = false;
  return { ending: G.ended, steps: guard, lvl: S.party.map(id => S.heroes[id].lvl).join(","), party: S.party.join(","), gold: S.gold, tablets: S.tab.length, flags: Object.keys(S.flags).filter(k => !/^(e_|ch_|tab|in_)/.test(k)).join(" "), eq: S.party.map(id => Object.values(S.heroes[id].eq).join("/")).join(" | "), log };
}

async function boot() {
  Q.high = CFG.high; perf.lvl = CFG.high ? 0 : 2; initRenderer($("gl")); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  await loadAssets(p => { $("lbar").style.width = (p * 100) + "%"; });
  G.port = makePortraits(); initBattleUi(); bindInput(); $("loading").classList.remove("on");
  requestAnimationFrame(frame); await title();
  window.__dbg = { G, CFG, bot, pl, get L() { return L; }, get lamp() { return lamp; }, get bloom() { return bloom; }, get renderer() { return renderer; }, cam, startGame, interact, startBattle, openMenu, travel, loadMap, title, updateHud, join, norm, stats, fullHeal, syncParty, runScript, saveGame };
  if ("serviceWorker" in navigator && location.protocol === "https:" && self === top && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot().catch(e => { console.error(e); $("lerr").textContent = "Не удалось загрузить игру: " + (e && e.message || e); });
