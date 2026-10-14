"""Original BEST bus for the Mumbai districts, modelled as code: the red double-decker or the single-deck bus.

One loft along the length (rounded plan corners, a skirt cut round the wheel arches, straight flanks and
a crowned roof) carries every colour band as a finish region: red panels, the cream waist band, tinted
window bands with red pillars, rubber seals and the kerb-side doors. Both ends are closed by faces built
from the end ring, so the windscreen, destination board and rear engine grille sit on real edges.
Wheels are full (tyre profile, rim, hub, studs), with twin rears. Built with vehicle_kit.py, so the GLB
uses the street's shared baked material: base colour in COLOR_0, (roughness, metalness) in TEXCOORD_0,
lamps and tail lamps as separate parts.

A generic Mumbai city bus in BEST livery, not a replica of any manufacturer's design.

Usage: python3.11 scripts/vehicles/build_bus.py <work-dir> <double|single> [--preview]
Output: <work-dir>/bus-<variant>.glb and bus-<variant>.stats.json.
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vehicle_kit import Part, export, preview, srgb, table, smooth

work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)
variant = sys.argv[2]
DOUBLE = variant == 'double'
name = f'bus-{variant}'

L, WD, WR = (10.2 if DOUBLE else 11.0), 1.25, .50
FRONT, REAR = L / 2, -L / 2
FRONT_WHEEL, REAR_WHEEL = FRONT - 2.05, REAR + (2.55 if DOUBLE else 2.9)
ARCH_R = WR + .1
TRACK = 1.02
BOT = .36

PALETTE = {
    'paint': (srgb('#b3241b'), .34, 0, 1), 'deep': (srgb('#7e1912'), .4, 0, 1), 'cream': (srgb('#e6dcc2'), .4, 0, 1),
    'window': (srgb('#11181b'), .06, 0, .35), 'door': (srgb('#151a1c'), .1, 0, .5), 'trim': (srgb('#151616'), .6, 0, 1),
    'roof': (srgb('#bdbab2'), .6, 0, 1), 'under': (srgb('#151514'), .95, 0, 1), 'skirt': (srgb('#2b2b2a'), .7, 0, 1),
    'grille': (srgb('#0d0e0e'), .5, .2, 1), 'board': (srgb('#0b0b0b'), .3, 0, .6), 'amber': (srgb('#f0a32a'), .3, 0, .4),
    'chrome': (srgb('#c9cccd'), .2, 1, .7), 'rubber': (srgb('#141414'), .85, 0, 1), 'tread': (srgb('#0c0c0c'), .9, 0, 1),
    'rim': (srgb('#9a9d9c'), .35, .8, .8), 'hub': (srgb('#3a3b3b'), .5, .6, 1), 'plate': (srgb('#f1f1ec'), .5, 0, .8),
    'platetext': (srgb('#111111'), .5, 0, .8), 'mirror': (srgb('#9fa6a8'), .05, 1, .3), 'ac': (srgb('#d6d4cd'), .5, 0, 1),
}

# Height levels, bottom to top, each naming the region of the flank face from it up to the next level.
if DOUBLE:
    LEVELS = [(.72, 'paint'), (1.30, 'trim'), (1.34, 'win1'), (2.12, 'trim'), (2.16, 'cream'), (2.44, 'paint'),
              (2.86, 'trim'), (2.90, 'win2'), (3.76, 'trim'), (3.80, 'paint'), (3.98, 'paint')]
    ROOF, DOOR_TOP = 4.30, 2.12
else:
    LEVELS = [(.72, 'paint'), (1.18, 'trim'), (1.22, 'win1'), (2.30, 'trim'), (2.34, 'cream'), (2.52, 'paint'), (2.80, 'paint')]
    ROOF, DOOR_TOP = 3.05, 2.30
ROOF_EDGE = LEVELS[-1][0]

# Plan half width: rounded corners at both ends.
W = table([(FRONT, WD - .16), (FRONT - .05, WD - .07), (FRONT - .16, WD - .015), (FRONT - .4, WD), (REAR + .4, WD),
           (REAR + .16, WD - .015), (REAR + .05, WD - .07), (REAR, WD - .16)])


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
        lean = .035 * max(0, z - 2.2) / 2          # the upper deck leans in slightly
        pts.append((w - lean, max(z, pts[-1][1] + .02), band))
    top = ROOF_EDGE; wl = w - .035 * max(0, top - 2.2) / 2
    pts += [(wl - .05, top + (ROOF - top) * .55, 'paint'), (wl - .17, ROOF - .03, 'roof'), (wl - .4, ROOF, 'roof'), (0, ROOF + .02, 'roof')]
    # The band named on a point colours the face from it up to the next point; the first flank face above the arch is paint.
    return pts


NP = len(section(0))
STATIONS = sorted(set([round(v, 4) for v in list(np.linspace(FRONT, REAR, 60)) + [FRONT - .01, FRONT - .03, REAR + .03, REAR + .01]
                       + [w + d for w in (FRONT_WHEEL, REAR_WHEEL) for d in np.linspace(-ARCH_R, ARCH_R, 11)]]), reverse=True)
# Window pillars every ~1.1 m along the flanks, and kerb-side (left, x < 0) door openings.
PILLAR_PITCH = 1.12
DOORS = [(FRONT - .35, FRONT - 1.35), (REAR_WHEEL + 2.4, REAR_WHEEL + 1.35)] if not DOUBLE else [(FRONT - .3, FRONT - 1.3), (REAR + 1.6, REAR + .55)]


def pillar(s, deck):
    """True where a window band shows a red pillar instead of glass."""
    start = FRONT - (.25 if deck == 1 else .45)
    if s > start or s < REAR + .35: return True
    k = (start - s) / PILLAR_PITCH
    return (k - math.floor(k)) * PILLAR_PITCH < .1


body, lamps, tail = Part(), Part(), Part()
rings = [[(x, s, z) for x, z, _ in section(s)] for s in STATIONS]
rings = [r + [(-x, y, z) for x, y, z in r[-2:0:-1]] for r in rings]
bands = [[b for _, _, b in section(s)] for s in STATIONS]


def region(i, j):
    s = (STATIONS[i] + STATIONS[i + 1]) / 2
    left = j >= NP - 1
    jj = j if not left else 2 * (NP - 1) - j - 1
    band = bands[i][jj]
    if band == 'well': return 'trim'
    if left and band in ('paint', 'win1', 'trim', 'skirt') and jj >= 3:
        for a, b in DOORS:
            if b < s < a and section(s)[jj][1] < DOOR_TOP - .01: return 'door'
    if band in ('win1', 'win2'):
        return 'paint' if pillar(s, 1 if band == 'win1' else 2) else 'window'
    return band


ids = body.grid(rings, region, closed=True)


def end_face(ring_ids, ring, sign):
    """Close an end with a grid spanning the end ring, so its windscreen, board and grille follow real edges."""
    half = ring[:NP]
    cols = 10
    P = []
    for x, y, z in half:
        P.append([(x * t, y, z) for t in np.linspace(1, -1, cols + 1)])

    def reg(j, k):
        z0, z1 = half[j][2], half[j + 1][2]; zc = (z0 + z1) / 2; xc = abs(1 - (2 * k + 1) / cols) * half[j][0]
        edge = half[j][0] - xc < .14
        if zc < .72: return 'skirt' if sign > 0 else 'under' if zc < .4 else 'skirt'
        if sign > 0:
            if DOUBLE:
                if 1.0 < zc < 2.12: return 'trim' if xc < .03 or edge else 'window'
                if 2.16 < zc < 2.44: return 'cream' if edge else 'board'
                if 2.9 < zc < 3.76: return 'trim' if xc < .03 or edge else 'window'
            else:
                if .95 < zc < 2.3: return 'trim' if xc < .03 or edge else 'window'
                if 2.34 < zc < 2.75: return 'paint' if edge else 'board'
        else:
            if zc < 1.25: return 'grille' if xc < .85 else 'paint'
            if DOUBLE and 2.9 < zc < 3.76: return 'paint' if edge else 'window'
            if not DOUBLE and 1.4 < zc < 2.3: return 'paint' if edge else 'window'
        if zc > ROOF_EDGE + .05: return 'roof' if zc > ROOF - .1 else 'paint'
        if 2.16 < zc < 2.44 and DOUBLE: return 'cream'
        return 'paint'
    body.grid(P, reg, flip=sign < 0)


end_face(ids[0], rings[0], 1)
end_face(ids[-1], rings[-1], -1)

# Front details: destination board lettering, bumper, headlamps, indicators, plate, wipers and mirrors on stalks.
board_z = 2.30 if DOUBLE else 2.55
body.box((-.78, FRONT + .012, board_z), (.36, .01, .16), 'amber')
for k in range(9): body.box((-.42 + k * .17, FRONT + .012, board_z + (.01 if k % 2 else -.01)), (.12, .01, .1), 'amber')
body.box((0, FRONT + .04, .52), (2.3, .12, .3), 'skirt')
body.box((0, FRONT + .11, .55), (.52, .012, .12), 'plate')
for k in range(7): body.box((-.19 + k * .063, FRONT + .118, .55), (.035, .004, .065), 'platetext')
for sx in (-1, 1):
    lamps.disc((sx * .92, FRONT + .015, .88), (0, 1, 0), (.11, .11), 'lamp', n=14)
    lamps.disc((sx * .66, FRONT + .015, .88), (0, 1, 0), (.08, .08), 'lamp', n=12)
    body.box((sx * 1.08, FRONT + .01, .88), (.1, .02, .08), 'amber')
    # Mirror stalk sweeping forward from the front corner pillar.
    top = 2.05 if DOUBLE else 2.2
    body.tube([(sx * (WD - .1), FRONT - .15, top), (sx * (WD + .18), FRONT + .12, top - .05), (sx * (WD + .26), FRONT + .2, top - .25)], .02, 'trim', sides=5)
    body.box((sx * (WD + .27), FRONT + .2, top - .5), (.1, .06, .36), 'trim')
    body.box((sx * (WD + .27), FRONT + .165, top - .5), (.08, .01, .32), 'mirror')
    body.tube([(sx * .1, FRONT + .03, 1.1), (sx * .75, FRONT + .03, 1.45)], .012, 'trim', sides=3)
# Rear: tail lamp clusters, bumper and plate.
for sx in (-1, 1):
    tail.box((sx * (WD - .2), REAR - .01, .95), (.18, .03, .34), 'tail')
body.box((0, REAR - .04, .52), (2.3, .12, .3), 'skirt')
body.box((0, REAR - .11, .82), (.52, .012, .12), 'plate')
for k in range(7): body.box((-.19 + k * .063, REAR - .118, .82), (.035, .004, .065), 'platetext')
# Route number on the kerb side, just behind the door.
for k in range(3): body.box((-(WD + .004), FRONT - 1.6 - k * .14, 1.1), (.01, .1, .16), 'board')
if not DOUBLE:
    # Roof-mounted air conditioning pod of the newer single-deck buses.
    body.box((0, FRONT - 3.2, ROOF + .14), (1.9, 2.4, .26), 'ac')
    for k in range(5): body.box((-.6 + k * .3, FRONT - 3.2, ROOF + .275), (.18, 2.0, .01), 'trim')


def wheel(cx, cy, twin=False):
    out = 1 if cx > 0 else -1
    rings = []
    for t in np.linspace(0, 2 * math.pi, 24, endpoint=False):
        c, s_ = math.cos(t), math.sin(t)
        w = .15 if not twin else .27
        prof = [(w, WR * .62), (w + .01, WR * .88), (w - .01, WR), (-w + .01, WR), (-w - .01, WR * .88), (-w, WR * .62)]
        rings.append([(cx + out * dx, cy + r * c, WR + r * s_) for dx, r in prof])
    rings.append(rings[0])
    body.grid(rings, lambda i, j: 'tread' if j == 2 else 'rubber')
    face = cx + out * (.155 if not twin else .275)
    body.disc((face - out * .02, cy, WR), (out, 0, 0), (WR * .62, WR * .62), 'rim', n=20, flip=out < 0)
    body.disc((face, cy, WR), (out, 0, 0), (WR * .26, WR * .26), 'hub', n=12, flip=out < 0)
    for k in range(8):
        a = k * math.pi / 4
        body.box((face + out * .01, cy + WR * .19 * math.cos(a), WR + WR * .19 * math.sin(a)), (.03, .03, .03), 'chrome')


for x in (-TRACK, TRACK):
    wheel(x, FRONT_WHEEL)
    wheel(x * .96, REAR_WHEEL, twin=True)

parts = {'body': body, 'lamps': lamps, 'tail': tail}
palette = {**PALETTE, 'lamp': PALETTE['trim'], 'tail': PALETTE['trim']}
if '--preview' not in sys.argv:
    tris = export(parts, palette, os.path.join(work, f'{name}.glb'), occluders=[])
    json.dump({'triangles': tris, 'length': L, 'height': ROOF, 'wheelRadius': WR, 'track': TRACK,
               'frontWheel': FRONT_WHEEL, 'rearWheel': REAR_WHEEL}, open(os.path.join(work, f'{name}.stats.json'), 'w'))
    print(name, tris, 'total', sum(tris.values()))
else:
    d = L * 1.0
    for view, cam, tgt in (('front', (d * .7, d * 1.05, 2.6), (0, 0, 1.8)), ('side', (-d * 1.3, -.4, 2.2), (0, 0, 1.9)), ('rear', (-d * .7, -d * 1.05, 3.0), (0, 0, 1.8))):
        preview(os.path.join(work, f'{name}.glb'), os.path.join(work, f'{name}-{view}.png'), cam, tgt)
os._exit(0)
