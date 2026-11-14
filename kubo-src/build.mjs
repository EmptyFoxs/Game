// Сборка «Кубо»: ../kubo (сайт) и dist/kubo.html (вся игра одним файлом).
// Модели, текстуры, звуки и запечённый свет берутся из готовой папки игры (OUT/models, OUT/tex, OUT/sounds, OUT/light).
import { build } from "esbuild"; import fs from "node:fs"; import path from "node:path";
const OUT = process.env.OUT || "../kubo";
const out = await build({ entryPoints: ["src/game.js"], bundle: true, minify: true, format: "iife", target: "es2020", write: false, legalComments: "none" });
const js = out.outputFiles[0].text, html = fs.readFileSync("src/index.html", "utf8");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "game.js"), js); fs.writeFileSync(path.join(OUT, "index.html"), html.replace("<!--SCRIPT-->", () => `<script src="game.js"></script>`));
const mime = { glb: "model/gltf-binary", webp: "image/webp", mp3: "audio/mpeg", png: "image/png" }, assets = {};
for (const d of ["models", "tex", "sounds", "light"]) if (fs.existsSync(path.join(OUT, d))) for (const f of fs.readdirSync(path.join(OUT, d))) assets[d + "/" + f] = `data:${mime[f.split(".").pop()]};base64,` + fs.readFileSync(path.join(OUT, d, f)).toString("base64");
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/kubo.html", html.replace("<!--SCRIPT-->", () => `<script>window.__ASSETS=${JSON.stringify(assets)}</script>\n<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`));
const kb = f => (fs.statSync(f).size / 1024 | 0) + " KB"; console.log(path.join(OUT, "game.js"), kb(path.join(OUT, "game.js")), "· dist/kubo.html", kb("dist/kubo.html"));
