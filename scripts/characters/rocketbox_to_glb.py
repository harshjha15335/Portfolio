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
# --- atlas UVs: body -> left half, head -> right half; hair cards (if any) -> strip below the head
me=mesh.data; uv=me.uv_layers.active.data
mat_kind=[]
for m in me.materials:
    n=m.name.lower(); mat_kind.append('opacity' if 'opacity' in n else 'head' if 'head' in n else 'body')
hair=bool(cfg.get('hair'))
top=(lambda v:(v+.5)/1.5) if hair else (lambda v:v)
for p in me.polygons:
    kind=mat_kind[p.material_index]
    for li in p.loop_indices:
        u,v=uv[li].uv
        if kind=='body': uv[li].uv=(u*.5,top(v))
        elif kind=='head': uv[li].uv=(.5+u*.5,top(v))
        else: uv[li].uv=(.5+u*.25,v/3)
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
