"""Original Mumbai mid-rise façade atlas for the backdrop buildings at the street ends and the skyline.

One 1024 px atlas of 4 x 4 cells. Each cell is one bay of one storey, 3 m wide and 3 m tall:
rows 0-2 hold twelve upper-storey bays (grilled windows, AC units, balconies, tarpaulins, louvres,
laundry), row 3 holds four ground-floor shopfronts. Everything is drawn here from seeded shapes and
noise; no photographs or downloaded artwork. Walls are near-neutral so each building's vertex colour
tints them, the same way the street's plaster maps work.

Usage: python3 scripts/generate-facade-atlas.py   (rewrites public/surfaces/facade-color.png and its record)
"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CELL = 256          # output pixels per cell
SS = 2              # supersampling while drawing
METRES = 3.0        # cell size on the wall
N = 4 * CELL
S = CELL * SS / METRES  # drawing pixels per metre
rng = np.random.default_rng(20261014)
out = Path('public/surfaces')

img = Image.new('RGB', (N * SS, N * SS), (206, 202, 194))
draw = ImageDraw.Draw(img, 'RGBA')


def rect(cx, cy, x0, y0, x1, y1, fill):
    """Rectangle in cell metres (origin bottom-left of cell cx, cy)."""
    ox, oy = cx * CELL * SS, cy * CELL * SS
    draw.rectangle([ox + x0 * S, oy + (METRES - y1) * S, ox + x1 * S - 1, oy + (METRES - y0) * S - 1], fill=fill)


def jitter(color, amount=10):
    return tuple(int(np.clip(c + rng.integers(-amount, amount + 1), 0, 255)) for c in color[:3]) + tuple(color[3:])


def slab(cx, cy):
    # Floor slab edge with a soft shadow under the band and a damp line at its foot.
    rect(cx, cy, 0, 0, 3, .2, (218, 214, 205))
    rect(cx, cy, 0, .2, 3, .26, (0, 0, 0, 40))
    rect(cx, cy, 0, 0, 3, .03, (0, 0, 0, 70))


def chhajja(cx, cy, x0, x1, y=2.42):
    # Concrete sunshade over an opening: lit top edge and a shadow falling on the wall below.
    rect(cx, cy, x0 - .15, y, x1 + .15, y + .12, (224, 220, 212))
    for i in range(6):
        rect(cx, cy, x0 - .1, y - .04 * (i + 1), x1 + .1, y - .04 * i, (0, 0, 0, 70 - i * 11))


def sill(cx, cy, x0, x1, y):
    rect(cx, cy, x0 - .06, y - .05, x1 + .06, y + .01, (222, 218, 210))
    # Rain run-off under the sill.
    for _ in range(int(rng.integers(2, 5))):
        x = rng.uniform(x0, x1)
        length = rng.uniform(.3, 1.1)
        for i in range(10):
            rect(cx, cy, x - .025, y - .05 - length * (i + 1) / 10, x + .025, y - .05 - length * i / 10, (40, 38, 30, int(46 * (1 - i / 10))))


def glass(cx, cy, x0, y0, x1, y1, lit=False):
    base = (176, 132, 78) if lit else (44, 54, 58)
    rect(cx, cy, x0, y0, x1, y1, base)
    # Sky reflection in the upper glass, darker interior below.
    steps = 8
    for i in range(steps):
        t = i / steps
        a = int((70 if not lit else 30) * (1 - t))
        rect(cx, cy, x0, y1 - (y1 - y0) * (t + 1 / steps) * .6, x1, y1 - (y1 - y0) * t * .6, (150, 168, 176, a) if not lit else (240, 205, 150, a))


def frame(cx, cy, x0, y0, x1, y1, color=(98, 88, 74), mullions=1):
    w = .05
    rect(cx, cy, x0, y0, x1, y0 + w, color); rect(cx, cy, x0, y1 - w, x1, y1, color)
    rect(cx, cy, x0, y0, x0 + w, y1, color); rect(cx, cy, x1 - w, y0, x1, y1, color)
    for m in range(1, mullions + 1):
        x = x0 + (x1 - x0) * m / (mullions + 1)
        rect(cx, cy, x - w / 2, y0, x + w / 2, y1, color)
    rect(cx, cy, x0, y0 + (y1 - y0) * .68, x1, y0 + (y1 - y0) * .68 + w, color)


def grille(cx, cy, x0, y0, x1, y1, color=(170, 170, 164)):
    # A projecting box grille: shadow cast to the lower right, then the bars.
    for x in np.arange(x0, x1 + .001, .11):
        rect(cx, cy, x + .02, y0 - .03, x + .045, y1 - .03, (0, 0, 0, 80))
        rect(cx, cy, x, y0, x + .025, y1, color)
    for y in (y0, y0 + (y1 - y0) * .5, y1 - .03):
        rect(cx, cy, x0, y, x1 + .025, y + .035, color)


def ac_unit(cx, cy, x0, y0):
    rect(cx, cy, x0 + .04, y0 - .05, x0 + .89, y0 + .5, (0, 0, 0, 60))
    rect(cx, cy, x0, y0, x0 + .85, y0 + .55, (226, 223, 214))
    ox, oy = cx * CELL * SS, cy * CELL * SS
    r = .19 * S
    ccx, ccy = ox + (x0 + .58) * S, oy + (METRES - y0 - .28) * S
    draw.ellipse([ccx - r, ccy - r, ccx + r, ccy + r], fill=(70, 72, 70))
    for i in range(4):
        rect(cx, cy, x0 + .06, y0 + .1 + i * .1, x0 + .32, y0 + .13 + i * .1, (150, 150, 144))
    # Drip stain under the unit.
    for i in range(8):
        rect(cx, cy, x0 + .3, y0 - .1 * (i + 1), x0 + .36, y0 - .1 * i, (40, 38, 30, 40 - i * 5))


def window_bay(cx, cy, lit=False, ac=None, grille_box=True, tarp=False, louvre=False, plants=False, narrow=False):
    slab(cx, cy)
    spans = [(.45, 1.35), (1.65, 2.55)] if narrow else [(.85, 2.15)]
    for x0, x1 in spans:
        y0, y1 = .9, 2.3
        rect(cx, cy, x0 - .08, y0 - .06, x1 + .08, y1 + .04, (0, 0, 0, 55))  # reveal
        if louvre:
            rect(cx, cy, x0, y0, x1, y1, (118, 90, 62))
            for y in np.arange(y0, y1, .08):
                rect(cx, cy, x0, y, x1, y + .03, (84, 62, 42))
        else:
            glass(cx, cy, x0, y0, x1, y1, lit)
            frame(cx, cy, x0, y0, x1, y1)
            if lit:
                rect(cx, cy, x0 + .05, y0 + .05, x0 + (x1 - x0) * .32, y1 - .05, (168, 64, 52, 200))  # curtain
        if grille_box and not louvre:
            grille(cx, cy, x0 - .05, y0 - .02, x1 + .05, y1 + .02)
        if tarp:
            # Blue monsoon tarpaulin tied over the grille, folds as light/dark bands.
            rect(cx, cy, x0 - .12, y0 + .35, x1 + .12, y1 + .1, (40, 92, 150))
            for i, x in enumerate(np.linspace(x0 - .12, x1 + .12, 7)[:-1]):
                rect(cx, cy, x, y0 + .35, x + .1, y1 + .1, (255, 255, 255, 26) if i % 2 else (0, 0, 0, 34))
            rect(cx, cy, x0 - .12, y0 + .33, x1 + .12, y0 + .37, (20, 30, 40, 120))
        if plants:
            for x in np.arange(x0, x1, .26):
                ox, oy = cx * CELL * SS, cy * CELL * SS
                rect(cx, cy, x, y0 - .02, x + .16, y0 + .16, (150, 82, 52))
                r = rng.uniform(.1, .17) * S
                px, py = ox + (x + .08) * S, oy + (METRES - y0 - .26) * S
                draw.ellipse([px - r, py - r, px + r, py + r], fill=jitter((70, 112, 58), 14))
        sill(cx, cy, x0, x1, y0 - .02)
        chhajja(cx, cy, x0, x1)
    if ac == 'below':
        ac_unit(cx, cy, 1.05, .3)
    elif ac == 'side':
        ac_unit(cx, cy, 2.05, 1.25) if not narrow else None


def balcony_bay(cx, cy, enclosed=False, laundry=False, plants=False):
    slab(cx, cy)
    x0, x1, y0, y1 = .3, 2.7, .26, 2.45
    rect(cx, cy, x0, y0, x1, y1, (58, 55, 52))           # recess in shadow
    rect(cx, cy, 1.0, y0, 1.95, 2.1, (88, 72, 56))       # door at the back
    rect(cx, cy, 2.1, 1.0, 2.55, 1.95, (96, 112, 116))   # back window
    rect(cx, cy, x0, y1 - .25, x1, y1, (0, 0, 0, 90))    # ceiling shadow
    rect(cx, cy, x0 - .1, y1, x1 + .1, y1 + .14, (222, 218, 210))  # slab edge above
    if enclosed:
        glass(cx, cy, x0, 1.05, x1, y1 - .05)
        frame(cx, cy, x0, 1.05, x1, y1 - .05, (170, 170, 166), mullions=3)
        rect(cx, cy, x0, y0, x1, 1.05, (200, 196, 188))   # parapet wall
    else:
        rect(cx, cy, x0, y0, x1, y0 + .12, (200, 196, 188))
        for x in np.arange(x0, x1, .1):
            rect(cx, cy, x, y0, x + .025, 1.12, (44, 46, 48))
        rect(cx, cy, x0, 1.08, x1, 1.14, (44, 46, 48))
    if laundry:
        rect(cx, cy, x0 + .05, 2.12, x1 - .05, 2.135, (30, 30, 30))
        x = x0 + .15
        while x < x1 - .3:
            w = rng.uniform(.18, .42)
            h = rng.uniform(.35, .8)
            color = jitter([(180, 40, 50), (230, 190, 60), (60, 90, 160), (230, 228, 220), (60, 140, 110), (200, 110, 150)][int(rng.integers(6))], 14)
            rect(cx, cy, x + .02, 2.13 - h - .03, x + w + .02, 2.13 - .03, (0, 0, 0, 60))
            rect(cx, cy, x, 2.13 - h, x + w, 2.13, color)
            x += w + rng.uniform(.04, .15)
    if plants:
        for x in np.arange(x0 + .1, x1 - .1, .3):
            ox, oy = cx * CELL * SS, cy * CELL * SS
            r = rng.uniform(.12, .2) * S
            px, py = ox + (x + .08) * S, oy + (METRES - 1.3) * S
            draw.ellipse([px - r, py - r, px + r, py + r], fill=jitter((66, 108, 56), 14))


def blank_bay(cx, cy):
    slab(cx, cy)
    # Drainpipe with its damp stain; a small vent window.
    rect(cx, cy, 2.55, 0, 2.62, 3, (0, 0, 0, 50))
    rect(cx, cy, 2.48, 0, 2.58, 3, (128, 126, 120))
    for i in range(12):
        rect(cx, cy, 2.3, i * .25, 2.85, (i + 1) * .25, (38, 36, 28, int(rng.uniform(10, 40))))
    rect(cx, cy, 1.0, 1.7, 1.55, 2.1, (0, 0, 0, 55))
    glass(cx, cy, 1.04, 1.74, 1.51, 2.06)
    for x in np.arange(1.04, 1.51, .09):
        rect(cx, cy, x, 1.74, x + .025, 2.06, (150, 150, 144))
    sill(cx, cy, 1.04, 1.51, 1.72)


def shop_bay(cx, cy, open_=False, sign_color=(176, 44, 40), shutter=(96, 112, 108), glass_door=False):
    # Ground floor: signboard band, then shutter, shop interior or glazed door.
    rect(cx, cy, 0, 2.45, 3, 3, (210, 206, 198))
    rect(cx, cy, .12, 2.5, 2.88, 2.95, sign_color)
    # Pseudo lettering: blocky light marks, not words.
    x = .35
    while x < 2.5:
        for _ in range(int(rng.integers(2, 6))):
            if x > 2.55:
                break
            w, top = rng.uniform(.05, .13), rng.uniform(2.78, 2.86)
            rect(cx, cy, x, 2.6, x + w, top, (236, 228, 205))
            x += w + .025
        x += rng.uniform(.12, .2)
    rect(cx, cy, 0, 2.38, 3, 2.45, (0, 0, 0, 90))
    x0, x1 = .2, 2.8
    if open_:
        rect(cx, cy, x0, 0, x1, 2.38, (184, 146, 92))   # lit interior
        for y in (.6, 1.1, 1.6, 2.0):
            rect(cx, cy, x0 + .1, y, x1 - .1, y + .05, (110, 80, 48))
            xx = x0 + .15
            while xx < x1 - .2:
                w = rng.uniform(.08, .2)
                rect(cx, cy, xx, y + .05, xx + w, y + rng.uniform(.18, .38), jitter([(160, 60, 50), (60, 100, 150), (220, 190, 90), (90, 140, 90)][int(rng.integers(4))], 18))
                xx += w + .03
        rect(cx, cy, x0, 2.1, x1, 2.38, shutter)       # shutter rolled up
        for y in np.arange(2.1, 2.38, .05):
            rect(cx, cy, x0, y, x1, y + .015, (0, 0, 0, 50))
    elif glass_door:
        rect(cx, cy, x0, 0, x1, 2.38, (70, 66, 60))
        glass(cx, cy, x0 + .1, .05, x1 - .1, 2.3, lit=True)
        frame(cx, cy, x0 + .1, .05, x1 - .1, 2.3, (60, 58, 52), mullions=2)
    else:
        rect(cx, cy, x0, 0, x1, 2.38, shutter)
        for y in np.arange(0, 2.38, .06):
            rect(cx, cy, x0, y, x1, y + .02, (0, 0, 0, 46))
            rect(cx, cy, x0, y + .02, x1, y + .03, (255, 255, 255, 18))
        rect(cx, cy, 1.3, .05, 1.7, .14, (60, 60, 58))  # lock plate
        # Posters and grime on the shutter.
        rect(cx, cy, .45, 1.0, .95, 1.7, jitter((214, 196, 120), 20) + (200,))
        rect(cx, cy, 1.9, 1.2, 2.4, 1.6, jitter((190, 70, 60), 20) + (190,))
    rect(cx, cy, 0, 0, .2, 2.45, (192, 188, 180)); rect(cx, cy, 2.8, 0, 3, 2.45, (192, 188, 180))
    rect(cx, cy, 0, 0, 3, .3, (40, 36, 30, 60))   # splash grime


# Rows 0-2 (top of the image is row 0): upper-storey bays.
window_bay(0, 0)
window_bay(1, 0, ac='below')
balcony_bay(2, 0, plants=True)
window_bay(3, 0, lit=True)
window_bay(0, 1, narrow=True)
window_bay(1, 1, tarp=True)
window_bay(2, 1, lit=True, ac='side')
balcony_bay(3, 1, enclosed=True)
blank_bay(0, 2)
window_bay(1, 2, louvre=True, grille_box=False)
balcony_bay(2, 2, laundry=True)
window_bay(3, 2, plants=True)
# Row 3: ground-floor shopfronts.
shop_bay(0, 3, sign_color=(176, 44, 40))
shop_bay(1, 3, open_=True, sign_color=(40, 82, 140))
shop_bay(2, 3, glass_door=True, sign_color=(222, 170, 40))
shop_bay(3, 3, sign_color=(42, 112, 80), shutter=(120, 104, 84))

img = img.resize((N, N), Image.LANCZOS)
pixels = np.asarray(img).astype(np.float32) / 255

# Weathering over everything: soft blotches, fine grain and a darker band at each storey's foot.
def field(scale):
    f = rng.standard_normal((N // scale + 2, N // scale + 2)).astype(np.float32)
    f = np.asarray(Image.fromarray(f).resize((N + 2 * scale, N + 2 * scale), Image.BICUBIC))[scale:scale + N, scale:scale + N]
    return (f - f.mean()) / (f.std() + 1e-6)

blotch = .035 * field(48) + .02 * field(12)
grain = .015 * rng.standard_normal((N, N)).astype(np.float32)
y = (np.arange(N) % CELL) / CELL          # 0 at the top of a cell
foot = np.clip((y - .82) / .18, 0, 1) ** 2 * .1
shade = np.clip(1 + blotch + grain - foot[:, None], .6, 1.15)
pixels = np.clip(pixels * shade[..., None], 0, 1)
out_img = Image.fromarray((pixels * 255 + .5).astype(np.uint8), 'RGB')
path = out / 'facade-color.png'
out_img.save(path, optimize=True)

provenance_path = out / 'provenance.json'
provenance = json.loads(provenance_path.read_text())
record = next((r for r in provenance['files'] if r['file'] == path.name), None)
if record is None:
    record = {'file': path.name}
    provenance['files'].append(record)
record.update({'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size, 'width': N, 'height': N,
               'colorSpace': 'sRGB', 'channel': 'color', 'surface': 'facade', 'origin': 'generated',
               'author': 'Harsh Jha portfolio (original generator)', 'license': 'CC0-1.0',
               'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/', 'source': 'scripts/generate-facade-atlas.py',
               'modifications': f'Original Mumbai mid-rise façade atlas, 4 x 4 cells of one {METRES:g} m bay each; no photographs or third-party input.'})
provenance['source'] = 'scripts/generate-plaster-maps.py and scripts/generate-facade-atlas.py (generated), scripts/import-scanned-surfaces.py (scanned)'
provenance_path.write_text(json.dumps(provenance, indent=2) + '\n')
print(path, out_img.size, path.stat().st_size)
