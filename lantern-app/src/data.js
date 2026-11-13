// «Последний фонарь» — данные: герои, умения, враги, предметы, карты, сюжет
export const TYPES = { slash: "рубящий", blunt: "дробящий", pierce: "колющий", fire: "огонь", frost: "холод", light: "свет", dark: "тьма" };
export const TYPE_IC = { slash: "🗡", blunt: "🔨", pierce: "📌", fire: "🔥", frost: "❄️", light: "✨", dark: "🌑" };
export const STATUS = {
  guard: { n: "Защита", ic: "🛡", good: 1 }, taunt: { n: "Вызов", ic: "📣", good: 1 }, defUp: { n: "Крепость", ic: "🧱", good: 1 }, atkUp: { n: "Натиск", ic: "💪", good: 1 },
  regen: { n: "Восстановление", ic: "💚", good: 1 }, shield: { n: "Барьер", ic: "🔷", good: 1 }, rage: { n: "Ярость", ic: "😡", good: 1 },
  defDown: { n: "Брешь", ic: "💔" }, atkDown: { n: "Слабость", ic: "🥀" }, mark: { n: "Метка", ic: "🎯" }, chill: { n: "Озноб", ic: "🥶" }, stun: { n: "Оглушение", ic: "💫" }, burn: { n: "Ожог", ic: "🔥" }, bleed: { n: "Кровотечение", ic: "🩸" },
};

// ---------- умения ----------
// tg: foe|foes|ally|allies|self|rand3 ; stat: atk|mag ; an: анимация ; fx: эффект
const S = (id, name, o) => Object.assign({ id, name, mp: 0, tg: "foe", stat: "atk", an: "slash", fx: o.type || "buff" }, o);
export const SK = Object.fromEntries([
  // Рен
  S("r_atk", "Удар мечом", { pow: 1, type: "slash", d: "Рубящий удар." }),
  S("r_guard", "Щит фонарщика", { mp: 4, tg: "self", an: "block", self: [{ s: "taunt", t: 2 }, { s: "defUp", t: 2 }], d: "Враги бьют только Рена. Его защита растёт на 2 хода." }),
  S("r_bash", "Удар рукоятью", { mp: 5, pow: 1.15, type: "blunt", an: "chop", ap: { s: "stun", t: 1, ch: 0.4 }, d: "Дробящий удар. Может оглушить." }),
  S("r_heal", "Тёплый свет", { mp: 6, tg: "ally", an: "raise", heal: 1.5, fx: "heal", d: "Лечит союзника." }),
  S("r_light", "Свет фонаря", { mp: 9, tg: "foes", pow: 0.7, type: "light", an: "raise", d: "Свет бьёт по всем врагам." }),
  S("r_oath", "Клятва", { mp: 8, tg: "allies", an: "cheer", ap: { s: "defUp", t: 3 }, d: "Защита всего отряда растёт на 3 хода." }),
  S("r_dawn", "Рассветный клинок", { mp: 14, pow: 2.4, type: "light", an: "chop", d: "Мощный удар светом по одной цели." }),
  // Велена
  S("v_atk", "Искра", { pow: 0.85, type: "fire", stat: "mag", an: "cast", d: "Слабый огненный заряд. Не тратит дух." }),
  S("v_fire", "Огненная стрела", { mp: 5, pow: 1.5, type: "fire", stat: "mag", an: "cast", ap: { s: "burn", t: 3, ch: 0.6 }, d: "Огонь по одной цели. Может поджечь." }),
  S("v_frost", "Ледяная игла", { mp: 5, pow: 1.4, type: "frost", stat: "mag", an: "cast", ap: { s: "chill", t: 2, ch: 0.8 }, d: "Холод по одной цели. Замедляет." }),
  S("v_barrier", "Барьер", { mp: 7, tg: "ally", stat: "mag", an: "raise", ap: { s: "shield", t: 3, shield: 2.6 }, fx: "buff", d: "Щит, поглощающий урон." }),
  S("v_flame", "Стена пламени", { mp: 11, tg: "foes", pow: 0.8, type: "fire", stat: "mag", an: "raise", ap: { s: "burn", t: 2, ch: 0.3 }, d: "Огонь по всем врагам." }),
  S("v_storm", "Метель", { mp: 15, tg: "foes", pow: 0.95, type: "frost", stat: "mag", an: "raise", ap: { s: "chill", t: 2, ch: 0.5 }, d: "Холод по всем врагам. Замедляет." }),
  S("v_nova", "Имя огня", { mp: 18, pow: 2.8, type: "fire", stat: "mag", an: "cast", d: "Сокрушительный огонь по одной цели." }),
  // Сорока
  S("s_atk", "Укол", { pow: 1, type: "pierce", an: "stab", crit: 0.1, d: "Колющий удар. Часто критует." }),
  S("s_sneak", "Подлый удар", { mp: 4, pow: 1.5, type: "pierce", an: "stab", crit: 0.35, ap: { s: "bleed", t: 3, ch: 0.5 }, d: "Сильный укол. Может вызвать кровотечение." }),
  S("s_smoke", "Дымовая шашка", { mp: 6, tg: "foes", an: "throw", ap: { s: "atkDown", t: 2, ch: 0.9 }, fx: "smoke", d: "Все враги бьют слабее 2 хода." }),
  S("s_mark", "Метка", { mp: 3, an: "throw", ap: { s: "mark", t: 3 }, fx: "mark", d: "Цель получает на 30% больше урона 3 хода." }),
  S("s_steal", "Ловкие пальцы", { mp: 4, pow: 1.0, type: "pierce", an: "stab", steal: 1, d: "Удар — и немного чужого золота." }),
  S("s_dance", "Танец клинков", { mp: 10, tg: "rand3", pow: 0.85, type: "pierce", an: "spin", crit: 0.15, d: "Три удара по случайным врагам." }),
  S("s_heart", "В самое сердце", { mp: 12, pow: 2.3, type: "pierce", an: "stab", crit: 0.5, d: "Смертельный укол по одной цели." }),
  // Бьёрн
  S("b_atk", "Удар обухом", { pow: 1.05, type: "blunt", an: "chop2", d: "Дробящий удар." }),
  S("b_sweep", "Размах", { mp: 6, tg: "foes", pow: 0.65, type: "blunt", an: "spin", d: "Дробящий удар по всем врагам." }),
  S("b_cry", "Боевой клич", { mp: 6, tg: "allies", an: "cheer", ap: { s: "atkUp", t: 3 }, d: "Весь отряд бьёт сильнее 3 хода." }),
  S("b_crush", "Дробящий удар", { mp: 8, pow: 1.7, type: "blunt", an: "chop2", ap: { s: "defDown", t: 3, ch: 0.7 }, d: "Тяжёлый удар. Ломает защиту." }),
  S("b_rage", "Ярость", { mp: 4, tg: "self", an: "cheer", self: [{ s: "rage", t: 3 }], d: "Урон +50%, защита −25% на 3 хода." }),
  S("b_aval", "Лавина", { mp: 14, pow: 2.6, type: "blunt", an: "chop2", d: "Сокрушительный удар по одной цели." }),
  // общее
  S("flash", "Вспышка Фонаря", { tg: "foes", pow: 2.0, type: "light", stat: "best", an: "raise", d: "Свет по всем врагам, отряд лечится на четверть." }),
  // враги
  S("e_hit", "Удар", { pow: 1, type: "slash" }), S("e_shot", "Выстрел", { pow: 1, type: "pierce", an: "cast", ranged: 1 }),
  S("e_aim", "Прицельный выстрел", { pow: 1.7, type: "pierce", an: "cast", ranged: 1, cd: 3 }), S("e_chop", "Рубящий удар", { pow: 1.25, type: "slash", an: "chop" }),
  S("e_cleave", "Широкий взмах", { tg: "foes", pow: 0.7, type: "slash", an: "spin" }), S("e_wall", "Стена щитов", { tg: "self", an: "block", self: [{ s: "defUp", t: 3 }] }),
  S("e_frost", "Могильный холод", { pow: 1.2, type: "frost", stat: "mag", an: "cast", ranged: 1, ap: { s: "chill", t: 2, ch: 0.4 } }),
  S("e_whisper", "Тёмный шёпот", { tg: "foes", an: "raise", cd: 4, ap: { s: "atkDown", t: 2, ch: 0.7 }, fx: "dark" }),
  S("e_mend", "Сшить кости", { tg: "ally", stat: "mag", an: "raise", heal: 1.3, fx: "heal", cd: 2 }),
  S("e_drown", "Хватка глубины", { pow: 1.3, type: "frost", an: "chop", cd: 3, ap: { s: "stun", t: 1, ch: 0.25 } }),
  S("e_requiem", "Реквием", { tg: "foes", pow: 0.8, type: "frost", stat: "mag", an: "raise", cd: 3, ap: { s: "chill", t: 2, ch: 0.5 } }),
  S("e_curse", "Вычеркнуть", { pow: 0.9, type: "dark", stat: "mag", an: "cast", ranged: 1, ap: { s: "mark", t: 3, ch: 0.8 } }),
  S("e_dark", "Чернильный шквал", { tg: "foes", pow: 0.85, type: "dark", stat: "mag", an: "raise", cd: 3 }),
  S("e_shield", "Пергаментный щит", { tg: "self", stat: "mag", an: "raise", cd: 5, self: [{ s: "shield", t: 3, shield: 3.2 }] }),
  S("e_lock", "Запереть", { pow: 1.1, type: "blunt", an: "chop", cd: 3, ap: { s: "stun", t: 1, ch: 0.45 } }),
  S("e_slam", "Тяжёлый удар", { pow: 1.5, type: "slash", an: "chop2" }), S("e_rage", "Северная ярость", { tg: "self", an: "taunt", once: 1, self: [{ s: "rage", t: 4 }] }),
  S("e_exec", "Приговор", { pow: 1.6, type: "slash", an: "chop2", cd: 3 }),
  S("e_king1", "Клинок забвения", { pow: 1.45, type: "dark", an: "chop2", ap: { s: "atkDown", t: 2, ch: 0.5 } }),
  S("e_king3", "Имя стёрто", { tg: "foes", pow: 0.9, type: "dark", stat: "mag", an: "raise", cd: 3, ap: { s: "mark", t: 2, ch: 0.4 } }),
  S("e_king4", "Корона пустоты", { tg: "foes", pow: 1.2, type: "dark", stat: "mag", an: "raise", cd: 2 }),
  S("e_sum_min", "Поднять стражу", { tg: "self", an: "summon", once: 1, summon: ["minion", "minion"], fx: "dark" }),
  S("e_sum_choir", "Позвать хор", { tg: "self", an: "summon", cd: 4, summon: ["dr_mage"], fx: "dark" }),
  S("e_sum_page", "Вырвать страницы", { tg: "self", an: "summon", cd: 4, summon: ["page", "page"], fx: "dark" }),
  S("e_sum_guard", "Королевский приказ", { tg: "self", an: "summon", cd: 6, summon: ["guard"], fx: "dark" }),
].map(s => [s.id, s]));

// ---------- герои ----------
export const HEROES = {
  ren: { name: "Рен", cls: "Фонарщик", model: "knight", show: ["1H_Sword", "Badge_Shield", "Knight_Helmet", "Knight_Cape"], color: "#ffcf6b", basic: "r_atk", w: "w_r1",
    base: { hp: 96, mp: 22, atk: 12, mag: 9, def: 12, spd: 10 }, grow: { hp: 13, mp: 3, atk: 2.2, mag: 1.7, def: 1.9, spd: 0.5 }, crit: 0.06,
    skills: [[1, "r_guard"], [2, "r_bash"], [3, "r_heal"], [5, "r_light"], [7, "r_oath"], [9, "r_dawn"]] },
  velena: { name: "Велена", cls: "Хронистка", model: "mage", show: ["2H_Staff", "Mage_Hat", "Mage_Cape"], color: "#ff8a5c", basic: "v_atk", w: "w_v1",
    base: { hp: 62, mp: 40, atk: 5, mag: 15, def: 6, spd: 11 }, grow: { hp: 9, mp: 5, atk: 1, mag: 2.6, def: 1.1, spd: 0.6 }, crit: 0.05,
    skills: [[1, "v_fire"], [2, "v_frost"], [4, "v_barrier"], [6, "v_flame"], [8, "v_storm"], [10, "v_nova"]] },
  soroka: { name: "Сорока", cls: "Воровка", model: "rogue", show: ["Knife", "Knife_Offhand", "Rogue_Cape"], color: "#b9a6ff", basic: "s_atk", w: "w_s1",
    base: { hp: 72, mp: 26, atk: 13, mag: 6, def: 8, spd: 15 }, grow: { hp: 10, mp: 3, atk: 2.3, mag: 1, def: 1.3, spd: 0.9 }, crit: 0.12,
    skills: [[1, "s_sneak"], [3, "s_smoke"], [4, "s_mark"], [6, "s_steal"], [8, "s_dance"], [10, "s_heart"]] },
  bjorn: { name: "Бьёрн", cls: "Северянин", model: "barbarian", show: ["2H_Axe", "Barbarian_Hat", "Barbarian_Cape"], color: "#7fd0ff", basic: "b_atk", w: "w_b1", two: 1,
    base: { hp: 112, mp: 18, atk: 15, mag: 4, def: 9, spd: 8 }, grow: { hp: 15, mp: 2.5, atk: 2.6, mag: 0.6, def: 1.5, spd: 0.45 }, crit: 0.07,
    skills: [[1, "b_sweep"], [3, "b_cry"], [5, "b_crush"], [7, "b_rage"], [9, "b_aval"]] },
};
export const ATTACH = ["1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield", "1H_Sword", "2H_Sword", "Knight_Helmet", "Knight_Cape", "1H_Axe_Offhand", "Barbarian_Round_Shield", "1H_Axe", "2H_Axe", "Mug",
  "Barbarian_Hat", "Barbarian_Cape", "Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff", "Mage_Hat", "Mage_Cape", "Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Knife", "Throwable", "Rogue_Cape"];
// внешность NPC (говорящие лица)
export const WHO = {
  ren: { n: "Рен", model: "knight", show: HEROES.ren.show }, velena: { n: "Велена", model: "mage", show: HEROES.velena.show }, soroka: { n: "Сорока", model: "rogue", show: HEROES.soroka.show }, bjorn: { n: "Бьёрн", model: "barbarian", show: HEROES.bjorn.show },
  galen: { n: "Мастер Гален", model: "knight", show: ["Knight_Cape"], tint: 0xb8bcc8 }, marta: { n: "Марта", model: "rogue2", show: ["Rogue_Cape"], tint: 0xffd9b0 },
  tihon: { n: "Звонарь Тихон", model: "barbarian", show: ["Mug", "Barbarian_Hat"], tint: 0xd8c8b0 }, agnia: { n: "Бабушка Агния", model: "mage", show: ["Mage_Cape", "Spellbook"], tint: 0xc9c0d8 },
  ulfm: { n: "Ульф", model: "sk_warrior", wpn: { r: "Skeleton_Axe" }, tint: 0xd06a5a, scale: 1.2 }, king: { n: "Король-без-имени", model: "sk_warrior", wpn: { r: "Skeleton_Blade" }, tint: 0x6a5a9a, scale: 1.6, glow: 0x7a5cff },
  gate: { n: "Привратник", model: "sk_warrior" }, regent: { n: "Регент хора", model: "sk_mage" }, arch: { n: "Архивариус", model: "sk_mage" },
};

// ---------- враги ----------
const F = (name, model, o) => Object.assign({ name, model, atk: 6, mag: 6, def: 4, spd: 9, weak: [], resist: [], xp: 10, gold: 5 }, o);
export const FOES = {
  minion: F("Костяк", "sk_minion", { wpn: { r: "Skeleton_Blade" }, hp: 34, atk: 9, def: 3, spd: 9, xp: 9, gold: 4, weak: ["blunt", "light"], ai: [["e_hit", 1]] }),
  archer: F("Костяной стрелок", "sk_rogue", { wpn: { r: "Skeleton_Crossbow" }, hp: 28, atk: 10, def: 2, spd: 13, xp: 11, gold: 6, weak: ["slash", "light"], ai: [["e_shot", 3], ["e_aim", 1]] }),
  warrior: F("Костяной латник", "sk_warrior", { wpn: { r: "Skeleton_Axe", l: "Skeleton_Shield_Large_A" }, hp: 58, atk: 11, def: 10, spd: 7, xp: 16, gold: 9, weak: ["blunt", "light"], resist: ["slash"], ai: [["e_chop", 3], ["e_cleave", 1], ["e_wall", 1, "nobuff"]] }),
  mage: F("Костяной чародей", "sk_mage", { wpn: { r: "Skeleton_Staff" }, hp: 30, mag: 11, def: 2, spd: 10, xp: 14, gold: 8, weak: ["pierce", "light"], resist: ["frost"], ai: [["e_frost", 3], ["e_whisper", 1], ["e_mend", 3, "hurt"]] }),
  drowned: F("Утопленник", "sk_minion", { tint: 0x66c2b0, wpn: { r: "Skeleton_Blade" }, hp: 40, atk: 9.5, def: 4, spd: 8, xp: 10, gold: 5, weak: ["fire", "light"], resist: ["frost", "blunt"], ai: [["e_hit", 2], ["e_drown", 1]] }),
  dr_archer: F("Тинный стрелок", "sk_rogue", { tint: 0x66c2b0, wpn: { r: "Skeleton_Crossbow" }, hp: 30, atk: 10, def: 2, spd: 13, xp: 11, gold: 6, weak: ["fire", "slash"], resist: ["frost"], ai: [["e_shot", 3], ["e_aim", 1]] }),
  dr_mage: F("Хорист", "sk_mage", { tint: 0x66c2b0, wpn: { r: "Skeleton_Staff" }, hp: 30, mag: 10.5, def: 2, spd: 10, xp: 13, gold: 8, weak: ["fire", "pierce"], resist: ["frost"], ai: [["e_frost", 3], ["e_mend", 3, "hurt"]] }),
  scribe: F("Чернильный писец", "sk_mage", { tint: 0x9a80e0, wpn: { r: "Skeleton_Staff" }, hp: 31, mag: 10.5, def: 2.5, spd: 10.5, xp: 13, gold: 9, weak: ["fire", "pierce"], resist: ["dark", "frost"], ai: [["e_curse", 3], ["e_dark", 1], ["e_mend", 2, "hurt"]] }),
  warden: F("Страж архива", "sk_warrior", { tint: 0x9a80e0, wpn: { r: "Skeleton_Axe", l: "Skeleton_Shield_Large_A" }, hp: 56, atk: 10.5, def: 10, spd: 7, xp: 15, gold: 10, weak: ["fire", "blunt"], resist: ["slash", "pierce"], ai: [["e_chop", 3], ["e_cleave", 1], ["e_wall", 1, "nobuff"]] }),
  page: F("Беглая страница", "sk_minion", { tint: 0xe8e0c8, hp: 24, atk: 8.5, def: 1.5, spd: 13, xp: 6, gold: 3, weak: ["fire", "slash"], ai: [["e_hit", 1]] }),
  guard: F("Гвардеец короны", "sk_warrior", { tint: 0xe0c070, wpn: { r: "Skeleton_Blade", l: "Skeleton_Shield_Large_A" }, hp: 50, atk: 10.5, def: 10, spd: 8, xp: 15, gold: 12, weak: ["light"], resist: ["slash"], ai: [["e_chop", 3], ["e_cleave", 2], ["e_wall", 1, "nobuff"]] }),
  courtmage: F("Придворный чародей", "sk_mage", { tint: 0xe0c070, wpn: { r: "Skeleton_Staff" }, hp: 32, mag: 9.5, def: 3, spd: 10.5, xp: 14, gold: 12, weak: ["light", "pierce"], resist: ["frost", "dark"], ai: [["e_frost", 2], ["e_dark", 1], ["e_whisper", 1], ["e_mend", 3, "hurt"]] }),
  headsman: F("Палач", "sk_rogue", { tint: 0xe0c070, wpn: { r: "Skeleton_Axe" }, hp: 42, atk: 10, def: 4, spd: 11, xp: 15, gold: 12, weak: ["light", "blunt"], ai: [["e_chop", 3], ["e_exec", 2]] }),
  // боссы
  gatekeeper: F("Привратник", "sk_warrior", { boss: 1, scale: 1.4, wpn: { r: "Skeleton_Axe", l: "Skeleton_Shield_Large_A" }, hp: 480, atk: 15.5, def: 8, spd: 8.5, xp: 70, gold: 60, weak: ["blunt", "light"], resist: ["pierce"],
    ai: [["e_slam", 3], ["e_cleave", 2], ["e_lock", 2]], ai2: [["e_sum_min", 9], ["e_slam", 3], ["e_cleave", 2], ["e_lock", 2]], bark2: "…Смена… ко мне…" }),
  ulf: F("Ульф", "sk_warrior", { boss: 1, scale: 1.2, tint: 0xd06a5a, wpn: { r: "Skeleton_Axe" }, hp: 300, atk: 15.5, def: 5, spd: 10, xp: 60, gold: 40, weak: ["frost", "light"],
    ai: [["e_slam", 3], ["e_cleave", 2]], ai2: [["e_rage", 9], ["e_slam", 3], ["e_cleave", 2]], bark2: "ХАЛЬДОР!.. СМОТРИ!.." }),
  regent: F("Регент хора", "sk_mage", { boss: 1, scale: 1.4, tint: 0x66c2b0, wpn: { r: "Skeleton_Staff" }, hp: 300, mag: 14, def: 5, spd: 10, xp: 90, gold: 80, weak: ["fire", "pierce"], resist: ["frost"],
    ai: [["e_frost", 3], ["e_requiem", 2], ["e_mend", 2, "hurt"]], ai2: [["e_sum_choir", 4, "few"], ["e_frost", 2], ["e_requiem", 3], ["e_mend", 2, "hurt"]], bark2: "Громче. ГРОМЧЕ." }),
  archivist: F("Архивариус", "sk_mage", { boss: 1, scale: 1.45, tint: 0x9a80e0, wpn: { r: "Skeleton_Staff" }, hp: 300, mag: 14.5, def: 6, spd: 11, xp: 120, gold: 110, weak: ["fire", "light"], resist: ["dark", "frost"],
    ai: [["e_curse", 3], ["e_dark", 2], ["e_shield", 2]], ai2: [["e_sum_page", 4, "few"], ["e_curse", 2], ["e_dark", 3], ["e_shield", 2]], bark2: "Вы шумите. Вас вычеркнут." }),
  king: F("Король-без-имени", "sk_warrior", { boss: 1, scale: 1.6, tint: 0x6a5a9a, glow: 0x7a5cff, wpn: { r: "Skeleton_Blade" }, hp: 170, atk: 10.5, mag: 9, def: 8, spd: 11, xp: 160, gold: 0, weak: ["light"], resist: ["dark", "frost", "pierce"],
    ai: [["e_king1", 3], ["e_cleave", 2], ["e_king3", 2]], ai2: [["e_sum_guard", 4, "few"], ["e_king1", 3], ["e_king3", 3], ["e_cleave", 1]], bark2: "Стража. Ко мне. В последний раз." }),
  shade: F("Тень короля", "sk_warrior", { boss: 1, scale: 1.75, tint: 0x3a2a6a, glow: 0xa060ff, wpn: { r: "Skeleton_Blade" }, hp: 175, atk: 10.8, mag: 10, def: 7, spd: 12, xp: 0, gold: 0, weak: ["light", "fire"], resist: ["dark", "frost"],
    ai: [["e_king4", 3], ["e_king1", 3], ["e_king3", 2]], ai2: [["e_king4", 4], ["e_king1", 3], ["e_exec", 2]], bark2: "СТО ДЕВЯТЬ ТЫСЯЧ ИМЁН. ПОПРОБУЙ УНЕСТИ." }),
};

// ---------- бои ----------
const E = (foes, lvl, o) => Object.assign({ foes, lvl, bg: "crypt" }, o);
export const ENC = {
  tut: E(["minion", "minion"], 1, { bg: "yard" }),
  c1_1: E(["minion", "minion"], 1), c1_5: E(["minion", "archer", "minion"], 2), c1_2: E(["warrior", "minion"], 2), c1_3: E(["archer", "archer", "minion"], 3), c1_7: E(["warrior", "mage"], 3),
  boss1: E(["gatekeeper"], 3, { boss: 1 }),
  c2_b: E(["drowned", "drowned", "dr_archer"], 4, { bg: "flood" }), c2_1: E(["drowned", "dr_mage", "drowned"], 4, { bg: "flood" }), c2_2: E(["dr_archer", "dr_archer", "drowned"], 5, { bg: "flood" }),
  c2_3: E(["drowned", "drowned", "dr_mage", "dr_archer"], 5, { bg: "flood" }), c2_4: E(["warrior", "dr_mage", "drowned"], 5, { bg: "flood" }), c2_5: E(["dr_mage", "dr_mage", "drowned", "drowned"], 6, { bg: "flood" }),
  ulf: E(["ulf"], 6, { boss: 1, bg: "flood" }), boss2: E(["regent", "dr_mage", "dr_mage"], 6, { boss: 1, bg: "flood" }),
  c3_5: E(["page", "page", "scribe"], 7, { bg: "archive" }), c3_3: E(["warden", "scribe", "page"], 7, { bg: "archive" }), c3_4: E(["scribe", "scribe", "warden"], 7, { bg: "archive" }),
  c3_1: E(["warden", "warden", "page", "page"], 8, { bg: "archive" }), c3_2: E(["scribe", "page", "page", "page"], 8, { bg: "archive" }), c3_6: E(["warden", "scribe", "scribe"], 8, { bg: "archive" }),
  boss3: E(["archivist"], 8, { boss: 1, bg: "archive" }),
  c4_1: E(["guard", "courtmage", "guard"], 9, { bg: "throne" }), c4_3: E(["headsman", "headsman", "courtmage"], 9, { bg: "throne" }), c4_4: E(["guard", "guard", "courtmage", "courtmage"], 10, { bg: "throne" }), c4_2: E(["headsman", "guard", "courtmage"], 10, { bg: "throne" }),
  king: E(["king"], 10, { boss: 1, bg: "throne" }), shade: E(["shade"], 11, { boss: 1, bg: "throne" }),
};
// порядок для симулятора баланса: [бой, кто в отряде]
export const CAMPAIGN = [["tut", 1], ["c1_1", 2], ["c1_5", 2], ["c1_2", 3], ["c1_3", 3], ["c1_7", 3], ["boss1", 3], ["c2_b", 4], ["c2_1", 4], ["c2_2", 4], ["c2_3", 4], ["c2_4", 4], ["c2_5", 4], ["ulf", 4], ["boss2", 4],
  ["c3_5", 4], ["c3_3", 4], ["c3_4", 4], ["c3_1", 4], ["c3_2", 4], ["c3_6", 4], ["boss3", 4], ["c4_1", 4], ["c4_3", 4], ["c4_4", 4], ["c4_2", 4], ["king", 4], ["shade", 4]];

// ---------- предметы ----------
const W = (n, who, eq, d) => ({ n, slot: "w", who, eq, d }), AR = (n, eq, d) => ({ n, slot: "a", eq, d }), CH = (n, eq, d) => ({ n, slot: "c", eq, d });
export const ITEMS = {
  potion: { n: "Целебный настой", use: "heal", v: 0.45, d: "Лечит 45% здоровья.", price: 25 }, ether: { n: "Эссенция духа", use: "mp", v: 0.5, d: "Возвращает половину духа.", price: 35 },
  root: { n: "Корень жизни", use: "revive", v: 0.4, d: "Поднимает павшего героя.", price: 80 }, water: { n: "Святая вода", use: "bomb", v: 38, d: "Свет по всем врагам.", price: 45 },
  amulet: { n: "Амулет с руной волка", key: 1, d: "На обороте нацарапано: «Ульфу от брата»." }, snuffer: { n: "Серебряный гасильник", key: 1, d: "Колпачок, которым гасят пламя. Очень старый." },
  book: { n: "Книга имён", key: 1, d: "Осталась одна исписанная страница." },
  w_r1: W("Меч фонарщика", "ren", {}, "Простой честный клинок."), w_r2: W("Клинок стражи", "ren", { atk: 6 }, "Сила +6"), w_r3: W("Рассветная сталь", "ren", { atk: 13, mag: 6 }, "Сила +13, дух +6"),
  w_v1: W("Посох ученицы", "velena", {}, "Исцарапан пометками."), w_v2: W("Посох с янтарём", "velena", { mag: 7 }, "Чары +7"), w_v3: W("Перо Архивариуса", "velena", { mag: 15, mmp: 10 }, "Чары +15, дух +10"),
  w_s1: W("Парные ножи", "soroka", {}, "Один — чужой."), w_s2: W("Стилеты склепа", "soroka", { atk: 6, spd: 1 }, "Сила +6, скорость +1"), w_s3: W("Клыки Регента", "soroka", { atk: 12, spd: 2, crit: 0.08 }, "Сила +12, скорость +2, криты"),
  w_b1: W("Секира Севера", "bjorn", {}, "Зазубрена о чужие щиты."), w_b2: W("Могильный молот", "bjorn", { atk: 8 }, "Сила +8"), w_b3: W("Обух Ульфа", "bjorn", { atk: 15, mhp: 20 }, "Сила +15, здоровье +20"),
  a_1: AR("Стёганка", { def: 3 }, "Защита +3"), a_2: AR("Кольчуга", { def: 6, mhp: 10 }, "Защита +6, здоровье +10"), a_3: AR("Латы Привратника", { def: 10, mhp: 22, spd: -1 }, "Защита +10, здоровье +22, скорость −1"),
  a_4: AR("Мантия архива", { def: 5, mmp: 12, mag: 3 }, "Защита +5, дух +12, чары +3"), a_5: AR("Плащ хора", { def: 7, spd: 2 }, "Защита +7, скорость +2"),
  c_hp: CH("Оберег Агнии", { mhp: 25 }, "Здоровье +25"), c_mp: CH("Кольцо ясности", { mmp: 10 }, "Дух +10"), c_spd: CH("Сорочье перо", { spd: 3 }, "Скорость +3"), c_atk: CH("Волчий клык", { atk: 4 }, "Сила +4"),
  c_mag: CH("Слеза янтаря", { mag: 4 }, "Чары +4"), c_def: CH("Костяной щиток", { def: 4 }, "Защита +4"), c_regen: CH("Уголёк Фонаря", { regen: 0.06 }, "Лечит 6% здоровья каждый ход"),
};
export const SHOP = f => [["potion", 25], ["ether", 35], ["water", 45], ["root", 80], ["a_1", 60], ["c_def", 90]]
  .concat(f.boss1 ? [["w_r2", 140], ["w_v2", 140], ["w_s2", 140], ["a_2", 150], ["c_atk", 120]] : [])
  .concat(f.boss2 ? [["w_b2", 170], ["a_4", 200], ["a_5", 210], ["c_spd", 150], ["c_mp", 120]] : [])
  .concat(f.boss3 ? [["c_regen", 280], ["c_mag", 140]] : []);

export const TABLETS = [null,
  ["Савва, бондарь", "Делал бочки, в которых не кисло вино."], ["Мила, повитуха", "Приняла половину Вереска."], ["Орест, привратник", "Тридцать лет не проспал ни одной смены."],
  ["Лукан, лодочник", "Никого не утопил."], ["Ульф, сын Хальдора", "Смеялся громче всех."], ["Хор святой Ины", "Двенадцать голосов, одна песня."], ["Гордей, вор", "Вернул больше, чем взял."],
  ["Тая, семи лет", "Любила кота по имени Уголь."], ["Безымянный солдат", "Просил записать: «был»."], ["Ведана, переписчица", "Сорок лет — ни одной кляксы."], ["Ефим, архивариус", "Помнил всё, кроме своих именин."],
  ["Аглая, первая фонарщица", "Жгла — и плакала."], ["Эдрик Вереск, каменщик", "Строил так, чтобы стояло после него."]];
export const TAB_TOTAL = 13, TAB_NEED = 9;

// ---------- карты ----------
// # стена  . камень  , земля  ~ вода  (пробел) пустота; декор: t факел b знамя k полки c свечи s кости p колонна o бочка x ящики r завал u гроб + могила g надгробие y сухое дерево a ель f ограда l фонарный столб = стол
// цифры и ЗАГЛАВНЫЕ буквы — объекты из словаря o
export const MAPS = {
  hub: { name: "Погост Вереска", theme: "yard", floor: ",", music: "hub", rows: [
    "                       ",
    "  a    a   K   a    a  ",
    " ffffffffffEffffffffff ",
    " f,+,,g,,l,,,l,,g,,+,f ",
    " f,,,,,,,,,,,,,,,,,,,f ",
    " f,g,,+,,,,L,,,,+,,g,f ",
    " f,,,,,,,,,G@,,,,,,,,f ",
    " f,+,,y,,,,,,,,,y,,+,f ",
    " f,,,,,,,,,,,,,,,,,,,f ",
    " f,g,,T,,,,,,,,xo,,g,f ",
    " f,,,,,,,,,,,,,,M,,,,f ",
    " f,+,,g,,,,,,,,,,g,+,f ",
    " f,,,A,,,,l,,,l,,,,,,f ",
    " f,y,,,,,,,,,,,,,,,y,f ",
    " fffffffff,,,fffffffff ",
    "    a    f,,,f    a    ",
    "         fffff         "],
    o: { K: { t: "set", model: "crypt" }, E: { t: "exit", to: "crypt", at: "E", label: "Спуститься в склеп", need: f => f.prologue, deny: "Сначала поговори с мастером Галеном у Фонаря." },
      L: { t: "lantern", id: "hub", big: 1 }, G: { t: "npc", who: "galen", if: f => !f.prologue, talk: () => "galen0", auto: 1 },
      M: { t: "npc", who: "marta", talk: f => f.marta ? "marta1" : "marta0" }, T: { t: "npc", who: "tihon", talk: f => f.boss3 ? "tihon3" : f.boss1 ? "tihon2" : "tihon0" },
      A: { t: "npc", who: "agnia", talk: f => f.agnia_done ? "agnia2" : f.tab1 ? "agnia1" : "agnia0" } } },
  crypt: { name: "Верхние склепы", theme: "crypt", floor: ".", music: "crypt", enter: "crypt_in", rows: [
    "#######################",
    "##########.X.##########",
    "#######t.......t#######",
    "#######....4....#######",
    "#######p.......p#######",
    "##########.D.##########",
    "##.t...b##.7.##t..b..##",
    "##......#.....#......##",
    "##.2..............3..##",
    "##......#...L.#......##",
    "##C.s...##...##...s.T##",
    "###########.###########",
    "###########.###########",
    "##t..b..###.###.t..b.##",
    "##.....SG.Q.....5...A##",
    "##..c...###.###......##",
    "###########.###########",
    "########.t.1...t#######",
    "########.6.....U.######",
    "########....@...#######",
    "##########.E.##########",
    "#######################"],
    o: { E: { t: "exit", to: "hub", at: "E", label: "Подняться на погост" }, X: { t: "exit", to: "flood", at: "E", label: "Спуститься глубже", need: f => f.boss1, deny: "Проход стережёт Привратник." },
      1: { t: "enemy", enc: "c1_1", foe: "minion" }, 5: { t: "enemy", enc: "c1_5", foe: "archer" }, 2: { t: "enemy", enc: "c1_2", foe: "warrior" }, 3: { t: "enemy", enc: "c1_3", foe: "archer" }, 7: { t: "enemy", enc: "c1_7", foe: "warrior" },
      4: { t: "enemy", enc: "boss1", foe: "gatekeeper", pre: "boss1_pre", post: "boss1_post" },
      6: { t: "chest", id: "c1a", loot: { potion: 2, ether: 1 } }, C: { t: "chest", id: "c1b", loot: { c_atk: 1 }, gold: 35 }, U: { t: "tablet", n: 1, dlg: "tab_first" }, T: { t: "tablet", n: 2 },
      L: { t: "lantern", id: "crypt" }, A: { t: "altar", sets: "gate1", dlg: "altar1" }, G: { t: "gate", need: f => f.gate1 }, Q: { t: "trigger", dlg: "soroka0", if: f => !f.soroka_seen },
      S: { t: "npc", who: "soroka", if: f => !f.soroka, talk: () => "soroka1" }, D: { t: "gate", need: f => f.soroka, deny: "Дверь заперта. Замок хитрый — тут нужны ловкие пальцы." } } },
  flood: { name: "Затопленные галереи", theme: "flood", floor: ".", music: "flood", enter: "flood_in", rows: [
    "#########################",
    "###########.E.###########",
    "#########t.....t#########",
    "#########...@...#########",
    "#########...B...#########",
    "###########~~~###########",
    "##t...b####~~~####t..b.##",
    "##.....~~~~~~~~~~~.....##",
    "##..U..~~~~~1~~~~~..2..##",
    "##.....~~~~~~~~~~~.....##",
    "##..s.T####~L~####..C.o##",
    "###########~~~###########",
    "####t..b..#~~~#..t..b####",
    "####......~~3~~......####",
    "####.4....#~~~#....5.####",
    "####..D...#~~~#...W..####",
    "###########~~~###########",
    "########t.~~~~~.t########",
    "########..~~R~~..########",
    "########p.~~~~~.p########",
    "###########.X.###########",
    "#########################"],
    o: { E: { t: "exit", to: "crypt", at: "X", label: "Подняться в склепы" }, X: { t: "exit", to: "archive", at: "E", label: "Спуститься в архив", need: f => f.boss2, deny: "Хор не пропустит." },
      B: { t: "trigger", dlg: "bjorn0", if: f => !f.bjorn }, 1: { t: "enemy", enc: "c2_1", foe: "drowned" }, 2: { t: "enemy", enc: "c2_2", foe: "dr_archer" }, 3: { t: "enemy", enc: "c2_3", foe: "drowned" },
      4: { t: "enemy", enc: "c2_4", foe: "warrior" }, 5: { t: "enemy", enc: "c2_5", foe: "dr_mage" }, U: { t: "npc", who: "ulfm", if: f => !f.ulf_done, talk: f => f.s.inv.amulet ? "ulf_am" : "ulf_no" },
      T: { t: "tablet", n: 4 }, W: { t: "tablet", n: 7, dlg: "tab_gordey" }, C: { t: "chest", id: "c2a", loot: { amulet: 1 }, gold: 50 }, D: { t: "chest", id: "c2b", loot: { a_2: 1, potion: 2 } },
      L: { t: "lantern", id: "flood" }, R: { t: "enemy", enc: "boss2", foe: "regent", pre: "boss2_pre", post: "boss2_post" } } },
  archive: { name: "Библиотека имён", theme: "archive", floor: ".", music: "archive", enter: "archive_in", rows: [
    "#########################",
    "###########.X.###########",
    "########k.k...k.k########",
    "########....Z....########",
    "########p.......p########",
    "###########.D.###########",
    "##k.k.k.###.6.###k.k.k.##",
    "##......#.......#......##",
    "##.=..1.....G.....2..=.##",
    "##......#.......#......##",
    "##A.c.T.###.L.###.U.c.B##",
    "###########...###########",
    "####k.k.k.#...#.k.k.k####",
    "####...3.........4...####",
    "####.C.=..#...#..=.H.####",
    "####......#...#......####",
    "###########.5.###########",
    "#########t.....t#########",
    "#########..V@...#########",
    "###########.E.###########",
    "#########################"],
    o: { E: { t: "exit", to: "flood", at: "X", label: "Вернуться в галереи" }, X: { t: "exit", to: "throne", at: "E", label: "Спуститься к престолу", need: f => f.boss3, deny: "Архивариус ещё стережёт Книгу." },
      V: { t: "tablet", n: 8, dlg: "tab_taya" }, 5: { t: "enemy", enc: "c3_5", foe: "page" }, 3: { t: "enemy", enc: "c3_3", foe: "warden" }, 4: { t: "enemy", enc: "c3_4", foe: "scribe" }, 1: { t: "enemy", enc: "c3_1", foe: "warden" },
      2: { t: "enemy", enc: "c3_2", foe: "scribe" }, 6: { t: "enemy", enc: "c3_6", foe: "warden" }, C: { t: "chest", id: "c3a", loot: { c_mag: 1, ether: 2 } }, H: { t: "chest", id: "c3b", loot: { root: 2 }, gold: 80 },
      L: { t: "lantern", id: "archive" }, A: { t: "altar", sets: "alt3a", dlg: "altar3" }, B: { t: "altar", sets: "alt3b", dlg: "altar3" }, T: { t: "tablet", n: 9 }, U: { t: "tablet", n: 10 },
      G: { t: "npc", who: "galen", pose: "sit", talk: f => f.galen_found ? (f.boss3 ? "galen3" : "galen2") : "galen1" }, D: { t: "gate", need: f => f.alt3a && f.alt3b, deny: "Решётка заперта. По бокам от неё — два потухших знака: запад и восток." },
      Z: { t: "enemy", enc: "boss3", foe: "archivist", pre: "boss3_pre", post: "boss3_post" } } },
  throne: { name: "Глубинный престол", theme: "throne", floor: ".", music: "throne", enter: "throne_in", rows: [
    "#####################",
    "#######t..F..t#######",
    "#######.......#######",
    "#######p..K..p#######",
    "#######.......#######",
    "#######p.....p#######",
    "#########...#########",
    "###b.t###.2.###t.b###",
    "###.....#...#.....###",
    "###.N.3.......4.T.###",
    "###.....#...#.....###",
    "###c...c#...#..C..###",
    "#########.1.#########",
    "#######t..S..t#######",
    "#######...L...#######",
    "#######.......#######",
    "#######...@...#######",
    "#########.E.#########",
    "#####################"],
    o: { E: { t: "exit", to: "archive", at: "X", label: "Вернуться в архив" }, L: { t: "lantern", id: "throne" }, S: { t: "trigger", dlg: "confess", if: f => !f.confess },
      1: { t: "enemy", enc: "c4_1", foe: "guard" }, 2: { t: "enemy", enc: "c4_2", foe: "headsman" }, 3: { t: "enemy", enc: "c4_3", foe: "headsman" }, 4: { t: "enemy", enc: "c4_4", foe: "guard" },
      C: { t: "chest", id: "c4a", loot: { w_r3: 1, potion: 2, ether: 2 } }, N: { t: "tablet", n: 13, dlg: "tab_king" }, T: { t: "tablet", n: 12 },
      K: { t: "npc", who: "king", if: f => !f.ending, talk: () => "king0", range: 3.4 }, F: { t: "set", model: "flame" } } },
};
export const LANTERNS = { hub: ["hub", "Погост Вереска"], crypt: ["crypt", "Верхние склепы"], flood: ["flood", "Затопленные галереи"], archive: ["archive", "Библиотека имён"], throne: ["throne", "Глубинный престол"] };

export function objective(f, map) {
  if (!f.prologue) return "Поговори с мастером Галеном у Фонаря";
  if (map === "hub" && !f.boss1) return "Спустись в склеп — вход на севере погоста";
  if (!f.boss1) return !f.gate1 ? (f.soroka_seen ? "Зажги алтарь на востоке, чтобы открыть решётку" : "Найди путь к лестнице вниз") : !f.soroka ? "Освободи пленницу" : "Одолей Привратника за северной дверью";
  if (!f.boss2) return !f.bjorn ? "Иди вглубь Затопленных галерей" : "Найди Регента хора на юге галерей";
  if (!f.boss3) return !f.galen_found ? "Найди мастера Галена в Библиотеке имён" : !(f.alt3a && f.alt3b) ? "Зажги два знака — в западном и восточном залах" : "Одолей Архивариуса";
  if (!f.ending) return "Спустись к Первому пламени";
  return "Сыграй ещё раз — у истории три финала";
}

// ---------- диалоги ----------
const give = (o, text) => [{ give: o }, ...(text ? [["", text]] : [])];
export const DLG = {
  intro: [["", "Вереск стоит на горе. Под горой — Некрополь: тысяча лет чужих могил."], ["", "Над входом горит Фонарь. Пока он горит — мёртвые спят. Так было триста лет."], ["", "Тебя зовут Рен. Ты младший фонарщик. Сегодня твоя очередь доливать масло."]],
  galen0: [["galen", "Рен. Масло?"], ["ren", "Долил на закате, мастер Гален."], ["galen", "Долил… Тридцать лет я слушаю это пламя. Сегодня оно шепчет не так."], { fx: "dark" },
    ["", "Пламя вздрагивает, тянется вверх тонкой синей нитью — и гаснет."], ["galen", "Нет. Нет-нет-нет. Только не сейчас."], ["", "Фонарь погас. Впервые за триста лет. Земля на погосте шевелится."], ["galen", "Меч, мальчик! Они просыпаются!"],
    { battle: "tut" },
    ["", "Из склепа выходят новые. Их слишком много."], ["galen", "Слушай! На самом дне горит Первое пламя — от него когда-то зажгли Фонарь. Принеси искру. Иначе к рассвету Вереска не станет."],
    ["ren", "А вы?"], ["galen", "А я их задержу. Я хорошо умею ждать, Рен."], { fx: "shake" }, ["", "Костяные руки смыкаются на плаще мастера. Его уносят во тьму склепа."], { set: { prologue: 1 } },
    ["velena", "Впечатляюще. Триста лет горел — и погас ровно в ту ночь, когда я приехала его изучать."], ["ren", "Вы кто?"],
    ["velena", "Велена, хронистка Академии. У меня рекомендательные письма к вашему мастеру. Которого, как я вижу, только что съел склеп."], ["ren", "Унёс. Он жив."],
    ["velena", "Оптимизм. Редкий реагент. Ладно, фонарщик: тебе вниз — и мне вниз. Мёртвым я интереснее живой. И я умею жечь."], { join: "velena" },
    ["", "Велена присоединилась к отряду. Перед спуском загляни к Марте — у неё лавка у ограды."], { save: 1 }],
  marta0: [["marta", "Рен! Живой! А я уж думала, торговать будет некому."], ["marta", "В долг не дам — я торговка, а не святая. Но первые склянки — за счёт заведения. Вернёшь искрой."], ...give({ potion: 3 }, "Получено: Целебный настой ×3."), { set: { marta: 1 } }, { shop: 1 }],
  marta1: [["marta", "Что берём? Мёртвые, говорят, сдачи не дают — так что трать у меня."], { shop: 1 }],
  tihon0: [["tihon", "Тридцать лет бью в колокол на закате. Сегодня ударил — а эхо вернулось снизу."], ["tihon", "Дед учил: кость меча не боится. Кость боится обуха да света. Смотри, чем бьёшь, — над врагом видно, что ему больно."]],
  tihon2: [["tihon", "Слыхал, как внизу грохнуло. Привратник, а? Его ещё мой дед боялся. А дед никого не боялся, кроме бабки."]],
  tihon3: [["tihon", "Колокол сам звонит, Рен. Тихо так. Будто кто-то внизу читает вслух — а он отзывается."]],
  agnia0: [["agnia", "Мой Савва лежит в верхних склепах. Третья ниша от входа. Бондарь был — золотые руки."], ["agnia", "Если встретишь его там, внизу… ты уж не бей сильно. Он и при жизни-то мухи не обидел."]],
  agnia1: [["ren", "Я нашёл его табличку. «Савва, бондарь. Делал бочки, в которых не кисло вино»."], ["agnia", "…Он сам придумал. Велел так написать. Говорил: по имени вспомнят, а по бочкам — выпьют."],
    ["agnia", "Возьми. Сорок лет ношу. Теперь тебе нужнее."], ...give({ c_hp: 1 }, "Получено: Оберег Агнии."), { set: { agnia_done: 1 } }],
  agnia2: [["agnia", "Иди, сынок. И таблички подбирай. Имя — оно ведь единственное, что от нас остаётся."]],
  crypt_in: [["velena", "Обрати внимание: ниши пустые. Все. Они не просто встали — они ушли вниз. Их кто-то зовёт."], ["", "Мертвецы стоят на месте, пока ты не подойдёшь. Синие фонари — места отдыха: там отряд лечится, а игра сохраняется."]],
  tab_first: [["velena", "Табличка с именем. Смотри: край обуглен, будто имя пытались сжечь — а оно не далось."], ["velena", "Собирай их. Мне нужно больше образцов. И… бабушке у ограды, кажется, тоже нужно."]],
  soroka0: [{ set: { soroka_seen: 1 } }, ["soroka", "Эй! Эй, с фонарём! Я тут! Я не мертвец!"], ["soroka", "Решётка упала, когда всё погасло. Тут где-то алтарь со свечами — зажги, она и поднимется. Старый механизм, я такие знаю."], ["velena", "Живая девица. В склепе. Ночью. Как интересно."]],
  altar1: [["", "Ты зажигаешь свечи на алтаре. Где-то в стене проворачивается камень."], { fx: "shake" }, ["", "Вдалеке со скрежетом поднимается решётка."]],
  altar3: [["", "Ты зажигаешь знак. Чернильные тени отползают от света."], { fx: "shake" }, { if: f => f.alt3a && f.alt3b, then: [["", "Оба знака горят. На севере зала поднимается решётка."]], else: [["", "Один знак горит. Нужен второй — в другом крыле."]] }],
  soroka1: [["soroka", "Фух. Спасибо. Сорока. Да, это имя. Нет, не настоящее."], ["velena", "И что Сорока делала в склепе в ту самую ночь, когда погас Фонарь?"], ["soroka", "Искала… кое-что. Слушайте, я знаю, как открыть северную дверь. Вы не спрашиваете, что у меня в сумке. Идёт?"],
    { ch: [["«Идёт. Пока что.»", [["soroka", "Вот и славно. Люблю людей, которым некогда."]]], ["«Сначала сумка.»", [["soroka", "…Ладно. Ладно! Вот."], ["", "Серебряный колпачок на длинной ручке. Гасильник. Очень старый."],
      ["soroka", "Мне его заказали. Человек в сером, лица не видела. Я сняла его с Фонаря на закате. А через час — погасло. Я не знала! Клянусь!"], ["velena", "Гасильник — просто серебро. От его пропажи пламя не гаснет. Но совпадение мне не нравится."], { set: { confess: 1, early: 1 } }, { give: { snuffer: 1 } }]]] },
    { join: "soroka" }, ["", "Сорока присоединилась к отряду. Теперь северная дверь не помеха."], { save: 1 }],
  boss1_pre: [["gate", "…Никто… не выходит… Никто… не входит…"], ["ren", "Он говорит?!"], ["velena", "Он помнит службу. Больше он не помнит ничего."]],
  boss1_post: [["", "Привратник рассыпается. На полу остаётся табличка — имя на ней выжжено почти дочиста."], { tablet: 3 }, ["velena", "«Орест». Еле читается. Его имя жгли. Долго. Зачем жечь имя мертвеца?"], ...give({ a_3: 1 }, "Получено: Латы Привратника."), { set: { boss1: 1 } }, { save: 1 }],
  flood_in: [["soroka", "Вода. Ненавижу. В воде не слышно шагов — ни своих, ни чужих."], ["velena", "Нижние ярусы затопило лет двести назад. Здесь хоронили лодочников, певчих и тех, кого не опознали."]],
  bjorn0: [["bjorn", "ХА! Ещё трое! Ульф, гляди — брат идёт!"], ["", "В проходе рубится огромный северянин. Мертвецы теснят его к воде."], ["ren", "Северянин, справа!"], { join: "bjorn" }, { battle: "c2_b" },
    ["bjorn", "Бьёрн, сын Хальдора. Иду за братом. Ульф нанялся сюда в стражу и не вернулся."], ["bjorn", "У нас так: кости должны лежать в своей земле. Иначе он не найдёт дорогу в чертог."],
    ["velena", "И ты пришёл в Некрополь один?"], ["bjorn", "Я пришёл с топором."], ["", "Бьёрн присоединился к отряду. Его обух дробит кости — но утопленникам он нипочём: их берёт огонь."], { save: 1 }],
  ulf_no: [["", "В боковом зале стоит мертвец в северных мехах. На шее — обрывок шнурка, амулета нет."], ["bjorn", "…Ульф. Это Ульф. Брат! Это я!"], ["ulfm", "…Кто… идёт…"], ["velena", "Он тебя не узнаёт. Ему нечем — у него почти не осталось имени."],
    { ch: [["Отступить и поискать то, что он вспомнит", [["soroka", "У него на шее шнурок. Что-то там висело. Найдём — может, вспомнит."]]], ["Сразиться", [["bjorn", "Прости, брат. Домой ты пойдёшь хоть так."], { battle: "ulf" }, { goto: "ulf_dead" }]]] }],
  ulf_am: [["", "Бьёрн протягивает амулет с руной волка. Мертвец замирает."], ["ulfm", "…Бьёрн?.. Малой… Ты вырос."], ["bjorn", "А ты умер."], ["ulfm", "Заметил."], ["ulfm", "Здесь не дают уйти, малой. Здесь жгут имена — по одному за ночь. Моё почти догорело. Я уже не помню лица матери."],
    ["ulfm", "Забери табличку. Скажи моё имя вслух дома. И топор забери — не пропадать же."], { tablet: 5 }, ...give({ w_b3: 1 }, "Получено: Обух Ульфа."), ["", "Ульф садится у стены и больше не шевелится. Он улыбается — если череп умеет улыбаться."], { set: { ulf_done: 1, ulf_saved: 1 } }, { save: 1 }],
  ulf_dead: [["", "Ульф падает. Бьёрн долго стоит над ним."], ["bjorn", "Он бил вполсилы. Ты видел? Вполсилы."], { tablet: 5 }, ...give({ w_b3: 1 }, "Получено: Обух Ульфа."), { set: { ulf_done: 1, ulf_killed: 1 } }, { save: 1 }],
  tab_gordey: [["soroka", "«Гордей, вор. Вернул больше, чем взял». …Хм."], ["soroka", "Вот бы и про меня так написали. А то напишут: «Сорока. Взяла»."]],
  boss2_pre: [["regent", "Тссс… Хор спит… Вы — фальшивите…"], ["bjorn", "Я не пою."], ["regent", "Теперь — запоёшь."]],
  boss2_post: [["", "Посох Регента ломается. Вода в зале впервые за двести лет становится тихой."], { tablet: 6 }, ["velena", "Ноты. Смотрите — вместо слов тут имена. Они пели имена умерших, чтобы не забыть."], ["velena", "А на последних листах — пусто. Имена кончились. И они пели тишину."],
    ...give({ w_s3: 1 }, "Получено: Клыки Регента."), { set: { boss2: 1 } }, { save: 1 }],
  archive_in: [["velena", "…О. Рен, ты понимаешь, что это? Здесь записан каждый, кто умер в Вереске за тысячу лет. Имя, ремесло и одна строка о жизни. Это величайший архив на свете!"], ["soroka", "Полки пустые."], ["velena", "…Да. Почему полки пустые?"]],
  tab_taya: [["", "«Тая, семи лет. Любила кота по имени Уголь»."], ["bjorn", "…"], ["soroka", "Пойдём. Пойдём отсюда."]],
  galen1: [["galen", "Рен… Дошёл. Конечно, дошёл."], ["ren", "Мастер! Вы ранены, они вас—"], ["galen", "Они меня не тащили, мальчик. Они меня несли. Я сам попросил."],
    ["galen", "Фонарь горит не на масле. В масло подмешаны чернила. А чернила — из Книги имён."], ["galen", "Каждый вечер ты заливал в лампу чьё-то имя. Сожжённое имя держит мёртвого во сне. Триста лет. По имени за ночь."],
    ["velena", "Сто девять тысяч ночей…"], ["galen", "Имена кончились, девочка. В Книге осталась одна запись. Моя. Я спустился, чтобы вписать себя в чернила. Одного имени хватит на ночь."], ["galen", "А завтра… завтра ты впишешь своё."],
    { ch: [["«Должен быть другой путь.»", [["galen", "Я искал его тридцать лет. Может, у тебя глаза моложе."]]], ["«Если так надо — я готов.»", [["galen", "Вот этого я и боялся. Что ты скажешь это так легко."]]]] },
    ["galen", "Книга у Архивариуса, за северной решёткой. Мне он её не отдал. Зажги два знака — на западе и на востоке — и решётка поднимется. Я подожду. Я хорошо умею ждать."], { set: { galen_found: 1 } }, { save: 1 }],
  galen2: [["galen", "Два знака, Рен. Запад и восток. И не жалей Архивариуса — он давно уже только переплёт."]],
  galen3: [["galen", "Значит, Книга у вас. Тогда решать будешь ты, не я. Внизу тебя ждёт тот, чьё имя сожгли первым."], ["galen", "Что бы ты ни выбрал — я впервые за тридцать лет не знаю, как правильно. Это хорошее чувство. Иди."]],
  boss3_pre: [["arch", "Тише. Здесь читают."], ["velena", "Здесь нечего читать. Вы сожгли всё."], ["arch", "Не всё. Одна страница. Моя забота. Вон."]],
  boss3_post: [["", "Архивариус осыпается хлопьями пепла. На пюпитре остаётся Книга имён — пустой переплёт и одна исписанная страница."], { tablet: 11 }, ...give({ book: 1, w_v3: 1 }, "Получено: Книга имён и Перо Архивариуса."),
    ["velena", "Рен. Эту книгу нужно вынести. В Академии её изучат, перепишут—"], ["soroka", "И запрут в подвале. Знаю я, как в Академии «изучают»."],
    { ch: [["«Книга останется здесь. Она их, не наша.»", [{ set: { book_stays: 1 } }, ["velena", "…Ты прав. Чёрт. Ты прав, и мне это не нравится."]]], ["«Перепиши, что успеешь. Но Книга останется.»", [{ set: { book_copied: 1 } }, ["velena", "Одну страницу. Мне хватит одной — чтобы там поверили."]]],
      ["«Забирай. Знание важнее.»", [{ set: { book_taken: 1 } }, ["velena", "Спасибо. Я… не ожидала."], ["bjorn", "Я тоже."]]]] },
    { set: { boss3: 1 } }, { save: 1 }],
  throne_in: [["", "Лестница кончается. Дальше — только зал, вырубленный в корне горы. В глубине дрожит синий свет."], ["bjorn", "Тихо. Слишком тихо. Даже вода не капает."]],
  confess: [{ set: { confess: 1 } }, { if: f => f.early, then: [["soroka", "Рен. Тот гасильник. Я всю дорогу думаю: меня наняли не украсть. Меня наняли, чтобы было на кого показать."], ["velena", "Тем, кому триста лет хотелось, чтобы Фонарь погас. Да. Я пришла к тому же."]],
    else: [["soroka", "Рен, стой. Я должна сказать, пока мы не пошли к нему."], ["soroka", "В сумке у меня гасильник. Серебряный колпачок с Фонаря. Мне его заказали — человек в сером, без лица. Я сняла его на закате. Через час погасло."], ["bjorn", "Так это ты."],
      ["velena", "Нет. Гасильник — просто серебро. Фонарь погас, потому что стало нечего жечь. Её наняли, чтобы было на кого показать."], { give: { snuffer: 1 } }] },
    { ch: [["«Ты шла с нами до самого дна. Этого хватит.»", [{ set: { forgave: 1 } }, ["soroka", "…Не говори так. Я же привыкну."]]], ["«Разберёмся потом. Сначала — король.»", [["soroka", "Справедливо."]]]] }],
  tab_king: [["", "Табличка лежит отдельно от прочих, под стеклом. Самая старая. Первая."], ["velena", "«Эдрик Вереск, каменщик». Вереск… Рен. Это основатель города. Это первая строка Книги."], ["velena", "Первое имя, которое сожгли."]],
  king0: [["king", "Фонарщик. Маленький. С маленьким огнём. Подойди."], ["king", "Триста лет назад я заложил Вереск. Когда пришёл Мор Беспокойных, я спустился сюда и отдал Пламени первое имя. Своё."],
    ["king", "Я не помню, как звала меня мать. Зато помню каждого, кого сожгли после. Сто девять тысяч. Я слышал, как гасло каждое."], ["king", "Сегодня чернила кончились. Сегодня я веду их домой — наверх, под небо."],
    ["ren", "Дорога наверх — через город. Они пройдут по живым."], ["king", "Они не помнят, что такое живые. У них отняли имена, мальчик. Знаешь, что остаётся от человека без имени? Голод."], { battle: "king" },
    ["", "Король падает на одно колено. Корона катится по плитам."], ["king", "…Ну. Зажигай. Впиши старика. Потом себя. Потом тех, кто родится. Триста лет — и ещё триста."],
    { if: f => f.tab13 && f.s.tab.length >= TAB_NEED, then: [{ ch: [["Назвать его по имени", [{ goto: "end_true" }]], ["Подойти к Первому пламени", [{ goto: "end_choice" }]]] }], else: [{ goto: "end_choice" }] }],
  end_true: [["ren", "Эдрик."], ["king", "…Что?"], ["ren", "Эдрик Вереск, каменщик. «Строил так, чтобы стояло после него»."], ["king", "…Каменщик. Да. У меня были руки в извести. Мать звала меня Рик."],
    ["velena", "Мила, повитуха. Приняла половину Вереска."], ["bjorn", "Ульф, сын Хальдора. Смеялся громче всех."], ["soroka", "Гордей, вор. Вернул больше, чем взял."],
    ["", "Вы читаете таблички одну за другой. С каждым именем в зале становится светлее. Не от пламени — от тех, кто слушает."], ["king", "Хватит жечь. Пусть помнят так. Вслух."], { end: "A" }],
  end_choice: [["", "Из-под короны поднимается тень — всё, что осталось от ста девяти тысяч сожжённых имён."], { battle: "shade" }, ["", "Тень рассеивается. Первое пламя горит ровно и ждёт. На пюпитре — Книга, перо и одна чистая строка."],
    { ch: [["Вписать имя мастера Галена", [{ end: "B" }]], ["Вписать своё имя", [{ end: "B2" }]], ["Поднять корону", [{ end: "C" }]]] }],
};
export const ENDINGS = {
  A: { title: "Рассвет имён", slides: ["К рассвету мёртвые вышли на погост. Не строем — поодиночке, как выходят из церкви после службы.", "Они шли мимо домов, и никто из живых не закрыл ставни. Бабушка Агния стояла у калитки и махала рукой бондарю.",
    "Фонарь в Вереске больше не зажигают. Вместо него каждый вечер кто-нибудь поднимается на колокольню и читает вслух одно имя из Книги.", "На это уйдёт триста лет. В Вереске никто никуда не торопится."] },
  B: { title: "Долгая ночь", slides: ["Гален сам продиктовал, что писать. Рен вывел строку и опустил перо в Пламя.", "Фонарь над Вереском загорелся до рассвета. Мёртвые легли в ниши. Город проснулся и ничего не заметил.",
    "Никто в Вереске не помнит, как звали старого фонарщика. Рен помнит только, что кого-то любил как отца.", "Чернил хватило на одну ночь. Завтра понадобится новое имя."] },
  B2: { title: "Безымянный фонарщик", slides: ["Он вписал себя раньше, чем остальные успели крикнуть.", "Фонарь над Вереском загорелся до рассвета. Мёртвые легли в ниши. Мастер Гален поднялся наверх один — и долго не мог вспомнить, кого ждёт.",
    "У ограды погоста теперь стоит рыцарь без имени. Он доливает масло на закате. Велена зовёт его «фонарщик». Сорока — «эй, ты». Он откликается.", "Чернил хватило на одну ночь. Но у него теперь много ночей."] },
  C: { title: "Новый король", slides: ["Корона оказалась лёгкой. Тяжёлым оказалось то, что под ней: сто девять тысяч имён — разом, в одной голове.", "Фонарь больше не нужен. Мёртвые спят, потому что внизу сидит тот, кто помнит каждого.",
    "Раз в год Велена спускается к престолу с новой тетрадью. Он диктует. Она записывает. Они успевают по тысяче имён за визит.", "Он уже не помнит, как звала его мать. Но помнит, как звали всех остальных."] },
};
export function epilogue(f, s) {
  const e = [];
  if (f.agnia_done) e.push("Агния повесила табличку Саввы над дверью. Гостям говорит: «Муж. Бондарь. Заходите, он не против».");
  e.push(f.ulf_saved ? "Бьёрн увёз брата на север и сказал его имя вслух у родного очага. Говорят, в ту ночь в чертоге смеялись громче обычного." : f.ulf_killed ? "Бьёрн увёз кости брата на север. Про то, как добыл их, он не рассказывает даже во хмелю." : "Бьёрн ещё долго спускался в галереи один. Брата он так и не нашёл.");
  e.push(f.book_taken ? "Велена защитила в Академии труд о Книге имён. Книгу заперли в подвале. Она ходит туда по ночам и читает вслух." : f.book_copied ? "Велена увезла одну страницу. Ей не поверили. Через год в Вереск приехали шестеро хронистов — проверять." : "Велена осталась в Вереске «на пару недель, закончить записи». Третий год заканчивает.");
  e.push(f.forgave ? "Сорока вернула гасильник на место. Потом вернула кошелёк Тихону. Потом задумалась, что ещё она должна вернуть, — и осталась считать." : "Сорока исчезла в ту же ночь. Гасильник нашли на алтаре — начищенный до блеска.");
  e.push(s.tab.length >= TAB_TOTAL ? "Все тринадцать табличек висят в часовне. Их читают вслух." : `Табличек найдено: ${s.tab.length} из ${TAB_TOTAL}. Остальные имена всё ещё ждут внизу.`);
  return e;
}
