// node tools/bot.cjs [номера уровней через запятую]  — бот проходит уровни по настоящей физике игры (после npm run build).
// Он идёт по платформам в порядке маршрута, прыгает у края, в воздухе правит на цель и при нужде делает второй прыжок,
// ждёт лифты и мигающие платформы. Если бот дошёл до фонаря — уровень проходим. Заодно ищет наложения неподвижных платформ.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 }); const errs = [];
  pg.on('pageerror', e => errs.push('PAGE ' + e.message));
  await pg.goto('file://' + path.resolve(__dirname, '../dist/kubo.html')); await pg.waitForFunction(() => window.__dbg && window.__dbg.state === 'menu', null, { timeout: 180000 });
  const n = await pg.evaluate(() => window.__dbg.levels); const want = process.argv[2] ? process.argv[2].split(',').map(Number) : [...Array(n).keys()]; let bad = 0;
  for (const lvl of want) {
    const r = await pg.evaluate(lvl => { const g = window.__dbg; g.Q.lock = true; window.__pause = false; g.start(lvl); window.__pause = true; const P = g.player, S = g.STEP;
      const half = c => c.tp.r || c.tp.w / 2, top = c => c.y + c.tp.h, R = g.colliders.filter(c => !c.tp.brick && !c.tp.qb);
      const inside = (c, x, z, pad) => c.tp.r ? Math.hypot(x - c.x, z - c.z) < c.tp.r + pad : Math.abs(x - c.x) < c.tp.w / 2 + pad && Math.abs(z - c.z) < c.tp.w / 2 + pad;
      // наложения неподвижных платформ (в плане, при близкой высоте)
      const st = R.filter(c => !c.mv), over = [];
      for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) { const a = st[i], c = st[j]; if (Math.abs(top(a) - top(c)) < 3.2 && Math.hypot(a.ox - c.ox, a.oz - c.oz) < half(a) + half(c) - 0.35) over.push([R.indexOf(a), R.indexOf(c)]); }
      const moving = c => !!c.mv || !!c.tp.blink;
      // лифты одной карусели (общий центр круга) — одна ступень маршрута: садимся на любой, сходим на платформу после карусели
      const grp = c => c.mv && c.mv.orbit ? c.mv.cx + ',' + c.mv.cz + ',' + c.mv.orbit : null;
      const nextOf = i => { const gi = grp(R[i]); let j = i + 1; while (gi && j < R.length && grp(R[j]) === gi) j++; if (j >= R.length) return null;
        const gj = grp(R[j]); if (!gj) return R[j]; let best = R[j], bd = 1e9; for (let k = j; k < R.length && grp(R[k]) === gj; k++) { const d = Math.hypot(R[k].x + R[k].dx / S * 0.5 - P.p.x, R[k].z + R[k].dz / S * 0.5 - P.p.z); if (d < bd) { bd = d; best = R[k]; } } return best; }; let t = 0, stuck = 0, lastIdx = 0, lastDeaths = 0, failsAt = {}, jumpT = -1, log = [];
      const maxT = 900 / S;
      while (g.state === 'play' && t < maxT) {
        const cur = P.last || R[0], i0 = R.indexOf(cur), i = i0 < 0 ? Math.max(0, lastIdx) : i0, nb = nextOf(i), last = !nb; let tx, tz, B = null;   // i0 < 0: стоим на блоке, цель прежняя
        if (g.deaths !== lastDeaths) { lastDeaths = g.deaths; failsAt[lastIdx] = (failsAt[lastIdx] || 0) + 1; if (failsAt[lastIdx] > 14) return { lvl, ok: false, why: 'не проходится участок после платформы ' + lastIdx + ' (' + (R[lastIdx].tp.m || 'cloud') + ')', deaths: g.deaths, over }; }
        if (i !== lastIdx && P.ground) { lastIdx = i; }
        if (last) { tx = g.flag.x; tz = g.flag.z; } else { B = nb; const lead = P.ground ? 0.42 : 0.2; tx = B.x + B.dx / S * lead; tz = B.z + B.dz / S * lead; }
        let dx = tx - P.p.x, dz = tz - P.p.z, d = Math.hypot(dx, dz) || 1e-6, ix = dx / d, iz = dz / d, inp = [ix, iz];
        if (P.ground) {
          const A = P.ground; g.hold = false;
          if (i0 < 0 && !last) { const A0 = R[i], l = Math.hypot(B.x - A0.x, B.z - A0.z) || 1; inp = [(B.x - A0.x) / l, (B.z - A0.z) / l]; }   // оказались на блоке: сходим с него дальше по ходу
          else if (!last) {
            const gapNow = Math.max(0, Math.hypot(B.x - P.p.x, B.z - P.p.z) - half(B)), rise = top(B) - P.p.y, wait = moving(A) || moving(B) || !!B.tp.falling || !!B.tp.bounce;
            let ready = true;
            if (B.tp.blink) { const k = B.blink, ph = (g.time + k.phase) % (k.on + k.off); ready = ph < k.on - 1.15; }
            if (B.tp.falling && (B.fallT >= 0 || !B.alive)) ready = false;                      // настил ещё не вернулся на место — ждём
            if (B.tp.falling || B.tp.bounce) { let C = B, lag = 0.9; while (C && (C.tp.falling || C.tp.bounce)) { lag += C.tp.bounce ? 1.1 : 0.75; C = nextOf(R.indexOf(C)); }      // за падающими настилами мигающая: на настиле и батуте не постоишь, момент выбираем заранее
              if (C && C.tp.blink) { const k = C.blink, ph = (g.time + lag - 0.75 + k.phase) % (k.on + k.off); if (!(ph < k.on - 1.5)) ready = false; } }
            if (wait) {                                            // стоим в полуметре от края со стороны цели и ждём момента
              const ex = A.x + ix * (half(A) - 0.55), ez = A.z + iz * (half(A) - 0.55), de = Math.hypot(ex - P.p.x, ez - P.p.z);
              const pg2 = Math.max(0, Math.hypot(tx - P.p.x, tz - P.p.z) - half(B)), closing = Math.hypot(B.x + B.dx - P.p.x, B.z + B.dz - P.p.z) <= Math.hypot(B.x - P.p.x, B.z - P.p.z) + 1e-9;
              ready = ready && pg2 < 3.3 && rise < 1.55 && rise > -7 && (closing || pg2 < 1.6 || !B.mv || B.mv.ay);
              if (!ready || de > 0.5) { const ddx = ex - P.p.x, ddz = ez - P.p.z; inp = de > 0.12 ? [ddx / de * Math.min(1, de * 3), ddz / de * Math.min(1, de * 3)] : [0, 0]; if (A.tp.falling) ready = true; }
              if (ready && de <= 0.5) { g.pressJump(); g.hold = true; jumpT = t; }
            } else if (!inside(A, P.p.x + ix * 0.3, P.p.z + iz * 0.3, 0)) { g.pressJump(); g.hold = true; jumpT = t; }
          }
        } else {
          g.hold = true;
          if (B) { const over = inside(B, P.p.x, P.p.z, -0.25), dc = Math.hypot(B.x - P.p.x, B.z - P.p.z);
            if (over) inp = [ix * Math.min(1, dc / 0.6) - P.v.x / 5.6 * 0.6, iz * Math.min(1, dc / 0.6) - P.v.z / 5.6 * 0.6];
            if (P.jumps === 1 && P.v.y < 0.4 && !over && t - jumpT > 6) { g.pressJump(); jumpT = t; } }
        }
        g.bot = inp; g.step(S); t++;
      }
      g.bot = null; g.hold = false;
      return { lvl, ok: g.state === 'win', time: +(t * S).toFixed(1), deaths: g.deaths, plats: R.length, par: g.par, over, falls: Object.entries(failsAt).map(([k, v]) => k + ':' + (R[k].tp.m || 'cloud') + '>' + (nextOf(+k) ? nextOf(+k).tp.m || 'cloud' : '?') + ' x' + v).join(', '), why: g.state === 'win' ? '' : 'время вышло на участке ' + Math.max(0, R.indexOf(P.last)) + ' ' + JSON.stringify({ p: [P.p.x, P.p.y, P.p.z].map(v => +v.toFixed(2)), ground: P.ground ? g.colliders.indexOf(P.ground) + ':' + (P.ground.tp.m || 'cloud') : null, last: P.last && (P.last.tp.m || 'cloud'), lastIdx }) }; }, lvl);
    if (!r.ok || r.over.length) bad++;
    console.log(`уровень ${lvl + 1}: ${r.ok ? 'пройден ботом за ' + r.time + ' с (норматив ' + r.par + ' с), падений ' + r.deaths + (r.falls ? ' [' + r.falls + ']' : '') + ', платформ ' + r.plats : 'НЕ ПРОЙДЕН: ' + r.why + ', падений ' + r.deaths}${r.over.length ? ' | НАЛОЖЕНИЯ: ' + JSON.stringify(r.over) : ''}`);
    await pg.evaluate(() => { window.__pause = false; }); await pg.waitForTimeout(150);
  }
  console.log(errs.join('\n') || 'no errors'); await b.close(); process.exit(bad ? 1 : 0);
})();
