// Конвейер ассетов: исходные наборы KayKit (CC0) -> компактные GLB в ../lantern/assets.
// Нужен только если хочется пересобрать модели: готовые GLB уже лежат в ../lantern/assets.
// Запуск: KAYKIT=папка_с_наборами node tools/assets.mjs  (наборы: github.com/KayKit-Game-Assets)
import { NodeIO, Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, resample, quantize, mergeDocuments, unpartition, getBounds } from "@gltf-transform/functions";
import fs from "fs";
import path from "path";

const KK = path.resolve(process.env.KAYKIT || "./kaykit");
const OUT = path.join(path.resolve(process.env.OUT || "../lantern"), "assets");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const ADV = `${KK}/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures`;
const SKE = `${KK}/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons`;
const DUN = `${KK}/KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf`;
const HAL = `${KK}/KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf`;
const kb = f => (fs.statSync(f).size / 1024 | 0) + "KB";
const verbose = process.argv.includes("-v");
function dropAnim(a) { const acc = new Set(); for (const s of a.listSamplers()) { acc.add(s.getInput()); acc.add(s.getOutput()); }
  a.listChannels().forEach(c => c.dispose()); a.listSamplers().forEach(s => s.dispose()); a.dispose();
  for (const x of acc) if (x && x.listParents().every(p => p.propertyType === "Root")) x.dispose(); }

const KEEP = ["Idle", "Walking_A", "Running_A", "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Chop", "1H_Melee_Attack_Stab", "2H_Melee_Attack_Chop", "2H_Melee_Attack_Spin",
  "Spellcast_Shoot", "Spellcast_Raise", "Block", "Hit_A", "Death_A", "Cheer", "Use_Item", "Interact", "Skeletons_Awaken_Floor", "Death_C_Skeletons", "Taunt", "Idle_Combat", "Spellcast_Summon", "Sit_Floor_Idle", "Lie_Idle", "Throw", "2H_Melee_Idle"];

// ---------- персонажи: только меш и скелет ----------
const CHARS = { knight: `${ADV}/Characters/gltf/Knight.glb`, barbarian: `${ADV}/Characters/gltf/Barbarian.glb`, mage: `${ADV}/Characters/gltf/Mage.glb`, rogue: `${ADV}/Characters/gltf/Rogue_Hooded.glb`, rogue2: `${ADV}/Characters/gltf/Rogue.glb`,
  sk_minion: `${SKE}/Characters/gltf/Skeleton_Minion.glb`, sk_warrior: `${SKE}/Characters/gltf/Skeleton_Warrior.glb`, sk_rogue: `${SKE}/Characters/gltf/Skeleton_Rogue.glb`, sk_mage: `${SKE}/Characters/gltf/Skeleton_Mage.glb` };
fs.mkdirSync(`${OUT}/chars`, { recursive: true });
const rest = {};
for (const [k, f] of Object.entries(CHARS)) {
  const doc = await io.read(f);
  rest[k] = Object.fromEntries(doc.getRoot().listNodes().map(n => [n.getName(), n.getTranslation().map(v => +v.toFixed(3)).join(",")]));
  doc.getRoot().listAnimations().forEach(dropAnim);
  await doc.transform(prune({ keepLeaves: true }), dedup(), quantize());
  await io.write(`${OUT}/chars/${k}.glb`, doc);
  const att = doc.getRoot().listNodes().filter(n => n.getMesh() && !n.getSkin()).map(n => n.getName());
  console.log(k, kb(`${OUT}/chars/${k}.glb`), "навесное:", att.join(" "));
}
// совпадают ли кости у героев и скелетов?
const bones = Object.keys(rest.knight).filter(n => rest.sk_warrior[n] !== undefined);
const diff = bones.filter(n => rest.knight[n] !== rest.sk_warrior[n]);
console.log("общих узлов", bones.length, "различий в позах:", diff.length, diff.slice(0, 6).map(n => `${n}: ${rest.knight[n]} | ${rest.sk_warrior[n]}`));

// ---------- общие анимации ----------
{
  const doc = await io.read(CHARS.sk_warrior);
  for (const a of doc.getRoot().listAnimations()) if (!KEEP.includes(a.getName())) dropAnim(a);
  for (const n of doc.getRoot().listNodes()) { n.setMesh(null); n.setSkin(null); }
  doc.getRoot().listSkins().forEach(s => s.dispose());
  await doc.transform(resample({ tolerance: 0.0005 }), prune({ keepLeaves: true }), dedup());
  await io.write(`${OUT}/chars/anims.glb`, doc);
  console.log("anims", kb(`${OUT}/chars/anims.glb`), doc.getRoot().listAnimations().map(a => a.getName() + ":" + Math.max(...a.listSamplers().map(s => s.getInput().getMax([])[0])).toFixed(1)).join(" "));
}

// ---------- наборы окружения ----------
async function pack(name, dir, list) {
  const doc = new Document(); doc.createBuffer(); const scene = doc.createScene("pack"); doc.getRoot().setDefaultScene(scene);
  const info = [];
  for (const a of list) {
    const f = [`${dir}/${a}.gltf.glb`, `${dir}/${a}.glb`, `${dir}/${a}.gltf`].find(p => fs.existsSync(p));
    if (!f) { console.log("  НЕТ ФАЙЛА", a); continue; }
    const src = await io.read(f);
    const before = new Set(doc.getRoot().listScenes());
    mergeDocuments(doc, src);
    const wrap = doc.createNode(a); scene.addChild(wrap);
    for (const sc of doc.getRoot().listScenes()) if (!before.has(sc)) { for (const ch of sc.listChildren()) wrap.addChild(ch); sc.dispose(); }
    const b = getBounds(wrap); info.push(`${a} [${b.min.map(v => v.toFixed(1))}]..[${b.max.map(v => v.toFixed(1))}]` + (wrap.listChildren().length > 1 || wrap.listChildren()[0]?.listChildren().length ? " ch:" + wrap.listChildren().map(c => c.getName() + (c.listChildren().length ? "(" + c.listChildren().map(x => x.getName()) + ")" : "")).join("|") : ""));
  }
  await doc.transform(unpartition(), dedup(), prune({ keepLeaves: true }), quantize());
  await io.write(`${OUT}/${name}.glb`, doc);
  console.log(name, kb(`${OUT}/${name}.glb`), "текстур:", doc.getRoot().listTextures().length, "материалов:", doc.getRoot().listMaterials().length);
  if (verbose) console.log(info.join("\n"));
}
await pack("dungeon", DUN, ["floor_tile_small", "floor_tile_small_broken_A", "floor_tile_small_broken_B", "floor_tile_small_decorated", "floor_tile_small_weeds_A", "floor_tile_large", "floor_dirt_small_A", "floor_dirt_small_B", "floor_wood_small", "floor_tile_grate",
  "wall", "wall_half", "wall_cracked", "wall_broken", "wall_corner", "wall_doorway", "wall_arched", "wall_gated", "wall_pillar", "wall_endcap", "wall_shelves", "wall_window_closed",
  "pillar", "pillar_decorated", "column", "torch_mounted", "torch_lit", "banner_red", "banner_blue", "banner_patternA_red", "banner_shield_blue", "banner_patternB_white",
  "barrel_large", "barrel_small", "barrel_small_stack", "box_large", "box_small", "crates_stacked", "chest", "chest_gold", "candle_lit", "candle_triple", "table_medium", "table_long_decorated_A", "table_small_decorated_A", "chair", "stool",
  "shelf_large", "shelves", "shelf_small_candles", "bed_floor", "rubble_large", "rubble_half", "stairs", "stairs_wide", "key", "coin_stack_medium", "sword_shield", "sword_shield_broken", "keg", "trunk_medium_A", "bottle_A_green", "plate_food_A"]);
await pack("graveyard", HAL, ["arch_gate", "arch", "bench", "coffin", "coffin_decorated", "crypt", "fence", "fence_broken", "fence_gate", "fence_pillar", "floor_dirt", "floor_dirt_grave", "floor_dirt_small", "grave_A", "grave_A_destroyed", "grave_B",
  "gravemarker_A", "gravemarker_B", "gravestone", "lantern_hanging", "lantern_standing", "path_A", "path_B", "path_C", "path_D", "pillar", "plaque", "plaque_candles", "post", "post_lantern", "post_skull", "shrine", "shrine_candles",
  "skull", "skull_candle", "ribcage", "bone_A", "bone_B", "tree_dead_large", "tree_dead_medium", "tree_dead_small", "tree_pine_orange_large", "tree_pine_orange_medium", "tree_pine_yellow_large", "tree_pine_yellow_medium", "candle_triple"]);
await pack("weapons", `${SKE}/Assets/gltf`, ["Skeleton_Blade", "Skeleton_Axe", "Skeleton_Staff", "Skeleton_Shield_Large_A", "Skeleton_Shield_Small_A", "Skeleton_Crossbow"]);
