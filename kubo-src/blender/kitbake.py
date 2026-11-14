# Материалы набора «Кубо», запекание общего атласа и экспорт kit.glb
import bpy, sys, os, math, time, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake as BK
from bake import NB, CH, base, finish, mat_mask, mat_paint, mat_brass, mat_wire, px, put
import kit
RES = int(os.environ.get("RES", "1024")); OUT = os.environ.get("OUT", "../out"); os.makedirs(OUT, exist_ok=True); BK.FS[0] = 0.26
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene
t0 = time.time(); log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)

def mat_stone(c1, c2, crackw=1.0):
    def f(m, masks):
        nb = NB(m); b = base(nb, masks); P = b["P"]; edge = nb.ss(b["edge"], 0.05, 0.4)
        v = nb.node("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE"); nb.link(P, v.inputs["Vector"]); v.inputs["Scale"].default_value = 2.6
        d = nb.add(v.outputs["Distance"], nb.mul(nb.m("SUBTRACT", b["nB"], 0.5), 0.10)); crack = nb.mul(nb.mul(nb.inv(nb.ss(d, 0.006, 0.03)), nb.ss(nb.noise(P, 9, 3), 0.42, 0.58)), crackw)
        col = nb.mix(b["nB"], c1, c2); col = nb.mix(nb.mul(nb.ss(b["nA"], 0.4, 0.75), 0.5), col, nb.mix(0.5, col, (0.0, 0.0, 0.0))); col = nb.mix(nb.mul(b["nC"], 0.25), col, nb.mix(0.25, col, (1.0, 1.0, 1.0)))
        col = nb.mix(nb.mul(edge, 0.4), col, nb.mix(0.25, col, (0.8, 0.76, 0.7))); moss = nb.mul(nb.mul(nb.ss(nb.noise(P, 14, 4), 0.55, 0.7), b["up"]), 0.8); col = nb.mix(moss, col, (0.05, 0.085, 0.025))
        col = nb.mix(nb.sat(nb.add(nb.mul(b["crev"], 0.75), crack)), col, (0.018, 0.015, 0.012))
        h = nb.add(nb.mul(nb.inv(crack), 1.2), nb.mul(b["nB"], 0.5), nb.mul(b["nC"], 0.2), nb.mul(nb.inv(nb.mul(edge, b["nB"])), 0.5))
        finish(nb, col, nb.add(0.76, nb.mul(b["nB"], 0.16)), 0.0, h, (0.8, 0.012))
    return f
def mat_wood(axis):
    def f(m, masks):
        nb = NB(m); b = base(nb, masks); P = b["P"]; x, y, z = nb.sep(P); across = y if axis == 0 else x
        pid = nb.m("FLOOR", nb.mul(nb.add(across, 5.0), 1 / 0.44)); wn = nb.node("ShaderNodeTexWhiteNoise", noise_dimensions="1D"); nb.link(pid, wn.inputs["W"]); rnd = wn.outputs["Value"]
        sc = (1.2, 22.0, 22.0) if axis == 0 else (22.0, 1.2, 22.0); mp = nb.node("ShaderNodeMapping"); nb.link(P, mp.inputs["Vector"]); mp.inputs["Scale"].default_value = sc
        va = nb.node("ShaderNodeVectorMath", operation="ADD"); nb.link(mp.outputs[0], va.inputs[0]); cx = nb.node("ShaderNodeCombineXYZ"); nb.link(nb.mul(rnd, 37.0), cx.inputs[axis]); nb.link(nb.mul(rnd, 11.0), cx.inputs[2]); nb.link(cx.outputs[0], va.inputs[1])
        g = nb.node("ShaderNodeTexNoise"); nb.link(va.outputs[0], g.inputs["Vector"]); g.inputs["Scale"].default_value = 1.0; g.inputs["Detail"].default_value = 5; g.inputs["Distortion"].default_value = 1.1; g1 = g.outputs[0]
        rings = nb.m("POWER", nb.add(nb.mul(nb.m("SINE", nb.add(nb.mul(g1, 22.0), nb.mul(across, 60.0), nb.mul(rnd, 40.0))), 0.5), 0.5), 1.6)
        fsc = (3.0, 120.0, 120.0) if axis == 0 else (120.0, 3.0, 120.0); fm = nb.node("ShaderNodeMapping"); nb.link(P, fm.inputs["Vector"]); fm.inputs["Scale"].default_value = fsc
        fn = nb.node("ShaderNodeTexNoise"); nb.link(fm.outputs[0], fn.inputs["Vector"]); fn.inputs["Scale"].default_value = 1.0; fn.inputs["Detail"].default_value = 2; fib = fn.outputs[0]
        tone = nb.sat(nb.add(nb.mul(g1, 0.5), nb.mul(rings, 0.36), nb.mul(fib, 0.2)))
        col = nb.mix(tone, (0.030, 0.017, 0.010), (0.170, 0.098, 0.050)); col = nb.mix(nb.mul(rnd, 0.5), col, (0.200, 0.135, 0.080)); col = nb.mix(nb.mul(nb.ss(b["nA"], 0.35, 0.75), 0.5), col, (0.130, 0.118, 0.104))
        edge = nb.ss(b["edge"], 0.05, 0.4); col = nb.mix(nb.mul(edge, 0.35), col, (0.26, 0.20, 0.14)); col = nb.mix(nb.sat(nb.mul(b["crev"], 1.2)), col, (0.014, 0.010, 0.007))
        h = nb.add(nb.mul(rings, 0.6), nb.mul(fib, 0.6), nb.mul(g1, 0.4)); finish(nb, col, nb.add(0.62, nb.mul(fib, 0.2)), 0.0, h, (0.8, 0.006))
    return f
def mat_gold(m, masks):
    nb = NB(m); b = base(nb, masks); edge = nb.ss(b["edge"], 0.05, 0.4)
    tarn = nb.sat(nb.add(nb.mul(nb.ss(nb.add(b["crev"], nb.mul(nb.m("SUBTRACT", b["nB"], 0.5), 0.6)), 0.35, 0.7), 0.85), nb.mul(nb.ss(b["nA"], 0.55, 0.8), 0.3)))
    col = nb.mix(b["nC"], (0.95, 0.60, 0.17), (0.78, 0.46, 0.11)); col = nb.mix(nb.mul(edge, 0.5), col, (1.0, 0.78, 0.38)); col = nb.mix(tarn, col, (0.10, 0.055, 0.02))
    finish(nb, col, nb.add(0.24, nb.mul(tarn, 0.4), nb.mul(b["nB"], 0.12)), nb.sat(nb.m("SUBTRACT", 1.0, nb.mul(tarn, 0.5))), nb.add(nb.mul(nb.inv(tarn), 0.4), nb.mul(b["nC"], 0.15)), (0.4, 0.003))
def mat_visor(m, masks):
    nb = NB(m); b = base(nb, masks); sm = nb.ss(nb.noise(b["P"], 60, 4, 0.6, 1.2), 0.5, 0.72)
    finish(nb, nb.mix(nb.sat(nb.add(nb.mul(sm, 0.2), nb.mul(b["crev"], 0.5))), (0.010, 0.012, 0.016), (0.16, 0.14, 0.12)), nb.add(0.10, nb.mul(sm, 0.22), nb.mul(b["crev"], 0.4)), 0.0, b["nD"], (0.1, 0.001))
def mat_steel(m, masks):
    nb = NB(m); b = base(nb, masks); P = b["P"]; edge = nb.ss(b["edge"], 0.05, 0.4)
    rust = nb.ss(nb.add(nb.mul(nb.noise(P, 150, 5, 0.65), 0.8), nb.mul(b["crev"], 0.45)), 0.50, 0.62)
    col = nb.mix(b["nB"], (0.085, 0.088, 0.095), (0.22, 0.225, 0.235)); col = nb.mix(nb.mul(edge, 0.6), col, (0.50, 0.50, 0.51)); col = nb.mix(rust, col, nb.mix(b["nC"], (0.09, 0.032, 0.012), (0.27, 0.105, 0.035)))
    col = nb.mix(nb.sat(nb.mul(b["crev"], 0.8)), col, (0.02, 0.018, 0.016))
    finish(nb, col, nb.mixf(rust, nb.add(0.36, nb.mul(b["nC"], 0.2)), 0.9), nb.inv(rust), nb.add(nb.mul(rust, b["nD"]), nb.mul(b["nB"], 0.3)), (0.5, 0.004))
def mat_iron(m, masks):
    nb = NB(m); b = base(nb, masks); P = b["P"]; rust = nb.ss(nb.add(nb.mul(nb.noise(P, 90, 5, 0.65), 0.9), nb.mul(b["crev"], 0.4)), 0.40, 0.58)
    col = nb.mix(b["nB"], (0.035, 0.034, 0.036), (0.11, 0.105, 0.10)); col = nb.mix(rust, col, nb.mix(b["nC"], (0.075, 0.028, 0.010), (0.24, 0.095, 0.030)))
    finish(nb, col, nb.mixf(rust, 0.5, 0.92), nb.inv(rust), nb.add(nb.mul(rust, b["nD"]), nb.mul(b["nB"], 0.4)), (0.6, 0.005))
PAL_Y = dict(c1=(0.46, 0.165, 0.010), c2=(0.66, 0.270, 0.022), fade=(0.56, 0.31, 0.07), soot=0.0, T=0.25)
PAL_B = dict(c1=(0.045, 0.085, 0.105), c2=(0.085, 0.140, 0.165), fade=(0.13, 0.17, 0.18), soot=0.0, T=0.24)
MATS = dict(paint_y=lambda m, k: mat_paint(m, k, PAL_Y), paint_b=lambda m, k: mat_paint(m, k, PAL_B), steel=mat_steel, iron=mat_iron, gold=mat_gold, bronze=mat_brass, visor=mat_visor,
            sand=mat_stone((0.185, 0.135, 0.080), (0.340, 0.262, 0.165)), basalt=mat_stone((0.026, 0.028, 0.034), (0.078, 0.082, 0.092), 0.6), wood_x=mat_wood(0), wood_y=mat_wood(1))

def mesh(name, g, faces, shift):
    vmap = {}; V = []; F = []
    for fi in faces:
        f = []
        for vi in g.F[fi]:
            if vi not in vmap: vmap[vi] = len(V); o = g.offs[g.VT[vi]] if shift else (0, 0, 0); V.append(tuple(float(a + b) for a, b in zip(g.V[vi], o)))
            f.append(vmap[vi])
        F.append(f)
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update(); uv = me.uv_layers.new(name="UVMap")
    for k, poly in enumerate(me.polygons):
        fi = faces[k]
        for li, loop in enumerate(poly.loop_indices):
            cid, u, v = g.FC[fi][li]; x0, y0 = g.pos[cid]; uv.data[loop].uv = (x0 + u * g.scale, y0 + v * g.scale)
        poly.material_index = g.FM[fi]; poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(38)); ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); return ob

g, glow = kit.build(); g.pack(margin=10.0 / RES); glow.pack()
bk = mesh("KitBake", g, list(range(len(g.F))), True)
for mname in g.mats: bk.data.materials.append(bpy.data.materials.new(mname))
log(f"kit: {len(g.V)} verts, {len(g.F)} faces, {len(g.charts)} charts, {g.scale * RES:.0f} px/m at density 1; tags: {len(g.tags) - 1}")

scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.use_denoising = False; scene.world = bpy.data.worlds.new("W"); scene.world.light_settings.distance = 0.8
def new_img(name, srgb=False, fl=False): img = bpy.data.images.new(name, RES, RES, alpha=False, float_buffer=fl); img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"; return img
def bake(img, typ, samples):
    for m in bk.data.materials: n = m.node_tree.nodes["BAKE"]; n.image = img; m.node_tree.nodes.active = n
    bpy.ops.object.select_all(action="DESELECT"); bk.select_set(True); bpy.context.view_layer.objects.active = bk; scene.cycles.samples = samples
    bpy.ops.object.bake(type=typ, use_clear=True, margin=max(4, RES // 128), margin_type="EXTEND", **(dict(normal_space="TANGENT") if typ == "NORMAL" else {}))
def route(ch):
    for m in bk.data.materials:
        c = CH[m.name]; nb = c["nb"]
        if ch in ("color", "rm"): nb.link(c[ch], c["emit"].inputs[0]); nb.link(c["emit"].outputs[0], c["out"])
        else: nb.link(c["bsdf"], c["out"])
mp = os.path.join(OUT, f"kit_masks_{RES}.exr"); ap = os.path.join(OUT, f"kit_ao_{RES}.png"); cache = bool(os.environ.get("CACHE"))
real = list(bk.data.materials); mask = mat_mask()
if cache and os.path.exists(mp): masks = bpy.data.images.load(mp); masks.colorspace_settings.name = "Non-Color"
else:
    for i in range(len(real)): bk.data.materials[i] = mask
    masks = new_img("masks", fl=True); bake(masks, "EMIT", 10); masks.filepath_raw = mp; masks.file_format = "OPEN_EXR"; masks.save()
    for i, m in enumerate(real): bk.data.materials[i] = m
log("masks ready")
for m in bk.data.materials: MATS[m.name](m, masks)
col = new_img("kit_color", srgb=True); rm = new_img("kit_orm"); nrm = new_img("kit_normal")
route("color"); bake(col, "EMIT", 2); route("rm"); bake(rm, "EMIT", 2); route("bsdf"); bake(nrm, "NORMAL", 1); log("channels baked")
if cache and os.path.exists(ap): ao = bpy.data.images.load(ap); ao.colorspace_settings.name = "Non-Color"
else: ao = new_img("ao"); bake(ao, "AO", int(os.environ.get("AO", "16"))); ao.filepath_raw = ap; ao.file_format = "PNG"; ao.save()
o = px(ao)[:, 0]; a = px(rm); a[:, 0] = np.clip(0.15 + 0.85 * o, 0, 1); put(rm, a); c = px(col); c[:, :3] *= (0.66 + 0.34 * o)[:, None]; put(col, c); log("ao ready")
for img, n in ((col, "kit_color"), (rm, "kit_orm"), (nrm, "kit_normal")): img.filepath_raw = os.path.join(OUT, n + ".png"); img.file_format = "PNG"; img.save()

# ----- экспорт: отдельный объект на каждую деталь, общий материал -----
bpy.data.objects.remove(bk)
grp = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree"); grp.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
M = bpy.data.materials.new("M_Kit"); M.use_nodes = True; t = M.node_tree; b = t.nodes["Principled BSDF"]
def tex(img): n = t.nodes.new("ShaderNodeTexImage"); n.image = img; return n
t.links.new(tex(col).outputs[0], b.inputs["Base Color"]); sc = t.nodes.new("ShaderNodeSeparateColor"); t.links.new(tex(rm).outputs[0], sc.inputs[0]); t.links.new(sc.outputs[1], b.inputs["Roughness"]); t.links.new(sc.outputs[2], b.inputs["Metallic"])
nm = t.nodes.new("ShaderNodeNormalMap"); t.links.new(tex(nrm).outputs[0], nm.inputs["Color"]); t.links.new(nm.outputs[0], b.inputs["Normal"]); gn = t.nodes.new("ShaderNodeGroup"); gn.node_tree = grp; t.links.new(sc.outputs[0], gn.inputs["Occlusion"])
for ti, tag in enumerate(g.tags):
    faces = [i for i, x in enumerate(g.FT) if x == ti]
    if not faces: continue
    ob = mesh(tag, g, faces, False); ob.data.materials.append(M)
    for p in ob.data.polygons: p.material_index = 0
GC = dict(glow_eye=(0.45, 0.95, 1.0), glow_jet=(0.4, 0.75, 1.0), glow_coin=(1.0, 0.72, 0.25), glow_lift=(0.35, 0.8, 1.0))
for ti, tag in enumerate(glow.tags):
    faces = [i for i, x in enumerate(glow.FT) if x == ti]
    if not faces: continue
    ob = mesh(tag + "__glow", glow, faces, False); used = sorted({glow.FM[i] for i in faces})
    for mi in used:
        n = glow.mats[mi]; m = bpy.data.materials.get(n) or bpy.data.materials.new(n); m.use_nodes = True; bb = m.node_tree.nodes["Principled BSDF"]; bb.inputs["Base Color"].default_value = (0, 0, 0, 1)
        bb.inputs["Emission Color"].default_value = (*GC[n], 1); bb.inputs["Emission Strength"].default_value = 4.0; ob.data.materials.append(m)
    for k, p in enumerate(ob.data.polygons): p.material_index = used.index(glow.FM[faces[k]])
path = os.path.join(OUT, "kit_raw.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_image_format="WEBP", export_image_quality=int(os.environ.get("Q", "86")), export_tangents=True)
log("exported", os.path.getsize(path) // 1024, "KB")
