const E = require("./engine4.js"); const ST = require("./story.js"); const fs = require("fs");
const NAMES = [
  ["Пробуждение", "Стена из ниоткуда", "Три мира", "Обход", "Изнанка", "Сквозь", "Двойное дно", "Лабиринт ана", "Соседи", "Зазор", "Книга миров", "Срез за срезом"],
  ["Ступенька", "Террасы", "Обрыв", "Подъём", "Водопад", "Лестница в ката", "Пирамида", "Уступы", "Скала", "Высота", "Плато", "Перевал"],
  ["Первый глитч", "Патруль", "Мерцание", "Засада", "Сквозняк", "Часовой", "Маятник", "Рой", "Тень", "Сбой", "Помехи", "Вслепую"],
  ["Плита", "Шлюз", "Противовес", "Замок", "Шестерни", "Рычаг", "Ключ ана", "Механика", "Затвор", "Сердце машины", "Гиперкуб", "Тессеракт"],
];
const SPECS = [
  { count: 12, L: [6, 16], rot: 2, cap: 200000, sp: { nx: [5, 6], nz: [5, 6], nw: [2, 3], walls: [2, 3], blocks: [0, 2], voids: [0, 1], crystals: [1, 2], buddy: 0.55 } },
  { count: 12, L: [8, 20], rot: 2, cap: 200000, sp: { nx: [5, 6], nz: [5, 6], nw: [3, 4], plateaus: [2, 4], ph: [1, 2], walls: [1, 2], voids: [0, 2], crystals: [2, 2], buddy: 0.6 }, needClimb: true },
  { count: 12, L: [8, 22], rot: 2, cap: 300000, sp: { nx: [5, 6], nz: [5, 6], nw: [3, 4], walls: [1, 2], blocks: [0, 2], plateaus: [0, 2], drones: [1, 2], crystals: [1, 2], buddy: 0.6 }, needDrone: true },
  { count: 12, L: [10, 26], rot: 2, cap: 300000, sp: { nx: [5, 6], nz: [5, 6], nw: [3, 4], walls: [1, 2], plateaus: [0, 2], gates: [1, 2], drones: [0, 1], voids: [0, 1], crystals: [2, 2], buddy: 0.6 }, needGates: true },
];
function check(lv, spec) {
  const { L, S } = E.parse(lv);
  const opt = { cap: spec.cap, needBuddy: !!lv.buddy };
  const r = E.solve(L, S, opt); if (r.len === undefined) return null;
  if (r.len < spec.L[0] || r.len > spec.L[1]) return null;
  const rot = E.rotations(r.path); if (rot < spec.rot) return null;
  const r0 = E.solve(L, S, Object.assign({}, opt, { noW: true })); if (r0.len !== undefined) return null;   // без 4D не пройти
  const rNoBud = lv.buddy ? E.solve(L, S, { cap: spec.cap }) : r;
  if (spec.needDrone) { const lv2 = Object.assign({}, lv, { drones: [] }); const q = E.parse(lv2); const rd = E.solve(q.L, q.S, opt); if (rd.len !== undefined && rd.len >= r.len) return null; }
  if (spec.needGates) { const lv2 = Object.assign({}, lv, { plates: [] }); const q = E.parse(lv2); const rg = E.solve(q.L, q.S, opt); if (rg.len !== undefined) return null; }
  if (spec.needClimb) { let up = 0, S1 = S; for (const a of r.path) { const st = E.step(L, S1, a); if (st.ev.dh > 0) up++; S1 = st.S; } if (up < 2) return null; }
  return { opt: r.len, par: rNoBud.len, sol: r.path.join(" "), rot, score: r.len + rot * 1.5 + 2 * Math.log10(r.explored) };
}
const out = [];
for (let ch = 0; ch < SPECS.length; ch++) {
  const spec = SPECS[ch], R = E.mulberry32(4242 + ch * 101);
  const hand = (ST.hand[ch] || []).map(lv => { const { L, S } = E.parse(lv); const r = E.solve(L, S, { needBuddy: !!lv.buddy }); if (r.len === undefined) throw new Error(lv.name); return Object.assign({}, lv, { opt: r.len, par: r.len, sol: r.path.join(" ") }); });
  const need = spec.count - hand.length, pool = [], seen = new Set(); let tries = 0; const t0 = Date.now();
  while (pool.length < need * 6 && tries < 8000 && Date.now() - t0 < 140000) {
    tries++;
    const lv = E.generate(R, spec.sp); if (!lv) continue;
    const k = JSON.stringify(lv); if (seen.has(k)) continue; seen.add(k);
    const c = check(lv, spec); if (!c) continue;
    pool.push(Object.assign(lv, c));
  }
  pool.sort((a, b) => a.score - b.score);
  const pick = []; for (let i = 0; i < need && pool.length; i++) pick.push(pool[Math.round(i * (pool.length - 1) / Math.max(1, need - 1))]);
  const lvls = hand.concat(pick).map((lv, i) => { const o = Object.assign({}, lv); delete o.score; o.name = NAMES[ch][i] || ("Срез " + (i + 1)); return o; });
  out.push(lvls);
  console.log(`глава ${ch}: попыток ${tries}, пул ${pool.length}, ходы: ${lvls.map(l => l.opt).join(" ")} | повороты: ${lvls.map(l => l.rot ?? "-").join(" ")} (${((Date.now() - t0) / 1000) | 0}с)`);
}
fs.writeFileSync("levels4.json", JSON.stringify(out));
