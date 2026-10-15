"""Pack a Rocketbox avatar's body and head maps side by side (2W×W). Avatars with alpha hair cards get a
third W/2-high strip holding the cards (2W×1.5W, RGBA PNG), so body, head and hair share one material.
Usage: rocketbox_atlas.py <textures-dir> <out-dir> <id> <code> <W> <normal 0|1> <skin-tone-shift 0..1>"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from skintone import warm
tex, work, cid, code, W, hero, tone = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]), sys.argv[6] == '1', float(sys.argv[7])
os.makedirs(work, exist_ok=True)
load = lambda kind, suffix: Image.open(f'{tex}/{code}_{kind}_{suffix}.tga')
hair = os.path.exists(f'{tex}/{code}_opacity_color.tga')
atlas = Image.new('RGBA' if hair else 'RGB', (2 * W, W + W // 2 if hair else W), (0, 0, 0, 255) if hair else (0, 0, 0))
for i, kind in enumerate(['body', 'head']):
    im = load(kind, 'color').convert('RGB')
    if tone > 0: im, _ = warm(im, tone)
    atlas.paste(im.resize((W, W), Image.LANCZOS), (i * W, 0))
if hair:
    cards = load('opacity', 'color').convert('RGBA').resize((W // 2, W // 2), Image.LANCZOS)
    atlas.paste(cards, (W, W))
    out = {'atlas': f'{work}/{cid}_atlas.png', 'hair': True}; atlas.save(out['atlas'], optimize=True)
else:
    out = {'atlas': f'{work}/{cid}_atlas.jpg'}; atlas.save(out['atlas'], quality=88)
if hero:
    n = Image.new('RGB', (2 * W, W))
    for i, kind in enumerate(['body', 'head']): n.paste(load(kind, 'normal').convert('RGB').resize((W, W), Image.LANCZOS), (i * W, 0))
    out['normal'] = f'{work}/{cid}_normal.jpg'; n.save(out['normal'], quality=90)
print(json.dumps(out))
