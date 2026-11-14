# Материалы (процедурные, с износом) и запекание в PBR-текстуры
import bpy, os, math, time, numpy as np
FS = [1.0]     # множитель частоты шумов: меньше — крупнее детали (для атласов с низкой плотностью)

class NB:
    def __init__(s, mat): mat.use_nodes = True; s.mat = mat; s.t = mat.node_tree; s.t.nodes.clear()
    def node(s, typ, **kw):
        n = s.t.nodes.new(typ)
        for k, v in kw.items(): setattr(n, k, v)
        return n
    def link(s, a, b): s.t.links.new(a, b)
    def _in(s, sock, v):
        if v is None: return
        if isinstance(v, (int, float)): sock.default_value = v
        elif isinstance(v, tuple): sock.default_value = v if len(v) == len(sock.default_value) else (*v, 1.0)
        else: s.link(v, sock)
    def m(s, op, a, b=None, c=None, clamp=False):
        n = s.node("ShaderNodeMath", operation=op, use_clamp=clamp); s._in(n.inputs[0], a); s._in(n.inputs[1], b); s._in(n.inputs[2], c); return n.outputs[0]
    def add(s, *xs):
        r = xs[0]
        for x in xs[1:]: r = s.m("ADD", r, x)
        return r
    def mul(s, a, b): return s.m("MULTIPLY", a, b)
    def sat(s, a): return s.m("ADD", a, 0.0, clamp=True)
    def inv(s, a): return s.m("SUBTRACT", 1.0, a, clamp=True)
    def ss(s, x, lo, hi):
        n = s.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP"); s._in(n.inputs["Value"], x); n.inputs["From Min"].default_value = lo; n.inputs["From Max"].default_value = hi; return n.outputs["Result"]
    def mix(s, f, a, b): n = s.node("ShaderNodeMix", data_type="RGBA"); s._in(n.inputs[0], f); s._in(n.inputs[6], a); s._in(n.inputs[7], b); return n.outputs[2]
    def mixf(s, f, a, b): n = s.node("ShaderNodeMix", data_type="FLOAT"); s._in(n.inputs[0], f); s._in(n.inputs[2], a); s._in(n.inputs[3], b); return n.outputs[0]
    def noise(s, vec, scale, detail=4.0, rough=0.55, dist=0.0):
        n = s.node("ShaderNodeTexNoise"); s.link(vec, n.inputs["Vector"]); n.inputs["Scale"].default_value = scale * FS[0]; n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough; n.inputs["Distortion"].default_value = dist; return n.outputs[0]
    def mapping(s, vec, scale=(1, 1, 1), loc=(0, 0, 0)):
        n = s.node("ShaderNodeMapping"); s.link(vec, n.inputs["Vector"]); n.inputs["Scale"].default_value = tuple(c * FS[0] for c in scale); n.inputs["Location"].default_value = loc; return n.outputs[0]
    def sep(s, vec): n = s.node("ShaderNodeSeparateXYZ"); s.link(vec, n.inputs[0]); return n.outputs
    def comb(s, r, g, b): n = s.node("ShaderNodeCombineColor"); s._in(n.inputs[0], r); s._in(n.inputs[1], g); s._in(n.inputs[2], b); return n.outputs[0]

CH = {}
def finish(nb, color, rough, metal, height=None, bump=(0.4, 0.0004)):
    """Общая обвязка: BSDF для запекания нормалей/AO и эмиссия для запекания каналов."""
    bsdf = nb.node("ShaderNodeBsdfPrincipled"); nb._in(bsdf.inputs["Base Color"], color); nb._in(bsdf.inputs["Roughness"], rough); nb._in(bsdf.inputs["Metallic"], metal)
    if height is not None:
        b = nb.node("ShaderNodeBump"); b.inputs["Strength"].default_value = bump[0]; b.inputs["Distance"].default_value = bump[1]; nb.link(height, b.inputs["Height"]); nb.link(b.outputs[0], bsdf.inputs["Normal"])
    out = nb.node("ShaderNodeOutputMaterial"); emit = nb.node("ShaderNodeEmission"); img = nb.node("ShaderNodeTexImage"); img.name = "BAKE"
    CH[nb.mat.name] = dict(nb=nb, color=color, rm=nb.comb(0.0, rough, metal), bsdf=bsdf.outputs[0], out=out.inputs["Surface"], emit=emit)
    nb.link(bsdf.outputs[0], out.inputs["Surface"])

def base(nb, masks):
    tc = nb.node("ShaderNodeTexCoord"); P = tc.outputs["Object"]; r = dict(P=P, z=nb.sep(P)[2])
    if masks:
        t = nb.node("ShaderNodeTexImage"); t.image = masks; t.interpolation = "Linear"; sc = nb.node("ShaderNodeSeparateColor"); nb.link(t.outputs[0], sc.inputs[0])
        r.update(edge=sc.outputs[0], cav=nb.inv(sc.outputs[1]), crev=nb.inv(sc.outputs[2]))
    geo = nb.node("ShaderNodeNewGeometry"); r["up"] = nb.ss(nb.sep(geo.outputs["Normal"])[2], 0.55, 0.95)
    r.update(nA=nb.noise(P, 22, 5, 0.6), nB=nb.noise(P, 110, 6, 0.65), nC=nb.noise(P, 520, 4, 0.6), nD=nb.noise(P, 1100, 2, 0.5)); return r

def mat_mask():
    m = bpy.data.materials.new("M_mask"); nb = NB(m); geo = nb.node("ShaderNodeNewGeometry"); bev = nb.node("ShaderNodeBevel", samples=8); bev.inputs["Radius"].default_value = 0.0026 / FS[0]
    dot = nb.node("ShaderNodeVectorMath", operation="DOT_PRODUCT"); nb.link(bev.outputs[0], dot.inputs[0]); nb.link(geo.outputs["Normal"], dot.inputs[1])
    edge = nb.m("MULTIPLY", nb.m("SUBTRACT", 1.0, dot.outputs["Value"]), 4.0, clamp=True)
    def ao(d): n = nb.node("ShaderNodeAmbientOcclusion", samples=12); n.inputs["Distance"].default_value = d / FS[0]; return n.outputs["AO"]
    emit = nb.node("ShaderNodeEmission"); nb.link(nb.comb(edge, ao(0.028), ao(0.007)), emit.inputs[0]); out = nb.node("ShaderNodeOutputMaterial"); nb.link(emit.outputs[0], out.inputs[0])
    img = nb.node("ShaderNodeTexImage"); img.name = "BAKE"; return m

def mat_paint(m, masks, pal=None):
    pal = pal or dict(c1=(0.034, 0.050, 0.026), c2=(0.070, 0.092, 0.048), fade=(0.115, 0.125, 0.082), soot=1.0, T=0.262)
    nb = NB(m); b = base(nb, masks); P = b["P"]
    streak = nb.noise(nb.mapping(P, (240, 240, 12)), 1.0, 3, 0.6)
    edge = nb.ss(b["edge"], 0.04, 0.36); lowz = nb.inv(nb.ss(b["z"], 0.0, 0.03))
    def scratch(rot, sc, lo):
        mp = nb.node("ShaderNodeMapping"); nb.link(P, mp.inputs["Vector"]); mp.inputs["Rotation"].default_value = rot; mp.inputs["Scale"].default_value = tuple(c * FS[0] for c in sc)
        return nb.mul(nb.ss(nb.noise(mp.outputs[0], 1.0, 1.5, 0.5), lo, lo + 0.03), nb.ss(nb.noise(P, 28, 3), 0.42, 0.6))
    scr = nb.sat(nb.add(scratch((0.4, 0.2, 0.9), (8, 650, 650), 0.70), scratch((1.1, 0.5, 0.2), (600, 6, 600), 0.71)))
    chipf = nb.add(nb.mul(edge, 0.55), nb.mul(nb.m("SUBTRACT", b["nB"], 0.5), 0.95), nb.mul(nb.m("SUBTRACT", b["nA"], 0.5), 0.75), nb.mul(nb.m("SUBTRACT", b["nC"], 0.5), 0.32), nb.mul(lowz, 0.10), nb.mul(b["crev"], 0.12))
    T = pal["T"]; chips = nb.sat(nb.add(nb.ss(chipf, T, T + 0.012), nb.mul(scr, 0.9)))
    rustn = nb.noise(P, 75, 6, 0.7); rust_in = nb.mul(nb.ss(chipf, T, T + 0.012), nb.ss(rustn, 0.36, 0.52))
    crev_rust = nb.ss(nb.add(nb.mul(b["crev"], 0.95), nb.mul(nb.m("SUBTRACT", b["nB"], 0.5), 0.8)), 0.36, 0.56)
    rust = nb.m("MAXIMUM", rust_in, crev_rust, clamp=True)
    stain = nb.mul(nb.mul(nb.ss(chipf, T - 0.12, T), nb.ss(b["nC"], 0.3, 0.6)), nb.inv(chips))
    drip = nb.mul(nb.ss(streak, 0.54, 0.7), nb.ss(nb.noise(P, 30, 3), 0.42, 0.6))                      # потёки ржавчины
    col = nb.mix(b["nA"], pal["c1"], pal["c2"]); col = nb.mix(nb.mul(streak, 0.32), col, pal["fade"])
    col = nb.mix(nb.mul(b["nC"], 0.6), col, nb.mix(0.4, col, (0.0, 0.0, 0.0)))
    col = nb.mix(nb.sat(nb.add(nb.mul(stain, 0.8), nb.mul(drip, 0.5))), col, (0.135, 0.052, 0.018))
    col = nb.mix(chips, col, nb.mix(b["nC"], (0.16, 0.155, 0.15), (0.34, 0.33, 0.32)))
    col = nb.mix(rust, col, nb.mix(nb.noise(P, 420, 4), (0.075, 0.026, 0.010), (0.270, 0.105, 0.030)))
    soot = nb.sat(nb.mul(nb.mul(nb.ss(b["z"], 0.205, 0.262), nb.add(0.3, nb.mul(b["nB"], 1.0))), pal["soot"])); col = nb.mix(nb.mul(soot, 0.85), col, (0.012, 0.010, 0.009))
    dust = nb.sat(nb.mul(nb.add(nb.mul(nb.mul(b["cav"], 1.5), nb.ss(b["nB"], 0.25, 0.7)), nb.mul(nb.mul(b["up"], 0.35), b["nA"])), 0.62)); col = nb.mix(dust, col, (0.150, 0.125, 0.095))
    metal = nb.mul(nb.mul(chips, nb.inv(rust)), nb.inv(dust))
    grease = nb.ss(nb.noise(P, 36, 3, 0.5, 1.5), 0.55, 0.75)
    rough = nb.m("SUBTRACT", nb.add(0.36, nb.mul(b["nB"], 0.26)), nb.mul(grease, 0.14)); rough = nb.mixf(chips, rough, nb.add(0.34, nb.mul(b["nC"], 0.2)))
    rough = nb.mixf(rust, rough, 0.92); rough = nb.mixf(nb.sat(nb.add(dust, nb.mul(soot, 0.7))), rough, 0.9)
    height = nb.add(nb.mul(nb.inv(chips), 1.0), nb.mul(rust, nb.add(0.2, nb.mul(b["nD"], 1.4))), nb.mul(b["nD"], 0.10), nb.mul(b["nA"], 1.2), nb.mul(b["nB"], 0.25))
    finish(nb, col, rough, metal, height, (0.7, 0.0009))

def mat_brass(m, masks):
    nb = NB(m); b = base(nb, masks); edge = nb.ss(b["edge"], 0.05, 0.4)
    tarn = nb.ss(nb.m("SUBTRACT", nb.add(nb.mul(b["nB"], 0.6), nb.mul(b["nA"], 0.5), nb.mul(b["crev"], 0.5)), nb.mul(edge, 0.3)), 0.36, 0.66)
    patina = nb.mul(nb.ss(nb.add(b["crev"], nb.mul(nb.m("SUBTRACT", b["nB"], 0.5), 0.9)), 0.5, 0.72), 0.85)
    col = nb.mix(b["nC"], (0.62, 0.40, 0.14), (0.40, 0.25, 0.085)); col = nb.mix(nb.mul(tarn, 0.9), col, (0.070, 0.042, 0.020)); col = nb.mix(patina, col, (0.060, 0.150, 0.115))
    metal = nb.sat(nb.m("SUBTRACT", nb.m("SUBTRACT", 1.0, nb.mul(patina, 0.85)), nb.mul(tarn, 0.3)))
    rough = nb.add(0.30, nb.mul(tarn, 0.34), nb.mul(patina, 0.4), nb.mul(b["nC"], 0.12))
    finish(nb, col, rough, metal, nb.add(nb.mul(nb.inv(patina), 0.5), nb.mul(b["nD"], 0.15), nb.mul(b["nB"], 0.4)), (0.5, 0.0005))

def mat_wire(m, masks):
    nb = NB(m); b = base(nb, masks); P = b["P"]
    rust = nb.ss(nb.add(nb.mul(nb.noise(P, 150, 5, 0.65), 0.85), nb.mul(b["crev"], 0.35)), 0.47, 0.58)
    col = nb.mix(b["nB"], (0.33, 0.34, 0.35), (0.56, 0.57, 0.58)); col = nb.mix(rust, col, nb.mix(b["nC"], (0.10, 0.036, 0.014), (0.30, 0.12, 0.04)))
    finish(nb, col, nb.mixf(rust, nb.add(0.34, nb.mul(b["nC"], 0.16)), 0.88), nb.inv(rust), nb.add(nb.mul(rust, b["nD"]), nb.mul(b["nD"], 0.1)), (0.5, 0.0004))

def mat_wick(m, masks):
    nb = NB(m); b = base(nb, masks); burnt = nb.ss(b["z"], 0.1105, 0.1140)
    finish(nb, nb.mix(burnt, (0.62, 0.56, 0.42), (0.012, 0.010, 0.009)), 0.95, 0.0, b["nD"], (0.5, 0.0002))

def mat_wood(m, masks):
    nb = NB(m); b = base(nb, masks); P = b["P"]; x, y, z = nb.sep(P)
    pid = nb.m("FLOOR", nb.mul(nb.add(y, 0.2425), 1 / 0.097)); wn = nb.node("ShaderNodeTexWhiteNoise", noise_dimensions="1D"); nb.link(pid, wn.inputs["W"]); rnd = wn.outputs["Value"]
    off = nb.node("ShaderNodeCombineXYZ"); nb.link(nb.mul(rnd, 3.1), off.inputs[0]); nb.link(nb.mul(rnd, 31.0), off.inputs[1]); nb.link(nb.mul(rnd, 17.0), off.inputs[2])
    def grain(sc): va = nb.node("ShaderNodeVectorMath", operation="ADD"); nb.link(nb.mapping(P, sc), va.inputs[0]); nb.link(off.outputs[0], va.inputs[1]); return va.outputs[0]
    g1 = nb.noise(grain((3.0, 55.0, 55.0)), 1.0, 5, 0.55, 1.2); ph = nb.add(nb.mul(g1, 20.0), nb.mul(y, 190.0), nb.mul(rnd, 40.0))
    rings = nb.m("POWER", nb.add(nb.mul(nb.m("SINE", ph), 0.5), 0.5), 1.8)
    fib = nb.noise(nb.mapping(P, (9.0, 420.0, 420.0)), 1.0, 2, 0.55); pores = nb.ss(nb.noise(nb.mapping(P, (26.0, 700.0, 700.0)), 1.0, 1, 0.5), 0.60, 0.74)
    crack = nb.mul(nb.ss(nb.noise(grain((1.8, 120.0, 120.0)), 1.0, 2, 0.5, 0.5), 0.70, 0.75), nb.ss(nb.noise(P, 9, 2), 0.42, 0.6))
    tone = nb.sat(nb.add(nb.mul(g1, 0.5), nb.mul(rings, 0.38), nb.mul(fib, 0.2)))
    col = nb.mix(tone, (0.026, 0.014, 0.008), (0.150, 0.082, 0.040)); col = nb.mix(nb.mul(rnd, 0.45), col, (0.20, 0.125, 0.070))
    col = nb.mix(nb.mul(nb.ss(b["nA"], 0.35, 0.75), 0.4), col, (0.120, 0.108, 0.095))            # выцветшая серая древесина
    col = nb.mix(nb.mul(pores, 0.45), col, (0.016, 0.009, 0.005))
    r = nb.m("SQRT", nb.add(nb.mul(x, x), nb.mul(y, y))); stain = nb.mul(nb.inv(nb.ss(r, 0.075, 0.14)), nb.add(0.45, nb.mul(b["nB"], 0.8)))
    spots = nb.ss(nb.noise(P, 14, 4, 0.6, 0.8), 0.6, 0.7); dark = nb.sat(nb.add(nb.mul(stain, 0.55), nb.mul(spots, 0.4)))
    col = nb.mix(dark, col, nb.mix(0.78, col, (0.0, 0.0, 0.0))); col = nb.mix(nb.sat(nb.add(nb.mul(b["crev"], 1.4), crack)), col, (0.010, 0.007, 0.005))
    rough = nb.m("SUBTRACT", nb.add(0.62, nb.mul(fib, 0.22)), nb.add(nb.mul(rings, 0.06), nb.mul(dark, 0.07)))
    height = nb.add(nb.mul(rings, 0.6), nb.mul(fib, 0.45), nb.mul(g1, 0.5), nb.mul(nb.inv(pores), 0.3), nb.mul(nb.inv(crack), 1.6))
    finish(nb, col, rough, 0.0, height, (0.8, 0.0016))

def mat_glass(m, masks):
    nb = NB(m); b = base(nb, None); P = b["P"]
    smudge = nb.ss(nb.noise(P, 34, 5, 0.65, 1.3), 0.50, 0.72); dustf = nb.noise(P, 900, 2, 0.5)
    soot = nb.sat(nb.mul(nb.ss(b["z"], 0.166, 0.204), nb.add(0.3, nb.mul(nb.noise(P, 55, 4), 1.0))))
    haze = nb.sat(nb.mul(nb.inv(nb.ss(b["z"], 0.088, 0.105)), 0.6))                                         # налёт у нижней кромки
    col = nb.mix(nb.sat(nb.add(nb.mul(smudge, 0.2), nb.mul(dustf, 0.05), nb.mul(haze, 0.25))), (0.93, 0.97, 0.95), (0.60, 0.56, 0.48)); col = nb.mix(nb.mul(soot, 0.72), col, (0.045, 0.04, 0.035))
    rough = nb.add(0.025, nb.mul(smudge, 0.2), nb.mul(soot, 0.45), nb.mul(dustf, 0.03), nb.mul(haze, 0.3))
    finish(nb, col, rough, 0.0)

def px(img): a = np.empty(img.size[0] * img.size[1] * 4, np.float32); img.pixels.foreach_get(a); return a.reshape(-1, 4)
def put(img, a): img.pixels.foreach_set(a.ravel()); img.update()

def run(objs, groups, res, OUT):
    scene = bpy.context.scene; scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.use_denoising = False
    scene.world = bpy.data.worlds.new("W"); scene.world.light_settings.distance = 0.3; scene.render.bake.use_selected_to_active = False
    t0 = time.time(); log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)
    def new_img(name, r, srgb=False, fl=False):
        img = bpy.data.images.new(name, r, r, alpha=False, float_buffer=fl); img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"; return img
    def bake(ob, img, typ, samples):
        for m in ob.data.materials: n = m.node_tree.nodes["BAKE"]; n.image = img; m.node_tree.nodes.active = n
        bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob; scene.cycles.samples = samples
        kw = dict(normal_space="TANGENT") if typ == "NORMAL" else {}
        bpy.ops.object.bake(type=typ, use_clear=True, margin=max(4, img.size[0] // 128), margin_type="EXTEND", **kw)
    def route(ob, ch):
        for m in ob.data.materials:
            c = CH[m.name]; nb = c["nb"]
            if ch in ("color", "rm"): nb.link(c[ch], c["emit"].inputs[0]); nb.link(c["emit"].outputs[0], c["out"])
            else: nb.link(c["bsdf"], c["out"])
    def save(img, name): img.filepath_raw = os.path.join(OUT, name); img.file_format = "PNG"; img.save(); return img
    objs["Glass"].hide_render = True; objs["Flame"].hide_render = True
    # 1) маски кромок и углублений
    mask = mat_mask(); masks = {}
    for name in [n for n in ("Lamp", "Table") if n in objs]:
        ob = objs[name]; real = list(ob.data.materials)
        for i in range(len(real)): ob.data.materials[i] = mask
        mp = os.path.join(OUT, f"{name}_masks_{res[name]}.exr")
        if os.environ.get("CACHE") and os.path.exists(mp): img = bpy.data.images.load(mp); img.colorspace_settings.name = "Non-Color"
        else: img = new_img(name + "_masks", res[name], fl=True); bake(ob, img, "EMIT", 12); img.filepath_raw = mp; img.file_format = "OPEN_EXR"; img.save()
        masks[name] = img
        for i, m in enumerate(real): ob.data.materials[i] = m
        a = px(img); log(name, "masks: edge mean %.3f, cav %.3f, crev %.3f" % (a[:, 0].mean(), 1 - a[:, 1].mean(), 1 - a[:, 2].mean()))
    # 2) материалы
    build = dict(paint=mat_paint, brass=mat_brass, wire=mat_wire, wick=mat_wick, wood=mat_wood, glass=mat_glass)
    names = [n for n in ("Lamp", "Table", "Glass") if n in objs]
    for name in names:
        for m in objs[name].data.materials: build[m.name](m, masks.get(name))
    # 3) каналы
    out = {}
    for name in names:
        ob = objs[name]; ob.hide_render = False; r = res[name]; col = new_img(name + "_color", r, srgb=True); rm = new_img(name + "_orm", r)
        route(ob, "color"); bake(ob, col, "EMIT", 2); route(ob, "rm"); bake(ob, rm, "EMIT", 2); a = px(rm); log(name, "color+rough/metal baked; metal mean %.3f rough mean %.3f" % (a[:, 2].mean(), a[:, 1].mean()))
        if name != "Glass":
            route(ob, "bsdf"); nrm = new_img(name + "_normal", r); bake(ob, nrm, "NORMAL", 1); log(name, "normal baked")
            ap = os.path.join(OUT, f"{name}_ao_{r}.png")
            if os.environ.get("CACHE") and os.path.exists(ap): ao = bpy.data.images.load(ap); ao.colorspace_settings.name = "Non-Color"
            else: ao = new_img(name + "_ao", r); bake(ob, ao, "AO", int(os.environ.get("AO", "24"))); ao.filepath_raw = ap; ao.file_format = "PNG"; ao.save()
            o = px(ao)[:, 0]; log(name, "ao ready, mean %.3f" % o.mean())
            a[:, 0] = np.clip(0.12 + 0.88 * o, 0, 1); c = px(col); c[:, :3] *= (0.62 + 0.38 * o)[:, None]; put(col, c); save(nrm, name + "_normal.png")
        else: a[:, 0] = 1.0
        put(rm, a); save(col, name + "_color.png"); save(rm, name + "_orm.png"); out[name] = (col, rm, nrm if name != "Glass" else None)
    # 4) экспортные материалы
    grp = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree"); grp.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    for name, (col, rm, nrm) in out.items():
        m = bpy.data.materials.new("M_" + name); m.use_nodes = True; t = m.node_tree; b = t.nodes["Principled BSDF"]
        def tex(img): n = t.nodes.new("ShaderNodeTexImage"); n.image = img; return n
        t.links.new(tex(col).outputs[0], b.inputs["Base Color"]); sc = t.nodes.new("ShaderNodeSeparateColor"); t.links.new(tex(rm).outputs[0], sc.inputs[0])
        t.links.new(sc.outputs[1], b.inputs["Roughness"]); t.links.new(sc.outputs[2], b.inputs["Metallic"])
        if nrm:
            nm = t.nodes.new("ShaderNodeNormalMap"); t.links.new(tex(nrm).outputs[0], nm.inputs["Color"]); t.links.new(nm.outputs[0], b.inputs["Normal"])
            g = t.nodes.new("ShaderNodeGroup"); g.node_tree = grp; t.links.new(sc.outputs[0], g.inputs["Occlusion"])
        else: b.inputs["Transmission Weight"].default_value = 1.0; b.inputs["IOR"].default_value = 1.5
        me = objs[name].data; me.materials.clear(); me.materials.append(m)
        for p in me.polygons: p.material_index = 0
    fm = objs["Flame"].data.materials[0]; fm.use_nodes = True; fb = fm.node_tree.nodes["Principled BSDF"]; fb.inputs["Emission Color"].default_value = (1, 0.6, 0.2, 1); fb.inputs["Emission Strength"].default_value = 5
    objs["Glass"].hide_render = False; objs["Flame"].hide_render = False
    path = os.path.join(OUT, "lamp_raw.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_image_format=os.environ.get("IMG", "WEBP"), export_image_quality=int(os.environ.get("Q", "88")), export_tangents=True)
    log("exported", os.path.getsize(path) // 1024, "KB")
