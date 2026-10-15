"""Original BEST bus for the Mumbai districts, modelled as code: the red double-decker or the single-deck bus.

One loft along the length (rounded plan corners, a skirt cut round the wheel arches, straight flanks and a
crowned roof) carries the colour bands as finish regions: red panels, the cream waist band, tinted window
bands and rubber seals. Window pillars and the kerb-side folding doors are panels standing just proud of the
flanks, so they stay crisp at every level of detail without slicing the loft. Both ends are their own grids
with rows and columns at the features: the front has a split windscreen in a black surround, a lit LED
destination board (route number and destination in amber dot-matrix lettering), the upper-deck screen, a
slatted grille band with twin headlamps, the BEST badge and a black bumper; the rear has the engine grille,
the rear screen and a route number box. Wheels have tyre profile, rim and hub, with twin rears.
Built with vehicle_kit.py: base colour in COLOR_0, (roughness, metalness) in TEXCOORD_0.

A generic Mumbai city bus in BEST livery, not a replica of any manufacturer's design.

Usage: python3.11 scripts/vehicles/build_bus.py <work-dir> <double|single> [--preview]
Output: <work-dir>/bus-<variant>.glb and bus-<variant>.stats.json. The district-traffic GLB at three levels
of detail (VEHICLE_LOD 0 near, 1 far, 2 distant) comes from
build_city.py <work-dir> bus-<variant> scripts/vehicles/build_bus.py <variant>.
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vehicle_kit import LOD, Part, export, preview, srgb, table

work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)
variant = sys.argv[2]
DOUBLE = variant == 'double'
name = f'bus-{variant}'
NEAR, FAR = LOD == 0, LOD <= 1

L, WD, WR = (10.2 if DOUBLE else 11.0), 1.25, .50
FRONT, REAR = L / 2, -L / 2
FRONT_WHEEL, REAR_WHEEL = FRONT - 2.05, REAR + (2.55 if DOUBLE else 2.9)
ARCH_R = WR + .1
TRACK = 1.02
BOT = .36

PALETTE = {
    'paint': (srgb('#b3241b'), .3, 0, 1), 'cream': (srgb('#e6dcc2'), .35, 0, 1),
    'window': (srgb('#0f1a1e'), .05, 0, .35), 'door': (srgb('#2a2f31'), .3, .2, .6), 'trim': (srgb('#141515'), .5, 0, 1),
    'roof': (srgb('#bdbab2'), .6, 0, 1), 'under': (srgb('#151514'), .95, 0, 1), 'skirt': (srgb('#232323'), .65, 0, 1),
    'grille': (srgb('#0d0e0e'), .5, .2, 1), 'board': (srgb('#060606'), .2, 0, .6), 'led': (srgb('#ffb12e'), .25, 0, 0),
    'chrome': (srgb('#c9cccd'), .18, 1, .7), 'rubber': (srgb('#141414'), .85, 0, 1), 'tread': (srgb('#0c0c0c'), .9, 0, 1),
    'rim': (srgb('#9a9d9c'), .32, .8, .8), 'hub': (srgb('#3a3b3b'), .5, .6, 1), 'plate': (srgb('#f1f1ec'), .5, 0, .8),
    'platetext': (srgb('#111111'), .5, 0, .8), 'mirror': (srgb('#9fa6a8'), .05, 1, .3), 'ac': (srgb('#d6d4cd'), .5, 0, 1),
    'amber': (srgb('#f09a2a'), .25, 0, .4), 'badge': (srgb('#efe8d6'), .4, 0, .8),
}

# Height levels, bottom to top, each naming the region of the flank face from it up to the next level. The thin
# 'trim' levels are rubber window seals, modelled near only.
if DOUBLE:
    LEVELS = [(.72, 'paint'), (1.30, 'trim'), (1.34, 'win1'), (2.12, 'trim'), (2.16, 'cream'), (2.44, 'paint'),
              (2.86, 'trim'), (2.90, 'win2'), (3.76, 'trim'), (3.80, 'paint')]
    ROOF, DOOR_TOP, ROOF_EDGE = 4.30, 2.12, 3.98
    DECKS = [(1.34, 2.12), (2.90, 3.76)]
else:
    LEVELS = [(.72, 'paint'), (1.18, 'trim'), (1.22, 'win1'), (2.30, 'trim'), (2.34, 'cream'), (2.52, 'paint')]
    ROOF, DOOR_TOP, ROOF_EDGE = 3.05, 2.30, 2.80
    DECKS = [(1.22, 2.30)]
if not NEAR: LEVELS = [lv for lv in LEVELS if lv[1] != 'trim']

# Plan half width: rounded corners at both ends.
W = table([(FRONT, WD - .16), (FRONT - .05, WD - .07), (FRONT - .16, WD - .015), (FRONT - .4, WD), (REAR + .4, WD),
           (REAR + .16, WD - .015), (REAR + .05, WD - .07), (REAR, WD - .16)])
# Window panes run between these; outside them the window bands are red panel.
PANES = (FRONT - .4, REAR + .35)


def lean(z):
    return .035 * max(0, z - 2.2) / 2          # the upper deck leans in slightly


def arch(s):
    best = 0
    for w in (FRONT_WHEEL, REAR_WHEEL):
        d = s - w
        if abs(d) < ARCH_R: best = max(best, WR + math.sqrt(ARCH_R ** 2 - d * d))
    return best


def section(s):
    """Right half ring from bottom centre to roof centre as (x, z, band). band names the face above the point."""
    w = W(s); bo = max(BOT, arch(s)); lip = bo > BOT
    pts = [(0, BOT, 'under'), (w - .2, BOT, 'well' if lip else 'skirt'), (w - .03, bo + .02 if lip else BOT + .08, 'skirt'),
           (w, bo + .10 if lip else BOT + .2, 'paint')]
    for z, band in LEVELS:
        pts.append((w - lean(z), max(z, pts[-1][1] + .02), band))
    wl = w - lean(ROOF_EDGE)
    pts.append((wl, ROOF_EDGE, 'paint'))
    if FAR: pts += [(wl - .05, ROOF_EDGE + (ROOF - ROOF_EDGE) * .55, 'paint'), (wl - .17, ROOF - .03, 'roof'), (wl - .4, ROOF, 'roof'), (0, ROOF + .02, 'roof')]
    else: pts += [(wl - .12, ROOF - .02, 'roof'), (0, ROOF + .02, 'roof')]
    return pts


NP = len(section(0))
ENDS = ([0, .03, .12, .4], [0, .4], [0, .4])[LOD]
STATIONS = [FRONT - d for d in ENDS] + [REAR + d for d in ENDS] + list(PANES)
STATIONS += [w + d for w in (FRONT_WHEEL, REAR_WHEEL) for d in np.linspace(-ARCH_R, ARCH_R, (7, 4, 3)[LOD])]
STATIONS = sorted(set(round(v, 4) for v in STATIONS), reverse=True)

body, lamps, tail = Part(), Part(), Part()
rings = [[(x, s, z) for x, z, _ in section(s)] for s in STATIONS]
rings = [r + [(-x, y, z) for x, y, z in r[-2:0:-1]] for r in rings]
bands = [[b for _, _, b in section(s)] for s in STATIONS]


def region(i, j):
    s = (STATIONS[i] + STATIONS[i + 1]) / 2
    jj = j if j < NP - 1 else 2 * (NP - 1) - j - 1
    band = bands[i][jj]
    if band == 'well': return 'trim'
    if band in ('win1', 'win2'): return 'window' if PANES[1] < s < PANES[0] else 'paint'
    return band


body.grid(rings, region, closed=True)


def quad(part, x0, x1, y0, y1, z0, z1, region, face):
    """A flat panel facing out along x (at x0, spanning y0..y1) or along y (at y0, spanning x0..x1)."""
    if face == 'x':
        v = [part.add_vert(p) for p in ((x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1))]
        out = x0 > 0
    else:
        v = [part.add_vert(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1))]
        out = y0 < 0
    part.add_face(v if out else v[::-1], region, fixed=True)


# Window pillars between the panes, every ~1.1 m, standing just proud of both flanks.
PILLAR_PITCH, PILLAR = 1.12, .1
if LOD < 2:
    for z0, z1 in DECKS:
        x = WD - lean((z0 + z1) / 2) + .006
        s = PANES[0] - PILLAR_PITCH
        while s > PANES[1] + .3:
            for side in (-1, 1): quad(body, side * x, 0, s - PILLAR / 2, s + PILLAR / 2, z0 - .01, z1 + .01, 'paint', 'x')
            s -= PILLAR_PITCH
# Kerb-side (left, x < 0) folding doors: dark leaves with glazed upper halves and a centre seam.
DOORS = [(FRONT - .45, FRONT - 1.4), (REAR_WHEEL + 2.4, REAR_WHEEL + 1.35)] if not DOUBLE else [(FRONT - .45, FRONT - 1.4), (REAR + 1.6, REAR + .55)]
for a, b in DOORS:
    x = -(WD + .012)
    quad(body, x, 0, b, a, BOT + .2, DOOR_TOP, 'door', 'x')
    if LOD < 2:
        for y0, y1 in ((b + .06, (a + b) / 2 - .04), ((a + b) / 2 + .04, a - .06)):
            quad(body, x - .002, 0, y0, y1, BOT + .2 + (DOOR_TOP - BOT) * .42, DOOR_TOP - .08, 'window', 'x')
        quad(body, x - .003, 0, (a + b) / 2 - .015, (a + b) / 2 + .015, BOT + .2, DOOR_TOP, 'trim', 'x')

# Dot-matrix font for the LED boards and the badge: 5 x 7 pixels, rows top to bottom.
FONT = {
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    ' ': ['00000'] * 7,
}


def lettering(text, y, z_top, pixel, region):
    """Lit pixels of `text`, centred on an end face at y, merged into runs along each pixel row. Reads left to
    right from outside: towards −x on the front (+y) face, towards +x on the rear."""
    across = 1 if y < 0 else -1
    left = -across * (len(text) * 6 - 1) * pixel / 2
    for k, ch in enumerate(text):
        for row, bits in enumerate(FONT[ch]):
            col = 0
            while col < 5:
                if bits[col] != '1': col += 1; continue
                end = col
                while end + 1 < 5 and bits[end + 1] == '1': end += 1
                a = left + across * (k * 6 + col) * pixel; b = left + across * ((k * 6 + end + 1) * pixel - pixel * .15)
                z1 = z_top - row * pixel
                quad(body, min(a, b), max(a, b), y, 0, z1 - pixel * .85, z1, region, 'y')
                col = end + 1


def end_face(sign):
    """Close an end with a grid whose rows and columns fall on its features, so every colour has real edges."""
    y = FRONT if sign > 0 else REAR
    half = [(x, z) for x, _, z in rings[0 if sign > 0 else -1][:NP]]
    if sign > 0:
        feats = [.52, .80, .96, 1.10, 2.04, 2.18, 2.50, 2.92, 3.68] if DOUBLE else [.52, .80, .96, 1.06, 2.24, 2.38, 2.72]
    else:
        feats = [.52, 1.25, 2.92, 3.68] if DOUBLE else [.52, 1.25, 1.45, 2.25]
    if LOD == 2: feats = [f for f in feats if 1.0 < f < 2.6]
    zs = sorted(set(round(z, 4) for z in [z for _, z in half] + feats))

    def half_width(z):
        for (x0, z0), (x1, z1) in zip(half, half[1:]):
            if z0 <= z <= z1 and z1 > z0: return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
        return half[-1][0]
    wmid = half_width(1.6)
    xs = ([.03, .62, wmid - .14], [.03, wmid - .14], [])[LOD]
    fr = sorted(set([-1.0, 1.0, 0.0] + [x / wmid for x in xs] + [-x / wmid for x in xs]), reverse=True)
    P = [[(half_width(z) * f, y, z) for f in fr] for z in zs]

    def reg(j, k):
        zc = (zs[j] + zs[j + 1]) / 2; xc = abs((fr[k] + fr[k + 1]) / 2) * wmid; frame = xc > wmid - .14; post = xc < .03
        if zc > ROOF_EDGE + .05: return 'roof' if zc > ROOF - .1 else 'paint'
        if zc < .72: return 'skirt'
        if sign > 0:
            low, screen, board = ((1.10, 2.04, (2.18, 2.50)) if DOUBLE else (1.06, 2.24, (2.38, 2.72)))
            if zc < low: return 'grille' if NEAR and .80 < zc < .96 and xc < .62 else 'paint'
            if zc < screen: return 'trim' if post or frame else 'window'
            if board[0] < zc < board[1]: return 'paint' if frame else 'board'
            if DOUBLE and 2.92 < zc < 3.68: return 'paint' if post or frame else 'window'
            return 'paint'
        if zc < 1.25: return 'grille' if not frame else 'paint'
        if DOUBLE and 2.92 < zc < 3.68: return 'paint' if post or frame else 'window'
        if not DOUBLE and 1.45 < zc < 2.25: return 'paint' if post or frame else 'window'
        if DOUBLE and 2.16 < zc < 2.44: return 'cream'
        return 'paint'
    body.grid(P, reg, flip=sign < 0)
    return wmid


wfront = end_face(1)
end_face(-1)

# Front: LED destination board, BEST badge, grille slats, headlamps, indicators, bumper, plate, wipers, mirrors.
yf = FRONT + .004
board = (2.18, 2.50) if DOUBLE else (2.38, 2.72)
if NEAR:
    pixel = (board[1] - board[0] - .06) / 7
    lettering('138 CSMT', yf, board[1] - .03, pixel, 'led')
    # BEST badge under the windscreen: cream plate, red lettering.
    bz = 1.03 if DOUBLE else .99
    quad(body, -.2, .2, yf, 0, bz - .045, bz + .045, 'badge', 'y')
    lettering('BEST', yf + .002, bz + .037, .011, 'paint')
    for z in (.83, .87, .91): quad(body, -.6, .6, yf + .001, 0, z, z + .012, 'chrome', 'y')
elif FAR:
    # Route number as a lit block, destination as a lit band.
    quad(body, wfront - .55, wfront - .2, yf, 0, board[0] + .06, board[1] - .06, 'led', 'y')
    quad(body, -wfront + .3, wfront - .7, yf, 0, board[0] + .1, board[1] - .1, 'led', 'y')
else:
    quad(body, -wfront + .3, wfront - .2, yf, 0, board[0] + .08, board[1] - .08, 'led', 'y')
body.box((0, FRONT + .04, .52), (2.34, .12, .3), 'skirt')
if FAR:
    body.box((0, FRONT + .11, .55), (.52, .012, .12), 'plate')
    for k in range(7 if NEAR else 0): body.box((-.19 + k * .063, FRONT + .118, .55), (.035, .004, .065), 'platetext')
for sx in (-1, 1):
    lamps.disc((sx * .92, FRONT + .006, .88), (0, 1, 0), (.11, .11), 'lamp', n=(14, 8, 6)[LOD])
    if LOD == 2: continue
    lamps.disc((sx * .7, FRONT + .006, .88), (0, 1, 0), (.08, .08), 'lamp', n=(12, 8)[LOD])
    quad(body, sx * 1.03 - .045, sx * 1.03 + .045, yf, 0, .84, .92, 'amber', 'y')
    # Mirror stalk sweeping forward from the front corner pillar.
    top = 2.05 if DOUBLE else 2.2
    body.tube([(sx * (WD - .1), FRONT - .15, top), (sx * (WD + .18), FRONT + .12, top - .05), (sx * (WD + .26), FRONT + .2, top - .25)], .02, 'trim', sides=(5, 3)[LOD])
    body.box((sx * (WD + .27), FRONT + .2, top - .5), (.1, .06, .36), 'trim')
    if NEAR:
        body.box((sx * (WD + .27), FRONT + .165, top - .5), (.08, .01, .32), 'mirror')
        body.tube([(sx * .1, FRONT + .02, (1.16 if DOUBLE else 1.12)), (sx * .75, FRONT + .02, (1.5 if DOUBLE else 1.46))], .012, 'trim', sides=3)
# Rear: tail lamp clusters, bumper, plate and the route number box; the route number on the kerb side.
for sx in (-1, 1):
    tail.box((sx * (WD - .2), REAR - .01, .95), (.18, .03, .34), 'tail')
body.box((0, REAR - .04, .52), (2.34, .12, .3), 'skirt')
if FAR:
    body.box((0, REAR - .11, .82), (.52, .012, .12), 'plate')
    for k in range(7 if NEAR else 0): body.box((-.19 + k * .063, REAR - .118, .82), (.035, .004, .065), 'platetext')
    rz = 2.62 if DOUBLE else 2.5
    quad(body, -.36, .36, REAR - .004, 0, rz - .13, rz + .13, 'board', 'y')
    if NEAR: lettering('138', REAR - .006, rz + .1, .028, 'led')
    else: quad(body, -.25, .25, REAR - .006, 0, rz - .08, rz + .08, 'led', 'y')
    quad(body, -(WD + .006), 0, FRONT - 2.0, FRONT - 1.5, 1.0, 1.24, 'board', 'x')
    quad(body, -(WD + .008), 0, FRONT - 1.95, FRONT - 1.55, 1.04, 1.2, 'led', 'x')
if not DOUBLE:
    # Roof-mounted air conditioning pod of the newer single-deck buses.
    body.box((0, FRONT - 3.2, ROOF + .14), (1.9, 2.4, .26), 'ac')
    for k in range(5 if NEAR else 0): body.box((-.6 + k * .3, FRONT - 3.2, ROOF + .275), (.18, 2.0, .01), 'trim')


def wheel(cx, cy, twin=False):
    out = 1 if cx > 0 else -1
    w = .15 if not twin else .27
    prof = [(w, WR * .62), (w - .01, WR), (-w + .01, WR), (-w, WR * .62)] if NEAR else [(w, WR), (-w, WR)]
    rings = []
    for t in np.linspace(0, 2 * math.pi, (16, 10, 6)[LOD], endpoint=False):
        c, s_ = math.cos(t), math.sin(t)
        rings.append([(cx + out * dx, cy + r * c, WR + r * s_) for dx, r in prof])
    rings.append(rings[0])
    tread = len(prof) // 2 - 1
    body.grid(rings, lambda i, j: 'tread' if j == tread else 'rubber')
    face = cx + out * (w + .005)
    if not NEAR:
        # Without the tyre's shoulders, a sidewall disc closes the wheel face.
        body.disc((face - out * .03, cy, WR), (out, 0, 0), (WR, WR), 'rubber', n=(16, 10, 6)[LOD], flip=out < 0)
    if LOD < 2: body.disc((face - out * .02, cy, WR), (out, 0, 0), (WR * .62, WR * .62), 'rim', n=(16, 10)[LOD], flip=out < 0)
    if NEAR: body.disc((face, cy, WR), (out, 0, 0), (WR * .26, WR * .26), 'hub', n=10, flip=out < 0)


for x in (-TRACK, TRACK):
    wheel(x, FRONT_WHEEL)
    wheel(x * .96, REAR_WHEEL, twin=True)

parts = {'body': body, 'lamps': lamps, 'tail': tail}
palette = {**PALETTE, 'lamp': PALETTE['trim'], 'tail': PALETTE['trim']}
if '--preview' not in sys.argv:
    tris = export(parts, palette, os.path.join(work, f'{name}.glb'), occluders=[], city=dict(paint=set(), lamp='#f4e7c2', tail='#9c2b22'))
    json.dump({'triangles': tris, 'length': L, 'height': ROOF, 'wheelRadius': WR, 'track': TRACK,
               'frontWheel': FRONT_WHEEL, 'rearWheel': REAR_WHEEL}, open(os.path.join(work, f'{name}.stats.json'), 'w'))
    print(name, tris, 'total', sum(tris.values()))
else:
    d = L * 1.0
    for view, cam, tgt in (('front', (d * .7, d * 1.05, 2.6), (0, 0, 1.8)), ('side', (-d * 1.3, -.4, 2.2), (0, 0, 1.9)), ('rear', (-d * .7, -d * 1.05, 3.0), (0, 0, 1.8))):
        preview(os.path.join(work, f'{name}.glb'), os.path.join(work, f'{name}-{view}.png'), cam, tgt)
os._exit(0)
