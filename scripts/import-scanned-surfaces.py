"""Admit scanned CC0 surface maps into public/surfaces, replacing generated maps one for one.

Sources are pinned by URL and SHA-256; the script refuses anything that does not match.
Only the asphalt set is scanned today: Poly Haven "Asphalt 02" (Rob Tuytel, CC0), as
mirrored in the Khronos glTF-Sample-Assets TrafficCone model. Plaster keeps the original
generated maps from scripts/generate-surface-maps.py until a scanned plaster set is reachable.

Processing (recorded per file in provenance.json):
- colour: resized to 512 px; mean brought to the generated map's mean in linear light so the
  per-material tint in StreetMaterials keeps the same road tone; contrast kept at 85%.
- roughness: resized to 512 px, unchanged values.
- normal: derived from the scan's luminance (high-passed height, OpenGL convention). The
  source set ships no normal map, so this is a derived map, not a scanned one.

Usage: python3 scripts/import-scanned-surfaces.py  (downloads, verifies, writes, updates provenance)
"""
from pathlib import Path
from urllib.request import urlopen
from io import BytesIO
import hashlib, json, math
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/surfaces'
SIZE = 512
BASE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/{commit}/Models/TrafficCone/glTF/{file}'
SOURCE = {
    'color': ('asphalt_02_diff_1k.jpg',),
    'roughness': ('asphalt_02_rough_1k.jpg',),
}
PINS = json.loads((ROOT / 'scripts/scanned-surfaces.lock.json').read_text())
CREDIT = {
    'author': 'Rob Tuytel (Poly Haven)',
    'title': 'Asphalt 02',
    'license': 'CC0-1.0',
    'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'source': 'https://polyhaven.com/a/asphalt_02',
    'mirror': f"https://github.com/KhronosGroup/glTF-Sample-Assets/tree/{PINS['commit']}/Models/TrafficCone",
    'licenseEvidence': f"https://github.com/KhronosGroup/glTF-Sample-Assets/blob/{PINS['commit']}/Models/TrafficCone/metadata.json",
}


def fetch(name):
    data = urlopen(BASE.format(commit=PINS['commit'], file=name)).read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != PINS['files'][name]:
        raise SystemExit(f'{name}: sha256 {digest} does not match the pinned source')
    return Image.open(BytesIO(data)), digest


def to_linear(c):
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def main():
    generated = np.asarray(Image.open(OUT / 'asphalt-color.png').convert('RGB'), dtype=np.float64) / 255
    target = to_linear(generated).mean(axis=(0, 1))
    colour_src, colour_sha = fetch(SOURCE['color'][0])
    rough_src, rough_sha = fetch(SOURCE['roughness'][0])

    colour = np.asarray(colour_src.convert('RGB').resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float64) / 255
    lin = to_linear(colour)
    mean = lin.mean(axis=(0, 1))
    lin = mean + (lin - mean) * .85
    lin = lin * (target / mean)
    colour_img = Image.fromarray((to_srgb(lin) * 255 + .5).astype(np.uint8), 'RGB')

    rough_img = rough_src.convert('L').resize((SIZE, SIZE), Image.LANCZOS).convert('RGB')

    # Height from luminance: remove large-scale shading, keep aggregate and crack relief.
    lum = np.asarray(colour_src.convert('L').resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float64) / 255
    low = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(12)), dtype=np.float64) / 255
    height = lum - low
    strength = 3.2
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    length = np.sqrt(1 + dx * dx + dy * dy)
    normal = np.stack([-dx / length, dy / length, 1 / length], axis=-1)
    normal_img = Image.fromarray(((normal * .5 + .5) * 255 + .5).astype(np.uint8), 'RGB')

    provenance = json.loads((OUT / 'provenance.json').read_text())
    keep = [r for r in provenance['files'] if r['surface'] != 'asphalt']
    records = []
    for channel, img, note, sha in [
        ('color', colour_img, 'Resized to 512 px; mean matched to the generated asphalt map in linear light; contrast 85%.', colour_sha),
        ('roughness', rough_img, 'Resized to 512 px.', rough_sha),
        ('normal', normal_img, 'Derived from the scan luminance (high-pass height, OpenGL convention); the source has no normal map.', colour_sha),
    ]:
        path = OUT / f'asphalt-{channel}.png'
        img.save(path, optimize=True)
        data = path.read_bytes()
        records.append({
            'file': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'width': SIZE, 'height': SIZE,
            'colorSpace': 'sRGB' if channel == 'color' else 'linear', 'channel': channel, 'surface': 'asphalt',
            'origin': 'scanned', **CREDIT, 'sourceFile': SOURCE['roughness' if channel == 'roughness' else 'color'][0],
            'sourceSha256': sha, 'modifications': note,
        })
    for r in keep:
        r.setdefault('origin', 'generated')
    provenance['files'] = records + keep
    provenance['author'] = 'Mixed: see each file'
    provenance['license'] = 'CC0-1.0'
    provenance['source'] = 'scripts/generate-surface-maps.py (generated), scripts/import-scanned-surfaces.py (scanned)'
    provenance['modifications'] = 'Asphalt maps are a CC0 photographic scan (Poly Haven, Asphalt 02), 512 px; plaster maps are original generated studies, 256 px. See each file.'
    (OUT / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    (OUT / 'LICENSE.txt').write_text(
        'All surface maps here are CC0 1.0 Universal (public domain dedication).\n'
        'asphalt-*.png: derived from "Asphalt 02" by Rob Tuytel, Poly Haven (https://polyhaven.com/a/asphalt_02), CC0.\n'
        'plaster-*.png: original maps generated by scripts/generate-surface-maps.py; no third-party input.\n'
        'https://creativecommons.org/publicdomain/zero/1.0/legalcode\n')
    print('\n'.join(f"{r['file']} {r['bytes']} {r['sha256'][:12]}" for r in records))


if __name__ == '__main__':
    main()
