"""Rocketbox FBX -> one skinned GLB: a single atlas material (body, head and any hair cards), retargeted clips and an in-file LOD mesh.
Usage: python3.11 rocketbox_to_glb.py <json-config>  (normally driven by build_cast.py)"""
import bpy, sys, json, math
cfg=json.load(open(sys.argv[-1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=cfg['avatar'],automatic_bone_orientation=False,ignore_leaf_bones=False)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]
for o in list(bpy.data.objects):
    if o not in (arm,mesh): bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
arm.name='Rig'; mesh.name=cfg['name']
# Rocketbox children are rigged as 'Bip02'; name their bones like the adults' so the adult clips and runtime lookups match.
for b in arm.data.bones:
    if b.name.startswith('Bip02'): b.name='Bip01'+b.name[5:]
bone_names={b.name for b in arm.data.bones}
# --- clips: retarget through parent-relative rest matrices (source and avatar rests differ)
from mathutils import Matrix
def rest_local(b):
    return (b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local.copy()
clips=[]
trim=cfg.get('trim',{})
for clip,path in cfg['clips'].items():
    before=set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path,automatic_bone_orientation=False,ignore_leaf_bones=False)
    new=[o for o in bpy.data.objects if o not in before]
    src=[o for o in new if o.type=='ARMATURE'][0]
    sact=src.animation_data.action
    f0,f1=int(sact.frame_range[0]),int(sact.frame_range[1])
    if clip in trim: f1=min(f1,f0+int(trim[clip]*30))
    conv={}
    for b in arm.data.bones:
        sb=src.data.bones.get(b.name)
        if sb: conv[b.name]=(rest_local(b).inverted() @ rest_local(sb))
    act=bpy.data.actions.new(clip); act.use_fake_user=True
    arm.animation_data_create(); arm.animation_data.action=act
    scale=arm.data.bones['Bip01 Pelvis'].matrix_local.translation.length/max(1e-5,src.data.bones['Bip01 Pelvis'].matrix_local.translation.length)
    first=None
    for f in range(f0,f1+1):
        bpy.context.scene.frame_set(f)
        for name,c in conv.items():
            m=c @ src.pose.bones[name].matrix_basis
            pb=arm.pose.bones[name]; pb.rotation_mode='QUATERNION'
            q=m.to_quaternion()
            pb.rotation_quaternion=q; pb.keyframe_insert('rotation_quaternion',frame=f-f0+1,group=name)
            if name=='Bip01 Pelvis':
                t=m.to_translation()*1.0
                if first is None: first=t.copy()
                pb.location=t; pb.keyframe_insert('location',frame=f-f0+1,group=name)
    # quaternion continuity
    for fcs in [ [fc for fc in act.fcurves if fc.data_path.endswith('rotation_quaternion') and fc.data_path.split('"')[1]==n] for n in conv]:
        pass
    if clip.lower().startswith('walk') or cfg.get('inplace_all'):
        for fc in act.fcurves:
            if fc.data_path=='pose.bones["Bip01 Pelvis"].location':
                k=fc.keyframe_points; d=k[-1].co[1]-k[0].co[1]; t0=k[0].co[0]; t1=k[-1].co[0]
                if abs(d)>0.05:
                    for p in k:
                        fr=(p.co[0]-t0)/(t1-t0); p.co[1]-=d*fr; p.handle_left[1]-=d*fr; p.handle_right[1]-=d*fr
                    print('drift removed',clip,fc.array_index,round(d,3))
    for o in new: bpy.data.objects.remove(o,do_unlink=True)
    for a in list(bpy.data.actions):
        if a.users==0 and not a.use_fake_user: bpy.data.actions.remove(a)
    clips.append(clip)
    print('clip',clip,f1-f0+1,'frames')
arm.animation_data.action=None
arm.animation_data_create()
for clip in clips:
    tr=arm.animation_data.nla_tracks.new(); tr.name=clip
    a=bpy.data.actions[clip]; tr.strips.new(clip,int(a.frame_range[0]),a)
arm.animation_data.action=None
# --- optional: drop a garment piece (e.g. a hoodie's hood) by its body-map island; [u0, y0, u1, y1] with y down, above a height fraction
if cfg.get('dropBody'):
    import bmesh
    u0,y0,u1,y1,above=cfg['dropBody']; me=mesh.data; uvl=me.uv_layers.active.data; M=mesh.matrix_world
    zs=[(M@v.co).z for v in me.vertices]; lo,hi=min(zs),max(zs)
    drop=[p.index for p in me.polygons if 'head' not in me.materials[p.material_index].name.lower() and 'opacity' not in me.materials[p.material_index].name.lower()
          and all(u0<=uvl[l].uv.x<=u1 and y0<=1-uvl[l].uv.y<=y1 for l in p.loop_indices) and ((M@p.center).z-lo)/(hi-lo)>above]
    bm=bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); edge={v for i in drop for v in bm.faces[i].verts}; bmesh.ops.delete(bm,geom=[bm.faces[i] for i in drop],context='FACES_KEEP_BOUNDARY')
    loose=[v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm,geom=loose,context='VERTS')
    # Nothing was modelled under the piece: close the opening it leaves, textured from a plain patch of the garment (cfg dropFillUV).
    filled=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary and all(v in edge for v in e.verts)],sides=0)['faces']
    lay=bm.loops.layers.uv.active; fu,fy=cfg.get('dropFillUV',(.5,.2)); body=[i for i,m in enumerate(me.materials) if 'head' not in m.name.lower()][0]
    for f in bmesh.ops.triangulate(bm,faces=filled)['faces']:
        f.material_index=body
        for l in f.loops: l[lay].uv=(fu,1-fy)
    bm.to_mesh(me); bm.free(); print('dropped faces',len(drop),'filled',len(filled))
# --- atlas UVs: body -> left half, head -> right half; hair cards (if any) -> strip below the head
me=mesh.data; uv=me.uv_layers.active.data
mat_kind=[]
for m in me.materials:
    n=m.name.lower(); mat_kind.append('opacity' if 'opacity' in n else 'head' if 'head' in n else 'body')
# Eyes, found by their UVs in the head map's eyeball island (lower left), for glasses placed later.
eye_verts=set(); head_verts=set()
for p in me.polygons:
    if mat_kind[p.material_index]!='head': continue
    for li in p.loop_indices:
        u,v=uv[li].uv; head_verts.add(me.loops[li].vertex_index)
        if .17<u<.36 and .0<v<.2: eye_verts.add(me.loops[li].vertex_index)
hair=bool(cfg.get('hair'))
top=(lambda v:(v+.5)/1.5) if hair else (lambda v:v)
for p in me.polygons:
    kind=mat_kind[p.material_index]
    for li in p.loop_indices:
        u,v=uv[li].uv
        if kind=='body': uv[li].uv=(u*.5,top(v))
        elif kind=='head': uv[li].uv=(.5+u*.5,top(v))
        else: uv[li].uv=(.5+u*.25,v/3)
# Hair cards shade like the scalp beneath them: normals point out from the head's centre rather than across each
# card, which otherwise catches the low sun as bright stripes. Opt-in (cast.json "radialHair") so older builds are unchanged.
if hair and cfg.get('radialHair') and head_verts:
    from mathutils import Vector
    hc=sum((me.vertices[i].co for i in head_verts),Vector())/len(head_verts)
    normals=[Vector(n.vector) for n in me.corner_normals]
    for p in me.polygons:
        if mat_kind[p.material_index]!='opacity': continue
        for li in p.loop_indices: normals[li]=(me.vertices[me.loops[li].vertex_index].co-hc).normalized()
    me.normals_split_custom_set(normals); print('radial hair normals set')
def material(name,color,normal=None,alpha=False):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; bsdf=nt.nodes['Principled BSDF']
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(color); nt.links.new(t.outputs['Color'],bsdf.inputs['Base Color'])
    if alpha: nt.links.new(t.outputs['Alpha'],bsdf.inputs['Alpha'])
    if normal:
        tn=nt.nodes.new('ShaderNodeTexImage'); tn.image=bpy.data.images.load(normal); tn.image.colorspace_settings.name='Non-Color'
        nm=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'],nm.inputs['Color']); nt.links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value=cfg.get('roughness',.78); bsdf.inputs['Metallic'].default_value=0
    return m
skin=material(cfg['name']+('_hair' if hair else '_atlas'),cfg['atlas'],cfg.get('normal'),hair)
idx=[0 for p in me.polygons]
me.materials.clear(); me.materials.append(skin)
for p,i in zip(me.polygons,idx): p.material_index=i
# --- glasses: a dark frame built around the eyes, skinned to the head bone, sampling a solid swatch in the atlas
if cfg.get('glasses'):
    import bmesh
    from mathutils import Vector
    g=cfg['glasses']; P=[me.vertices[i].co.copy() for i in eye_verts]
    ext=[max(v.co[k] for v in me.vertices)-min(v.co[k] for v in me.vertices) for k in range(3)]; up_i=ext.index(max(ext))
    var=[sum((p[k]-sum(q[k] for q in P)/len(P))**2 for p in P) for k in range(3)]; ax=var.index(max(var))
    mid=sorted(p[ax] for p in P)[len(P)//2]
    L=[p for p in P if p[ax]<mid]; R=[p for p in P if p[ax]>=mid]
    eL=sum(L,Vector())/len(L); eR=sum(R,Vector())/len(R); unit=(eR-eL).length/.064
    up=Vector([1 if k==up_i else 0 for k in range(3)]); right=(eR-eL).normalized(); fwd=up.cross(right).normalized()
    hc=sum((me.vertices[i].co for i in head_verts),Vector())/len(head_verts); eyes=(eL+eR)/2
    if (eyes-hc).dot(fwd)<0: fwd=-fwd
    up=right.cross(fwd).normalized() if right.cross(fwd).dot(up)>0 else -right.cross(fwd).normalized()
    bm=bmesh.new(); t=g.get('thick',.0045)*unit; dep=.004*unit
    def tube(points,closed):
        rings=[]
        for i,c in enumerate(points):
            a=points[i-1] if (closed or i>0) else points[i]; b=points[(i+1)%len(points)] if (closed or i<len(points)-1) else points[i]
            tan=(b-a).normalized(); side=tan.cross(fwd).normalized() if abs(tan.dot(fwd))<.9 else tan.cross(up).normalized(); nrm=tan.cross(side).normalized()
            rings.append([bm.verts.new(c+side*sx*t/2+nrm*sy*dep/2) for sx,sy in ((1,1),(-1,1),(-1,-1),(1,-1))])
        for i in range(len(rings)-(0 if closed else 1)):
            r0,r1=rings[i],rings[(i+1)%len(rings)]
            for k in range(4): bm.faces.new((r0[k],r0[(k+1)%4],r1[(k+1)%4],r1[k]))
        if not closed:
            for r in (rings[0],rings[-1]): bm.faces.new(r)
    w,h,rad=g['w']*unit,g['h']*unit,g.get('radius',.008)*unit; front=eyes+fwd*g.get('front',.021)*unit+up*g.get('lift',.002)*unit
    corners=[]
    for side in (-1,1):
        c=front+right*side*.032*unit; pts=[]
        for q in range(4):
            cx,cy=((1,1),(-1,1),(-1,-1),(1,-1))[q]; base=c+right*cx*(w/2-rad)+up*cy*(h/2-rad); a0=[0,90,180,270][q]
            for j in range(5):
                a=math.radians(a0+j*22.5); pts.append(base+right*math.cos(a)*rad+up*math.sin(a)*rad)
        tube(pts,True); corners.append(c)
    # Bridge between the rims, and temples running back over the ears.
    tube([corners[0]+right*w/2+up*h*.22,front+up*h*.3,corners[1]-right*w/2+up*h*.22],False)
    for side,c in ((-1,corners[0]),(1,corners[1])):
        o=c+right*side*w/2+up*h*.25
        tube([o,o+right*side*.012*unit-fwd*.02*unit,o+right*side*.016*unit-fwd*.1*unit-up*.012*unit],False)
    new=list(bm.verts); tmp=bpy.data.meshes.new('glasses'); bm.to_mesh(tmp); bm.free()
    gobj=bpy.data.objects.new('glasses',tmp); bpy.context.scene.collection.objects.link(gobj); gobj.matrix_world=mesh.matrix_world.copy()
    tmp.uv_layers.new(name=me.uv_layers.active.name)
    for loop in tmp.uv_layers[0].data: loop.uv=g['uv']
    vg=gobj.vertex_groups.new(name='Bip01 Head'); vg.add(list(range(len(tmp.vertices))),1.0,'REPLACE')
    gobj.data.materials.append(skin)
    bpy.ops.object.select_all(action='DESELECT'); gobj.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active=mesh
    bpy.ops.object.join(); print('glasses joined, units per metre',round(unit,4))
# --- LOD: decimated duplicate bound to the same rig
if cfg.get('lod_ratio'):
    lod=mesh.copy(); lod.data=mesh.data.copy(); lod.name=cfg['name']+'_LOD1'; bpy.context.scene.collection.objects.link(lod)
    bpy.context.view_layer.objects.active=lod
    d=lod.modifiers.new('dec','DECIMATE'); d.ratio=cfg['lod_ratio']; d.use_collapse_triangulate=True
    # Decimate must run before the armature modifier
    while lod.modifiers[0].name!='dec': bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
    print('lod tris',sum(len(p.vertices)-2 for p in lod.data.polygons))
print('tris',sum(len(p.vertices)-2 for p in me.polygons))
bpy.ops.export_scene.gltf(filepath=cfg['out'],export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',
    export_image_format='AUTO',export_jpeg_quality=cfg.get('jpeg',86),export_skins=True,export_all_influences=False,
    export_morph=False,export_apply=False,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=False,
    export_optimize_animation_size=True,export_anim_single_armature=True,export_def_bones=False,export_frame_step=1,
    export_force_sampling=True,export_extras=False,export_cameras=False,export_lights=False)
print('EXPORTED',cfg['out'])
import os
sys.stdout.flush()
os._exit(0)  # bpy can crash during interpreter teardown after a successful export
