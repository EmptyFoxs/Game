# Запекание света уровней «Кубо» трассировкой лучей (Cycles).
#   python3 bakelight.py [номера уровней]        переменные: RES=2048 GI=1024 SPP=96 SPPGI=384 VOX=0.4
# Вход:  ../out/level{N}.json — неподвижная геометрия уровня, выгруженная самой игрой (tools/export-level.cjs)
# Выход: ../../kubo/light/l{N}_mask.webp — маска солнечных теней (мягкая полутень), развёртка uv1
#        ../../kubo/light/l{N}_gi.webp   — свет неба с затенением + отражённый свет солнца, та же развёртка
#        ../../kubo/light/l{N}_vol.png   — объёмная карта для подвижных объектов: R — видимость солнца, G — открытость небу
#        ../src/light.json               — масштаб яркости и размеры объёмной карты для игры
import bpy, json, math, os, sys, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from PIL import Image

RES = int(os.environ.get("RES", 2048)); GI = int(os.environ.get("GI", 1024)); SPP = int(os.environ.get("SPP", 96)); SPPGI = int(os.environ.get("SPPGI", 384))
VOX = float(os.environ.get("VOX", 0.4)); OUT = os.environ.get("OUT", "../../kubo/light"); SRC = os.environ.get("SRC", "../out")
SUN_ANGLE = 2.6                       # угловой размер солнца, градусы: от него зависит ширина полутени
SUN_COL = tuple(((c / 255) / 12.92 if c / 255 <= 0.04045 else ((c / 255 + 0.055) / 1.055) ** 2.4) for c in (0xff, 0xd7, 0xa2)); SUN_I = 4.3   # как в игре (gfx.js)
SKY_K = 0.92                          # яркость неба: карта окружения игры (0.85) плюс прежний рассеянный свет
HOR = np.array([0.44, 0.58, 0.82]); ZEN = np.array([0.06, 0.18, 0.52])
T0 = time.time()
def log(*a): print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)
b3 = lambda a: np.stack([a[:, 0], -a[:, 2], a[:, 1]], 1)            # координаты игры (Y вверх) -> Blender (Z вверх)

def albedo():                                                       # средний цвет плитки: им красится отражённый свет
    r = {}
    for n, k in (("grass", 1.0), ("stone", 0.95), ("rock", 0.9)):
        a = np.asarray(Image.open(f"../../kubo/tex/{n}_color.webp").convert("RGB")).astype(np.float64) / 255
        r[n] = tuple(np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4).reshape(-1, 3).mean(0) * k)
    r["occ"] = (0.35, 0.33, 0.30); return r

def sky_image(sun):                                                 # небо игры как равнопромежуточная панорама (без диска солнца: он задан лампой)
    W, H = 512, 256; u = (np.arange(W) + 0.5) / W; v = (np.arange(H) + 0.5) / H; U, V = np.meshgrid(u, v)
    el = (V - 0.5) * math.pi; az = -(U - 0.5) * 2 * math.pi; d = np.stack([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)], -1)
    h = np.maximum(d[..., 2], 0)[..., None]; c = HOR + (ZEN - HOR) * h ** 0.42
    t = np.clip((d[..., 2] - 0.02) / (-0.3 - 0.02), 0, 1); t = (t * t * (3 - 2 * t))[..., None]; c = c + (HOR * np.array([0.92, 0.95, 1.0]) - c) * t
    s = np.maximum(d @ sun, 0)[..., None]; c = c + np.array([1.0, 0.66, 0.36]) * (s ** 5 * 0.30 + s ** 60 * 0.9)
    img = bpy.data.images.new("sky", W, H, float_buffer=True, alpha=False); img.colorspace_settings.name = "Non-Color"; px = np.ones((H, W, 4), np.float32); px[..., :3] = c * SKY_K
    img.pixels.foreach_set(px.ravel()); f = os.path.abspath(f"{SRC}/sky.exr"); img.filepath_raw = f; img.file_format = "OPEN_EXR"; img.save()   # Cycles читает панораму с диска
    img = bpy.data.images.load(f); img.colorspace_settings.name = "Non-Color"; return img

def mesh_obj(name, parts, alb, lm):
    V = np.concatenate([b3(np.array(p["pos"], np.float64).reshape(-1, 3)) for p in parts]); Nn = np.concatenate([b3(np.array(p["nor"], np.float64).reshape(-1, 3)) for p in parts])
    F, MI, UV, off, kinds = [], [], [], 0, []
    for p in parts:
        f = np.array(p["idx"], np.int64).reshape(-1, 3) + off; F.append(f); off += len(p["pos"]) // 3; k = p.get("mat", "occ")
        if k not in kinds: kinds.append(k)
        MI.append(np.full(len(f), kinds.index(k))); UV.append(np.array(p["uv"], np.float64).reshape(-1, 2) if lm else None)
    F = np.concatenate(F); MI = np.concatenate(MI)
    me = bpy.data.meshes.new(name); me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel()); me.loops.add(len(F) * 3); me.loops.foreach_set("vertex_index", F.ravel())
    me.polygons.add(len(F)); me.polygons.foreach_set("loop_start", np.arange(len(F)) * 3); me.polygons.foreach_set("loop_total", np.full(len(F), 3)); me.polygons.foreach_set("material_index", MI)
    me.polygons.foreach_set("use_smooth", np.ones(len(F), bool)); me.update(calc_edges=True); me.validate(clean_customdata=False)
    if len(me.polygons) != len(F): raise RuntimeError("вырожденные грани изменили сетку: " + name)
    if lm: uv = me.uv_layers.new(name="lm"); uv.data.foreach_set("uv", np.concatenate(UV)[F.ravel()].ravel())
    me.normals_split_custom_set_from_vertices(Nn.tolist())
    for k in kinds:
        m = bpy.data.materials.new(name + "_" + k); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        d = nt.nodes.new("ShaderNodeBsdfDiffuse"); d.inputs["Color"].default_value = (*alb[k], 1); o = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(d.outputs[0], o.inputs[0]); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob, V, F

def grass_obj(G, alb):                                             # трава: только заслон; прозрачна по рисунку травинок, сами травинки пропускают 40 % света
    import base64
    f = os.path.abspath(f"{SRC}/grass_blades.png"); open(f, "wb").write(base64.b64decode(G["tex"].split(",")[1])); img = bpy.data.images.load(f)
    V = b3(np.array(G["pos"], np.float64).reshape(-1, 3)); F = np.array(G["idx"], np.int64).reshape(-1, 3); UV = np.array(G["uv"], np.float64).reshape(-1, 2)
    me = bpy.data.meshes.new("GRASS"); me.vertices.add(len(V)); me.vertices.foreach_set("co", V.ravel()); me.loops.add(len(F) * 3); me.loops.foreach_set("vertex_index", F.ravel())
    me.polygons.add(len(F)); me.polygons.foreach_set("loop_start", np.arange(len(F)) * 3); me.polygons.foreach_set("loop_total", np.full(len(F), 3)); me.update(calc_edges=True)
    uv = me.uv_layers.new(name="uv"); uv.data.foreach_set("uv", UV[F.ravel()].ravel())
    m = bpy.data.materials.new("grass_blades"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.4; nt.links.new(t.outputs["Alpha"], gt.inputs[0])
    tl = nt.nodes.new("ShaderNodeMath"); tl.operation = "MULTIPLY"; tl.inputs[1].default_value = 0.6; nt.links.new(gt.outputs[0], tl.inputs[0]); gt = tl   # травинка просвечивает: тень от неё не глухая
    d = nt.nodes.new("ShaderNodeBsdfDiffuse"); d.inputs["Color"].default_value = (0.10, 0.19, 0.035, 1); tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(gt.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(d.outputs[0], mx.inputs[2]); o = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(mx.outputs[0], o.inputs[0])
    me.materials.append(m); ob = bpy.data.objects.new("GRASS", me); bpy.context.scene.collection.objects.link(ob); return ob

def blur(a, cov, r):                                                # сглаживание шума только внутри запечённых областей
    if r <= 0: return a
    k = np.exp(-0.5 * (np.arange(-2 * r, 2 * r + 1) / r) ** 2); k /= k.sum(); w = cov[..., None].astype(np.float64)
    def conv(x):
        for ax in (0, 1): x = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), ax, x)
        return x
    return np.where(w > 0, conv(a * w) / np.maximum(conv(w), 1e-6), a)

def bake_level(n):
    D = json.load(open(f"{SRC}/level{n}.json")); assert D["size"] == 2048, "развёртка рассчитана на 2048"
    bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.use_denoising = False
    cy.max_bounces = 4; cy.diffuse_bounces = 4; cy.glossy_bounces = 0; cy.transmission_bounces = 0; cy.caustics_reflective = cy.caustics_refractive = False; cy.use_adaptive_sampling = False
    sc.render.threads_mode = "AUTO"; sc.render.bake.margin_type = "EXTEND"; sc.render.bake.use_clear = True
    alb = albedo(); lmo, V, F = mesh_obj("LM", D["rec"], alb, True); oco, Vo, Fo = mesh_obj("OCC", D["occ"], alb, False) if D["occ"] else (None, np.zeros((0, 3)), np.zeros((0, 3), np.int64))
    gro = grass_obj(D["grass"], alb) if D.get("grass") else None
    sun_g = np.array(D["sun"]); sun_b = np.array([sun_g[0], -sun_g[2], sun_g[1]])
    sd = bpy.data.lights.new("sun", "SUN"); sd.energy = SUN_I; sd.color = SUN_COL; sd.angle = math.radians(SUN_ANGLE); so = bpy.data.objects.new("sun", sd); sc.collection.objects.link(so)
    so.rotation_mode = "QUATERNION"; so.rotation_quaternion = Vector(sun_b).to_track_quat("Z", "Y")
    w = bpy.data.worlds.new("w"); w.use_nodes = True; sc.world = w; nt = w.node_tree; bg = nt.nodes["Background"]; env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = sky_image(sun_b); nt.links.new(env.outputs[0], bg.inputs[0])
    imgs = {}
    for m in lmo.data.materials:
        t = m.node_tree.nodes.new("ShaderNodeTexImage"); t.name = "bake"; m.node_tree.nodes.active = t
    def bake(key, res, spp, typ, flt, margin):
        if (key, res) not in imgs: imgs[(key, res)] = bpy.data.images.new(f"{key}{res}", res, res, float_buffer=True, alpha=True)
        im = imgs[(key, res)]
        for m in lmo.data.materials: m.node_tree.nodes["bake"].image = im
        cy.samples = spp; bpy.ops.object.select_all(action="DESELECT"); lmo.select_set(True); bpy.context.view_layer.objects.active = lmo
        kw = dict(type=typ, margin=margin, uv_layer="lm");
        if flt: kw["pass_filter"] = flt
        bpy.ops.object.bake(**kw); a = np.empty(res * res * 4, np.float32); im.pixels.foreach_get(a); return a.reshape(res, res, 4)[::-1].astype(np.float64)   # строка 0 — верх картинки
    # 1) маска теней: только солнце
    bg.inputs[1].default_value = 0.0; so.hide_render = False
    # маска = прямой свет солнца с тенями / тот же свет без теней: остаётся доля видимого диска солнца (в полутени — дробная)
    sh = bake("mask", RES, SPP, "DIFFUSE", {"DIRECT"}, 8); cov = sh[..., 3] > 0; sh = sh[..., :3].sum(-1)
    for o in (lmo, oco, gro):
        if o: o.visible_shadow = False
    un = bake("mask", RES, max(8, SPP // 8), "DIFFUSE", {"DIRECT"}, 8)[..., :3].sum(-1)
    for o in (lmo, oco, gro):
        if o: o.visible_shadow = True
    lim = 0.02 * SUN_I * sum(SUN_COL) / math.pi                      # грань почти отвёрнута от солнца: там света нет и без тени
    mask = np.where(un > lim, np.clip(sh / np.maximum(un, 1e-9), 0, 1), 0.0); lit = cov & (un > lim); mask[~cov] = 1.0
    log(f"L{n} маска теней: покрытие {cov.mean():.2f}, обращено к солнцу {lit.sum() / cov.sum():.2f}, из них в тени {(mask[lit] < 0.5).mean():.2f}, в полутени {((mask[lit] > 0.05) & (mask[lit] < 0.95)).mean():.3f}")
    # 2) небо (прямой свет неба с затенением и его переотражения), 3) переотражённый свет солнца
    so.hide_render = True; bg.inputs[1].default_value = 1.0; sky = bake("gi", GI, SPPGI, "DIFFUSE", {"DIRECT", "INDIRECT"}, 4); covg = sky[..., 3] > 0; sky = sky[..., :3].copy(); log(f"L{n} свет неба")
    so.hide_render = False; bg.inputs[1].default_value = 0.0; bnc = bake("gi", GI, SPPGI, "DIFFUSE", {"INDIRECT"}, 4)[..., :3]; log(f"L{n} отражённый свет солнца")
    log(f"L{n} небо {(sky[covg].mean(0) * math.pi).round(3)}, отражённый {(bnc[covg].mean(0) * math.pi).round(3)}")
    gi = blur((sky + bnc) * math.pi, covg, 1.0 * GI / 1024); gi[~covg] = gi[covg].mean(0)
    scale = float(np.percentile(gi[covg].max(1), 99.8)) * 1.02; e = np.clip(gi / scale, 0, 1); e = np.where(e <= 0.0031308, e * 12.92, 1.055 * e ** (1 / 2.4) - 0.055)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((mask * 255 + 0.5).astype(np.uint8), "L").save(f"{OUT}/l{n}_mask.webp", quality=92, method=6)
    Image.fromarray((e * 255 + 0.5).astype(np.uint8), "RGB").save(f"{OUT}/l{n}_gi.webp", quality=92, method=6)
    log(f"L{n} свет: открытая горизонталь {gi[covg].max(1).max():.2f} макс, среднее {gi[covg].mean(0).round(3)}, масштаб {scale:.3f}")

    # 4) объёмная карта (в координатах игры): лучи к солнцу и в небо из центров ячеек
    def tris(pts, idx): return [tuple(t) for t in idx.tolist()]
    Vg = np.concatenate([np.array(p["pos"], np.float64).reshape(-1, 3) for p in D["rec"] + D["occ"]]); Fg, off = [], 0
    for p in D["rec"] + D["occ"]: Fg.append(np.array(p["idx"], np.int64).reshape(-1, 3) + off); off += len(p["pos"]) // 3
    Fg = np.concatenate(Fg); bvh = BVHTree.FromPolygons([Vector(v) for v in Vg], tris(Vg, Fg), all_triangles=True)
    lo = Vg.min(0) - np.array([3.0, 1.5, 3.0]); hi = Vg.max(0) + np.array([3.0, 7.0, 3.0]); nxyz = np.ceil((hi - lo) / VOX).astype(int); size = nxyz * VOX; nx, ny, nz = map(int, nxyz)
    rs = np.random.default_rng(7 + n); sun = Vector(sun_g); a_ = Vector((0, 1, 0)).cross(sun).normalized(); b_ = sun.cross(a_); cone = math.tan(math.radians(SUN_ANGLE * 1.5))
    NS, NK = 12, 20; sd_ = []
    for i in range(NS): r = math.sqrt((i + 0.5) / NS) * cone; t = i * 2.399963; sd_.append((sun + a_ * (r * math.cos(t)) + b_ * (r * math.sin(t))).normalized())
    kd = []
    for i in range(NK): r = math.sqrt((i + 0.5) / NK); t = i * 2.399963; kd.append(Vector((r * math.cos(t), math.sqrt(1 - r * r), r * math.sin(t))))   # косинус-взвешенные направления вверх
    vol = np.ones((ny, nz, nx, 2), np.float32); inside = np.zeros((ny, nz, nx), bool); up = Vector((0, 1, 0)); rc = bvh.ray_cast
    for iy in range(ny):
        y = lo[1] + (iy + 0.5) * VOX
        for iz in range(nz):
            z = lo[2] + (iz + 0.5) * VOX
            for ix in range(nx):
                p = Vector((lo[0] + (ix + 0.5) * VOX, y, z)); h = rc(p, up, 60.0)
                if h[0] is not None and h[1].dot(up) > 0.0 and h[3] < 30.0: inside[iy, iz, ix] = True; continue
                s = 0
                for d in sd_:
                    if rc(p, d, 150.0)[0] is None: s += 1
                k = 0
                for d in kd:
                    if rc(p, d, 60.0)[0] is None: k += 1
                vol[iy, iz, ix, 0] = s / NS; vol[iy, iz, ix, 1] = k / NK
    # ячейки внутри камня получают значения соседей снаружи, чтобы объект у самой поверхности не темнел
    for _ in range(4):
        acc = np.zeros_like(vol); cnt = np.zeros(inside.shape, np.float32); ok = ~inside
        for ax in range(3):
            for sh in (1, -1):
                v2 = np.roll(vol, sh, ax); o2 = np.roll(ok, sh, ax)
                sl = [slice(None)] * 3; sl[ax] = 0 if sh == 1 else -1; o2[tuple(sl)] = False
                acc += v2 * o2[..., None]; cnt += o2
        fill = inside & (cnt > 0); vol[fill] = acc[fill] / cnt[fill][:, None]; inside = inside & ~fill
    vol[inside] = 1.0
    cols = int(math.ceil(math.sqrt(ny * nz / nx))) or 1; cols = max(1, min(ny, cols)); rows = int(math.ceil(ny / cols)); at = np.full((rows * nz, cols * nx, 3), 255, np.uint8)
    for iy in range(ny): cx, cy_ = (iy % cols) * nx, (iy // cols) * nz; at[cy_:cy_ + nz, cx:cx + nx, :2] = (vol[iy] * 255 + 0.5).astype(np.uint8)
    at[..., 2] = 0; Image.fromarray(at, "RGB").save(f"{OUT}/l{n}_vol.png", optimize=True)
    log(f"L{n} объёмная карта {nx}x{ny}x{nz} ({nx * ny * nz} ячеек), в тени {(vol[..., 0] < 0.5).mean():.2f}")
    return {"scale": round(scale, 4), "min": [round(float(v), 4) for v in lo], "size": [round(float(v), 4) for v in size], "n": [nx, ny, nz], "cols": cols}

if __name__ == "__main__":
    levels = [int(a) for a in sys.argv[1:] if a.isdigit()] or [0, 1, 2]; mf = "../src/light.json"
    meta = json.load(open(mf)) if os.path.exists(mf) else {"levels": []}
    while len(meta["levels"]) < 3: meta["levels"].append(None)
    for n in levels:
        meta["levels"][n] = bake_level(n); json.dump(meta, open(mf, "w"), indent=1); log(f"L{n} готов")
