// Генерация уровней: случайные кандидаты -> решатель -> фильтры качества -> сортировка по сложности
const E = require("./engine.js");
const INTRO = require("./intro.js");
const fs = require("fs");

const NAMES = [
  ["Первый шаг", "Стена решает", "Три ветви", "Развилка", "Параллели", "Рассинхрон", "Узкий проход", "Две тропы", "Шаг в сторону", "Лабиринт близнецов", "Тень и свет", "Сдвиг фазы", "Разные судьбы"],
  ["Отражение", "Край пустоты", "Левша", "Обратная сторона", "Зазеркалье", "Пропасть", "Кривое зеркало", "Перевёртыш", "Хрупкий мост", "Симметрия", "Антимир", "Бездна смотрит"],
  ["Отзвук", "Две секунды назад", "Запоздалый", "Петля", "Догоняя себя", "Пауза", "Ритм", "Опоздание", "Эхо в коридоре", "Сбитый такт", "Шёпот прошлого", "Хор"],
  ["Трещина", "Портал", "Переселение", "Шов", "Сквозь ветви", "Чужой мир", "Скачок", "Мост между мирами", "Вдвоём", "Пересадка", "Разрыв", "Сшивание"],
  ["Причина и следствие", "Держи дверь", "Ключ в другом мире", "Эффект бабочки", "Цепная реакция", "Сторож", "Замок", "Связь", "Открой мне", "Вахта", "Шлюз", "Парадокс"],
  ["Мост из массы", "Груз на кнопке", "Толчок", "Засыпать бездну", "Грузчик", "Тяжесть", "Камень преткновения", "Насыпь", "Противовес", "Склад", "Тупик", "Опора"],
  ["Всё сразу", "Мультивселенная", "Перекрёсток времён", "Пятая ось", "Узел", "Квантовый шаг", "Сингулярность", "Горизонт", "Хронос", "Энтропия", "Струны", "Голограмма", "Многоголосие", "Ткань времени", "Точка схода", "Сердце мультивселенной"],
];

const SPECS = [
  { count: 13, L: [5, 16], cap: 60000, sp: { N: [2, 3], W: [5, 6], H: [4, 6], wall: [0.12, 0.3] }, need: ["bump"] },
  { count: 12, L: [5, 18], cap: 80000, sp: { N: [2, 3], W: [5, 6], H: [4, 6], wall: [0.08, 0.22], voids: [1, 3], mirror: [1, 2], mirrorBoth: true }, need: ["bump"] },
  { count: 12, L: [5, 18], cap: 120000, sp: { N: [2, 3], W: [5, 6], H: [4, 6], wall: [0.1, 0.24], voids: [0, 2], delay: [1, 2], dval: [1, 2] }, need: ["delayMatters"] },
  { count: 12, L: [5, 20], cap: 80000, sp: { N: [2, 3], W: [5, 6], H: [4, 6], wall: [0.06, 0.2], voids: [0, 2], transfer: true, rifts: [1, 3] }, need: ["teleport"] },
  { count: 12, L: [6, 22], cap: 100000, sp: { N: [2, 3], W: [5, 6], H: [4, 6], wall: [0.06, 0.2], voids: [0, 1], buttons: [1, 2] }, need: ["gatesNeeded"] },
  { count: 12, L: [6, 26], cap: 150000, sp: { N: [2, 2], W: [5, 6], H: [4, 6], wall: [0.04, 0.15], voids: [1, 2], boxes: [1, 1], buttons: [0, 1] }, need: ["push"] },
  { count: 16, L: [9, 30], cap: 150000, mix: true, sp: { N: [2, 4], W: [5, 6], H: [4, 6], wall: [0.06, 0.2] }, need: ["mix2"] },
];

function mixSpec(R, base) {
  const sp = Object.assign({}, base);
  const pool = ["mirror", "delay", "rift", "button", "box", "void"].sort(() => R() - 0.5);
  const k = 2 + (R() < 0.45 ? 1 : 0);
  const chosen = pool.slice(0, k);
  if (chosen.includes("mirror")) { sp.mirror = [1, 2]; sp.mirrorBoth = true; }
  if (chosen.includes("delay")) { sp.delay = [1, 1]; sp.dval = [1, 2]; }
  if (chosen.includes("rift")) { sp.transfer = true; sp.rifts = [1, 3]; }
  if (chosen.includes("button")) sp.buttons = [1, 2];
  if (chosen.includes("box")) { sp.boxes = [0, 1]; sp.voids = [1, 2]; sp.N = [2, 3]; }
  if (chosen.includes("void")) sp.voids = [1, 3];
  return { sp, chosen };
}

function features(P, S0, path, lv) {
  const r = E.replay(P, S0, path);
  const f = new Set();
  r.evs.forEach(ev => ev.forEach(e => f.add(e.t)));
  if (lv.lines.some(l => l.mx || l.my)) f.add("mirror");
  if (lv.lines.some(l => l.d > 0)) f.add("delay");
  // кнопка нажималась?
  let S = S0;
  for (const a of path) { const m = E.pressedMask(P, S.copies, S.boxes); if (m) f.add("press"); S = E.step(P, S, a, true).S; }
  return f;
}
const strip = (lv, fn) => ({ w: lv.w, h: lv.h, lines: lv.lines.map(l => fn(Object.assign({}, l, { rows: l.rows.slice() }))) });

function evaluate(lv, spec, wi) {
  const { P, S } = E.parse(lv);
  if (E.isWin(P, S)) return null;
  const r = E.solve(P, S, spec.cap);
  if (r.len === undefined) return null;
  if (r.len < spec.L[0] || r.len > spec.L[1]) return null;
  const f = features(P, S, r.path, lv);
  for (const n of spec.need) {
    if (n === "bump" && !f.has("bump")) return null;
    if (n === "teleport" && !f.has("teleport")) return null;
    if (n === "push" && !f.has("push")) return null;
    if (n === "delayMatters") {
      const lv0 = strip(lv, l => (l.d = 0, l)); const q = E.parse(lv0); const r0 = E.solve(q.P, q.S, spec.cap);
      if (r0.len !== undefined && r0.len <= r.len) return null;
    }
    if (n === "gatesNeeded") {
      if (!f.has("press")) return null;
      const lvc = strip(lv, l => (l.rows = l.rows.map(row => row.replace(/[A-E]/g, "#")), l)); const q = E.parse(lvc); const rc = E.solve(q.P, q.S, spec.cap);
      if (rc.len !== undefined) return null;
    }
    if (n === "mix2") {
      const used = ["mirror", "delay", "teleport", "press", "push"].filter(x => f.has(x));
      if (used.length < 2) return null;
    }
  }
  return { len: r.len, explored: r.explored, score: r.len + 3 * Math.log10(r.explored), feats: [...f] };
}

const out = [];
const t0 = Date.now();
for (let wi = 0; wi < SPECS.length; wi++) {
  const spec = SPECS[wi];
  const intro = (INTRO[wi] || []).map(lv => {
    const { P, S } = E.parse(lv); const r = E.solve(P, S, 400000);
    if (r.len === undefined) throw new Error("intro unsolvable " + lv.name);
    return Object.assign({}, lv, { opt: r.len, sol: r.path.join("") });
  });
  const need = spec.count - intro.length;
  const pool = [], seen = new Set();
  const R = E.mulberry32(1000 + wi * 7919);
  let tries = 0; const tw = Date.now();
  while (pool.length < need * 5 && tries < 6000 && Date.now() - tw < 150000) {
    tries++;
    let sp = spec.sp, chosen = null;
    if (spec.mix) { const m = mixSpec(R, spec.sp); sp = m.sp; chosen = m.chosen; }
    const lv = E.generate(R, sp);
    const k = JSON.stringify(lv.lines.map(l => l.rows));
    if (seen.has(k)) continue; seen.add(k);
    const ev = evaluate(lv, spec, wi);
    if (!ev) continue;
    const { P, S } = E.parse(lv); const sol = E.solve(P, S, spec.cap).path.join("");
    pool.push(Object.assign(lv, { opt: ev.len, score: ev.score, sol }));
  }
  pool.sort((a, b) => a.score - b.score);
  // берём равномерно от лёгких к сложным, последний — самый сложный
  const chosen = [];
  if (pool.length <= need) chosen.push(...pool);
  else for (let i = 0; i < need; i++) chosen.push(pool[Math.round(i * (pool.length - 1) / (need - 1 || 1))]);
  const levels = intro.concat(chosen).map((lv, i) => ({ name: (NAMES[wi][i] || ("Ветвь " + (i + 1))), w: lv.w, h: lv.h, lines: lv.lines.map(l => { const o = { rows: l.rows }; if (l.mx) o.mx = 1; if (l.my) o.my = 1; if (l.d) o.d = l.d; return o; }), opt: lv.opt, sol: lv.sol }));
  out.push(levels);
  console.log(`мир ${wi}: попыток ${tries}, пул ${pool.length}, уровней ${levels.length}, ходы: ${levels.map(l => l.opt).join(" ")}  (${((Date.now() - tw) / 1000).toFixed(0)}с)`);
}
fs.writeFileSync("levels.json", JSON.stringify(out));
console.log("готово за", ((Date.now() - t0) / 1000).toFixed(0), "с; всего уровней", out.reduce((a, w) => a + w.length, 0));
