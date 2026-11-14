// node tools/test.cjs  (после npm run build; PLAYWRIGHT=путь к playwright, если он не установлен рядом)
// Проверка механик на новом рендере: каждая платформа держит героя, монеты, блоки, лифты, падающие настилы, чекпоинты, падение, финиш
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 1 }); const errs = [];
  pg.on('pageerror', e => errs.push('PAGE ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); pg.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text().slice(0, 300)); });
  await pg.goto('file://' + require('path').resolve(__dirname, '../dist/kubo.html')); await pg.waitForFunction(() => window.__dbg && window.__dbg.state === 'menu', null, { timeout: 180000 });
  for (const lvl of [0, 1, 2]) {
    const r = await pg.evaluate(lvl => { const g = window.__dbg; g.Q.lock = true; g.start(lvl); window.__pause = true; const P = g.player, S = g.STEP, out = { lvl, plats: 0, bad: [] };
      const run = n => { for (let i = 0; i < n; i++) g.step(S); }; const put = (x, y, z) => { P.p.set(x, y, z); P.v.set(0, 0, 0); };
      const top = c => c.y + c.tp.h;
      // 1) каждая платформа держит героя
      for (const c of g.colliders) { if (!c.alive || c.tp.brick || c.tp.qb || c.tp.falling || c.mv) continue; put(c.x, top(c) + 0.6, c.z); run(40); out.plats++; if (!P.ground || Math.abs(P.p.y - top(c)) > 0.06) out.bad.push(c.tp.m + '@' + c.ox.toFixed(1) + ',' + c.oz.toFixed(1) + ' y=' + P.p.y.toFixed(2) + ' top=' + top(c).toFixed(2)); }
      // 2) монеты
      const n0 = g.stats.coinN; for (const k of g.coins) { put(k.x, k.y - 0.4, k.z); run(3); } out.coins = (g.stats.coinN - n0) + '/' + g.coins.length;
      // 3) блоки: удар головой снизу
      let qb = 0, qbN = 0, br = 0, brN = 0; for (const c of g.colliders) { if (!(c.tp.qb || c.tp.brick)) continue; const before = g.stats.coinN; put(c.x, c.y - 1.15, c.z); P.v.y = 9; run(12); if (c.tp.qb) { qbN++; if (c.used && g.stats.coinN === before + 1) qb++; } else { brN++; if (!c.alive) br++; } }
      out.qb = qb + '/' + qbN; out.bricks = br + '/' + brN; out.total = g.stats.coinN + '/' + g.stats.coinTotal;
      // 4) падающие настилы: держат, падают под героем, возвращаются на место
      const fs = g.colliders.filter(c => c.tp.falling); let fok = 0; for (const f of fs) { put(f.ox, top(f) + 0.1, f.oz); run(20); const held = !!P.ground, y0 = f.y; run(240); const fell = f.y < y0 - 1; run(600); if (held && fell && Math.abs(f.y - y0) < 0.05) fok++; }
      out.fall = fok + '/' + fs.length;
      // 5) лифты: в 12 фазах движения герой встаёт на лифт, едет полный период, не съезжает и не проваливается
      const lifts = g.colliders.filter(c => c.mv); let lok = 0, ln = 0; for (const c of lifts) { const per = Math.round(c.mv.per / S); for (let k = 0; k < 12; k++) { run(Math.round(per / 12) + 1); ln++;
        put(c.x, top(c) + 0.05, c.z); run(20); let ok = P.ground === c, mx = 0; const ox = P.p.x - c.x, oz = P.p.z - c.z, x0 = P.p.x, y0 = P.p.y, z0 = P.p.z;
        for (let i = 0; i < per; i++) { g.step(S); if (P.ground !== c) ok = false; mx = Math.max(mx, Math.hypot(P.p.x - x0, P.p.y - y0, P.p.z - z0)); }
        if (ok && Math.abs(P.p.y - top(c)) < 0.03 && Math.hypot(P.p.x - c.x - ox, P.p.z - c.z - oz) < 0.02 && mx > 0.5) lok++; } }
      if (lifts.length) out.lift = lok + '/' + ln;
      out.light = g.U.uBaked.value === 1 ? 'запечён' : 'обычный';                // запечённый свет уровня загружен и включён
      // 6) чекпоинт и падение
      const cps = g.colliders.filter(c => c.tp.cp), cp = cps[cps.length - 1]; put(cp.x, top(cp) + 0.2, cp.z); run(30); const d0 = g.stats.deaths; put(cp.x + 30, cp.y - 30, cp.z + 30); run(400);
      out.respawn = (g.stats.deaths === d0 + 1 && Math.hypot(P.p.x - cp.x, P.p.z - cp.z) < 3) ? 'у чекпоинта' : 'НЕТ (' + P.p.x.toFixed(1) + ',' + P.p.y.toFixed(1) + ',' + P.p.z.toFixed(1) + ' deaths ' + (g.stats.deaths - d0) + ')';
      // 7) финиш
      put(g.flag.x, g.flag.y + 0.3, g.flag.z - 0.9); run(120); out.win = g.state; return out; }, lvl);
    console.log(JSON.stringify(r)); await pg.evaluate(() => { window.__pause = false; }); await pg.waitForTimeout(300);
    await pg.evaluate(() => { document.getElementById('bAgain') && 0; });
  }
  console.log(errs.slice(0, 6).join('\n') || 'no errors'); await b.close();
})();
