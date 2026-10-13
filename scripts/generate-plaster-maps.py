"""Original painted cement-render study for the street façades: tileable 1024 px maps covering 2 m of wall.

No photographs or downloaded artwork; every feature is generated here from seeded noise:
float-trowel undulation and sand grain, aggregate pits, hairline shrinkage cracks, patched repairs,
flaking paint over grey cement, and dirt held in the cracks. Maps are near-white so the material colour
tints them; the street shader adds building-scale staining on top.

Usage: python3 scripts/generate-plaster-maps.py   (rewrites public/surfaces/plaster-*.png and their records)
"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image

N = 1024            # pixels per tile
METRES = 2.0        # tile size on the wall (see StreetMaterials wallUv)
rng = np.random.default_rng(20261013)
out = Path('public/surfaces')
freq = np.fft.fftfreq(N)
FX, FY = np.meshgrid(freq, freq)


def blur(field, sx, sy=None, angle=0.0):
    """Periodic (wrap-around) anisotropic Gaussian blur through the FFT, so every map tiles."""
    sy = sx if sy is None else sy
    c, s = np.cos(angle), np.sin(angle)
    u, v = c * FX + s * FY, -s * FX + c * FY
    kernel = np.exp(-2 * np.pi ** 2 * ((sx * u) ** 2 + (sy * v) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(field) * kernel))


def noise(sx, sy=None, angle=0.0):
    f = blur(rng.standard_normal((N, N)), sx, sy, angle)
    return (f - f.mean()) / (f.std() + 1e-9)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


mm = N / (METRES * 1000)  # pixels per millimetre
# Height in millimetres.
undulation = 0.9 * noise(90) + 0.5 * noise(35)
trowel = sum(smooth(0.6, 1.6, noise(60, 7, a)) * 0.25 for a in (0.3, 1.1, 2.2, 2.9))
grain = 0.10 * noise(1.1) + 0.07 * noise(2.5)
pits = -0.35 * smooth(3.2, 3.9, noise(1.6))
height = undulation + trowel + grain + pits

# Hairline cracks: wandering random walks that wrap at the tile edge.
crack = np.zeros((N, N))
for _ in range(5):
    x, y = rng.uniform(0, N, 2)
    angle = rng.uniform(0, 2 * np.pi)
    for _ in range(int(rng.uniform(300, 900))):
        angle += rng.normal(0, 0.12)
        x, y = (x + np.cos(angle) * 0.5) % N, (y + np.sin(angle) * 0.5) % N
        crack[int(y), int(x)] = 1
        if rng.random() < 0.004:  # occasional branch
            bx, by, ba = x, y, angle + rng.choice([-1, 1]) * rng.uniform(0.6, 1.2)
            for _ in range(int(rng.uniform(40, 180))):
                ba += rng.normal(0, 0.15)
                bx, by = (bx + np.cos(ba) * 0.5) % N, (by + np.sin(ba) * 0.5) % N
                crack[int(by), int(bx)] = 0.7
crack = np.clip(blur(crack, 0.6) * 2.2, 0, 1)
crack_halo = np.clip(blur(crack, 5) * 3, 0, 1)
height -= 0.5 * crack

# Patched repairs: a few soft-edged blobs sitting a little proud, in slightly different paint.
patch = smooth(1.55, 1.75, noise(70) + 0.4 * noise(12))
height += 0.45 * patch
# Flaking paint: small islands where the coat has gone and grey cement shows.
flake = smooth(2.1, 2.3, noise(14) + 0.35 * noise(3))
height -= 0.25 * flake

# Colour (linear-ish factors, encoded sRGB at the end).
paint = np.stack([np.full((N, N), 0.88), np.full((N, N), 0.865), np.full((N, N), 0.83)], -1)
paint *= (1 + 0.035 * noise(50) + 0.025 * noise(6))[..., None]
paint *= (1 + 0.14 * (grain - pits * 0.3))[..., None]
fresh = np.array([0.93, 0.915, 0.88])
paint = paint * (1 - 0.6 * patch[..., None]) + fresh * (0.6 * patch[..., None])
cement = np.array([0.6, 0.585, 0.55]) * (1 + 0.08 * noise(2))[..., None]
color = paint * (1 - flake[..., None]) + cement * flake[..., None]
dirt = np.clip(0.4 * crack + 0.25 * crack_halo + 0.4 * smooth(0.2, 1, -pits) + 0.12 * smooth(0.5, 2.0, noise(25)), 0, 0.85)
color *= (1 - dirt[..., None] * np.array([0.62, 0.64, 0.68]))
roughness = np.clip(0.86 + 0.05 * noise(8) + 0.08 * flake + 0.06 * dirt - 0.05 * patch, 0, 1)

# Normal map (OpenGL convention) from the height field, wrap-around differences.
gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5 * mm
gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5 * mm
nx, ny, nz = -gx, gy, np.ones_like(gx)
length = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.stack([nx, ny, nz], -1) / length[..., None]


def srgb(v):
    v = np.clip(v, 0, 1)
    return np.where(v <= 0.0031308, 12.92 * v, 1.055 * v ** (1 / 2.4) - 0.055)


images = {
    'color': (srgb(color) * 255 + 0.5).astype(np.uint8),
    'roughness': np.repeat((roughness * 255 + 0.5).astype(np.uint8)[..., None], 3, -1),
    'normal': ((normal * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8),
}
provenance_path = out / 'provenance.json'
provenance = json.loads(provenance_path.read_text())
for channel, pixels in images.items():
    path = out / f'plaster-{channel}.png'
    Image.fromarray(pixels, 'RGB').save(path, optimize=True)
    record = next(r for r in provenance['files'] if r['file'] == path.name)
    record.update({'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size, 'width': N, 'height': N,
                   'origin': 'generated', 'author': 'Harsh Jha portfolio (original generator)', 'license': 'CC0-1.0',
                   'source': 'scripts/generate-plaster-maps.py',
                   'modifications': f'Original painted cement render, tileable, {N} px = {METRES:g} m of wall; no photographs or third-party input.'})
provenance['modifications'] = ('Asphalt maps are a CC0 photographic scan (Poly Haven, Asphalt 02), 512 px; plaster maps are an original '
                               f'generated cement-render study, {N} px tiling every {METRES:g} m. See each file.')
provenance['source'] = 'scripts/generate-plaster-maps.py (generated), scripts/import-scanned-surfaces.py (scanned)'
provenance_path.write_text(json.dumps(provenance, indent=2) + '\n')
print({c: (p.shape, int(p.mean())) for c, p in images.items()})
