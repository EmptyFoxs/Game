// Графический слой: рендер, ассеты, персонажи, сборка уровней, эффекты
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ATTACH, MAPS, WHO, FOES } from "./data.js";

export { THREE };
export const CS = 2, V3 = THREE.Vector3;
export const M = { chars: {}, clips: {}, packs: [] };
export const Q = { high: true };
export let renderer, composer, rpass, bloom;
const neon = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);

export function initRenderer(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  composer = new EffectComposer(renderer); rpass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); composer.addPass(rpass);
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.5); composer.addPass(bloom); composer.addPass(new OutputPass());
  resize();
}
export function resize() {
  const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, Q.high ? 2 : 1.25, Q.cap || 9);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
  renderer.shadowMap.enabled = Q.high;
}
export function render(scene, camera) { if (Q.high) { rpass.scene = scene; rpass.camera = camera; composer.render(); } else renderer.render(scene, camera); }

// ---------- текстуры ----------
function canvasTex(size, draw) { const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export const TEX = {};
function makeTextures() {
  TEX.glow = canvasTex(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  TEX.arc = canvasTex(128, (g, s) => { g.strokeStyle = "#fff"; g.lineCap = "round"; for (let i = 0; i < 5; i++) { g.globalAlpha = 0.25 + i * 0.18; g.lineWidth = 16 - i * 3; g.beginPath(); g.arc(s * 0.38, s * 0.62, s * 0.42, -1.25, 0.35); g.stroke(); } });
  TEX.star = canvasTex(64, (g, s) => { g.fillStyle = "#fff"; g.translate(s / 2, s / 2); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -s / 2); g.quadraticCurveTo(3, -3, s / 2, 0); g.quadraticCurveTo(3, 3, 0, 4); g.fill(); } });
  TEX.stone = canvasTex(128, (g, s) => { g.fillStyle = "#8a8794"; g.fillRect(0, 0, s, s); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "20,18,30" : "235,230,245"},${Math.random() * .08})`; const w = 4 + Math.random() * 22; g.fillRect(Math.random() * s, Math.random() * s, w, w * .6); }
    g.strokeStyle = "rgba(15,12,25,.35)"; g.lineWidth = 2; for (let y = 0; y <= s; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); for (let x = (y / 32 % 2) * 32; x <= s; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } });
  TEX.stone.wrapS = TEX.stone.wrapT = THREE.RepeatWrapping;
}

// ---------- ассеты ----------
const b64 = d => { const b = atob(d), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
async function glb(path) { const L = new GLTFLoader(), A = window.__ASSETS; return A && A[path] ? await L.parseAsync(b64(A[path]), "") : await L.loadAsync("assets/" + path); }
function fixMats(root) { root.traverse(o => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.88; } }); }
const CHARS = ["knight", "barbarian", "mage", "rogue", "rogue2", "sk_minion", "sk_warrior", "sk_rogue", "sk_mage"];
export async function loadAssets(onProg) {
  makeTextures();
  const list = [...CHARS.map(n => "chars/" + n + ".glb"), "chars/anims.glb", "dungeon.glb", "graveyard.glb", "weapons.glb"]; let done = 0;
  const res = await Promise.all(list.map(p => glb(p).then(g => { onProg(++done / list.length); return g; })));
  CHARS.forEach((n, i) => { M.chars[n] = res[i]; fixMats(res[i].scene); });
  const names = new Set(); M.chars.knight.scene.traverse(o => names.add(o.name));
  for (const c of res[CHARS.length].animations) { c.tracks = c.tracks.filter(t => names.has(t.name.split(".")[0])); M.clips[c.name] = c; }
  M.packs = res.slice(CHARS.length + 1).map(g => { fixMats(g.scene); return g.scene; });
}
export function prop(name, pack) { const ps = pack === undefined ? M.packs : [M.packs[pack]]; for (const p of ps) { const o = p.getObjectByName(name); if (o) { const c = o.clone(true); c.position.set(0, 0, 0); return c; } } console.warn("нет модели", name); return new THREE.Group(); }
const shadowed = (o, cast = true) => { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; };

// ---------- персонаж ----------
export const CHAR_SCALE = 0.72;
export const foeSpec = k => { const f = FOES[k]; return { model: f.model, wpn: f.wpn, tint: f.tint, scale: f.scale, glow: f.glow }; };
export class Actor {
  constructor(spec) {
    this.spec = spec; this.root = new THREE.Group(); this.inner = new THREE.Group(); this.root.add(this.inner);
    const model = this.model = SkeletonUtils.clone(M.chars[spec.model].scene); this.inner.add(model); this.mats = [];
    const show = spec.show || [];
    model.traverse(o => { if (ATTACH.includes(o.name)) o.visible = show.includes(o.name);
      if (o.isMesh) { o.material = o.material.clone(); this.mats.push(o.material); o.castShadow = true; o.frustumCulled = false; if (spec.tint) o.material.color.multiply(new THREE.Color(spec.tint)); if (spec.glow) { o.material.emissive = new THREE.Color(spec.glow); o.material.emissiveIntensity = 0.3; } } });
    if (spec.wpn) for (const side of ["r", "l"]) if (spec.wpn[side]) { const slot = model.getObjectByName("handslot" + side); if (slot) slot.add(shadowed(prop(spec.wpn[side], 2))); }
    this.scale = CHAR_SCALE * (spec.scale || 1); this.inner.scale.setScalar(this.scale);
    this.mixer = new THREE.AnimationMixer(model); this.acts = {}; this.cur = null; this.flashT = 0; this.fade = 1;
    this.mixer.addEventListener("finished", e => { if (e.action === this.cur && this.onDone) { const f = this.onDone; this.onDone = null; f(); } });
    this.idle = spec.idle || "Idle"; this.play(this.idle);
  }
  act(name) { return this.acts[name] || (M.clips[name] && (this.acts[name] = this.mixer.clipAction(M.clips[name]))); }
  play(name, o = {}) {
    const a = this.act(name); if (!a) return 0; if (this.cur === a && !o.once) { a.timeScale = o.speed || 1; return 0; }
    a.reset(); a.timeScale = o.speed || 1; a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    a.fadeIn(o.fade ?? 0.15).play(); if (this.cur && this.cur !== a) this.cur.fadeOut(o.fade ?? 0.15); this.cur = a;
    this.onDone = o.once && !o.hold ? () => this.play(this.idle, { fade: 0.2 }) : null;
    return a.getClip().duration / (o.speed || 1);
  }
  flash(color = 0xffffff, t = 0.22) { this.flashC = new THREE.Color(color); this.flashT = this.flashD = t; }
  setFade(v) { this.fade = v; for (const m of this.mats) { m.transparent = v < 1; m.opacity = v; } this.root.visible = v > 0.01; }
  update(dt) {
    this.mixer.update(dt);
    if (this.flashT > 0) { this.flashT -= dt; const k = Math.max(0, this.flashT / this.flashD); for (const m of this.mats) { m.emissive.copy(this.flashC); m.emissiveIntensity = k * 1.6; }
      if (this.flashT <= 0) for (const m of this.mats) { if (this.spec.glow) { m.emissive.set(this.spec.glow); m.emissiveIntensity = 0.3; } else m.emissiveIntensity = 0; } }
  }
}
// портреты для диалогов
export function makePortraits() {
  const out = {}, S = 144, rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace }), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20), buf = new Uint8Array(S * S * 4);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x554466, 2.2)); const d = new THREE.DirectionalLight(0xfff0dd, 2.4); d.position.set(1.5, 2, 3); sc.add(d);
  const cv = document.createElement("canvas"); cv.width = cv.height = S; const g = cv.getContext("2d");
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  for (const id in WHO) {
    const a = new Actor(WHO[id]); a.mixer.update(0.3); sc.add(a.root); const s = a.scale / CHAR_SCALE, hy = 1.42 * s;
    cam.position.set(0.5 * s, hy + 0.08 * s, 2.0 * s); cam.lookAt(0, hy, 0);
    sc.background = new THREE.Color(id.length % 2 ? 0x2a2440 : 0x30283e);
    renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf); renderer.setRenderTarget(null);
    const img = g.createImageData(S, S); for (let y = 0; y < S; y++) img.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); g.putImageData(img, 0, 0);
    out[id] = cv.toDataURL("image/jpeg", 0.85); sc.remove(a.root);
  }
  renderer.toneMapping = tm; rt.dispose(); return out;
}

// ---------- эффекты ----------
export class FX {
  constructor(scene) { this.scene = scene; this.list = []; }
  add(obj, life, upd) { this.scene.add(obj); this.list.push({ obj, t: 0, life, upd }); return obj; }
  sprite(tex, color, size, k = 2.2) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: neon(color, k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; }
  burst(pos, color, n = 12, o = {}) {
    for (let i = 0; i < n; i++) { const s = this.sprite(o.tex || TEX.glow, color, o.size || 0.3); s.position.copy(pos);
      const v = new V3(Math.random() - .5, (Math.random() - (o.down ? .8 : .2)), Math.random() - .5).normalize().multiplyScalar((o.spd || 3) * (0.4 + Math.random() * 0.8)); if (o.up) v.y = Math.abs(v.y) + o.up;
      this.add(s, (o.life || 0.6) * (0.6 + Math.random() * 0.6), (k, dt) => { s.position.addScaledVector(v, dt); v.y -= (o.grav ?? 4) * dt; s.material.opacity = 1 - k; s.scale.setScalar((o.size || 0.3) * (1 - k * 0.5)); }); }
  }
  ring(pos, color, r = 1.6, life = 0.5) { const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color: neon(color, 2.4), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); this.add(m, life, k => { m.scale.setScalar(0.2 + k * r); m.material.opacity = 1 - k; }); }
  beam(pos, color, h = 6, life = 0.6) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, h, 20, 1, true), new THREE.MeshBasicMaterial({ color: neon(color, 2.2), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); m.position.y += h / 2; this.add(m, life, k => { m.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.75; m.scale.set(1 - k * 0.5, 1, 1 - k * 0.5); }); }
  arc(pos, color, rot = 0) { const s = this.sprite(TEX.arc, color, 2.2, 3); s.position.copy(pos); s.material.rotation = rot; this.add(s, 0.28, k => { s.material.opacity = 1 - k; s.scale.setScalar(1.6 + k * 1.4); s.material.rotation = rot - k * 1.2; }); }
  orb(from, to, color, dur, onHit) { const s = this.sprite(TEX.glow, color, 0.7, 3); s.position.copy(from); let n = 0;
    this.add(s, dur, (k, dt) => { s.position.lerpVectors(from, to, k); s.position.y += Math.sin(k * Math.PI) * 0.6; if ((n += dt) > 0.03) { n = 0; this.burst(s.position, color, 1, { spd: 0.6, life: 0.3, size: 0.25, grav: 0 }); } if (k >= 1 && onHit) { onHit(); onHit = null; } }); }
  flash(pos, color, size = 4) { const s = this.sprite(TEX.glow, color, size, 2.5); s.position.copy(pos); this.add(s, 0.3, k => { s.material.opacity = 1 - k; }); }
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const e = this.list[i]; e.t += dt; const k = Math.min(1, e.t / e.life); e.upd(k, dt); if (k >= 1) { this.scene.remove(e.obj); e.obj.material && e.obj.material.dispose(); this.list.splice(i, 1); } } }
  clear() { for (const e of this.list) this.scene.remove(e.obj); this.list = []; }
}

// ---------- темы локаций ----------
export const THEMES = {
  yard: { bg: 0x0a0f22, fog: [0x0a0f22, 16, 52], hemi: [0x93a8ff, 0x1a1c2c, 1.25], dir: [0xb9c6ff, 1.5], wall: 0x555a70, floor: ["floor_dirt_small"], pack: 1, lamp: 0xffb060 },
  crypt: { bg: 0x08070e, fog: [0x08070e, 11, 36], hemi: [0x9a9cc8, 0x1c1620, 1.0], dir: [0xfff0e0, 0.7], wall: 0x77708a, floor: ["floor_tile_small", "floor_tile_small", "floor_tile_small", "floor_tile_small_broken_A", "floor_tile_small_broken_B", "floor_tile_small_weeds_A"], lamp: 0xffb060 },
  flood: { bg: 0x050b10, fog: [0x061119, 11, 36], hemi: [0x86c8cc, 0x0e181c, 1.05], dir: [0xd8fff2, 0.65], wall: 0x587880, floor: ["floor_tile_small", "floor_tile_small_weeds_A", "floor_tile_small_broken_A"], water: 0x2a8a9a, lamp: 0xa0ffe0 },
  archive: { bg: 0x09070f, fog: [0x0b0816, 11, 36], hemi: [0xb09ae8, 0x16121e, 1.05], dir: [0xf0e0ff, 0.65], wall: 0x6a5e8a, floor: ["floor_wood_small"], lamp: 0xd0a0ff },
  throne: { bg: 0x040409, fog: [0x060512, 10, 34], hemi: [0x8a8aff, 0x0c0c16, 0.95], dir: [0xd0d0ff, 0.6], wall: 0x4c4868, floor: ["floor_tile_small", "floor_tile_small", "floor_tile_small_broken_B"], lamp: 0x8fa0ff },
};
export function sceneFor(theme) {
  const T = THEMES[theme], sc = new THREE.Scene(); sc.background = new THREE.Color(T.bg); sc.fog = new THREE.Fog(T.fog[0], T.fog[1], T.fog[2]);
  sc.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
  const dir = new THREE.DirectionalLight(T.dir[0], T.dir[1]); dir.position.set(-5, 12, 7); dir.castShadow = true; dir.shadow.mapSize.set(1024, 1024);
  Object.assign(dir.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 }); dir.shadow.bias = -0.0008; dir.shadow.normalBias = 0.03; sc.add(dir, dir.target); sc.userData.dir = dir;
  return sc;
}
const SOLID = "poxru+gyafl=";
const mx = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new V3(sx, sy, sz));
class Batch {
  constructor(group) { this.map = new Map(); this.group = group; }
  add(name, m, pack) { const key = name + (pack ?? ""); let e = this.map.get(key);
    if (!e) { const node = prop(name, pack); node.updateMatrixWorld(true); const parts = []; node.traverse(o => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }); }); e = { parts, list: [] }; this.map.set(key, e); }
    e.list.push(m); }
  build(cast = true) { const t = new THREE.Matrix4(); for (const e of this.map.values()) for (const p of e.parts) { const im = new THREE.InstancedMesh(p.geo, p.mat, e.list.length); e.list.forEach((m, i) => im.setMatrixAt(i, t.multiplyMatrices(m, p.local))); im.castShadow = cast; im.receiveShadow = true; this.group.add(im); } }
}
function glowSprite(color, size, k = 2.4) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: neon(color, k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; }

// ---------- уровень ----------
export function buildLevel(mapId, ctx) {
  const map = MAPS[mapId], T = THEMES[map.theme], rows = map.rows, W = rows[0].length, H = rows.length;
  const scene = sceneFor(map.theme), group = new THREE.Group(); scene.add(group);
  const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? " " : rows[z][x];
  const isFloor = (x, z) => { const c = at(x, z); return c !== "#" && c !== " "; };
  const hash = (x, z) => { let h = (x * 73856093) ^ (z * 19349663) ^ (mapId.length * 83492791); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const isWater = (x, z) => { const c = at(x, z); if (c === "~") return true; if (!/[0-9A-Z@]/.test(c)) return false; let n = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, z + dz) === "~") n++; return n >= 2; };
  const B = new Batch(group), BN = new Batch(group), lights = [], flames = [], objs = [], anim = [];
  const wallsFull = [], wallsLow = [], water = [];
  const flame = (x, y, z, color, size = 0.9, int = 1) => { const s = glowSprite(color, size); s.position.set(x, y, z); group.add(s); flames.push({ s, size, ph: Math.random() * 9 }); lights.push({ pos: new V3(x, y, z), color, int }); return s; };
  if (map.theme === "yard") { const g = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x33313d, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.set(W, -0.03, H); g.receiveShadow = true; group.add(g); }
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = at(x, z), px = x * CS, pz = z * CS, h = hash(x, z);
    if (c === "#") {
      let near = false; for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, z + dz)) { near = true; break; }
      if (!near) continue;
      if (isFloor(x, z - 1)) { wallsLow.push([px, pz]); continue; }
      wallsFull.push([px, pz]);
      const S = (ry, ox, oz) => B.add("wall_half", mx(px + ox, 0, pz + oz, ry, 1, 0.76, 0.3).multiply(new THREE.Matrix4().makeTranslation(-1, 0, 0)));
      if (isFloor(x, z + 1)) S(0, 0, 0.98); if (isFloor(x + 1, z)) S(Math.PI / 2, 0.98, 0); if (isFloor(x - 1, z)) S(-Math.PI / 2, -0.98, 0);
      continue;
    }
    if (c === " ") { if ("ay".includes(c)) continue; continue; }
    // пол
    const wet = isWater(x, z);
    if (wet) { B.add("floor_dirt_small_A", mx(px, -0.5, pz, Math.floor(h * 4) * Math.PI / 2)); water.push([px, pz]); }
    else if (map.theme === "yard") { B.add("floor_dirt_small", mx(px, 0, pz, Math.floor(h * 4) * Math.PI / 2, 1.1, 1, 1.1), 1); if (h > 0.8 && c === ",") BN.add("path_" + "ABCD"[Math.floor(h * 97) % 4], mx(px, 0, pz, h * 6), 1); }
    else { const fl = T.floor[Math.floor(h * T.floor.length)]; B.add(fl, mx(px, fl.includes("wood") ? 0 : -0.1, pz, Math.floor(h * 4) * Math.PI / 2)); }
    // декор
    const wallZ = pz - 1;
    if (c === "t") { BN.add("torch_mounted", mx(px, 1.55, wallZ + 0.12, 0, 0.9)); flame(px, 2.2, wallZ + 0.5, 0xff8a30, 1.1, 1); }
    else if (c === "b") BN.add(["banner_red", "banner_blue", "banner_patternA_red", "banner_shield_blue", "banner_patternB_white"][Math.floor(h * 5)], mx(px, 0.05, wallZ - 0.28, 0, 0.95, 0.74, 1));
    else if (c === "k") BN.add("shelves", mx(px, 0.1, wallZ - 0.2, 0, 0.95, 0.8, 1));
    else if (c === "c") { BN.add("candle_triple", mx(px - 0.4, 0, pz + 0.2, h * 6, 0.9)); BN.add("candle_lit", mx(px + 0.35, 0, pz - 0.3, 0, 0.7)); flame(px, 0.9, pz, 0xffa040, 0.6, 0.5); }
    else if (c === "s") { BN.add("skull", mx(px + 0.3, 0, pz, h * 6, 0.5), 1); BN.add("bone_A", mx(px - 0.4, 0.05, pz + 0.3, h * 9, 0.8), 1); BN.add("ribcage", mx(px - 0.2, 0.2, pz - 0.4, h * 3, 0.6), 1); }
    else if (c === "p") B.add("pillar", mx(px, 0, pz, 0, 0.9, 0.78, 0.9));
    else if (c === "o") { B.add(h > 0.5 ? "barrel_large" : "barrel_small_stack", mx(px, 0, pz, h * 6, 0.8)); }
    else if (c === "x") B.add(h > 0.5 ? "crates_stacked" : "box_large", mx(px, 0, pz, Math.floor(h * 4) * Math.PI / 2, 0.8));
    else if (c === "r") { B.add("box_small", mx(px + 0.3, 0, pz + 0.2, h * 5, 0.9)); B.add("barrel_small", mx(px - 0.4, 0, pz - 0.3, 0, 0.9)); }
    else if (c === "u") B.add(h > 0.5 ? "coffin" : "coffin_decorated", mx(px, 0, pz, Math.PI / 2, 0.62), 1);
    else if (c === "+") { B.add(h > 0.5 ? "grave_A" : "grave_B", mx(px, 0, pz - 0.4, 0, 0.8), 1); if (h > 0.6) BN.add("candle_triple", mx(px + 0.5, 0, pz + 0.3, 0, 0.8), 1); }
    else if (c === "g") B.add(["gravestone", "gravemarker_A", "gravemarker_B"][Math.floor(h * 3)], mx(px, 0, pz, (h - 0.5) * 0.5, 0.95), 1);
    else if (c === "=") { B.add("table_medium", mx(px, 0, pz, 0, 0.8)); BN.add("candle_triple", mx(px, 0.8, pz, h * 6, 0.8)); flame(px, 1.5, pz, 0xffa040, 0.6, 0.5); }
    else if (c === "l") { B.add("post_lantern", mx(px, 0, pz, Math.PI / 2 * Math.floor(h * 4), 0.85), 1); flame(px, 2.0, pz, 0xffb050, 1.3, 1); }
    else if (c === "f") { const horiz = at(x - 1, z) === "f" || at(x + 1, z) === "f" || /[A-Z]/.test(at(x - 1, z) + at(x + 1, z)); const vert = at(x, z - 1) === "f" || at(x, z + 1) === "f";
      if (horiz) B.add("fence", mx(px, 0, pz, 0, 0.5, 0.85, 1), 1); if (vert) B.add("fence", mx(px, 0, pz, Math.PI / 2, 0.5, 0.85, 1), 1); if (horiz && vert) B.add("fence_pillar", mx(px, 0, pz, 0, 1.2, 0.95, 1.2), 1); }
  }
  // деревья стоят и за оградой
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const c = rows[z][x], h = hash(x, z + 7);
    if (c === "a") B.add(h > 0.5 ? "tree_pine_orange_large" : "tree_pine_yellow_large", mx(x * CS, 0.3, z * CS, h * 6, 0.85 + h * 0.3), 1);
    if (c === "y") B.add(h > 0.5 ? "tree_dead_large" : "tree_dead_medium", mx(x * CS, 0.2, z * CS, h * 6, 1), 1); }
  B.build(true); BN.build(false);
  // стены-блоки
  const wm = new THREE.MeshStandardMaterial({ color: new THREE.Color(T.wall).multiplyScalar(0.55), map: TEX.stone, roughness: 0.95 });
  const box = new THREE.BoxGeometry(CS, 1, CS);
  const mk = (list, hgt) => { if (!list.length) return; const im = new THREE.InstancedMesh(box, wm, list.length); list.forEach(([x, z], i) => im.setMatrixAt(i, mx(x, hgt / 2 - 0.1, z, 0, 1, hgt + 0.2, 1))); im.receiveShadow = true; im.castShadow = true; group.add(im); };
  mk(wallsFull, 3.05); mk(wallsLow, 0.8);
  let waterMat = null;
  if (water.length) { waterMat = new THREE.MeshStandardMaterial({ color: T.water || 0x2a8a9a, transparent: true, opacity: 0.6, roughness: 0.55, metalness: 0, emissive: 0x0a3a44, emissiveIntensity: 0.6 });
    const pg = new THREE.PlaneGeometry(CS, CS); pg.rotateX(-Math.PI / 2); const im = new THREE.InstancedMesh(pg, waterMat, water.length); water.forEach(([x, z], i) => im.setMatrixAt(i, mx(x, -0.14, z))); group.add(im); }

  // ---------- объекты ----------
  let start = [1, 1];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = rows[z][x]; if (c === "@") start = [x, z]; if (!/[0-9A-Z]/.test(c)) continue;
    const def = map.o[c], o = { key: c, def, x, z, pos: new V3(x * CS, 0, z * CS), node: new THREE.Group(), on: true }; o.node.position.copy(o.pos); group.add(o.node); objs.push(o);
    const add = (n, pack, s = 1, y = 0) => { const p = shadowed(prop(n, pack)); p.scale.multiplyScalar(s); p.position.y = y; o.node.add(p); return p; };
    const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dz]) => { const cc = at(x + dx, z + dz); return cc !== "#" && cc !== " " && !SOLID.includes(cc); }) || [0, 1];
    if (def.t === "npc") { o.actor = new Actor(Object.assign({}, WHO[def.who], def.pose === "sit" ? { idle: "Sit_Floor_Idle" } : {})); o.node.add(o.actor.root); }
    else if (def.t === "enemy") { o.actor = new Actor(Object.assign(foeSpec(def.foe), { idle: "Idle_Combat" })); o.node.add(o.actor.root); const s = glowSprite(0xff3040, 2.2 * (FOES[def.foe].scale || 1), 0.9); s.position.y = 0.15; o.node.add(s); o.mark = s; }
    else if (def.t === "chest") { o.chest = add("chest", 0, 0.75); o.lid = o.chest.getObjectByName("chest_lid"); o.node.rotation.y = Math.atan2(near[0], near[1]); }
    else if (def.t === "lantern") { if (def.big) { add("plaque", 1, 0.85); const l = add("lantern_standing", 1, 2.6, 0.3); o.glow = glowSprite(0xffb050, 3.2); o.glow.position.y = 1.5; o.node.add(o.glow); o.lightRef = { pos: o.pos.clone().setY(1.8), color: 0xffb050, int: 1.6 }; }
      else { add("post_lantern", 1, 0.9); o.node.rotation.y = Math.atan2(near[0], near[1]); o.glow = glowSprite(0x7fc8ff, 1.15, 1.9); o.glow.position.set(0, 2.05, 1.05); o.node.add(o.glow); const lp = o.pos.clone().add(new V3(near[0] * 1.05, 2.05, near[1] * 1.05)); o.lightRef = { pos: lp, color: 0x7fc8ff, int: 1.2 }; } lights.push(o.lightRef); }
    else if (def.t === "altar") { add("shrine", 1, 0.95); o.cand = add("candle_triple", 1, 1.0, 1.05); o.glow = glowSprite(0xffc060, 1.6); o.glow.position.y = 1.9; o.node.add(o.glow); o.lightRef = { pos: o.pos.clone().setY(1.9), color: 0xffc060, int: 0 }; lights.push(o.lightRef); }
    else if (def.t === "tablet") { const p = add("plaque", 1, 0.6); p.rotation.x = 0.62; p.position.set(0, 0.42, -0.1); o.node.rotation.y = Math.atan2(near[0], near[1]); o.glow = glowSprite(0xffd870, 1.25, 1.8); o.glow.position.set(0, 0.95, 0.3); o.node.add(o.glow); }
    else if (def.t === "gate") { const horiz = !isFloor(x - 1, z) || !isFloor(x + 1, z); const g = add("fence_gate", 1, 1); g.scale.set(0.5, 0.92, 1.4); o.node.rotation.y = horiz ? 0 : Math.PI / 2; }
    else if (def.t === "exit") { const south = near[1] === -1 && !near[0], hy = south ? 0.34 : 0.6, a = add("arch", 1, 1); a.scale.set(0.47, hy, 0.8); o.node.rotation.y = near[0] ? Math.PI / 2 : 0; const fwd = def.need ? 0x5f8cff : 0xffa050;
      const ph = south ? 1.25 : 2.3, pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, ph), new THREE.MeshBasicMaterial({ color: 0x020204, side: THREE.DoubleSide })); pl.position.y = ph / 2; o.node.add(pl); o.glow = glowSprite(fwd, south ? 2.0 : 2.6, 1.6); o.glow.position.y = south ? 0.7 : 1.2; o.node.add(o.glow); }
    else if (def.t === "set" && def.model === "crypt") { const p = add("crypt", 1, 0.85); p.position.z = -3.2; }
    else if (def.t === "set" && def.model === "flame") { add("plaque_candles", 1, 0.9); o.node.position.z -= 0.2; for (let i = 0; i < 3; i++) { const s = glowSprite(0x4f8cff, 2.6 - i * 0.6, 2.6); s.position.y = 1.2 + i * 0.7; o.node.add(s); flames.push({ s, size: 2.6 - i * 0.6, ph: i * 2 }); } lights.push({ pos: o.pos.clone().setY(2), color: 0x4f8cff, int: 2.2 }); }
    o.near = near;
  }
  // столы/проходы под объектами-«выходами» в помещении: пол уже положен общим циклом
  const L = { mapId, map, scene, group, W, H, objs, lights, start, theme: T, fx: new FX(scene),
    tile: at,
    water: (cx, cz) => isWater(cx, cz),
    solid(cx, cz) { const c = at(cx, cz); if (c === "#" || c === " " || SOLID.includes(c)) return true; for (const o of objs) if (o.on && o.solid && Math.abs(o.x - cx) <= (o.def.t === "set" ? 1 : 0) && o.z === cz) return true; return false; },
    refresh() { const f = ctx.f();
      for (const o of objs) { const d = o.def; let on = !d.if || !!d.if(f); o.solid = ["npc", "chest", "lantern", "altar", "tablet", "exit", "set"].includes(d.t);
        if (d.t === "enemy") on = !f["e_" + d.enc];
        if (d.t === "gate") { on = !d.need(f); o.solid = true; }
        if (d.t === "trigger") o.solid = false;
        if (d.t === "chest" && o.lid) o.lid.rotation.x = f["ch_" + d.id] ? -1.2 : 0;
        if (d.t === "tablet") { const got = f["tab" + d.n]; o.glow.visible = !got; o.done = !!got; }
        if (d.t === "altar") { const lit = !!f[d.sets]; o.cand.visible = lit; o.glow.visible = lit; o.lightRef.int = lit ? 1 : 0; o.done = lit; }
        if (d.t === "lantern") { if (d.big) { const lit = !f.prologue; o.glow.visible = lit; o.lightRef.int = lit ? 1.6 : 0; } }
        if (d.t === "chest") o.done = !!f["ch_" + d.id];
        o.on = on; o.node.visible = on; } },
    update(dt, t) { for (const fl of flames) { const k = 1 + Math.sin(t * 9 + fl.ph) * 0.12 + Math.sin(t * 23 + fl.ph * 2) * 0.06; fl.s.scale.setScalar(fl.size * k); }
      for (const o of objs) { if (!o.on) continue; if (o.actor) o.actor.update(dt); if (o.mark) o.mark.material.opacity = 0.5 + Math.sin(t * 4 + o.x) * 0.25; if (o.def.t === "tablet" && o.glow.visible) o.glow.scale.setScalar(1.25 + Math.sin(t * 3 + o.x) * 0.2); }
      if (waterMat) waterMat.opacity = 0.56 + Math.sin(t * 1.3) * 0.06; this.fx.update(dt); },
    dispose() { scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); } };
  L.refresh();
  return L;
}

// ---------- арена боя ----------
export function buildArena(themeId) {
  const T = THEMES[themeId] || THEMES.crypt, scene = sceneFor(themeId), B = new Batch(scene), BN = new Batch(scene), flames = [];
  const X0 = -9, X1 = 5, Z0 = -4, Z1 = 5, wz = Z0 * CS - 1, ex = X1 * CS + 1, tr = new THREE.Matrix4().makeTranslation(-1, 0, 0);
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) { const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    if (themeId === "yard") B.add("floor_dirt_small", mx(x * CS, 0, z * CS, Math.floor(h * 4) * Math.PI / 2, 1.1, 1, 1.1), 1);
    else { const fl = T.floor[Math.floor(h * T.floor.length)]; B.add(fl, mx(x * CS, fl.includes("wood") ? 0 : -0.1, z * CS, Math.floor(h * 4) * Math.PI / 2)); } }
  const torch = (x, y, z, ry, dx, dz) => { BN.add("torch_mounted", mx(x, y, z, ry, 1)); const s = glowSprite(0xff8a30, 1.3); s.position.set(x + dx, y + 0.7, z + dz); scene.add(s); flames.push(s); const pl = new THREE.PointLight(0xff8a30, 24, 17, 2); pl.position.copy(s.position); scene.add(pl); };
  if (themeId === "yard") {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x2c2b36, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.y = -0.03; scene.add(g);
    for (let x = X0; x <= X1; x++) B.add("fence", mx(x * CS, 0, wz + 0.6, 0, 0.5, 0.85, 1), 1);
    for (let z = Z0; z <= Z1; z++) B.add("fence", mx(ex - 0.6, 0, z * CS, Math.PI / 2, 0.5, 0.85, 1), 1);
    [[-12, wz - 1.5], [-6, wz - 2.5], [0, wz - 1.8], [6, wz - 2.6], [ex + 2, wz - 1], [ex + 2.6, -3], [ex + 1.8, 3], [ex + 3, 8]].forEach(([x, z], i) => B.add(i % 2 ? "tree_dead_large" : "tree_pine_orange_large", mx(x, 0, z, i, 1), 1));
    [[-8, wz + 2.4], [-2, wz + 2.6], [4, wz + 2.2], [ex - 2.4, -4], [ex - 2.6, 2]].forEach(([x, z], i) => B.add(i % 2 ? "grave_A" : "grave_B", mx(x, 0, z, x > 7 ? -Math.PI / 2 : 0, 0.85), 1));
    BN.add("post_lantern", mx(ex - 2.2, 0, wz + 2.2, -Math.PI / 4, 0.95), 1); const s = glowSprite(0xffb050, 1.5); s.position.set(ex - 2.9, 2.2, wz + 2.9); scene.add(s); flames.push(s); const pl = new THREE.PointLight(0xffb050, 30, 20, 2); pl.position.copy(s.position); scene.add(pl);
  } else {
    for (let x = X0 - 1; x <= X1; x++) B.add("wall_half", mx(x * CS, 0, wz + 1, 0, 1, 0.9, 1).multiply(tr));
    for (let z = Z0; z <= Z1 + 1; z++) B.add("wall_half", mx(ex, 0, z * CS, -Math.PI / 2, 1, 0.9, 1).multiply(tr));
    [-15, -9, -3, 3, 9].forEach(x => B.add("pillar", mx(x, 0, wz + 1.9, 0, 0.9, 0.9, 0.9))); [-4, 2, 8].forEach(z => B.add("pillar", mx(ex - 0.9, 0, z, 0, 0.9, 0.9, 0.9)));
    [-12, -6, 0, 6].forEach(x => torch(x, 2.1, wz + 1.6, 0, 0, 0.4)); [-7, -1, 5].forEach(z => torch(ex - 0.6, 2.1, z, -Math.PI / 2, -0.4, 0));
    const bn = ["banner_red", "banner_blue", "banner_patternB_white"][themeId.length % 3];
    BN.add(bn, mx(-3, 0.4, wz + 1.1, 0, 1.2, 0.85, 1)); BN.add("banner_shield_blue", mx(3, 0.4, wz + 1.1, 0, 1.1, 0.85, 1)); BN.add(bn, mx(ex - 0.1, 0.4, 2, -Math.PI / 2, 1.2, 0.85, 1)); BN.add("banner_shield_blue", mx(ex - 0.1, 0.4, -4, -Math.PI / 2, 1.1, 0.85, 1));
  }
  if (themeId === "flood") { const w = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), new THREE.MeshStandardMaterial({ color: 0x2a8a9a, transparent: true, opacity: 0.35, roughness: 0.45, emissive: 0x0a3a44, emissiveIntensity: 0.5 })); w.rotation.x = -Math.PI / 2; w.position.set(-4, 0.06, 0); scene.add(w); }
  B.build(true); BN.build(false);
  const dir = scene.userData.dir; dir.intensity = T.dir[1] * 2.2 + 0.6; dir.position.set(-6, 12, 9); dir.target.position.set(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  return { scene, fx: new FX(scene), flames, update(dt, t) { flames.forEach((s, i) => s.scale.setScalar(1.3 * (1 + Math.sin(t * 9 + i * 2) * 0.12))); this.fx.update(dt); } };
}

// подгонка камеры: вместить коробку в область экрана [top, bottom] пикселей
export function fitCamera(cam, box, yaw, pitch, topPx, botPx, xLim = 0.9) {
  const W = innerWidth, Hh = innerHeight, yMax = 1 - 2 * topPx / Hh, yMin = -1 + 2 * botPx / Hh, c = box.getCenter(new V3());
  const cs = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) cs.push(new V3(x, y, z));
  cam.clearViewOffset(); cam.aspect = W / Hh; cam.updateProjectionMatrix();
  const test = d => { cam.position.set(c.x - Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d); cam.lookAt(c); cam.updateMatrixWorld();
    let a = 9, b = -9, lo = 9, hi = -9; for (const p of cs) { const v = p.clone().project(cam); a = Math.min(a, v.x); b = Math.max(b, v.x); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } return { ok: Math.max(-a, b) <= xLim && hi - lo <= yMax - yMin, mid: (lo + hi) / 2 }; };
  let lo = 2, hi = 90; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (test(m).ok) hi = m; else lo = m; }
  const r = test(hi); cam.setViewOffset(W, Hh, 0, ((yMax + yMin) / 2 - r.mid) * Hh / 2, W, Hh); cam.updateProjectionMatrix();
}
