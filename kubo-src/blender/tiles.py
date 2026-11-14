# Бесшовные PBR-текстуры (плитняк, скала, трава): шум на 4D-торе -> точная периодичность по U и V
import bpy, sys, os, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake import NB, CH, px, put
OUT = os.environ.get("OUT", "../out"); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.use_denoising = False; scene.world = bpy.data.worlds.new("W")

class TB(NB):
    def setup(s):
        tc = s.node("ShaderNodeTexCoord"); u, v, _ = s.sep(tc.outputs["UV"]); tau = 2 * math.pi
        s.cu, s.su, s.cv, s.sv = s.m("COSINE", s.mul(u, tau)), s.m("SINE", s.mul(u, tau)), s.m("COSINE", s.mul(v, tau)), s.m("SINE", s.mul(v, tau)); s.k = 0
    def torus(s, ru, rv):
        s.k += 1; o = s.k * 7.31; c = s.node("ShaderNodeCombineXYZ")
        s.link(s.add(s.mul(s.cu, ru), o), c.inputs[0]); s.link(s.add(s.mul(s.su, ru), o * 1.7), c.inputs[1]); s.link(s.add(s.mul(s.cv, rv), o * 0.6), c.inputs[2]); return c.outputs[0], s.add(s.mul(s.sv, rv), o * 2.3)
    def tn(s, ru, rv=None, detail=4.0, rough=0.55, dist=0.0):
        vec, w = s.torus(ru, rv or ru); n = s.node("ShaderNodeTexNoise", noise_dimensions="4D"); s.link(vec, n.inputs["Vector"]); s.link(w, n.inputs["W"])
        n.inputs["Scale"].default_value = 1.0; n.inputs["Detail"].default_value = detail; n.inputs["Roughness"].default_value = rough; n.inputs["Distortion"].default_value = dist; return n.outputs[0]
    def vor(s, ru, rv=None, feature="DISTANCE_TO_EDGE", rnd=1.0):
        vec, w = s.torus(ru, rv or ru); n = s.node("ShaderNodeTexVoronoi", voronoi_dimensions="4D", feature=feature); s.link(vec, n.inputs["Vector"]); s.link(w, n.inputs["W"])
        n.inputs["Scale"].default_value = 1.0; n.inputs["Randomness"].default_value = rnd; return n
    def done(s, color, rough, ao, height, dist):
        bsdf = s.node("ShaderNodeBsdfPrincipled"); s._in(bsdf.inputs["Base Color"], color); s._in(bsdf.inputs["Roughness"], rough)
        b = s.node("ShaderNodeBump"); b.inputs["Strength"].default_value = 1.0; b.inputs["Distance"].default_value = dist; s.link(height, b.inputs["Height"]); s.link(b.outputs[0], bsdf.inputs["Normal"])
        out = s.node("ShaderNodeOutputMaterial"); emit = s.node("ShaderNodeEmission"); img = s.node("ShaderNodeTexImage"); img.name = "BAKE"
        s.ch = dict(color=s.mix(s.inv(ao), color, s.mix(0.5, color, (0.0, 0.0, 0.0))), rm=s.comb(ao, rough, 0.0), bsdf=bsdf.outputs[0], out=out.inputs["Surface"], emit=emit)

def cellmap(nb, name):
    tc = nb.node("ShaderNodeTexCoord"); t = nb.node("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(OUT, f"cells_{name}.png")); t.image.colorspace_settings.name = "Non-Color"; t.extension = "REPEAT"
    nb.link(tc.outputs["UV"], t.inputs["Vector"]); sc = nb.node("ShaderNodeSeparateColor"); nb.link(t.outputs[0], sc.inputs[0]); return nb.mul(sc.outputs[0], 0.12), sc.outputs[1], sc.outputs[2]

def flagstone(m):
    nb = TB(m); nb.setup(); d, cr, cg = cellmap(nb, "stone")
    nbig, nmed, nfin, nmic = nb.tn(0.45, detail=3), nb.tn(1.6, detail=5), nb.tn(6.0, detail=4), nb.tn(18.0, detail=2)
    dd = nb.add(d, nb.mul(nb.m("SUBTRACT", nfin, 0.5), 0.010))
    stone = nb.ss(dd, 0.0045, 0.011); pillow = nb.ss(dd, 0.004, 0.045)
    col = nb.mix(nmed, (0.165, 0.145, 0.120), (0.320, 0.290, 0.245)); col = nb.mix(nb.mul(cr, 0.6), col, (0.250, 0.235, 0.215)); col = nb.mix(nb.mul(cg, 0.4), col, (0.120, 0.104, 0.088))
    col = nb.mix(nb.mul(nb.ss(nbig, 0.5, 0.75), 0.4), col, (0.095, 0.086, 0.076))                                   # тёмные пятна
    lichen = nb.mul(nb.ss(nb.tn(3.2, detail=3), 0.63, 0.70), nb.ss(nb.tn(0.9, detail=2), 0.45, 0.6)); col = nb.mix(nb.mul(lichen, 0.75), col, (0.330, 0.340, 0.210))
    pits = nb.ss(nmic, 0.62, 0.74); col = nb.mix(nb.mul(pits, 0.5), col, (0.060, 0.052, 0.045))
    worn = nb.inv(nb.ss(dd, 0.008, 0.03)); col = nb.mix(nb.mul(worn, 0.35), col, (0.36, 0.34, 0.30))                    # светлые стёртые кромки
    moss = nb.sat(nb.mul(nb.add(nb.inv(nb.ss(dd, 0.006, 0.026)), nb.mul(nb.ss(nb.tn(1.1, detail=4), 0.60, 0.74), 0.9)), nb.add(0.1, nb.mul(nmed, 1.3))))
    mosscol = nb.mix(nfin, (0.030, 0.062, 0.016), (0.085, 0.140, 0.035))
    col = nb.mix(nb.mul(moss, 0.9), col, mosscol); col = nb.mix(nb.mul(nb.inv(stone), nb.inv(nb.mul(moss, 0.8))), col, (0.028, 0.022, 0.016))
    rough = nb.add(0.68, nb.mul(nmed, 0.2), nb.mul(moss, 0.12))
    h = nb.add(nb.mul(pillow, 0.9), nb.mul(cg, 0.3), nb.mul(nfin, 0.10), nb.mul(nb.inv(pits), 0.06), nb.mul(nmed, 0.14)); h = nb.add(nb.mul(h, stone), nb.mul(moss, 0.2))
    ao = nb.add(0.35, nb.mul(nb.ss(dd, 0.0, 0.025), 0.65)); nb.done(col, rough, ao, h, 0.012); return nb

def rock(m):
    nb = TB(m); nb.setup(); d, cr, cg = cellmap(nb, "rock")
    strata = nb.tn(0.55, 2.3, detail=6, rough=0.6, dist=0.6); big = nb.tn(0.42, 0.42, detail=3); med = nb.tn(1.8, 2.4, detail=5); fin = nb.tn(7.0, 8.0, detail=4); mic = nb.tn(20.0, detail=2)
    dd = nb.add(d, nb.mul(nb.m("SUBTRACT", fin, 0.5), 0.016), nb.mul(nb.m("SUBTRACT", med, 0.5), 0.02)); crack = nb.mul(nb.inv(nb.ss(dd, 0.002, 0.011)), nb.ss(big, 0.3, 0.55))
    ledge = nb.ss(nb.add(strata, nb.mul(cr, 0.25)), 0.5, 0.72); block = nb.ss(dd, 0.004, 0.07)
    col = nb.mix(strata, (0.100, 0.088, 0.076), (0.285, 0.255, 0.220)); col = nb.mix(nb.mul(cg, 0.45), col, (0.190, 0.176, 0.160)); col = nb.mix(nb.mul(nb.ss(med, 0.4, 0.7), 0.45), col, (0.205, 0.155, 0.100))  # охра
    col = nb.mix(nb.mul(nb.ss(big, 0.5, 0.75), 0.4), col, (0.066, 0.062, 0.058)); col = nb.mix(nb.mul(fin, 0.3), col, (0.34, 0.32, 0.29))
    lich = nb.mul(nb.ss(nb.tn(3.0, detail=3), 0.64, 0.71), 0.65); col = nb.mix(lich, col, (0.290, 0.300, 0.195))
    mossm = nb.mul(nb.ss(nb.tn(1.3, 1.3, detail=4), 0.60, 0.74), nb.inv(ledge)); col = nb.mix(nb.mul(mossm, 0.7), col, (0.050, 0.085, 0.025))
    col = nb.mix(nb.mul(crack, 0.85), col, (0.020, 0.017, 0.014))
    h = nb.add(nb.mul(big, 1.0), nb.mul(ledge, 0.6), nb.mul(block, 0.45), nb.mul(cr, 0.35), nb.mul(med, 0.4), nb.mul(fin, 0.14), nb.mul(mic, 0.04), nb.mul(nb.inv(crack), 0.5))
    ao = nb.sat(nb.add(0.3, nb.mul(nb.inv(crack), 0.45), nb.mul(ledge, 0.25))); nb.done(col, nb.add(0.74, nb.mul(med, 0.18)), ao, h, 0.03); return nb

def grass(m):
    nb = TB(m); nb.setup()
    big, med, fin, mic = nb.tn(0.5, detail=3), nb.tn(2.2, detail=5), nb.tn(9.0, detail=4), nb.tn(26.0, detail=2)
    col = nb.mix(nb.ss(med, 0.3, 0.7), (0.022, 0.048, 0.010), (0.085, 0.145, 0.032)); col = nb.mix(nb.mul(nb.ss(big, 0.45, 0.75), 0.6), col, (0.150, 0.145, 0.050))                 # сухие пятна
    col = nb.mix(nb.mul(nb.ss(fin, 0.55, 0.8), 0.5), col, (0.130, 0.200, 0.050)); soil = nb.mul(nb.ss(nb.tn(1.4, detail=4), 0.66, 0.76), nb.ss(mic, 0.3, 0.6))
    col = nb.mix(soil, col, (0.050, 0.036, 0.022)); col = nb.mix(nb.mul(nb.ss(mic, 0.7, 0.8), 0.6), col, (0.012, 0.024, 0.006))
    h = nb.add(nb.mul(fin, 0.5), nb.mul(mic, 0.5), nb.mul(med, 0.4), nb.mul(nb.inv(soil), 0.3))
    nb.done(col, nb.add(0.80, nb.mul(fin, 0.12)), nb.add(0.55, nb.mul(mic, 0.45)), h, 0.02); return nb

me = bpy.data.meshes.new("P"); me.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [], [(0, 1, 2, 3)]); uv = me.uv_layers.new(name="UVMap")
for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv.data[i].uv = c
ob = bpy.data.objects.new("P", me); scene.collection.objects.link(ob); ob.select_set(True); bpy.context.view_layer.objects.active = ob
for name, fn, res in (("stone", flagstone, 1024), ("rock", rock, 1024), ("grass", grass, 512)):
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    m = bpy.data.materials.new(name); nb = fn(m); me.materials.clear(); me.materials.append(m); c = nb.ch
    def bake(typ, srgb, ch, samples=4):
        img = bpy.data.images.new(name + "_" + ch, res, res, alpha=False); img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
        n = m.node_tree.nodes["BAKE"]; n.image = img; m.node_tree.nodes.active = n
        if ch in ("color", "rm"): nb.link(c[ch], c["emit"].inputs[0]); nb.link(c["emit"].outputs[0], c["out"])
        else: nb.link(c["bsdf"], c["out"])
        scene.cycles.samples = samples; bpy.ops.object.bake(type=typ, use_clear=True, margin=0, **(dict(normal_space="TANGENT") if typ == "NORMAL" else {}))
        img.filepath_raw = os.path.join(OUT, f"{name}_{ch}.png"); img.file_format = "PNG"; img.save(); return img
    bake("EMIT", True, "color"); bake("EMIT", False, "rm"); bake("NORMAL", False, "normal", 1); print("baked", name, flush=True)
