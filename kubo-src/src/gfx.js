// «Кубо» — рендер: небо, свет, материалы, процедурные острова, облака, трава, модели
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export const A = window.__ASSETS || null;
export const aurl = k => (A && A[k]) || k;
export const b64buf = d => { const b = atob(d.split(",")[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };

export const canvas = document.getElementById("gl");
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92; renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
scene.fog = new THREE.Fog(0xffffff, 70, 460);
export const SUN_DIR = new THREE.Vector3(0.62, 0.50, 0.44).normalize(), SUN_OFF = SUN_DIR.clone().multiplyScalar(34);
export const sun = new THREE.DirectionalLight(0xffd7a2, 4.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 90 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2.5; scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xa9c2ff, 0x5a4a3a, 0.22); scene.add(hemi);
// небо: свой градиентный купол (зенит -> горизонт), тёплое свечение у солнца и диск; из него же строится карта окружения
const HOR = new THREE.Color(0.44, 0.58, 0.82), ZEN = new THREE.Color(0.06, 0.18, 0.52);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sunDir: { value: SUN_DIR }, hor: { value: HOR }, zen: { value: ZEN } },
  vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
  fragmentShader: `uniform vec3 sunDir, hor, zen; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.); vec3 c = mix(hor, zen, pow(h, .42)); c = mix(c, hor * vec3(.92, .95, 1.), smoothstep(.02, -.3, d.y));
      float s = max(dot(d, sunDir), 0.); c += vec3(1., .66, .36) * (pow(s, 5.) * .30 + pow(s, 60.) * .9) + vec3(1., .9, .72) * smoothstep(.9992, .9997, s) * 30.; gl_FragColor = vec4(c, 1.); }` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);
{ const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat)); scene.environment = pm.fromScene(es, 0, 1, 3000).texture; scene.environmentIntensity = 0.85; pm.dispose(); }
scene.fog.color.copy(HOR);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera)); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.6, 1.15); composer.addPass(bloom); composer.addPass(new OutputPass());
export const Q = { cap: 2, lvl: 0, t: 0, n: 0, lock: false };
export function resize() {
  const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, Q.cap); renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 68 : 52; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
function adapt(raw) {                                              // слабый телефон: ступенчато снижаем разрешение, затем свечение и размер теней
  if (Q.lock || raw > 0.4) return; Q.t += raw; if (++Q.n < 60) return; const avg = Q.t / Q.n; Q.t = Q.n = 0; if (avg < 1 / 26 || Q.lvl >= 3) return; Q.lvl++;
  Q.cap = [2, 1.5, 1.15, 1][Q.lvl]; if (Q.lvl >= 2) bloom.enabled = false; if (Q.lvl === 3) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map && sun.shadow.map.dispose(); sun.shadow.map = null; } resize();
}
export const uTime = { value: 0 };
let lastT = performance.now();
export function frame() { const now = performance.now(), raw = (now - lastT) / 1000; lastT = now; uTime.value += Math.min(raw, 0.05); adapt(raw); sky.position.copy(camera.position); composer.render(); }

// ---------- вспомогательное ----------
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h3 = (x, y, z, s) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(s, 144665); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
function vn3(x, y, z, s) { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, v = y - Y, w = z - Z, f = t => t * t * (3 - 2 * t), a = f(u), b = f(v), c = f(w), L = (p, q, t) => p + (q - p) * t;
  return L(L(L(h3(X, Y, Z, s), h3(X + 1, Y, Z, s), a), L(h3(X, Y + 1, Z, s), h3(X + 1, Y + 1, Z, s), a), b), L(L(h3(X, Y, Z + 1, s), h3(X + 1, Y, Z + 1, s), a), L(h3(X, Y + 1, Z + 1, s), h3(X + 1, Y + 1, Z + 1, s), a), b), c); }
function cnv(w, h, fn) { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const radial = (stops) => cnv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
export const texShadow = radial([[0, "rgba(0,0,0,.9)"], [0.55, "rgba(0,0,0,.45)"], [1, "rgba(0,0,0,0)"]]);
export const texPart = radial([[0, "rgba(255,255,255,.9)"], [0.5, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]);

// ---------- материалы ----------
const TL = new THREE.TextureLoader(); export const MAT = {}, M = {}; let lampSrc = null;
function tileMat(name, opt = {}) {
  const t = k => { const x = TL.load(aurl(`tex/${name}_${k}.webp`)); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; return x; }, c = t("color"), o = t("rm"); c.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial(Object.assign({ map: c, normalMap: t("normal"), aoMap: o, roughnessMap: o, metalness: 0, vertexColors: true, envMapIntensity: 0.8 }, opt));
}
const flameMat = new THREE.ShaderMaterial({ uniforms: { t: uTime, uY: { value: new THREE.Vector2(0, 1) } },
  vertexShader: `uniform float t; uniform vec2 uY; varying vec3 vN, vV; varying float vH;
    void main(){ vec3 p = position; float s = uY.y - uY.x, h = clamp((p.y - uY.x) / s, 0., 1.); vH = h;
      p.x += (sin(t * 9. + h * 4.) * 0.035 * h * h + sin(t * 23.) * 0.015 * h) * s; p.z += cos(t * 7.3) * 0.024 * h * h * s; p.y += sin(t * 13.) * 0.045 * h * s;
      vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN, vV; varying float vH;
    void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); vec3 c = mix(vec3(1., .80, .42), vec3(1., .36, .06), smoothstep(.3, 1., vH)); c = mix(vec3(.55, .45, .75), c, smoothstep(0., .13, vH));
      float a = .22 + .78 * f * (1. - smoothstep(.75, 1., vH) * .5); gl_FragColor = vec4(c * a * 9., 1.); }` });
const glowTex = radial([[0, "rgba(255,200,120,1)"], [0.3, "rgba(255,150,60,.55)"], [1, "rgba(255,120,30,0)"]]);

export async function loadAssets(onProg) {
  MAT.stone = tileMat("stone", { normalScale: new THREE.Vector2(1.3, 1.3) }); MAT.rock = tileMat("rock", { normalScale: new THREE.Vector2(1.7, 1.7) }); MAT.grass = tileMat("grass"); MAT.rock.color.setScalar(0.9); MAT.stone.color.setScalar(0.95);
  const gl = new GLTFLoader(), load = k => A ? gl.parseAsync(b64buf(A[k]), "") : gl.loadAsync(k); let n = 0;
  const [kit, lamp] = await Promise.all(["models/kit.glb", "models/lamp.glb"].map(k => load(k).then(g => { onProg(++n / 2); return g; })));
  kit.scene.updateMatrixWorld(true);
  kit.scene.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
    if (/__glow$/.test(o.name)) { o.castShadow = o.receiveShadow = false; o.material.emissiveIntensity = /qb/.test(o.name) ? 0.75 : 4; } else { o.material.envMapIntensity = 0.9; if (o.material.map) o.material.map.anisotropy = 4; } M[o.name] = o; });
  lampSrc = lamp.scene; lampSrc.traverse(o => { if (!o.isMesh) return; const nm = o.name + " " + o.material.name;
    if (/flame/i.test(nm)) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; o.material = flameMat.clone(); o.material.uniforms.t = uTime; o.material.uniforms.uY.value.set(bb.min.y, bb.max.y); o.userData.flame = 1; }
    else if (/glass/i.test(nm)) { o.material = new THREE.MeshStandardMaterial({ color: 0xcfe0dc, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 2.2 }); o.renderOrder = 3; o.userData.glass = 1; }
    else if (/table/i.test(nm)) o.visible = false;
    else { o.castShadow = false; o.receiveShadow = true; } });
}
export function inst(name) { const m = M[name].clone(); m.position.set(0, 0, 0); const g = M[name + "__glow"]; if (g) { const c = g.clone(); c.material = g.material.clone(); c.position.set(0, 0, 0); m.add(c); m.userData.glow = c; } return m; }
export function makeLamp(scale) {
  const o = lampSrc.clone(true); o.scale.setScalar(scale); const L = { obj: o, lit: null, flame: null, halo: null };
  o.traverse(c => { if (c.userData.flame) L.flame = c; });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.material.color.setScalar(1.3); s.scale.setScalar(0.34); s.position.set(0, 0.135, 0); o.add(s); L.halo = s;
  L.set = v => { if (L.lit === v) return; L.lit = v; L.flame.visible = v; s.visible = v; }; L.set(false); return L;
}

// ---------- острова ----------
const sq = (th, n) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(th)), n) + Math.pow(Math.abs(Math.sin(th)), n), 1 / n);
function ringGeo(rows, uvs, cols, closeUV) {                      // rows[i][j] = [x,y,z]; одиночная точка = вершина-стяжка
  const pos = [], uv = [], col = [], idx = [], base = []; const N = rows[0].p.length > 1 ? rows[0].p.length : rows[1].p.length;
  for (const r of rows) { base.push(pos.length / 3); const n = r.p.length > 1 ? N + 1 : 1;
    for (let j = 0; j < n; j++) { const p = r.p[j % r.p.length]; pos.push(p[0], p[1], p[2]); const u = r.uv(j, p); uv.push(u[0], u[1]); const c = r.c ?? 1; col.push(c, c, c); } }
  for (let i = 0; i < rows.length - 1; i++) { const a = rows[i], b = rows[i + 1], A0 = base[i], B0 = base[i + 1];
    for (let j = 0; j < N; j++) { if (a.p.length === 1) idx.push(A0, B0 + j + 1, B0 + j); else if (b.p.length === 1) idx.push(A0 + j, A0 + j + 1, B0); else idx.push(A0 + j, A0 + j + 1, B0 + j + 1, A0 + j, B0 + j + 1, B0 + j); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nrm = g.attributes.normal; rows.forEach((r, i) => { if (r.p.length > 1) { const a = base[i], b = a + N, x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b), l = Math.hypot(x, y, z) || 1; nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l); } });
  return g;
}
// o: { w | r, h, seed, grass, depth, far }
export function makeIsland(o) {
  const R0 = o.r ?? o.w / 2, round = !!o.r, N = Math.min(128, Math.max(40, Math.round(R0 * 2 * Math.PI * 5 / 8) * 8)), h = o.h, seed = o.seed | 0, rnd = rng(seed + 11), G = new THREE.Group();
  const outline = th => round ? R0 * (1 + (vn3(Math.cos(th) * 2 + 5, Math.sin(th) * 2 + 5, 1, seed) - 0.5) * 0.03) : R0 * sq(th, 14);
  const ring = (y, f, extra) => { const p = []; for (let j = 0; j < N; j++) { const th = j / N * Math.PI * 2, r = (extra ? extra(th) : outline(th)) * f; p.push([Math.cos(th) * r, y, Math.sin(th) * r]); } return p; };
  const ox = rnd() * 2, oz = rnd() * 2, planar = (j, p) => [(p[0] + ox * 2) / 1.3, (p[2] + oz * 2) / 1.3], mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.userData.own = 1; x.castShadow = cast && !o.far; x.receiveShadow = !o.far; G.add(x); return x; };
  // верх
  const rin = o.grass ? Math.max(0.3, 1 - (o.far ? 0.12 * 6 / R0 : 0.42 / R0)) : 0.55;
  mesh(ringGeo([{ p: [[0, h, 0]], uv: planar }, { p: ring(h, rin * 0.5), uv: planar }, { p: ring(h, rin), uv: planar }], 0, N), o.grass ? MAT.grass : MAT.stone, false);
  mesh(ringGeo([{ p: ring(h, rin), uv: planar }, { p: ring(h, 0.985), uv: planar }], 0, N), MAT.stone, false);
  // кромка плит и скала
  const per = 2 * Math.PI * R0 * (round ? 1 : 1.2), US = Math.max(1, Math.round(per / 1.3)), UR = Math.max(1, Math.round(per / 1.6)), band = 0.3, D = o.depth ?? (round ? 3.4 : 0.8 + o.w * 0.5), lean = [(rnd() - 0.5) * 0.5 * R0, (rnd() - 0.5) * 0.5 * R0];
  const su = j => j / N * US;
  mesh(ringGeo([{ p: ring(h, 0.985), uv: (j, p) => [su(j), p[1] / 1.3] }, { p: ring(h - 0.035, 1.0), uv: (j, p) => [su(j), p[1] / 1.3 - 0.01] }, { p: ring(h - band, 1.0), uv: (j, p) => [su(j), p[1] / 1.3 - 0.01] }, { p: ring(h - band, 0.9), c: 0.5, uv: (j, p) => [su(j), p[1] / 1.3 - 0.08] }], 0, N), MAT.stone);
  const rows = [], K = o.far ? 6 : 9, y0 = h - band;
  for (let k = 0; k <= K; k++) { const t = k / K, y = y0 - D * Math.pow(t, 1.12), f = 0.95 * (1 - 0.93 * Math.pow(t, o.far ? 2.8 : 2.1)), mor = Math.min(1, t * 2.2), ao = 0.5 + 0.5 * Math.pow(1 - t, 0.8) * (k === 0 ? 0.75 : 1);
    const p = []; for (let j = 0; j < N; j++) { const th = j / N * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const nz = (vn3(c * 1.6 + 9, s * 1.6 + 9, t * 2.4, seed) - 0.5) * 0.46 + (vn3(c * 4.5 + 3, s * 4.5 + 3, t * 6, seed + 7) - 0.5) * 0.2 + Math.sin(t * 19 + vn3(c * 2, s * 2, 0, seed) * 6) * 0.035;
      const r = (outline(th) * (1 - mor) + R0 * 1.04 * mor) * f * (1 + nz * Math.min(1, t * 5 + 0.15)); p.push([c * r + lean[0] * t * t, y, s * r + lean[1] * t * t]); }
    rows.push({ p, c: ao, uv: (j, q) => [j / N * UR, q[1] / 1.6] }); }
  rows.push({ p: [[lean[0], y0 - D * 1.06, lean[1]]], c: 0.42, uv: (j, q) => [(j + 0.5) / N * UR, q[1] / 1.6] });
  mesh(ringGeo(rows, 0, N), MAT.rock);
  G.userData.rin = rin * R0; return G;
}

// ---------- трава ----------
const bladeTex = cnv(256, 256, (g, w, h) => { const r = rng(5); g.clearRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { const x0 = 128 + (r() - 0.5) * 120, lean = (r() - 0.5) * 130 + (x0 - 128) * 0.7, ht = 110 + r() * 140, wd = 5 + r() * 6, gr = g.createLinearGradient(0, 256, 0, 256 - ht), hue = 70 + r() * 40, l = 20 + r() * 16;
    gr.addColorStop(0, `hsl(${hue},48%,${l * 0.55}%)`); gr.addColorStop(0.6, `hsl(${hue},50%,${l}%)`); gr.addColorStop(1, `hsl(${hue - 14},55%,${l + 14}%)`); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0 - wd, 256); g.quadraticCurveTo(x0 - wd * 0.4 + lean * 0.35, 256 - ht * 0.55, x0 + lean, 256 - ht); g.quadraticCurveTo(x0 + wd * 0.4 + lean * 0.35, 256 - ht * 0.55, x0 + wd, 256); g.fill(); } });
const grassMat = new THREE.MeshStandardMaterial({ map: bladeTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
grassMat.onBeforeCompile = s => { s.uniforms.uT = uTime; s.vertexShader = "uniform float uT;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vec4 ip = instanceMatrix[3]; float k = uv.y * uv.y; transformed.x += sin(uT * 1.7 + ip.x * 1.3 + ip.z * 0.7) * 0.22 * k; transformed.z += cos(uT * 1.3 + ip.z * 1.1) * 0.12 * k;"); };
const tuftGeo = (() => { const g = new THREE.BufferGeometry(), p = [], u = [], n = [], ix = []; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, c = Math.cos(a) * 0.5, s = Math.sin(a) * 0.5, b = k * 4; p.push(-c, 0, -s, c, 0, s, c, 1, s, -c, 1, -s); u.push(0, 0, 1, 0, 1, 1, 0, 1); n.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); ix.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2)); g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3)); g.setIndex(ix); return g; })();
export function makeGrass(list) {                                  // list: [x, y, z, size]
  const im = new THREE.InstancedMesh(tuftGeo, grassMat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), r = rng(list.length);
  list.forEach(([x, y, z, s], i) => { e.set(0, r() * 6.28, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(x, y - 0.02, z), q, new THREE.Vector3(s * (0.9 + r() * 0.5), s * (0.7 + r() * 0.7), s)); im.setMatrixAt(i, m); c.setHSL(0.22 + r() * 0.07, 0.5, 0.42 + r() * 0.2); im.setColorAt(i, c); });
  im.receiveShadow = true; im.frustumCulled = false; return im;
}

// ---------- облака ----------
const cloudTex = [1, 2, 3].map(sd => cnv(256, 160, (g, w, h) => { const r = rng(sd * 31); g.clearRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.7), x = 128 + Math.cos(a) * d * 86, y = 92 + Math.sin(a) * d * 30 - (1 - d) * 22, rad = 16 + r() * 30 * (1.15 - d), gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,.34)"); gr.addColorStop(0.6, "rgba(255,255,255,.14)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.globalCompositeOperation = "source-atop"; const sh = g.createLinearGradient(0, 30, 0, 140); sh.addColorStop(0, "rgba(255,244,228,1)"); sh.addColorStop(0.55, "rgba(226,222,232,1)"); sh.addColorStop(1, "rgba(150,160,190,1)"); g.fillStyle = sh; g.fillRect(0, 0, w, h); }));
export function makeCloud(i, w, tint = 1.9) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex[i % 3], transparent: true, depthWrite: false, fog: false })); s.material.color.setRGB(tint * (tint < 1.3 ? 0.84 : 1), tint * (tint < 1.3 ? 0.9 : 0.97), tint * (tint < 1.3 ? 1 : 0.94)); s.scale.set(w, w * 0.62, 1); return s; }

// ---------- Кубо ----------
export function makeKubo() {
  const holder = new THREE.Group(), piv = (name, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); const m = inst(name); m.position.set(-x, -y, -z); g.add(m); holder.add(g); return g; };
  const body = piv("kubo_body", 0, 0.56, 0), ant = piv("kubo_ant", 0.13, 0.8, -0.06), fl = piv("kubo_footL", 0.13, 0.33, 0), fr = piv("kubo_footR", -0.13, 0.33, 0);
  body.add(ant); ant.position.set(0.13, 0.24, -0.06); const jet = M["kubo_jet__glow"].clone(); jet.material = jet.material.clone(); jet.position.set(0, -0.56, 0); jet.visible = false; body.add(jet);
  return { holder, body, ant, fl, fr, jet, eyes: body.children[0].userData.glow, ph: 0, blink: 2, jetT: 0, antV: 0, antA: 0 };
}

// ---------- море облаков ----------
const seaTex = cnv(512, 512, (g, w, h) => { const r = rng(77); g.clearRect(0, 0, w, h);
  for (let i = 0; i < 54; i++) { const x = r() * w, y = r() * h, rad = 30 + r() * 78, a = 0.16 + r() * 0.3;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { if (x + dx + rad < 0 || x + dx - rad > w || y + dy + rad < 0 || y + dy - rad > h) continue; const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.5})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); } } });
seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
export function makeCloudSea(y) {
  const G = new THREE.Group(), geo = new THREE.PlaneGeometry(1800, 1800); geo.rotateX(-Math.PI / 2);
  [[0, 6, 0.95, 0.95], [3.5, 3.7, 0.85, 1.1], [7, 9, 0.6, 1.25]].forEach(([dy, rep, op, k], i) => { const t = seaTex.clone(); t.repeat.set(rep, rep); t.offset.set(i * 0.37, i * 0.21); t.needsUpdate = true;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: op })); m.material.color.setRGB(0.92 * k, 0.95 * k, 1.0 * k); m.position.y = y + dy; m.renderOrder = -2 + i; m.userData.drift = 0.0012 * (i + 1); G.add(m); });
  const base = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.30, 0.40, 0.64) })); base.position.y = y - 6; base.renderOrder = -3; G.add(base);
  G.userData.tick = dt => G.children.forEach(m => { if (m.userData.drift) m.material.map.offset.x += m.userData.drift * dt; }); return G;
}
