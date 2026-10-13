"""Admit scanned CC0 surface maps from Poly Haven into public/surfaces.

Every source is pinned by SHA-256 in scripts/scanned-surfaces.lock.json; the script refuses anything
that does not match. Each set replaces the maps its surface already had one for one, so the street's
texture count does not change:

- asphalt: "Asphalt 02" (Rob Tuytel)        colour, roughness, normal   512 px, one tile = 3 m
- plaster: "Plaster Grey 04" (Rob Tuytel)   colour, roughness, normal  1024 px, one tile = 1.5 m
- stone:   "Sandstone Blocks 08" (Rob Tuytel) colour only (AO baked in) 1024 px, one tile = 1.8 m
- paving:  "Concrete Pavers" (Amal Kumar)   colour only (AO baked in)  1024 px, one tile = 1.92 m

Stone and paving have only a colour slot in StreetMaterials (they shade relief from it as a bump map),
so their ambient occlusion is multiplied into the colour so joints read as recessed.

Colour is tone-matched per channel, in linear light, to the map it replaces, so the per-material tints in
StreetMaterials keep the same brightness and hue: contrast is set in log space, highlights roll off
softly instead of clipping, and the mean is then brought back to the target.

Usage: python3 scripts/import-scanned-surfaces.py [--cache DIR]
"""
from pathlib import Path
from urllib.request import urlopen
from io import BytesIO
import argparse, hashlib, json
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/surfaces'
PINS = json.loads((ROOT / 'scripts/scanned-surfaces.lock.json').read_text())
CC0 = {'license': 'CC0-1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/'}

# Linear-light means of the maps each set replaces (generated asphalt and plaster files, and the runtime
# canvas study for stone and paving), recorded here so the script gives the same output when re-run.
SETS = {
    'asphalt': {'asset': 'asphalt_02', 'title': 'Asphalt 02', 'author': 'Rob Tuytel', 'size': 512, 'metres': 3.0,
                'target': (.3877, .3880, .3977), 'contrast': .85, 'channels': ('color', 'roughness', 'normal')},
    'plaster': {'asset': 'plaster_grey_04', 'title': 'Plaster Grey 04', 'author': 'Rob Tuytel', 'size': 1024, 'metres': 1.5,
                'target': (.8657, .8506, .8154), 'contrast': 1.15, 'channels': ('color', 'roughness', 'normal')},
    'stone': {'asset': 'sandstone_blocks_08', 'title': 'Sandstone Blocks 08', 'author': 'Rob Tuytel', 'size': 1024, 'metres': 1.8,
              'target': (.6172, .5906, .5333), 'contrast': 1.2, 'channels': ('color',), 'ao': .9},
    'paving': {'asset': 'concrete_pavers', 'title': 'Concrete Pavers', 'author': 'Amal Kumar', 'size': 1024, 'metres': 1.92,
               'target': (.6172, .5906, .5333), 'contrast': .75, 'channels': ('color',), 'ao': .8},
}
SUFFIX = {'color': 'diff', 'roughness': 'rough', 'normal': 'nor_gl', 'ao': 'ao'}


def fetch(asset, kind, cache):
    name = f'{asset}_{SUFFIX[kind]}_1k.jpg'
    local = cache / name if cache else None
    data = local.read_bytes() if local and local.exists() else urlopen(PINS['base'].format(asset=asset, file=name)).read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != PINS['files'][name]:
        raise SystemExit(f'{name}: sha256 {digest} does not match the pinned source')
    return Image.open(BytesIO(data)), name, digest


def to_linear(c):
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def shoulder(x, knee=.82):
    return np.where(x < knee, x, knee + (1 - knee) * (1 - np.exp(-(x - knee) / (1 - knee))))


def tone_match(lin, target, contrast):
    target = np.asarray(target)
    logs = np.log(np.maximum(lin, 1e-4))
    ratio = np.exp((logs - logs.mean(axis=(0, 1))) * contrast)
    gain = target / ratio.mean(axis=(0, 1))
    for _ in range(8):  # the shoulder pulls the mean down; raise the gain until it lands on the target
        out = shoulder(ratio * gain)
        gain *= target / out.mean(axis=(0, 1))
    return shoulder(ratio * gain)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, help='directory already holding the pinned source files')
    cache = parser.parse_args().cache
    records = []
    for surface, spec in SETS.items():
        size = spec['size']
        credit = {'author': f"{spec['author']} (Poly Haven)", 'title': spec['title'], **CC0,
                  'source': f"https://polyhaven.com/a/{spec['asset']}", 'tileMetres': spec['metres']}
        for channel in spec['channels']:
            src, name, digest = fetch(spec['asset'], channel, cache)
            img = src.convert('RGB').resize((size, size), Image.LANCZOS)
            if channel == 'color':
                lin = to_linear(np.asarray(img, dtype=np.float64) / 255)
                note = f"Resized to {size} px; tone-matched per channel in linear light to the map it replaces (contrast {spec['contrast']:.0%}, soft highlight roll-off)."
                if 'ao' in spec:
                    ao_src, ao_name, _ = fetch(spec['asset'], 'ao', cache)
                    ao = np.asarray(ao_src.convert('L').resize((size, size), Image.LANCZOS), dtype=np.float64)[..., None] / 255
                    lin = lin * (1 - spec['ao'] + spec['ao'] * ao)
                    note += f" Ambient occlusion ({ao_name}) multiplied in at {spec['ao']:.0%} before matching."
                img = Image.fromarray((to_srgb(tone_match(lin, spec['target'], spec['contrast'])) * 255 + .5).astype(np.uint8), 'RGB')
            elif channel == 'roughness':
                img = img.convert('L').convert('RGB')
                note = f'Resized to {size} px, values unchanged.'
            else:
                note = f'Scanned normal map (OpenGL convention), resized to {size} px.'
            path = OUT / f'{surface}-{channel}.jpg'
            img.save(path, quality=90, subsampling=0 if channel == 'normal' else 2, optimize=True)
            data = path.read_bytes()
            records.append({
                'file': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'width': size, 'height': size,
                'colorSpace': 'sRGB' if channel == 'color' else 'linear', 'channel': channel, 'surface': surface,
                'origin': 'scanned', **credit, 'sourceFile': name, 'sourceSha256': digest, 'modifications': note,
            })
    for old in OUT.glob('*.png'):
        old.unlink()
    provenance = {
        'author': 'Rob Tuytel and Amal Kumar (Poly Haven); see each file',
        **CC0,
        'source': 'scripts/import-scanned-surfaces.py (pinned in scripts/scanned-surfaces.lock.json)',
        'modifications': 'Photographic CC0 scans from Poly Haven, resized and tone-matched to the maps they replace. See each file.',
        'files': records,
    }
    (OUT / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    (OUT / 'LICENSE.txt').write_text(
        'All surface maps here are CC0 1.0 Universal (public domain dedication), from Poly Haven.\n'
        'asphalt-*.jpg: "Asphalt 02" by Rob Tuytel, https://polyhaven.com/a/asphalt_02\n'
        'plaster-*.jpg: "Plaster Grey 04" by Rob Tuytel, https://polyhaven.com/a/plaster_grey_04\n'
        'stone-color.jpg: "Sandstone Blocks 08" by Rob Tuytel, https://polyhaven.com/a/sandstone_blocks_08\n'
        'paving-color.jpg: "Concrete Pavers" by Amal Kumar, https://polyhaven.com/a/concrete_pavers\n'
        'https://creativecommons.org/publicdomain/zero/1.0/legalcode\n')
    print('\n'.join(f"{r['file']} {r['bytes']} {r['sha256'][:12]}" for r in records))


if __name__ == '__main__':
    main()
