// «Кубо: Небесные острова» — игровая логика (уровни и физика прежние, графика новая)
import * as THREE from "three";
import { A, aurl, b64buf, canvas, scene, camera, sun, SUN_OFF, frame, loadAssets, inst, M, MAT, makeIsland, makeGrass, makeCloud, makeCloudSea, makeLamp, makeKubo, texShadow, texPart, rng, uTime, Q } from "./gfx.js";


const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem("kubo_" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("kubo_" + k, JSON.stringify(v)); } catch (e) {} },
};
const SOUNDS = ["coin", "jump", "land", "break", "fall", "walking"];
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
// ================= Звук =================
let actx = null, buffers = {}, muted = store.get("muted", false), stepSrc = null, stepGain = null;
async function initAudio() {
  if (actx) { if (actx.state === "suspended") actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  for (const s of SOUNDS) {
    try { const k = "sounds/" + s + ".mp3"; const ab = A ? b64buf(A[k]) : await (await fetch(k)).arrayBuffer(); buffers[s] = await actx.decodeAudioData(ab); } catch (e) {}
  }
}
function sfx(name, rate = 1, vol = 0.7) {
  if (muted || !actx || !buffers[name]) return;
  const s = actx.createBufferSource(), g = actx.createGain();
  s.buffer = buffers[name]; s.playbackRate.value = rate * (0.95 + Math.random() * 0.1); g.gain.value = vol;
  s.connect(g).connect(actx.destination); s.start();
}
function steps(on, rate) {
  if (!actx || !buffers.walking) return;
  if (!stepSrc) {
    stepSrc = actx.createBufferSource(); stepGain = actx.createGain(); stepGain.gain.value = 0;
    stepSrc.buffer = buffers.walking; stepSrc.loop = true; stepSrc.connect(stepGain).connect(actx.destination); stepSrc.start();
  }
  stepGain.gain.setTargetAtTime(on && !muted ? 0.35 : 0, actx.currentTime, 0.05);
  stepSrc.playbackRate.value = rate;
}

// ================= Типы объектов =================
const T = {
  plat:  { m: "platform", w: 2, h: 0.55 },
  med:   { m: "platform-medium", w: 3, h: 0.55 },
  large: { m: "platform-large", w: 5, h: 0.55 },
  round: { m: "platform-grass-large-round", r: 2.5, h: 0.5, cp: true },
  fall:  { m: "fall", w: 2.2, h: 0.5, falling: true },
  brick: { m: "brick", w: 1, h: 1, brick: true },
  qb:    { m: "qb", w: 1.08, h: 1, qb: true },
  step:  { m: "step", w: 1, h: 1 },
};

// ================= Уровни =================
// p(тип, x, y, z, движение) — y это низ модели; верх = y + h
function L1() {
  const e = [];
  const p = (t, x, y, z, mv) => e.push({ t, x, y, z, mv });
  const c = (x, y, z) => e.push({ t: "coin", x, y, z });
  const arc = (x1, y1, z1, x2, y2, z2, n, hgt = 1.2) => { for (let i = 1; i <= n; i++) { const k = i / (n + 1); c(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k + Math.sin(k * Math.PI) * hgt, z1 + (z2 - z1) * k); } };
  p("round", 0, 0, 0);
  c(-1, 1.1, -1); c(1, 1.1, -1);
  p("plat", 0, 0, -5);       arc(0, 1.2, -2.3, 0, 1.2, -4.2, 2, 0.6); c(0, 1.2, -5);
  p("plat", 0, 0.6, -8.6);   c(0, 1.8, -8.6);
  p("med", 0, 1.2, -13);     c(-1, 2.4, -12.2); c(1, 2.4, -12.2);
  p("brick", -0.6, 3.25, -13.3); p("qb", 0.6, 3.25, -13.3);
  p("plat", 2.5, 1.2, -17);  c(2.5, 2.4, -17);
  p("plat", 2.5, 1.2, -22.5); arc(2.5, 2.4, -18.6, 2.5, 2.4, -21, 3, 1.6); c(2.5, 2.4, -22.5);
  p("round", 2.5, 1.2, -28); c(1.5, 2.3, -28); c(3.5, 2.3, -28);
  p("fall", 2.5, 1.2, -32.3); c(2.5, 2.4, -32.3);
  p("fall", 2.5, 1.2, -35.6); c(2.5, 2.4, -35.6);
  p("fall", 2.5, 1.2, -38.9); c(2.5, 2.4, -38.9);
  p("large", 2.5, 1.2, -43.6); c(1, 2.4, -42.5); c(4, 2.4, -42.5);
  e.push({ t: "flag", x: 2.5, y: 1.75, z: -45 });
  return { name: "Первые шаги", par: 45, spawn: [0, 0.5, 1], yaw: 0, ents: e,
           tip: isTouch ? "Тяни слева — бежать, кнопка — прыжок.<br>В воздухе нажми ещё раз — двойной прыжок!" : "WASD/стрелки — бег, Пробел — прыжок (дважды — двойной)" };
}
function L2() {
  const e = [];
  const p = (t, x, y, z, mv) => e.push({ t, x, y, z, mv });
  const c = (x, y, z) => e.push({ t: "coin", x, y, z });
  const R = 7.5, N = 20, dA = 0.5, dY = 0.6;
  p("round", R, 0, 0); c(R - 1, 1.1, 0.8); c(R + 1, 1.1, 0.8);
  let last = null;
  for (let i = 1; i <= N; i++) {
    const a = i * dA, x = Math.cos(a) * R, z = -Math.sin(a) * R, y = i * dY;
    let t = "plat", mv;
    if (i % 7 === 0) t = "round";
    else if (i === 3 || i === 10 || i === 17) { t = "med"; mv = { ax: 0, ay: 1.2, az: 0, per: 3.2 }; }
    else if (i >= 12 && i <= 14) t = "fall";
    else if (i === 19) t = "fall";
    p(t, x, y, z, mv);
    const top = y + T[t].h;
    if (t === "round") { p(i === 7 ? "qb" : "brick", x, top + 1.5, z); c(x + 1, top + 0.6, z); c(x - 1, top + 0.6, z); }
    else c(x, top + 0.6 + (mv ? 1.2 : 0), z);
    last = { x, z, y: top, a };
  }
  // финиш — к центру спирали
  const a = (N + 1.6) * dA, fx = Math.cos(a) * R, fz = -Math.sin(a) * R, fy = (N + 1) * dY;
  p("large", fx, fy, fz); e.push({ t: "flag", x: fx, y: fy + 0.55, z: fz });
  c(fx - 1.2, fy + 1.2, fz); c(fx + 1.2, fy + 1.2, fz);
  // облачная колонна в центре
  e.push({ t: "bigcloud", x: 0, y: -14, z: 0, s: 6 });
  return { name: "Облачная спираль", par: 75, spawn: [R, 0.5, 0.8], yaw: 0, ents: e,
           tip: "Поднимайся по спирали. Платформы с синим огнём — лифты!" };
}
function L3() {
  const e = [];
  const p = (t, x, y, z, mv) => e.push({ t, x, y, z, mv });
  const c = (x, y, z) => e.push({ t: "coin", x, y, z });
  p("round", 0, 0, 0); c(1, 1.1, -1); c(1, 1.1, 1);
  // ступени-кирпичи
  [[4, 0.2, 0], [6, 0.8, 0.6], [8, 1.4, -0.4], [10, 2, 0.4]].forEach(([x, y, z]) => { p("step", x, y, z); c(x, y + 1.6, z); });
  p("med", 13.5, 1.7, 0); p("qb", 13.5, 3.75, -0.6); c(13.5, 2.9, 0.8);
  // горизонтальный паром
  p("plat", 18.5, 1.7, 0, { ax: 2.8, ay: 0, az: 0, per: 4 }); c(18.5, 2.9, 0);
  p("med", 24, 1.7, 0); c(24, 2.9, 0);
  p("round", 29, 1.7, 0); p("brick", 28.4, 3.7, 0); p("qb", 29.6, 3.7, 0);
  // падающий зигзаг
  [[33, 2, 1.4], [36, 2.4, -1.4], [39, 2.8, 1.4], [42, 3.2, -1.4]].forEach(([x, y, z]) => { p("fall", x, y, z); c(x, y + 1.2, z); });
  p("med", 46, 3.2, 0); c(46, 4.4, 0);
  // лифт
  p("plat", 49.6, 3.2, 0, { ax: 0, ay: 1.8, az: 0, per: 5, phase: 1.5 });
  p("large", 54.2, 6.0, 0); c(53, 7.2, -1.5); c(55.5, 7.2, 1.5); p("qb", 54.2, 8.05, 0);
  p("round", 60, 6.0, 0);
  // двойные прыжки
  p("plat", 65.5, 6.0, 0); c(65.5, 7.2, 0);
  p("plat", 70.6, 6.8, 0); for (let i = 1; i <= 3; i++) c(66.5 + i * 0.9, 8 + Math.sin(i / 4 * Math.PI) * 1.4, 0);
  // качели по Z
  p("plat", 75, 6.8, 0, { ax: 0, ay: 0, az: 3, per: 3.5 }); c(75, 8, 0);
  p("plat", 79.5, 6.8, 0, { ax: 0, ay: 0, az: 3, per: 3.5, phase: Math.PI }); c(79.5, 8, 0);
  p("large", 85, 6.8, 0); e.push({ t: "flag", x: 86.4, y: 7.35, z: 0 }); c(84, 8, 1.5); c(84, 8, -1.5);
  return { name: "Испытание ветра", par: 90, spawn: [0, 0.5, 0], yaw: -Math.PI / 2, ents: e,
           tip: "Песчаные блоки и бронзовые блоки с монетой разбиваются ударом головы снизу" };
}
const LEVELS = [L1, L2, L3];

// ================= Мир =================
let world = null, level = null, levelIdx = 0;
let colliders = [], coins = [], flag = null, decor = [], parts = [], blocks = [];
let state = "loading"; // loading | menu | play | pause | win
let timeT = 0, coinN = 0, coinTotal = 0, deaths = 0, checkpoint = null;

const FAR = [];                                                    // дальние острова: строятся один раз
function farIslands(group, ctr, seed) {
  const r = rng(seed);
  for (let k = 0; k < 9; k++) { const R = 8 + r() * 15, a = k / 9 * 6.28 + r() * 0.5, d = 125 + r() * 110; const m = makeIsland({ r: R, h: 0, seed: seed * 13 + k, grass: true, depth: R * (0.5 + r() * 0.4), far: true });
    m.position.set(ctr.x + Math.cos(a) * d, ctr.y - 12 + r() * 50, ctr.z + Math.sin(a) * d); m.rotation.y = r() * 6; group.add(m); }
}
let lamps = [], lifts = [], cpLight = null, sea = null;
function addLamp(parent, x, y, z, scale, ped) { const p = inst(ped); p.position.set(x, y, z); parent.add(p); const L = makeLamp(scale); L.obj.position.set(x, y + (ped === "ped_big" ? 0.72 : 0.38), z); L.obj.rotation.y = Math.random() * 6; parent.add(L.obj); lamps.push(L); return L; }

function buildLevel(i) {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  colliders = []; coins = []; decor = []; parts = []; blocks = []; flag = null; lamps = []; lifts = [];
  levelIdx = i; level = LEVELS[i](); coinTotal = 0; const R = rng(900 + i * 71), tufts = [];
  if (!cpLight) { cpLight = new THREE.PointLight(0xffa24a, 0, 9, 1.8); }
  world.add(cpLight);
  for (const en of level.ents) {
    if (en.t === "coin") { const m = inst("coin"); m.position.set(en.x, en.y, en.z); world.add(m); coins.push({ m, x: en.x, y: en.y, z: en.z, got: false }); coinTotal++; continue; }
    if (en.t === "flag") { const m = new THREE.Group(); m.position.set(en.x, en.y, en.z); world.add(m); const Lm = addLamp(m, 0, 0, 0, 2.3, "ped_big"); Lm.set(true); Lm.halo.scale.setScalar(0.6);
      const pl = new THREE.PointLight(0xffa24a, 26, 14, 1.8); pl.position.set(0, 1.1, 0); m.add(pl); flag = { x: en.x, y: en.y, z: en.z, m, lamp: Lm }; continue; }
    if (en.t === "bigcloud") { const m = new THREE.Group(); for (let k = 0; k < 9; k++) { const c = makeCloud(k, en.s * (2.2 + R() * 1.6), 1.15); c.position.set((R() - 0.5) * en.s * 1.2, k * en.s * 0.42, (R() - 0.5) * en.s * 1.2); m.add(c); }
      m.position.set(en.x, en.y, en.z); world.add(m); decor.push({ m, by: en.y, sp: 0.3, ph: 0 }); continue; }
    const tp = T[en.t]; let m; const seed = Math.round(en.x * 7 + en.z * 13 + en.y * 31 + i * 101);
    if (en.mv && (en.t === "plat" || en.t === "med")) { m = inst("lift"); const k = tp.w / 2; m.scale.set(k, 1, k); lifts.push(m); }
    else if (tp.r) { m = makeIsland({ r: tp.r, h: tp.h, seed, grass: true }); const rin = m.userData.rin;
      for (let k = 0; k < 150; k++) { const a = R() * 6.28, d = Math.sqrt(R()) * rin * 0.98; tufts.push([en.x + Math.cos(a) * d, en.y + tp.h, en.z + Math.sin(a) * d, 0.3 + R() * 0.2]); } }
    else if (en.t === "plat" || en.t === "med" || en.t === "large") { m = makeIsland({ w: tp.w, h: tp.h, seed });
      for (let k = 0; k < tp.w * 5; k++) { const e = (R() < 0.5 ? -1 : 1) * (tp.w / 2 - 0.08 - R() * 0.12), f = (R() - 0.5) * (tp.w - 0.3), sw = R() < 0.5; tufts.push([en.x + (sw ? e : f), en.y + tp.h, en.z + (sw ? f : e), 0.14 + R() * 0.14]); } }
    else m = inst(tp.m);
    m.position.set(en.x, en.y, en.z); world.add(m);
    const col = { tp, m, x: en.x, y: en.y, z: en.z, ox: en.x, oy: en.y, oz: en.z, mv: en.mv, dx: 0, dy: 0, dz: 0, alive: true };
    if (tp.falling) { col.fallT = -1; col.vy = 0; }
    if (tp.qb) { col.used = false; coinTotal++; }
    if (tp.cp) { const a = R() * 6.28; col.lamp = addLamp(m, Math.cos(a) * 1.75, tp.h, Math.sin(a) * 1.75, 1.5, "ped_small"); }
    colliders.push(col);
  }
  if (tufts.length) world.add(makeGrass(tufts));
  const bb = new THREE.Box3(); colliders.forEach(c => bb.expandByPoint(new THREE.Vector3(c.x, c.y, c.z)));
  const ctr = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), span = Math.max(sz.x, sz.z);
  for (let k = 0; k < 22; k++) { const m = makeCloud(k, 9 + R() * 16, 1.15); const a = R() * 6.28, r = span * 0.5 + 16 + R() * 60;
    m.position.set(ctr.x + Math.cos(a) * r, ctr.y - 6 + R() * 30, ctr.z + Math.sin(a) * r); world.add(m); decor.push({ m, by: m.position.y, sp: 0.15 + R() * 0.25, ph: R() * 6 }); }
  sea = makeCloudSea(bb.min.y - 17); sea.position.set(ctr.x, 0, ctr.z); world.add(sea);
  for (let k = 0; k < 16; k++) { const m = makeCloud(k, 22 + R() * 26, 1.12); const a = R() * 6.28, r = span * 0.5 + 30 + R() * 150; m.position.set(ctr.x + Math.cos(a) * r, bb.min.y - 9 + R() * 4, ctr.z + Math.sin(a) * r); world.add(m); }
  farIslands(world, ctr, 40 + i);
  level.lowest = bb.min.y - 12;
  checkpoint = { x: level.spawn[0], y: level.spawn[1], z: level.spawn[2] };
  timeT = 0; coinN = 0; deaths = 0;
  world.add(player.root); resetPlayer(true);
  camYaw = level.yaw; camPitch = 0.42;
  $("cn").textContent = 0; $("ct").textContent = "/" + coinTotal;
}

// ================= Игрок =================
const player = { root: new THREE.Group(), model: null, mixer: null, acts: {}, cur: null,
  p: new THREE.Vector3(), v: new THREE.Vector3(), yaw: 0, ground: null, wasGround: true, coyote: 0, buffer: 0, jumps: 0, sq: 1, shadow: null };
const R = 0.3, HGT = 0.9, GRAV = 25, JUMP = 7.4, SPEED = 5.6;

function setupPlayer() {
  const rig = makeKubo(); player.rig = rig; player.model = rig.holder; player.root.add(rig.holder);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, depthWrite: false, opacity: 0.5 }));
  sh.rotation.x = -Math.PI / 2; sh.renderOrder = 2; player.shadow = sh; scene.add(sh);
}
// процедурная анимация робота: шаг, покачивание корпуса, прыжок, реактивный ранец на двойном прыжке
function animKubo(P, dt, hs) {
  const g = P.rig, air = !P.ground, k = Math.min(1, hs / SPEED), L = (o, key, v, r = 14) => { o[key] += (v - o[key]) * Math.min(1, dt * r); };
  g.ph += dt * (air ? 3 : 5 + hs * 2.1); const s = Math.sin(g.ph), c = Math.cos(g.ph), idle = Math.sin(uTime.value * 2.1);
  const foot = (f, sg) => { const w = air ? 0 : k; L(f.position, "z", sg * s * 0.11 * w); L(f.position, "y", 0.33 + (air ? 0.07 : Math.max(0, sg * c) * 0.08 * w)); L(f.rotation, "x", air ? 0.5 : -sg * s * 0.5 * w); };
  foot(g.fl, 1); foot(g.fr, -1);
  L(g.body.position, "y", 0.56 + (air ? 0.02 : Math.abs(s) * 0.022 * k + idle * 0.006 * (1 - k))); L(g.body.rotation, "x", air ? THREE.MathUtils.clamp(-P.v.y * 0.03, -0.3, 0.25) : k * 0.16, 8); L(g.body.rotation, "z", air ? 0 : s * 0.05 * k);
  const tgt = -k * 0.5 - (air ? P.v.y * 0.05 : 0); g.antV += ((tgt - g.antA) * 90 - g.antV * 9) * dt; g.antA += g.antV * dt; g.ant.rotation.x = g.antA; g.ant.rotation.z = Math.sin(uTime.value * 3) * 0.04;
  g.blink -= dt; if (g.blink < 0) g.blink = 2.5 + Math.random() * 3; g.eyes.visible = g.blink > 0.12;
  if (P.jumps === 2 && air && P.v.y > 1) g.jetT = 0.3; g.jetT -= dt; g.jet.visible = g.jetT > 0; if (g.jet.visible) g.jet.scale.set(1, 1, 0.8 + Math.random() * 0.8);
}
function resetPlayer(first) {
  player.p.set(checkpoint.x, checkpoint.y + 0.05, checkpoint.z); player.v.set(0, 0, 0);
  player.ground = null; player.jumps = 0; player.coyote = 0; player.buffer = 0;
  if (first) player.yaw = level.yaw + Math.PI;
}

// ================= Ввод =================
const keys = {};
let joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, cam = { id: null, lx: 0, ly: 0 }, jumpHeld = false;
let camYaw = 0, camPitch = 0.42, camDist = 10;
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if ((e.code === "Space" || e.code === "KeyW" && false) && !e.repeat) { e.preventDefault(); pressJump(); }
  if (e.code === "Escape" && state === "play") pause();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
function pressJump() { initAudio(); if (state === "play") player.buffer = 0.14; }

const touchEl = $("touch");
const jumpBtn = $("jump");
jumpBtn.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); jumpBtn.classList.add("down"); jumpHeld = true; pressJump(); });
["pointerup", "pointercancel", "pointerleave"].forEach(ev => jumpBtn.addEventListener(ev, () => { jumpBtn.classList.remove("down"); jumpHeld = false; }));
function onDown(e) {
  if (state !== "play") return;
  initAudio();
  if (e.pointerType !== "mouse" && e.clientX < window.innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    const s = $("stick"); s.style.display = "block"; s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px"; $("knob").style.transform = "";
    $("hint").style.display = "none";
  } else if (cam.id === null) { cam.id = e.pointerId; cam.lx = e.clientX; cam.ly = e.clientY; }
}
function onMove(e) {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), mx = 55;
    if (d > mx) { dx *= mx / d; dy *= mx / d; }
    joy.x = dx / mx; joy.y = dy / mx; $("knob").style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === cam.id) {
    camYaw -= (e.clientX - cam.lx) * 0.006; camPitch = Math.max(0.12, Math.min(1.1, camPitch + (e.clientY - cam.ly) * 0.004));
    cam.lx = e.clientX; cam.ly = e.clientY;
  }
}
function onUp(e) {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $("stick").style.display = "none"; }
  if (e.pointerId === cam.id) cam.id = null;
}
canvas.addEventListener("pointerdown", onDown); touchEl.addEventListener("pointerdown", onDown);
window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
canvas.addEventListener("wheel", e => { camDist = Math.max(6, Math.min(16, camDist + e.deltaY * 0.01)); }, { passive: true });
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") pause(); });

function inputVec() {
  let x = joy.x, y = joy.y;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  if (l < 0.12) return [0, 0];
  // относительно камеры
  const s = Math.sin(camYaw), c = Math.cos(camYaw);
  return [x * c + y * s, -x * s + y * c];
}

// ================= Физика =================
function colTop(c) { return c.y + c.tp.h; }
function insideXZ(c, px, pz, pad) {
  if (c.tp.r) return Math.hypot(px - c.x, pz - c.z) < c.tp.r + pad;
  const hw = c.tp.w / 2 + pad; return Math.abs(px - c.x) < hw && Math.abs(pz - c.z) < hw;
}
function updatePlatforms(dt) {
  for (const c of colliders) {
    if (!c.alive) continue;
    const px = c.x, py = c.y, pz = c.z;
    if (c.mv) {
      const ph = timeT * Math.PI * 2 / c.mv.per + (c.mv.phase || 0);
      const k = Math.sin(ph);
      c.x = c.ox + c.mv.ax * k; c.y = c.oy + c.mv.ay * (c.mv.ay ? (k + 1) / 2 : 0); c.z = c.oz + c.mv.az * k;
    }
    if (c.tp.falling && c.fallT >= 0) {
      c.fallT += dt;
      if (c.fallT < 0.55) { c.m.position.x = c.x + Math.sin(c.fallT * 70) * 0.05; }
      else { c.vy -= 18 * dt; c.y += c.vy * dt; if (c.y < level.lowest - 5) { c.alive = false; c.m.visible = false; c.respawn = 3; } }
    }
    c.dx = c.x - px; c.dy = c.y - py; c.dz = c.z - pz;
    if (!(c.tp.falling && c.fallT >= 0 && c.fallT < 0.55)) c.m.position.set(c.x, c.y, c.z);
  }
  for (const c of colliders) if (!c.alive && c.respawn !== undefined) {
    c.respawn -= dt; if (c.respawn <= 0) { delete c.respawn; c.alive = true; c.m.visible = true; c.x = c.ox; c.y = c.oy; c.z = c.oz; c.fallT = -1; c.vy = 0; c.m.position.set(c.x, c.y, c.z); c.m.scale.setScalar(0.01); }
  }
}
function step(dt) {
  timeT += dt;
  updatePlatforms(dt);
  const P = player, p = P.p, v = P.v;
  // перенос платформой
  if (P.ground && P.ground.alive) { p.x += P.ground.dx; p.y += P.ground.dy; p.z += P.ground.dz; }
  // управление
  const [ix, iz] = inputVec();
  const acc = P.ground ? 14 : 7;
  v.x += (ix * SPEED - v.x) * Math.min(1, acc * dt);
  v.z += (iz * SPEED - v.z) * Math.min(1, acc * dt);
  if (Math.hypot(ix, iz) > 0.1) P.yaw = Math.atan2(v.x, v.z);
  // прыжок
  P.coyote = P.ground ? 0.1 : P.coyote - dt;
  P.buffer -= dt;
  if (P.buffer > 0) {
    if (P.ground || P.coyote > 0) { v.y = JUMP; P.jumps = 1; P.ground = null; P.coyote = 0; P.buffer = 0; P.sq = 0.7; sfx("jump"); dust(4); }
    else if (P.jumps < 2) { v.y = JUMP * 0.92; P.jumps = 2; P.buffer = 0; P.sq = 0.75; sfx("jump", 1.25); dust(5); }
  }
  // переменная высота прыжка
  const holding = jumpHeld || keys.Space;
  v.y -= GRAV * (v.y > 0 && !holding ? 1.9 : 1) * dt;
  if (v.y < -22) v.y = -22;
  // горизонталь
  p.x += v.x * dt; p.z += v.z * dt;
  for (const c of colliders) {
    if (!c.alive) continue;
    const top = colTop(c);
    if (!(p.y < top - 0.22 && p.y + HGT > c.y + 0.02)) continue;
    if (c.tp.r) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.tp.r + R;
      if (d < m && d > 1e-5) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    } else {
      const hw = c.tp.w / 2;
      const cx = Math.max(c.x - hw, Math.min(p.x, c.x + hw)), cz = Math.max(c.z - hw, Math.min(p.z, c.z + hw));
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < R) {
        if (d > 1e-5) { p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
        else { const ox = hw + R - Math.abs(p.x - c.x), oz = hw + R - Math.abs(p.z - c.z);
               if (ox < oz) p.x += Math.sign(p.x - c.x || 1) * ox; else p.z += Math.sign(p.z - c.z || 1) * oz; }
      }
    }
  }
  // вертикаль
  const prevY = p.y; p.y += v.y * dt;
  const wasG = P.ground; P.ground = null;
  for (const c of colliders) {
    if (!c.alive) continue;
    const top = colTop(c);
    if (v.y <= 0 && prevY >= top - 0.25 && p.y <= top + 0.02 && insideXZ(c, p.x, p.z, 0.12)) {
      if (!P.ground || top > colTop(P.ground)) P.ground = c;
    } else if (v.y > 0 && prevY + HGT <= c.y + 0.1 && p.y + HGT > c.y && insideXZ(c, p.x, p.z, -0.05)) {
      p.y = c.y - HGT; v.y = -1; bonk(c);
    }
  }
  if (P.ground) {
    p.y = colTop(P.ground); if (v.y < 0) v.y = 0; P.jumps = 0;
    if (!wasG) { P.sq = 1.3; if (P.fallSpeed < -6) { sfx("land", 1, 0.5); dust(6); } }
    const g = P.ground;
    if (g.tp.falling && g.fallT < 0) g.fallT = 0;
    if (g.tp.cp && (checkpoint.c !== g)) {
      if (checkpoint.c !== undefined || g.x !== level.spawn[0] || g.z !== level.spawn[2]) { if (checkpoint.c !== undefined) toast("Чекпоинт!"); }
      checkpoint = { x: g.x, y: colTop(g), z: g.z, c: g };
    }
  }
  P.fallSpeed = v.y;
  // монеты
  for (const k of coins) if (!k.got && Math.hypot(p.x - k.x, (p.y + 0.45) - k.y, p.z - k.z) < 0.85) collect(k);
  // флаг
  if (flag && Math.hypot(p.x - flag.x, p.z - flag.z) < 1.1 && Math.abs(p.y - flag.y) < 1.5) win();
  // падение
  if (p.y < level.lowest) { deaths++; sfx("fall"); flashFade(); resetPlayer(false); }
}
function bonk(c) {
  if (c.tp.brick) {
    sfx("break"); c.alive = false; c.m.visible = false;
    for (let i = 0; i < 6; i++) {
      const m = inst("chunk"); m.scale.setScalar(0.8 + Math.random() * 0.9); m.position.set(c.x + (i % 2 - 0.5) * 0.5, c.y + 0.5, c.z + ((i >> 1) % 2 - 0.5) * 0.5); world.add(m);
      parts.push({ m, v: new THREE.Vector3((i % 2 - 0.5) * 4 + Math.random() - 0.5, 4 + Math.random() * 3, ((i >> 1) % 2 - 0.5) * 4 + Math.random() - 0.5), life: 1.4, rot: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0) });
    }
  } else if (c.tp.qb && !c.used) {
    c.used = true; c.bump = 0.25;
    c.m.material = c.m.material.clone(); c.m.material.color.setRGB(0.42, 0.4, 0.4); if (c.m.userData.glow) c.m.userData.glow.visible = false;
    const m = inst("coin"); m.position.set(c.x, colTop(c) + 0.3, c.z); world.add(m);
    parts.push({ m, v: new THREE.Vector3(0, 7, 0), life: 0.55, spin: true, coin: true });
    coinN++; updCoins(); sfx("coin", 1.1);
  } else { sfx("land", 0.8, 0.4); }
}
function collect(k) { k.got = true; coinN++; updCoins(); sfx("coin"); parts.push({ m: k.m, v: new THREE.Vector3(0, 3, 0), life: 0.35, spin: true, coin: true, grow: true }); }
function updCoins() { $("cn").textContent = coinN; const el = $("coins"); el.animate([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 200 }); }

// пыль
const dustGeo = new THREE.PlaneGeometry(1, 1);
const dustMat = new THREE.MeshBasicMaterial({ map: texPart, transparent: true, depthWrite: false, color: 0xffffff });
function dust(n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dustGeo, dustMat.clone()); const a = Math.random() * 6.28;
    m.position.set(player.p.x + Math.cos(a) * 0.25, player.p.y + 0.1, player.p.z + Math.sin(a) * 0.25); m.scale.setScalar(0.2);
    world.add(m); parts.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.2, 0.6, Math.sin(a) * 1.2), life: 0.45, max: 0.45, dust: true });
  }
}

// ================= Камера и кадр =================
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();
function updateVisual(dt) {
  const P = player, p = P.p;
  P.root.position.copy(p);
  // поворот модели
  let dy = P.yaw - P.model.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  P.model.rotation.y += dy * Math.min(1, dt * 12);
  // сквош
  P.sq += (1 - P.sq) * Math.min(1, dt * 10);
  const sqv = 1 + (P.sq - 1) * 0.45; P.model.scale.set(1 + (1 - sqv) * 0.6, sqv, 1 + (1 - sqv) * 0.6);
  // анимация
  const hs = Math.hypot(P.v.x, P.v.z);
  animKubo(P, dt, hs);
  steps(state === "play" && P.ground && hs > 1.5, 0.8 + hs / SPEED * 0.6);
  if (P.ground && hs > 4 && Math.random() < dt * 14) dust(1);
  // тень-пятно
  let gy = -999; for (const c of colliders) if (c.alive && insideXZ(c, p.x, p.z, 0) && colTop(c) <= p.y + 0.05 && colTop(c) > gy) gy = colTop(c);
  if (gy > -999) { P.shadow.visible = true; P.shadow.position.set(p.x, gy + 0.02, p.z); const s = Math.max(0.3, 0.9 - (p.y - gy) * 0.08); P.shadow.scale.setScalar(s); }
  else P.shadow.visible = false;
  // монеты и декор
  const t = performance.now() / 1000;
  for (const k of coins) if (!k.got) { k.m.rotation.y = t * 2.5; k.m.position.y = k.y + Math.sin(t * 3 + k.x) * 0.06; }
  for (const d of decor) d.m.position.y = d.by + Math.sin(t * d.sp + d.ph) * 0.6;
  for (const c of colliders) {
    if (c.bump) { c.bump -= dt; c.m.position.y = c.y + Math.max(0, Math.sin((0.25 - c.bump) / 0.25 * Math.PI)) * 0.25; if (c.bump <= 0) { c.bump = 0; c.m.position.y = c.y; } }
    if (c.m.scale.x < 1) c.m.scale.setScalar(Math.min(1, c.m.scale.x + dt * 3));
  }
  if (sea) sea.userData.tick(dt);
  // фонари чекпоинтов: горит тот, у которого герой возродится
  let act = null; for (const c of colliders) if (c.lamp) { const on = checkpoint.c === c || (checkpoint.c === undefined && c.x === level.spawn[0] && Math.abs(c.z - level.spawn[2]) < 1.5); c.lamp.set(on); if (on) act = c; }
  if (act) { act.lamp.obj.getWorldPosition(cpLight.position); cpLight.position.y += 0.3; cpLight.intensity = 9 * (1 + Math.sin(t * 11) * 0.05); } else cpLight.intensity = 0;
  for (const m of lifts) if (m.userData.glow) m.userData.glow.material.emissiveIntensity = 5 + Math.sin(t * 4 + m.position.x) * 2;
  for (const q of parts) {
    q.life -= dt;
    if (q.coin) { q.m.position.y += q.v.y * dt; q.v.y -= 20 * dt; q.m.rotation.y += dt * 20; if (q.grow) q.m.scale.setScalar(1 + (0.35 - q.life) * 3); }
    else if (q.dust) { q.m.position.addScaledVector(q.v, dt); q.m.material.opacity = Math.max(0, q.life / q.max); q.m.scale.setScalar(0.2 + (1 - q.life / q.max) * 0.25); q.m.quaternion.copy(camera.quaternion); }
    else { q.v.y -= 20 * dt; q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += q.rot.x * dt; q.m.rotation.y += q.rot.y * dt; }
    if (q.life <= 0) { q.m.removeFromParent(); }
  }
  parts = parts.filter(q => q.life > 0);
  // мягкий автоповорот камеры за героем
  if (state === "play" && cam.id === null && hs > 2) { let d = (P.yaw + Math.PI) - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 0.9); }
  // камера
  const dist = camDist * (camera.aspect < 1 ? 1.15 : 1);
  camLook.lerp(tmp.set(p.x, p.y + 1, p.z), 1 - Math.exp(-dt * 8));
  const cx = camLook.x + Math.sin(camYaw) * Math.cos(camPitch) * dist;
  const cz = camLook.z + Math.cos(camYaw) * Math.cos(camPitch) * dist;
  const cy = camLook.y + Math.sin(camPitch) * dist;
  camPos.lerp(tmp.set(cx, cy, cz), 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos); camera.lookAt(camLook);
  sun.position.copy(p).add(SUN_OFF); sun.target.position.copy(p);
}

// ================= Экраны =================
function show(id) { ["loading", "menu", "pauseS", "win", "creditsS"].forEach(s => $(s).classList.toggle("on", s === id)); }
function hudOn(on) { $("hud").style.display = on ? "block" : "none"; $("touch").style.display = on && isTouch ? "block" : "none"; }
let toastT = 0;
function toast(html, dur = 1.6) { $("toast").innerHTML = html; $("toast").classList.add("on"); toastT = dur; }
function flashFade() { const f = $("fade"); f.style.opacity = 0.8; setTimeout(() => f.style.opacity = 0, 160); }
const fmtT = s => { const m = Math.floor(s / 60), r = s - m * 60; return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1); };

function menu() {
  state = "menu"; hudOn(false); show("menu");
  const prog = store.get("prog", {}), wrap = $("levels"); wrap.innerHTML = "";
  LEVELS.forEach((fn, i) => {
    const lv = fn(), pr = prog[i], unlocked = i === 0 || prog[i - 1];
    const b = document.createElement("button"); b.className = "btn lvl" + (i ? " alt" : "");
    b.disabled = !unlocked;
    b.innerHTML = `<span>${i + 1}. ${lv.name}<small>${pr ? "лучшее: " + fmtT(pr.best) : unlocked ? "не пройден" : "🔒 закрыт"}</small></span><span class="st">${pr ? "★".repeat(pr.stars) + "☆".repeat(3 - pr.stars) : ""}</span>`;
    b.onclick = () => start(i);
    wrap.appendChild(b);
  });
}
function start(i) {
  initAudio(); buildLevel(i); state = "play"; show(null); hudOn(true);
  camPos.set(player.p.x + Math.sin(camYaw) * 12, player.p.y + 7, player.p.z + Math.cos(camYaw) * 12); camLook.copy(player.p);
  toast(`<div style="font-size:26px">${level.name}</div><div style="font-size:15px;font-weight:600;margin-top:4px">${level.tip}</div>`, 4);
}
function pause() { if (state !== "play") return; state = "pause"; steps(false, 1); show("pauseS"); $("bSound").textContent = "Звук: " + (muted ? "выкл" : "вкл"); }
function win() {
  if (state !== "play") return;
  state = "win"; steps(false, 1); sfx("coin", 0.8); sfx("coin", 1.2);
  const allC = coinN >= coinTotal, fast = timeT <= level.par;
  const stars = 1 + (allC ? 1 : 0) + (fast ? 1 : 0);
  const prog = store.get("prog", {}); const old = prog[levelIdx];
  const best = old ? Math.min(old.best, timeT) : timeT;
  prog[levelIdx] = { best, stars: Math.max(stars, old ? old.stars : 0) }; store.set("prog", prog);
  setTimeout(() => {
    hudOn(false); show("win");
    $("wTitle").textContent = levelIdx === LEVELS.length - 1 ? "Все острова пройдены!" : "Уровень пройден!";
    $("wStars").innerHTML = [0, 1, 2].map(k => `<i class="${k < stars ? "on" : ""}">★</i>`).join("");
    $("wCoins").textContent = coinN + " / " + coinTotal + (allC ? " ✓" : "");
    $("wTime").textContent = fmtT(timeT) + (fast ? " ✓" : " (норма " + fmtT(level.par) + ")");
    $("wDeaths").textContent = deaths;
    $("wBest").textContent = fmtT(best);
    $("bNext").textContent = levelIdx < LEVELS.length - 1 ? "Следующий уровень" : "К выбору уровней";
  }, 700);
}
$("pause").onclick = pause;
$("bResume").onclick = () => { state = "play"; show(null); };
$("bRestart").onclick = () => start(levelIdx);
$("bMenu").onclick = menu;
$("bSound").onclick = () => { muted = !muted; store.set("muted", muted); $("bSound").textContent = "Звук: " + (muted ? "выкл" : "вкл"); };
$("bNext").onclick = () => { if (levelIdx < LEVELS.length - 1) start(levelIdx + 1); else menu(); };
$("bAgain").onclick = () => start(levelIdx);
$("bCredits").onclick = () => show("creditsS");
$("bBack").onclick = menu;
// Кнопка «назад» в приложении Android: в игре — пауза, на паузе — продолжить, на экранах финиша и авторов — в меню.
// Возвращает false, когда обрабатывать нечего (тогда приложение сворачивается).
window.__onBack = () => {
  if (state === "play") { pause(); return true; }
  if (state === "pause") { $("bResume").click(); return true; }
  if (state === "win" || $("creditsS").classList.contains("on")) { menu(); return true; }
  return false;
};

// ================= Цикл =================
let last = performance.now(), acc = 0; const STEP = 1 / 120;
function loop(now) {
  if (window.__pause) { last = now; requestAnimationFrame(loop); return; }
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === "play") {
    acc += dt; while (acc >= STEP) { step(STEP); acc -= STEP; }
    $("timer").textContent = fmtT(timeT);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $("toast").classList.remove("on"); }
  } else acc = 0;
  if (level) updateVisual(state === "play" || state === "win" ? dt : 0);
  frame();
  requestAnimationFrame(loop);
}

$("coins").querySelector("img").src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#b8791c"/><circle cx="32" cy="32" r="25" fill="#f2b233"/><circle cx="32" cy="32" r="17" fill="none" stroke="#b8791c" stroke-width="4"/><circle cx="32" cy="32" r="6" fill="#b8791c"/></svg>');
loadAssets(p => { $("lbar").style.width = (p * 100) + "%"; }).then(() => {
  setupPlayer();
  buildLevel(0); // фон для меню
  camPos.set(6, 6, 8); camLook.set(0, 1, -4);
  menu(); requestAnimationFrame(loop);
}).catch(err => { $("err").textContent = "Не удалось загрузить игру: " + (err && err.message || err); });
window.__dbg = { player, start, get state() { return state; }, get level() { return level; }, get colliders() { return colliders; }, get coins() { return coins; }, get flag() { return flag; }, step, Q, camera, snap() { updateVisual(0); frame(); return document.getElementById("gl").toDataURL("image/jpeg", 0.92); }, tick(n = 1) { for (let i = 0; i < n; i++) step(STEP); updateVisual(1 / 60); }, STEP, set cam(v) { camYaw = v[0]; camPitch = v[1]; camDist = v[2] ?? camDist; }, get stats() { return { coinN, coinTotal, deaths, timeT }; } };
