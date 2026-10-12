"""Build the parked-scooter GLB from the CC-BY "Vino" model by minghauLoh.

Source: https://sketchfab.com/3d-models/vino-2205f4e69bc64df3aab03c71ab9d7492 (CC-BY-4.0), as mirrored
in gkjohnson/3d-demo-data at a pinned commit (scooter.json). Every source file is SHA-256 checked.

Requires Python 3.11 with `pip install bpy==4.2.0 numpy`, and Node (npx @gltf-transform/cli@4.1.1,
which decodes the source's meshopt compression for Blender).
Usage:   python3.11 scripts/vehicles/build_scooter.py <work-dir>
Output:  <work-dir>/scooter.glb, to be admitted with `node scripts/vehicles/import-scooter.mjs <work-dir>`.

What the conversion does, so the result can share the street's baked material (no textures, no new
shader program):
- removes the beginner's-licence sticker decal;
- samples each corner's base colour, roughness and metalness from the source PBR textures;
- decimates each material separately (keeps paint/seat/tyre boundaries crisp) to about TARGET triangles;
- writes base colour as COLOR_0 and (roughness, metalness) in TEXCOORD_0; drops all images;
- places the wheels on y=0, centres it, and points the headlamp along +Z (glTF), length in metres.
"""
import hashlib, json, math, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(HERE, 'scooter.json')))
work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)
TARGET = spec['targetTriangles']


def fetch(path):
    local = os.path.join(work, 'src', path)
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        url = f"https://raw.githubusercontent.com/{spec['source']['repository']}/{spec['source']['commit']}/{spec['source']['path']}/{path}"
        with urllib.request.urlopen(url) as r, open(local, 'wb') as f: f.write(r.read())
    if hashlib.sha256(open(local, 'rb').read()).hexdigest() != spec['source']['files'][path]:
        raise SystemExit(f'Checksum mismatch for {path}')
    return local


if __name__ == '__main__' and 'bpy' not in sys.modules and os.environ.get('SCOOTER_STAGE') != 'blender':
    for path in spec['source']['files']: fetch(path)
    decoded = os.path.join(work, 'vino-decoded.glb'); small = os.path.join(work, 'vino-1k.glb')
    subprocess.check_call(['npx', '--yes', '@gltf-transform/cli@4.1.1', 'copy', os.path.join(work, 'src', 'scene.gltf'), decoded])
    subprocess.check_call(['npx', '--yes', '@gltf-transform/cli@4.1.1', 'resize', decoded, small, '--width', '1024', '--height', '1024'])
    subprocess.check_call([sys.executable, '-I', os.path.abspath(__file__), work], env={**os.environ, 'SCOOTER_STAGE': 'blender'})
    sys.exit(0)

import bpy, bmesh, numpy as np, mathutils

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(work, 'vino-1k.glb'))
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = obj; obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh = obj.data


def image_array(material, socket):
    node = material.node_tree.nodes.get('Principled BSDF')
    links = node.inputs[socket].links
    if not links: return None
    src = links[0].from_node
    while src.type != 'TEX_IMAGE':
        inputs = [i for i in src.inputs if i.links]
        if not inputs: return None
        src = inputs[0].links[0].from_node
    image = src.image; w, h = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(h, w, image.channels)
    if image.colorspace_settings.name == 'sRGB':  # 8-bit pixels come back unconverted; glTF COLOR_0 is linear
        pixels[..., :3] = np.where(pixels[..., :3] <= .04045, pixels[..., :3] / 12.92, ((pixels[..., :3] + .055) / 1.055) ** 2.4)
    return pixels


materials = []
for m in mesh.materials:
    bsdf = m.node_tree.nodes['Principled BSDF']
    base_factor = np.array(bsdf.inputs['Base Color'].default_value[:3])
    materials.append(dict(
        name=m.name, base=image_array(m, 'Base Color'), base_factor=base_factor,
        mr=image_array(m, 'Roughness') if bsdf.inputs['Roughness'].links else None,
        # A linked socket's default_value is meaningless (the importer folds factors of 1 away).
        rough=1.0 if bsdf.inputs['Roughness'].links else bsdf.inputs['Roughness'].default_value,
        metal=1.0 if bsdf.inputs['Metallic'].links else bsdf.inputs['Metallic'].default_value))

# Remove the decal.
bm = bmesh.new(); bm.from_mesh(mesh)
sticker = [i for i, m in enumerate(materials) if m['name'] == 'Sticker']
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in sticker], context='FACES')
bm.to_mesh(mesh); bm.free()

uv = np.zeros(len(mesh.loops) * 2, np.float32); mesh.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
loop_material = np.zeros(len(mesh.loops), np.int32)
for poly in mesh.polygons: loop_material[poly.loop_start:poly.loop_start + poly.loop_total] = poly.material_index
colour = np.ones((len(mesh.loops), 4), np.float32); finish = np.zeros((len(mesh.loops), 2), np.float32)
glass = spec['glass']
for index, m in enumerate(materials):
    sel = loop_material == index
    if not sel.any(): continue
    if 'Glass' in m['name']:
        colour[sel, :3] = glass['color']; finish[sel] = glass['roughness'], 0; continue
    if m['base'] is not None:
        h, w, _ = m['base'].shape
        x = np.clip((uv[sel, 0] % 1) * w, 0, w - 1).astype(int); y = np.clip((uv[sel, 1] % 1) * h, 0, h - 1).astype(int)
        colour[sel, :3] = m['base'][y, x, :3] * m['base_factor']
    else:
        colour[sel, :3] = m['base_factor']
    if m['mr'] is not None:
        h, w, _ = m['mr'].shape
        x = np.clip((uv[sel, 0] % 1) * w, 0, w - 1).astype(int); y = np.clip((uv[sel, 1] % 1) * h, 0, h - 1).astype(int)
        finish[sel, 0] = m['mr'][y, x, 1] * m['rough']; finish[sel, 1] = m['mr'][y, x, 2] * m['metal']
    else:
        finish[sel] = m['rough'], m['metal']
attr = mesh.color_attributes.new('base', 'FLOAT_COLOR', 'CORNER'); attr.data.foreach_set('color', colour.ravel())
mesh.color_attributes.active_color = attr
while mesh.uv_layers: mesh.uv_layers.remove(mesh.uv_layers[0])
fl = mesh.uv_layers.new(name='finish'); fl.data.foreach_set('uv', finish.ravel())

# Keep the full-resolution surface to re-sample colour after decimation (collapse blends corner colours).
high = bmesh.new(); high.from_mesh(mesh); bmesh.ops.triangulate(high, faces=high.faces[:])
high.faces.ensure_lookup_table()
base_layer = high.loops.layers.float_color['base']; finish_layer = high.loops.layers.uv['finish']
high_colour = np.array([[l[base_layer][:3] for l in f.loops] for f in high.faces], np.float32)
high_finish = np.array([[l[finish_layer].uv[:] for l in f.loops] for f in high.faces], np.float32)
high_tri = [[v.co.copy() for v in f.verts] for f in high.faces]
from mathutils.bvhtree import BVHTree
tree = BVHTree.FromBMesh(high)

# Decimate each material on its own so colour boundaries stay where the artist put them.
total = len(mesh.polygons)
before = sum(len(p.vertices) - 2 for p in mesh.polygons)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for part in parts:
    # The glTF import splits vertices at every UV seam; weld them so the collapse can work across seams.
    bm = bmesh.new(); bm.from_mesh(part.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.0004); bm.to_mesh(part.data); bm.free()
    mod = part.modifiers.new('decimate', 'DECIMATE'); mod.decimate_type = 'COLLAPSE'; mod.ratio = max(.004, TARGET / before); mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = part; bpy.ops.object.modifier_apply(modifier='decimate')
for part in parts: part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active; mesh = obj.data
for m in list(mesh.materials): mesh.materials.pop()

# Re-sample each corner from the original surface, nudged toward its face centre so a corner on a
# paint/rubber boundary takes the colour of its own face.
low_colour = np.zeros((len(mesh.loops), 4), np.float32); low_colour[:, 3] = 1; low_finish = np.zeros((len(mesh.loops), 2), np.float32)
for poly in mesh.polygons:
    centre = poly.center
    for li in range(poly.loop_start, poly.loop_start + poly.loop_total):
        p = mesh.vertices[mesh.loops[li].vertex_index].co.lerp(centre, .35)
        loc, _, index, _ = tree.find_nearest(p)
        a, b, c = high_tri[index]
        w = mathutils.geometry.barycentric_transform(loc, a, b, c, mathutils.Vector((1, 0, 0)), mathutils.Vector((0, 1, 0)), mathutils.Vector((0, 0, 1)))
        w = np.clip(np.array(w[:]), 0, None); w /= max(w.sum(), 1e-6)
        low_colour[li, :3] = w @ high_colour[index]; low_finish[li] = w @ high_finish[index]
mesh.color_attributes['base'].data.foreach_set('color', low_colour.ravel())
mesh.uv_layers['finish'].data.foreach_set('uv', low_finish.ravel())
high.free()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

# Ground, centre and orientation: headlamp toward Blender -Y (glTF +Z).
co = np.zeros(len(mesh.vertices) * 3, np.float32); mesh.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
lo, hi = co.min(0), co.max(0)
offset = mathutils.Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
mesh.transform(mathutils.Matrix.Translation(offset))
if spec['headlampTowardPlusY']: mesh.transform(mathutils.Matrix.Rotation(math.pi, 4, 'Z'))
scale = spec['lengthMetres'] / (hi[1] - lo[1]); mesh.transform(mathutils.Matrix.Scale(scale, 4))
mesh.update()

after = sum(len(p.vertices) - 2 for p in mesh.polygons)
bpy.ops.export_scene.gltf(filepath=os.path.join(work, 'scooter.glb'), export_format='GLB', use_selection=False,
                          export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True,
                          export_texcoords=True, export_normals=True, export_materials='NONE', export_yup=True)
json.dump({'sourceTriangles': before, 'triangles': after, 'size': [float(v) for v in (hi - lo) * scale]}, open(os.path.join(work, 'scooter.stats.json'), 'w'))
print('scooter', before, '->', after, 'triangles')
os._exit(0)  # bpy can crash while tearing down; the export is already written
