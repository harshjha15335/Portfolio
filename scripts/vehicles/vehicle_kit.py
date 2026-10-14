"""Small modelling kit for the original vehicle bodies (taxi, auto-rickshaw).

Geometry is authored here as code, in Blender's axes (x right, y forward, z up; metres), then handed
to Blender for smoothing, ambient-occlusion baking and glTF export. Every face carries a finish
region (paint, chrome, rubber...) so colour boundaries stay on real edges.

Output parts, matched by the runtime (src/game/World/AuthoredVehicles.ts):
- body:  base colour in COLOR_0, (roughness, metalness) in TEXCOORD_0, drawn with the street's shared
         baked material (no texture, no new shader program);
- glass: positions only, drawn with the vehicle's existing glass material;
- lamps / tail: positions only, drawn with the vehicle's existing lamp and tail-lamp materials.
"""
import math
import numpy as np


def srgb(hex_colour):
    c = np.array([int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


class Part:
    """Polygons for one exported part, each with a region name."""

    def __init__(self):
        self.verts, self.faces, self.regions = [], [], []

    def add_vert(self, p):
        self.verts.append(tuple(float(v) for v in p)); return len(self.verts) - 1

    def add_face(self, idx, region):
        self.faces.append(tuple(idx)); self.regions.append(region)

    def grid(self, P, region, closed=False, flip=False):
        """Quad strip surface over P[ring][point]. region(i, j) names face (i..i+1, j..j+1) or None to skip."""
        P = np.asarray(P, float); n_r, n_p = P.shape[:2]
        ids = [[self.add_vert(P[i, j]) for j in range(n_p)] for i in range(n_r)]
        for i in range(n_r - 1):
            for j in range(n_p if closed else n_p - 1):
                k = (j + 1) % n_p; r = region(i, j)
                if r is None: continue
                quad = [ids[i][j], ids[i + 1][j], ids[i + 1][k], ids[i][k]]
                self.add_face(quad[::-1] if flip else quad, r)
        return ids

    def fan(self, ring_ids, centre, region, flip=False):
        c = self.add_vert(centre)
        for j in range(len(ring_ids)):
            tri = [ring_ids[j], ring_ids[(j + 1) % len(ring_ids)], c]
            self.add_face(tri[::-1] if flip else tri, region)

    def tube(self, path, radius, region, sides=8, caps=True, up=(0, 0, 1)):
        """Sweep an ellipse (rx, rz in the path's frame) along a polyline."""
        path = np.asarray(path, float); rx, rz = (radius, radius) if np.isscalar(radius) else radius
        rings = []
        for i, p in enumerate(path):
            t = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]; t /= np.linalg.norm(t)
            u = np.cross(t, up); u = u / np.linalg.norm(u) if np.linalg.norm(u) > 1e-6 else np.cross(t, (1, 0, 0)) / np.linalg.norm(np.cross(t, (1, 0, 0)))
            v = np.cross(u, t)
            rings.append([p + u * rx * math.cos(a) + v * rz * math.sin(a) for a in np.linspace(0, 2 * math.pi, sides, endpoint=False)])
        ids = self.grid(rings, lambda i, j: region, closed=True, flip=True)
        if caps:
            self.fan(ids[0], path[0], region, flip=False)
            self.fan(ids[-1], path[-1], region, flip=True)

    def ellipsoid(self, centre, radii, region, nu=12, nv=6):
        c = np.asarray(centre, float); r = np.asarray(radii, float)
        lat = np.linspace(-math.pi / 2, math.pi / 2, nv + 1)[1:-1]
        rings = [[c + r * np.array([math.cos(la) * math.cos(a), math.cos(la) * math.sin(a), math.sin(la)]) for a in np.linspace(0, 2 * math.pi, nu, endpoint=False)] for la in lat]
        ids = self.grid(rings, lambda i, j: region, closed=True, flip=True)
        self.fan(ids[0], c - r * np.array([0, 0, 1]), region)
        self.fan(ids[-1], c + r * np.array([0, 0, 1]), region, flip=True)

    def box(self, centre, size, region):
        c = np.asarray(centre, float); h = np.asarray(size, float) / 2
        v = [self.add_vert(c + h * np.array([x, y, z])) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.add_face([v[i] for i in f], region)

    def torus(self, centre, axis, R, r, region, nu=16, nv=5):
        c = np.asarray(centre, float); n = np.asarray(axis, float) / np.linalg.norm(axis)
        a = np.cross(n, (0, 0, 1) if abs(n[2]) < .9 else (1, 0, 0)); a /= np.linalg.norm(a); b = np.cross(n, a)
        rings = []
        for t in np.linspace(0, 2 * math.pi, nu, endpoint=False):
            d = a * math.cos(t) + b * math.sin(t)
            rings.append([c + d * (R + r * math.cos(p)) + n * r * math.sin(p) for p in np.linspace(0, 2 * math.pi, nv, endpoint=False)])
        rings.append(rings[0])
        self.grid(rings, lambda i, j: region, closed=True)

    def disc(self, centre, axis, radii, region, n=16, flip=False):
        c = np.asarray(centre, float); nrm = np.asarray(axis, float) / np.linalg.norm(axis)
        a = np.cross(nrm, (0, 0, 1) if abs(nrm[2]) < .9 else (1, 0, 0)); a /= np.linalg.norm(a); b = np.cross(nrm, a)
        ring = [self.add_vert(c + a * radii[0] * math.cos(t) + b * radii[1] * math.sin(t)) for t in np.linspace(0, 2 * math.pi, n, endpoint=False)]
        self.fan(ring, c, region, flip=flip)

    def mirrored(self):
        """Adds the x-mirror of everything so far (for parts authored on one side)."""
        n = len(self.verts)
        self.verts += [(-x, y, z) for x, y, z in self.verts[:n]]
        self.faces += [tuple(i + n for i in f[::-1]) for f in self.faces[:]]
        self.regions += self.regions[:]

    def triangles(self):
        return sum(len(f) - 2 for f in self.faces)


def table(points):
    """Piecewise-linear profile through (s, value) points; s may be given in any order."""
    pts = sorted(points); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return lambda s: float(np.interp(s, xs, ys))


def smooth(edge0, edge1, x):
    t = min(max((x - edge0) / (edge1 - edge0), 0), 1); return t * t * (3 - 2 * t)


def export(parts, palette, out, ground=True, occluders=(), ao_distance=.35, ao_floor=.32, city=None):
    """Builds Blender objects, bakes ambient occlusion into the body colour and writes a GLB.

    city: optional dict(out=path, near=triangles, far=triangles, paint={regions}, lamp=hex, tail=hex). Also writes a
    district-traffic GLB with two meshes, 'near' and 'far': body, lamps and tail joined into one vertex-coloured
    mesh, decimated to the given triangle counts. COLOR_0 alpha is 1 on paint faces (recoloured per vehicle at
    runtime) and 0 elsewhere.
    """
    import bpy, bmesh
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 64
    scene.world = bpy.data.worlds.new('w')
    objects = {}
    for name, part in parts.items():
        mesh = bpy.data.meshes.new(name); mesh.from_pydata(part.verts, [], part.faces); mesh.validate(); mesh.update()
        obj = bpy.data.objects.new(name, mesh); scene.collection.objects.link(obj); objects[name] = obj
        bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free()
    # Occluders for the bake only: ground and wheels.
    temp = []
    if ground:
        bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); temp.append(bpy.context.object)
    for loc, radius, width in occluders:
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=width, location=loc, rotation=(0, math.pi / 2, 0), vertices=20); temp.append(bpy.context.object)
    body = objects['body']; mesh = body.data
    colour = np.array([palette[r][0] for r in parts['body'].regions], np.float32)
    finish = np.array([palette[r][1:3] for r in parts['body'].regions], np.float32)
    ao_scale = np.array([palette[r][3] if len(palette[r]) > 3 else 1 for r in parts['body'].regions], np.float32)
    loop_colour = np.ones((len(mesh.loops), 4), np.float32); loop_finish = np.zeros((len(mesh.loops), 2), np.float32); loop_ao = np.zeros(len(mesh.loops), np.float32)
    for poly in mesh.polygons:
        s = slice(poly.loop_start, poly.loop_start + poly.loop_total)
        loop_colour[s, :3] = colour[poly.index]; loop_finish[s] = finish[poly.index]; loop_ao[s] = ao_scale[poly.index]
    for o in bpy.context.scene.objects: o.select_set(False)
    body.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
    ao = mesh.color_attributes.new('ao', 'FLOAT_COLOR', 'CORNER'); mesh.color_attributes.active_color = ao
    mat = bpy.data.materials.new('bake'); mat.use_nodes = True; mesh.materials.append(mat)
    scene.cycles.bake_type = 'AO'; scene.render.bake.target = 'VERTEX_COLORS'; scene.world.light_settings.distance = ao_distance
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    occlusion = np.zeros(len(mesh.loops) * 4, np.float32); ao.data.foreach_get('color', occlusion); occlusion = occlusion.reshape(-1, 4)[:, 0]
    shade = ao_floor + (1 - ao_floor) * occlusion
    print('ambient occlusion: mean', float(occlusion.mean()), 'min', float(occlusion.min()))
    loop_colour[:, :3] *= (1 - loop_ao[:, None] + loop_ao[:, None] * shade[:, None])
    mesh.materials.clear(); mesh.color_attributes.remove(ao)
    base = mesh.color_attributes.new('base', 'FLOAT_COLOR', 'CORNER'); base.data.foreach_set('color', loop_colour.ravel()); mesh.color_attributes.active_color = base
    uv = mesh.uv_layers.new(name='finish'); uv.data.foreach_set('uv', loop_finish.ravel())
    for o in temp: bpy.data.objects.remove(o, do_unlink=True)
    for name, obj in objects.items():
        if name == 'body': continue
        for o in bpy.context.scene.objects: o.select_set(False)
        obj.select_set(True); bpy.context.view_layer.objects.active = obj; bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_vertex_color='ACTIVE',
                              export_active_vertex_color_when_no_material=True, export_texcoords=True, export_normals=True,
                              export_materials='NONE', export_yup=True)
    counts = {name: part.triangles() for name, part in parts.items()}
    if city: counts.update(_export_city(objects, parts, city))
    return counts


def _export_city(objects, parts, city):
    import bpy
    copies = []
    for name, obj in objects.items():
        copy = obj.copy(); copy.data = obj.data.copy(); bpy.context.scene.collection.objects.link(copy); mesh = copy.data
        n = len(mesh.loops)
        if name == 'body':
            colour = np.zeros(n * 4, np.float32); mesh.color_attributes['base'].data.foreach_get('color', colour); colour = colour.reshape(-1, 4)
            paint = np.array([r in city['paint'] for r in parts['body'].regions])
            for poly in mesh.polygons: colour[poly.loop_start:poly.loop_start + poly.loop_total, 3] = 1.0 if paint[poly.index] else 0.0
        else:
            rgb = srgb(city['lamp'] if name == 'lamps' else city['tail'] if name == 'tail' else '#26343a')
            colour = np.tile(np.array([*rgb, 0], np.float32), (n, 1))
            attr = mesh.color_attributes.new('base', 'FLOAT_COLOR', 'CORNER')
        mesh.color_attributes['base'].data.foreach_set('color', colour.ravel()); mesh.color_attributes.active_color = mesh.color_attributes['base']
        for uv in list(mesh.uv_layers): mesh.uv_layers.remove(uv)
        copies.append(copy)
    for o in bpy.context.scene.objects: o.select_set(False)
    for c in copies: c.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]; bpy.ops.object.join(); near = bpy.context.object; near.name = 'near'; near.data.name = 'near'
    far = near.copy(); far.data = near.data.copy(); far.name = 'far'; far.data.name = 'far'; bpy.context.scene.collection.objects.link(far)
    out = {}
    for obj, target in ((near, city['near']), (far, city['far'])):
        tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if tris > target:
            mod = obj.modifiers.new('decimate', 'DECIMATE'); mod.decimate_type = 'COLLAPSE'; mod.ratio = target / tris
            for o in bpy.context.scene.objects: o.select_set(False)
            obj.select_set(True); bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier='decimate')
        out[obj.name] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    for o in bpy.context.scene.objects: o.select_set(o in (near, far))
    bpy.ops.export_scene.gltf(filepath=city['out'], export_format='GLB', use_selection=True, export_vertex_color='ACTIVE',
                              export_active_vertex_color_when_no_material=True, export_texcoords=False, export_normals=True,
                              export_materials='NONE', export_yup=True)
    return out


def preview(glb, out, camera, target, lens=35, size=(960, 600), samples=48):
    """Cycles render of a built GLB with its vertex colours and finish, for review only."""
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = size; scene.view_settings.view_transform = 'AgX'
    bpy.ops.import_scene.gltf(filepath=glb)
    for obj in [o for o in scene.objects if o.type == 'MESH']:
        mat = bpy.data.materials.new(obj.name); mat.use_nodes = True; nodes = mat.node_tree.nodes; bsdf = nodes['Principled BSDF']
        if obj.name.startswith('body'):
            col = nodes.new('ShaderNodeVertexColor'); col.layer_name = obj.data.color_attributes[0].name
            mat.node_tree.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
            uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = obj.data.uv_layers[0].name; sep = nodes.new('ShaderNodeSeparateXYZ')
            mat.node_tree.links.new(uv.outputs['UV'], sep.inputs[0]); mat.node_tree.links.new(sep.outputs['X'], bsdf.inputs['Roughness'])
            # The importer undoes the exporter's V flip, so Y is metalness here.
            mat.node_tree.links.new(sep.outputs['Y'], bsdf.inputs['Metallic'])
        elif obj.name.startswith('glass'):
            bsdf.inputs['Base Color'].default_value = (.5, .58, .56, 1); bsdf.inputs['Roughness'].default_value = .05; bsdf.inputs['Transmission Weight'].default_value = .85
        else:
            bsdf.inputs['Emission Color'].default_value = (1, .85, .6, 1) if obj.name.startswith('lamps') else (.8, .1, .05, 1); bsdf.inputs['Emission Strength'].default_value = 1.5
        obj.data.materials.clear(); obj.data.materials.append(mat)
    bpy.ops.mesh.primitive_plane_add(size=30); ground = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.12, .12, .12, 1); gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9; ground.data.materials.append(gm)
    world = bpy.data.worlds.new('sky'); scene.world = world; world.use_nodes = True
    sky = world.node_tree.nodes.new('ShaderNodeTexSky'); sky.sun_elevation = math.radians(18); sky.sun_rotation = math.radians(60)
    world.node_tree.links.new(sky.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color']); world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); cam.data.lens = lens; scene.camera = cam
    cam.location = camera; direction = np.subtract(target, camera)
    import mathutils
    cam.rotation_euler = mathutils.Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = out; bpy.ops.render.render(write_still=True)
