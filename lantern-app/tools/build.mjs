// Сборка. Результат — папка ../lantern (сайт для GitHub Pages, PWA и webDir для Capacitor)
// и dist/lantern.html (вся игра одним файлом). Другую папку можно задать через OUT=путь.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const R = (...p) => path.join(root, ...p);
const OUT = path.resolve(root, process.env.OUT || "../lantern"), O = (...p) => path.join(OUT, ...p);
const VERSION = JSON.parse(fs.readFileSync(R("package.json"), "utf8")).version;

// --- шрифты: встраиваются в CSS, чтобы игра работала без сети ---
const RANGE = {
  cyrillic: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
const FONTS = [["Rubik", "rubik", [400, 500, 700]], ["Cormorant Garamond", "cormorant-garamond", [600, 700]]];
let fontCss = "";
for (const [fam, pkg, weights] of FONTS) for (const w of weights) for (const sub of ["cyrillic", "latin"]) {
  const b = fs.readFileSync(R("node_modules/@fontsource", pkg, "files", `${pkg}-${sub}-${w}-normal.woff2`)).toString("base64");
  fontCss += `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format("woff2");unicode-range:${RANGE[sub]}}\n`;
}

// --- код ---
const out = await build({ entryPoints: [R("src/game.js")], bundle: true, minify: true, format: "iife", target: "es2020", write: false, legalComments: "none", define: { __VERSION__: JSON.stringify(VERSION) } });
const js = out.outputFiles[0].text;
const html = fs.readFileSync(R("src/index.html"), "utf8").replace("/*FONTS*/", () => fontCss);

// --- многофайловая версия ---
fs.mkdirSync(O(), { recursive: true });
fs.writeFileSync(O("game.js"), js);
const head = `<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`;
fs.writeFileSync(O("index.html"), html.replace("<!--HEAD-->", () => head).replace("<!--SCRIPT-->", () => `<script src="game.js"></script>`));
fs.writeFileSync(O("manifest.webmanifest"), JSON.stringify({
  name: "Последний фонарь", short_name: "Фонарь", description: "Сюжетная 3D-RPG с пошаговыми боями", lang: "ru", start_url: "./", scope: "./", display: "fullscreen", orientation: "any",
  background_color: "#0a0c13", theme_color: "#0a0c13",
  icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
}, null, 1));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(O()).map(f => path.relative(O(), f).split(path.sep).join("/")).filter(f => f !== "sw.js").sort();
const stamp = VERSION + "-" + Date.now().toString(36);
fs.writeFileSync(O("sw.js"), `// Кэш для игры без сети (PWA). Версия меняется при каждой сборке.
const CACHE = "lantern-${stamp}", FILES = ${JSON.stringify(["./"].concat(files))};
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith("lantern-") && x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => { if (e.request.method !== "GET") return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
`);

// --- dist/lantern.html: один файл ---
const assets = {};
for (const f of walk(O("assets"))) assets[path.relative(O("assets"), f).split(path.sep).join("/")] = fs.readFileSync(f).toString("base64");
const safe = s => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
fs.mkdirSync(R("dist"), { recursive: true });
const single = html.replace("<!--HEAD-->", "").replace("<!--SCRIPT-->", () => `<script>window.__ASSETS=${JSON.stringify(assets)}</script>\n<script>${safe(js)}</script>`);
fs.writeFileSync(R("dist/lantern.html"), single);
const kb = n => (n / 1024).toFixed(0) + " KB";
console.log(`game.js ${kb(js.length)} · index.html ${kb(fs.statSync(O("index.html")).size)} · папка игры всего ${kb(walk(O()).reduce((a, f) => a + fs.statSync(f).size, 0))} · dist/lantern.html ${kb(single.length)}`);
