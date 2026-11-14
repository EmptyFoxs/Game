# Облегчённая лампа для игры (чекпоинты и финиш): та же модель с меньшим числом сегментов, атлас 1024
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo; geo.SEG[0] = 0.5; geo.CRN[0] = 0.6
import lamp_parts, bake
OUT = "../out/lamp"; os.makedirs(OUT, exist_ok=True); RES = int(os.environ.get("RES", "1024"))
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene
def make_object(g, res):
    g.pack(margin=8.0 / res); me = bpy.data.meshes.new(g.name); me.from_pydata([tuple(map(float, v)) for v in g.V], [], g.F); me.update(); uv = me.uv_layers.new(name="UVMap")
    for fi, poly in enumerate(me.polygons):
        for li, loop in enumerate(poly.loop_indices): cid, u, v = g.FC[fi][li]; x0, y0 = g.pos[cid]; uv.data[loop].uv = (x0 + u * g.scale, y0 + v * g.scale)
        poly.material_index = g.FM[fi]; poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(66)); ob = bpy.data.objects.new(g.name, me); scene.collection.objects.link(ob)
    for m in g.mats: me.materials.append(bpy.data.materials.get(m) or bpy.data.materials.new(m))
    return ob
groups = [g for g in lamp_parts.build() if g.name != "Table"]; res = {"Lamp": RES, "Glass": 64, "Flame": 64}
objs = {g.name: make_object(g, res[g.name]) for g in groups}
for g in groups: print(f"{g.name}: {len(g.V)} verts, {len(g.F)} faces", flush=True)
bake.run(objs, groups, res, OUT); os.replace(os.path.join(OUT, "lamp_raw.glb"), "../out/lamp_low.glb")
