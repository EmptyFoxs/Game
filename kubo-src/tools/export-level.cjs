// node tools/export-level.cjs  — выгружает неподвижную геометрию всех уровней в out/level{N}.json для запекания света.
// Геометрию строит сама игра (dist/kubo.html), поэтому в Blender попадает ровно то, что увидит игрок.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 }); const errs = [];
  pg.on('pageerror', e => errs.push('PAGE ' + e.message));
  await pg.addInitScript(() => { window.__nolight = true; });
  await pg.goto('file://' + path.resolve(__dirname, '../dist/kubo.html')); await pg.waitForFunction(() => window.__dbg && window.__dbg.state === 'menu', null, { timeout: 180000 });
  const n = await pg.evaluate(() => document.querySelectorAll('#levels button, #levels > *').length) || 3;
  fs.mkdirSync(path.resolve(__dirname, '../out'), { recursive: true });
  for (let l = 0; l < 3; l++) {
    const d = await pg.evaluate(l => { const g = window.__dbg; g.Q.lock = true; g.start(l); window.__pause = true; return g.exportStatic(); }, l);
    const f = path.resolve(__dirname, `../out/level${l}.json`); fs.writeFileSync(f, JSON.stringify(d));
    const tri = a => a.reduce((s, e) => s + e.idx.length / 3, 0);
    console.log(`level ${l}: ${d.rec.length} поверхностей (${tri(d.rec)} треугольников), ${d.occ.length} заслонов (${tri(d.occ)}), плотность ${d.dens.toFixed(1)} точек/м, ${(fs.statSync(f).size / 1e6).toFixed(1)} МБ`);
    await pg.evaluate(() => { window.__pause = false; }); await pg.waitForTimeout(200);
  }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
