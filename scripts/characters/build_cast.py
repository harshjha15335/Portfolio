"""Rebuild the street cast GLBs from the pinned Microsoft Rocketbox commit.

Requires: Python 3.11 with `pip install bpy==4.2.0 pillow numpy`, and Node (npx @gltf-transform/cli@4.1.1).
Usage:   python3.11 scripts/characters/build_cast.py <work-dir> [character-id ...]
Then:    node scripts/import-cast.mjs <work-dir>
Every source file is fetched from the pinned commit and checked against cast.json before conversion.
"""
import hashlib, json, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
cast = json.load(open(os.path.join(HERE, 'cast.json')))
work = os.path.abspath(sys.argv[1]); only = set(sys.argv[2:])
raw = f"https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/{cast['source']['commit']}/"
os.makedirs(work, exist_ok=True)

def fetch(path, sha=None):
    local = os.path.join(work, 'src', path)
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with urllib.request.urlopen(raw + urllib.request.quote(path)) as r, open(local, 'wb') as f: f.write(r.read())
    if sha and hashlib.sha256(open(local, 'rb').read()).hexdigest() != sha:
        raise SystemExit(f'Checksum mismatch for {path}')
    return local

for c in cast['characters']:
    if only and c['id'] not in only: continue
    name = c['avatar'].split('/')[-1]
    fbx = fetch(f"{c['avatar']}/Export/{name}.fbx", c['avatarSha256'])
    kinds = ['body_color', 'head_color'] + (['body_normal', 'head_normal'] if c['normalMap'] else []) + (['opacity_color'] if c['hairCard'] else [])
    textures = os.path.dirname(fetch(f"{c['avatar']}/Textures/{c['textureCode']}_body_color.tga"))
    for kind in kinds: fetch(f"{c['avatar']}/Textures/{c['textureCode']}_{kind}.tga")
    clips = {k: fetch(v['file'], v['sha256']) for k, v in c['clips'].items()}
    atlas = json.loads(subprocess.check_output([sys.executable, '-I', os.path.join(HERE, 'rocketbox_atlas.py'), textures, work, c['id'], c['textureCode'], str(c['atlas']), '1' if c['normalMap'] else '0', str(c['skinToneShift'])]))
    cfg = dict(name=c['id'], avatar=fbx, out=os.path.join(work, f"{c['id']}.raw.glb"), lod_ratio=.3, clips=clips, trim=c['trim'], **atlas)
    cfg_path = os.path.join(work, f"{c['id']}.json"); json.dump(cfg, open(cfg_path, 'w'))
    subprocess.check_call([sys.executable, '-I', os.path.join(HERE, 'rocketbox_to_glb.py'), cfg_path])
    resampled = os.path.join(work, f"{c['id']}.resampled.glb")
    subprocess.check_call(['npx', '--yes', '@gltf-transform/cli@4.1.1', 'resample', cfg['out'], resampled])
    subprocess.check_call([sys.executable, '-I', os.path.join(HERE, 'glb_materials.py'), resampled, os.path.join(work, f"{c['id']}.glb")])
print('Built', work)
