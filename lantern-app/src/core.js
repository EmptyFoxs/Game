// Общее состояние, сохранения, звук, мелкие помощники
import { HEROES, ITEMS, TABLETS } from "./data.js";
import { heroStats } from "./battle.js";

export const $ = id => document.getElementById(id);
export const G = { S: null, mode: "boot", turbo: false, T: 0, port: {}, busy: 0, known: {} };
export const CFG = Object.assign({ sound: true, music: true, high: true, speed: 1, auto: false, easy: false }, (() => { try { return JSON.parse(localStorage.getItem("lantern_cfg")) || {}; } catch (e) { return {}; } })());
export const saveCfg = () => { try { localStorage.setItem("lantern_cfg", JSON.stringify(CFG)); } catch (e) {} };

// ---------- время и анимации ----------
const tweens = [];
export const sleep = ms => G.turbo ? Promise.resolve() : new Promise(r => tweens.push({ t: 0, dur: ms / 1000 / (G.mode === "battle" ? CFG.speed : 1), fn: null, r }));
export const tween = (ms, fn) => { if (G.turbo) { fn(1); return Promise.resolve(); } return new Promise(r => tweens.push({ t: 0, dur: Math.max(0.001, ms / 1000 / (G.mode === "battle" ? CFG.speed : 1)), fn, r })); };
export function tickTweens(dt) { for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn && w.fn(k); if (k >= 1) { tweens.splice(i, 1); w.r(); } } }
export const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

// ---------- состояние ----------
export const newState = () => ({ v: 1, map: "hub", pos: null, party: ["ren"], heroes: { ren: { id: "ren", lvl: 1, xp: 0, eq: { w: "w_r1", a: "a_1" } } }, inv: { potion: 1 }, gold: 20, flags: {}, tab: [], flame: 0, lit: [], last: { map: "hub", key: "L" }, losses: {}, known: {}, time: 0 });
export const fl = () => Object.assign({ s: G.S }, G.S.flags);
export const stats = id => heroStats(id, G.S.heroes[id].lvl, G.S.heroes[id].eq);
export function norm(id) { const h = G.S.heroes[id], s = stats(id); if (h.hp === undefined || h.hp === null) h.hp = s.mhp; if (h.mp === undefined || h.mp === null) h.mp = s.mmp; h.hp = Math.min(h.hp, s.mhp); h.mp = Math.min(h.mp, s.mmp); return h; }
export function fullHeal() { for (const id of G.S.party) { const h = G.S.heroes[id], s = stats(id); h.hp = s.mhp; h.mp = s.mmp; } }
export function addItem(id, n = 1) { G.S.inv[id] = (G.S.inv[id] || 0) + n; }
export function join(id) { const S = G.S; if (S.party.includes(id)) return; const r = S.heroes.ren; S.heroes[id] = { id, lvl: r.lvl, xp: 0, eq: { w: HEROES[id].w } }; S.party.push(id); S.flags[id] = 1; norm(id); }
export function addTablet(n) { const S = G.S; if (S.tab.includes(n)) return false; S.tab.push(n); S.flags["tab" + n] = 1; return true; }
export const tabText = n => `«${TABLETS[n][0]}. ${TABLETS[n][1]}»`;
export function save() { try { localStorage.setItem("lantern_save", JSON.stringify(G.S)); } catch (e) {} }
export function loadSave() { try { const s = JSON.parse(localStorage.getItem("lantern_save")); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
export const itemName = id => ITEMS[id] ? ITEMS[id].n : id;

let toastT = null;
export function toast(html, ms = 2200) { const el = $("toast"); el.innerHTML = html; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), G.turbo ? 1 : ms); }

// ---------- звук ----------
let ac = null, master = null, musicGain = null, musicTimer = null, curMusic = null;
export function initAudio() { if (ac) { if (ac.state === "suspended") ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination); musicGain = ac.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master); } catch (e) { ac = null; } if (curMusic) { const m = curMusic; curMusic = null; music(m); } }
function tone(f1, f2, dur, type = "sine", vol = 0.08, delay = 0, dest) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(25, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.1, freq = 1200, delay = 0) { if (!ac) return; const t = ac.currentTime + delay, n = ac.sampleRate * dur, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = "bandpass"; f.frequency.value = freq; g.gain.value = vol; s.connect(f).connect(g).connect(master); s.start(t); }
const SFX = {
  click: () => tone(820, 700, .04, "sine", .04), talk: () => tone(500 + Math.random() * 200, 420, .05, "sine", .025), step: () => noise(.05, .03, 500),
  slash: () => { noise(.12, .12, 2400); tone(900, 300, .1, "sawtooth", .03); }, blunt: () => { noise(.14, .16, 300); tone(140, 60, .16, "sine", .14); }, pierce: () => { noise(.07, .1, 3800); tone(1500, 700, .06, "square", .025); },
  fire: () => { noise(.35, .14, 700); tone(300, 90, .3, "sawtooth", .04); }, frost: () => { [1900, 2400, 3100].forEach((f, i) => tone(f, f * .8, .18, "sine", .035, i * .04)); noise(.1, .06, 5000); },
  light: () => { [784, 1047, 1568].forEach((f, i) => tone(f, f, .35, "sine", .05, i * .05)); }, dark: () => { tone(160, 50, .5, "sawtooth", .06); tone(233, 70, .5, "sine", .06); },
  heal: () => { [523, 659, 784].forEach((f, i) => tone(f, f, .22, "triangle", .05, i * .07)); }, buff: () => { tone(440, 660, .2, "triangle", .05); }, debuff: () => { tone(400, 200, .25, "triangle", .05); },
  ko: () => { noise(.3, .1, 400); tone(300, 60, .4, "triangle", .07); }, crit: () => { noise(.1, .16, 3000); tone(1200, 400, .12, "square", .05); }, weak: () => tone(1320, 1760, .12, "square", .04),
  open: () => { tone(200, 400, .2, "triangle", .06); noise(.15, .06, 900); }, tablet: () => { [659, 988, 1319].forEach((f, i) => tone(f, f, .5, "sine", .05, i * .12)); }, lantern: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, f, .6, "sine", .05, i * .1)); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .3, "triangle", .07, i * .12)); tone(1319, 1319, .6, "triangle", .07, .5); }, lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, f, .5, "triangle", .07, i * .2)); },
  level: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, .25, "square", .035, i * .08)); }, flame: () => { noise(.6, .12, 1500); [523, 784, 1047, 1568].forEach((f, i) => tone(f, f * 1.01, .7, "sine", .05, i * .04)); },
  gate: () => { noise(.5, .12, 200); tone(90, 60, .5, "square", .05); }, encounter: () => { tone(220, 880, .25, "sawtooth", .05); noise(.25, .1, 1800); }, summon: () => { tone(80, 300, .6, "sawtooth", .05); }, dkn: () => { tone(300, 40, 1.2, "sine", .12); },
};
export function sfx(n) { if (!CFG.sound || !ac || G.turbo) return; const f = SFX[n]; f && f(); }
const MUS = { hub: [220, [0, 3, 7, 10, 12], 900], crypt: [196, [0, 2, 3, 7, 8], 1000], flood: [174.6, [0, 2, 5, 7, 9], 1100], archive: [207.7, [0, 3, 5, 6, 10], 950], throne: [164.8, [0, 1, 5, 7, 8], 1150], battle: [220, [0, 3, 5, 7, 10], 300], boss: [196, [0, 1, 3, 6, 7], 260], title: [220, [0, 4, 7, 11, 12], 1000] };
export function music(name) {
  if (curMusic === name) return; curMusic = name; clearTimeout(musicTimer); if (!ac || !CFG.music || !name || G.turbo) return;
  const [root, scale, step] = MUS[name] || MUS.crypt, fast = step < 500; let i = 0;
  const tick = () => { if (curMusic !== name || !CFG.music) return; const n = scale[Math.floor(Math.random() * scale.length)], f = root * Math.pow(2, n / 12);
    if (fast) { tone(root / 2 * (i % 8 === 6 ? 1.19 : 1), root / 2, .22, "sawtooth", .045, 0, musicGain); if (i % 2 === 0) tone(f * 2, f * 2, .18, "square", .018, 0, musicGain); if (i % 4 === 2) noise(.05, .03, 4000); }
    else { if (i % 4 === 0) { [0, 7, scale[2]].forEach(s => tone(root / 2 * Math.pow(2, s / 12), root / 2 * Math.pow(2, s / 12), step * 4 / 1000, "sine", .028, 0, musicGain)); } if (Math.random() < 0.6) tone(f * 2, f * 2, 1.4, "triangle", .022, 0, musicGain); }
    i++; musicTimer = setTimeout(tick, step); };
  tick();
}
export const stopMusic = () => { curMusic = null; clearTimeout(musicTimer); };
