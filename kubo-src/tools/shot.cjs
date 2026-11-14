// node tools/shot.cjs name level "yaw,pitch,dist[,px,py,pz | ,номер платформы];..." [w h]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const [name, lvl, views, w, h] = [process.argv[2], +(process.argv[3] || 0), process.argv[4] || '0.6,0.42,10', +(process.argv[5] || 520), +(process.argv[6] || 900)];
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const errs = [];
  if (process.env.NOLIGHT) await pg.addInitScript(() => { window.__nolight = true; });
  pg.on('pageerror', e => errs.push('PAGE ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); pg.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0, 300)); });
  await pg.goto('file://' + require('path').resolve(__dirname, '../dist/kubo.html')); await pg.waitForFunction(() => window.__dbg && window.__dbg.state === 'menu' || document.getElementById('err').textContent, null, { timeout: 180000 }).catch(() => errs.push('not ready'));
  const er = await pg.evaluate(() => document.getElementById('err').textContent); if (er) errs.push('ERR ' + er);
  if (!er) { await pg.evaluate(l => { window.__dbg.Q.lock = true; window.__dbg.start(l); window.__pause = true; }, lvl); if (process.env.SUN) await pg.evaluate(v => { window.__dbg.sun.intensity = v; }, +process.env.SUN); let i = 0; const t0 = Date.now();
    for (const v of views.split(';')) { const a = v.split(',').map(Number);
      const url = await pg.evaluate(a => { const g = window.__dbg; if (a.length === 4) { const c = g.colliders[a[3]]; g.player.p.set(c.x, c.y + c.tp.h + 0.05, c.z); g.player.v.set(0, 0, 0); } else if (a.length > 3) { g.player.p.set(a[3], a[4], a[5]); g.player.v.set(0, 0, 0); } g.cam = [a[0], a[1], a[2]]; for (let k = 0; k < 90; k++) g.tick(k < 30 ? 2 : 0); g.snap(); return g.snap(); }, a);
      fs.mkdirSync('shots', { recursive: true }); fs.writeFileSync(`shots/${name}_${i++}.jpg`, Buffer.from(url.split(',')[1], 'base64')); }
    console.log('sec/view', ((Date.now() - t0) / 1000 / i).toFixed(1)); }
  console.log(errs.slice(0, 6).join('\n') || 'no errors'); await b.close();
})();
