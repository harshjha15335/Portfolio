"""Original commuter motorbike for Mumbai streets, modelled as code (a generic 100-125 cc commuter, not a replica).

Wheels with tyre profile, rim, hub and spokes; front fork and handlebar with grips, levers and mirrors;
a teardrop tank with knee recesses; seat, side panels and tail with grab rail; a finned engine, chain
guard and silencer; mudguards, headlamp cowl, indicators and number plates. Built with vehicle_kit.py,
so the GLB uses the street's shared baked material, with lamps and tail lamp as separate parts.

Usage: python3.11 scripts/vehicles/build_bike.py <work-dir> [colour-hex] [--preview]
Output: <work-dir>/motorbike.glb and motorbike.stats.json.
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vehicle_kit import LOD, Part, export, preview, srgb

work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)
paint = next((a for a in sys.argv[2:] if a.startswith('#')), '#1d2d5a')

PALETTE = {
    'paint': (srgb(paint), .25, 0, 1), 'black': (srgb('#151515'), .55, 0, 1), 'seat': (srgb('#1b1a19'), .75, 0, 1),
    'chrome': (srgb('#d5d7d8'), .14, 1, .7), 'alloy': (srgb('#9b9e9f'), .35, .8, .8), 'engine': (srgb('#5c5e5f'), .45, .5, 1),
    'rubber': (srgb('#141414'), .85, 0, 1), 'tread': (srgb('#0c0c0c'), .9, 0, 1), 'decal': (srgb('#d8d8d2'), .4, 0, 1),
    'plate': (srgb('#f1f1ec'), .5, 0, .8), 'platetext': (srgb('#111111'), .5, 0, .8), 'amber': (srgb('#d8892a'), .2, 0, .6),
    'mirror': (srgb('#9fa6a8'), .05, 1, .3), 'exhaust': (srgb('#6a6b6b'), .3, .9, .9),
}
WR, WB = .30, 1.24          # wheel radius and wheelbase (y forward)
FW, RW = WB / 2, -WB / 2
body, lamps, tail = Part(), Part(), Part()
# Resolution by level of detail (VEHICLE_LOD 0 near, 1 far, 2 distant): segment counts scale down and fine
# parts (fins, spokes, grips, levers, plate text) drop out. NEAR and FAR read as "keep this at these levels".
NEAR, FAR = LOD == 0, LOD <= 1


def n(k):
    return max(3, round(k * (1, .5, .3)[LOD]))


def wheel(cy):
    rings = []
    prof = [(.045, WR * .78), (.035, WR), (-.035, WR), (-.045, WR * .78)] if FAR else [(.04, WR), (-.04, WR)]
    for t in np.linspace(0, 2 * math.pi, (16, 10, 8)[LOD], endpoint=False):
        c, s = math.cos(t), math.sin(t)
        rings.append([(dx, cy + r * c, WR + r * s) for dx, r in prof])
    rings.append(rings[0])
    tread = len(prof) // 2 - 1
    body.grid(rings, lambda i, j: 'tread' if j == tread else 'rubber')
    if not NEAR:
        # Further out the wheel is a tyre and a rim disc on each face.
        for x in (-1, 1):
            body.disc((x * .036, cy, WR), (x, 0, 0), (WR, WR), 'rubber', n=(18, 10, 8)[LOD], flip=x < 0)
            if LOD == 1: body.disc((x * .04, cy, WR), (x, 0, 0), (WR * .45, WR * .45), 'alloy', n=8, flip=x < 0)
        return
    body.torus((0, cy, WR), (1, 0, 0), WR * .76, .012, 'alloy', nu=16, nv=3)
    body.tube([(-.05, cy, WR), (.05, cy, WR)], .045, 'alloy', sides=8)
    for k in range(5):
        a = k * 2 * math.pi / 5
        body.tube([(0, cy + .04 * math.cos(a), WR + .04 * math.sin(a)), (0, cy + WR * .74 * math.cos(a + .3), WR + WR * .74 * math.sin(a + .3))], (.008, .02), 'alloy', sides=4, caps=False)


wheel(FW); wheel(RW)
# Front fork, triple clamp, headlamp cowl and handlebar.
rake = math.radians(26)
head = np.array([0, FW - .28, .98])
for x in ((-.075, .075) if LOD < 2 else (0,)):
    body.tube([(x, FW, WR), (x, head[1] + .02, head[2] - .08)], .02 if LOD < 2 else .04, 'chrome', sides=n(6))
    if NEAR: body.tube([(x, FW + .02, WR + .1), (x, FW - .05, WR + .36)], .03, 'black', sides=6)   # fork gaiter
body.box((0, head[1] + .03, head[2] - .04), (.2, .07, .04), 'black')
body.ellipsoid((0, head[1] + .14, head[2] - .06), (.13, .1, .12), 'paint', nu=n(12), nv=(5, 3, 2)[LOD])
lamps.disc((0, head[1] + .235, head[2] - .06), (0, 1, 0), (.08, .08), 'lamp', n=n(14))
for x in ((-1, 1) if FAR else ()):
    body.box((x * .14, head[1] + .18, head[2] - .12), (.05, .04, .03), 'amber')
bar = [(-.36, head[1] - .06, head[2] + .1), (-.2, head[1] - .02, head[2] + .08), (0, head[1], head[2] + .05), (.2, head[1] - .02, head[2] + .08), (.36, head[1] - .06, head[2] + .1)]
body.tube(bar if NEAR else bar[::2], .012 if FAR else .02, 'chrome', sides=n(6))
for x in ((-1, 1) if NEAR else ()):
    body.tube([(x * .28, head[1] - .055, head[2] + .095), (x * .38, head[1] - .065, head[2] + .1)], .02, 'rubber', sides=6)
    body.tube([(x * .2, head[1] - .0, head[2] + .1), (x * .33, head[1] + .06, head[2] + .1)], .006, 'black', sides=3)
    body.tube([(x * .2, head[1] - .02, head[2] + .1), (x * .3, head[1] - .04, head[2] + .26)], .006, 'black', sides=3)
    body.ellipsoid((x * .31, head[1] - .045, head[2] + .29), (.05, .012, .035), 'black', nu=8, nv=3)
if FAR: body.box((0, head[1] - .02, head[2] + .1), (.12, .05, .06), 'black')   # speedometer
# Front mudguard.
body.grid([[(x, FW + WR * 1.08 * math.cos(t), WR + WR * 1.08 * math.sin(t)) for x in (-.06, .06)] for t in np.linspace(.35, 1.95, n(8))], lambda i, j: 'paint')
# Frame spine, tank, seat, side panels, tail.
body.tube([head + (0, -.02, -.06), (0, .02, .8), (0, -.2, .66), (0, -.55, .66)], .03, 'black', sides=n(6))
if FAR: body.tube([head + (0, -.02, -.12), (0, .08, .36), (0, -.2, .3)], .028, 'black', sides=n(6))
tank = []
for t in np.linspace(0, 1, (9, 6, 4)[LOD]):
    y = .18 - t * .52; h = .13 * math.sin(math.pi * (.15 + .85 * t)) ** .6 + .02; w = .14 * math.sin(math.pi * (.1 + .9 * t)) ** .5 + .03
    zc = .86 - t * .06
    ring = [(w * math.cos(a) * (.8 if abs(math.cos(a)) > .5 and math.sin(a) < 0 else 1), y, zc + h * math.sin(a)) for a in np.linspace(-math.pi / 2, 3 * math.pi / 2, (13, 9, 7)[LOD])]
    tank.append(ring)
body.grid(tank, lambda i, j: 'decal' if NEAR and j in (2, 9) and 3 < i < 5 else 'paint')
if NEAR:
    body.ellipsoid((0, .18, .84), (.03, .02, .06), 'paint', nu=8, nv=3)
    body.box((0, -.03, .955), (.08, .07, .02), 'chrome')                     # filler cap
seat = []
for t in np.linspace(0, 1, (8, 4, 3)[LOD]):
    y = -.32 - t * .5; w = .13 - .04 * t; z = .82 + .03 * t
    seat.append([(w * math.cos(a), y, z + .055 * math.sin(a)) for a in np.linspace(-.25, math.pi + .25, (9, 5, 4)[LOD])])
body.grid(seat, lambda i, j: 'seat')
for x in (-1, 1):
    body.box((x * .11, -.38, .66), (.03, .3, .16), 'paint')               # side panel
    if NEAR: body.box((x * .127, -.38, .69), (.004, .14, .012), 'decal')
body.grid([[(x * (.11 - .03 * t), -.75 - t * .3, .76 + .05 * t) for x in (-1, 1)] for t in np.linspace(0, 1, (4, 3, 2)[LOD])], lambda i, j: 'paint')
if FAR: body.tube([(-.12, -.6, .86), (-.13, -.95, .86), (.13, -.95, .86), (.12, -.6, .86)], .012, 'black', sides=n(5))  # grab rail
tail.box((0, -1.06, .8), (.14, .04, .06), 'tail')
for x in ((-1, 1) if FAR else ()): body.box((x * .15, -1.0, .76), (.05, .04, .03), 'amber')
body.box((0, -1.1, .62), (.2, .012, .12), 'plate')
for k in range(5 if NEAR else 0): body.box((-.07 + k * .035, -1.108, .62), (.02, .004, .06), 'platetext')
# Rear mudguard and swingarm, chain guard.
body.grid([[(x, RW + WR * 1.1 * math.cos(t), WR + WR * 1.1 * math.sin(t)) for x in (-.07, .07)] for t in np.linspace(.9, 2.4, n(7))], lambda i, j: 'black')
for x in ((-.08, .08) if FAR else (0,)): body.tube([(x, -.12, .36), (x, RW, WR)], .018 if FAR else .03, 'black', sides=n(5))
for x in ((-.1, .1) if FAR else ()): body.tube([(x, RW + .05, WR + .02), (x, -.68, .7)], .022, 'chrome', sides=n(6))   # shock absorbers
if FAR: body.box((.1, -.37, .36), (.03, .6, .1), 'black')
# Engine: crankcase, finned cylinder, silencer.
if LOD == 2: body.box((0, -.04, .37), (.22, .4, .26), 'engine')
else: body.ellipsoid((0, -.06, .35), (.12, .21, .13), 'engine', nu=n(12), nv=(5, 3)[LOD])
if NEAR: body.ellipsoid((.11, .0, .34), (.03, .1, .09), 'alloy', nu=8, nv=3)          # clutch cover
axis = np.array([0, .45, .89]); base = np.array([0, .07, .42])
body.tube([base, base + axis * .22], .055 if NEAR else .075, 'engine', sides=n(8))
for k in range(5 if NEAR else 0):
    c = base + axis * (.03 + k * .038)
    body.tube([c, c + axis * .012], .085, 'engine', sides=6)
exhaust = [(0, .17, .5), (0, .2, .38), (-.13, .05, .25), (-.15, -.55, .3), (-.16, -.8, .34)]
body.tube(exhaust if NEAR else exhaust[1:4:2] if LOD == 2 else exhaust[::2], .028, 'exhaust', sides=n(6))
body.tube([(-.16, -.55, .32), (-.16, -.95, .38)], .055, 'exhaust', sides=n(10))
for x in ((-1, 1) if NEAR else ()): body.tube([(x * .05, -.15, .2), (x * .22, -.25, .2)], .01, 'black', sides=3)   # footrests
body.box((0, FW + .32, .55), (.16, .012, .1), 'plate')

parts = {'body': body, 'lamps': lamps, 'tail': tail}
palette = {**PALETTE, 'lamp': PALETTE['black'], 'tail': PALETTE['black']}
if '--preview' not in sys.argv:
    tris = export(parts, palette, os.path.join(work, 'motorbike.glb'), occluders=[], city=dict(paint={'paint'}, lamp='#f4e7c2', tail='#9c2b22'))
    json.dump({'triangles': tris, 'wheelbase': WB, 'wheelRadius': WR}, open(os.path.join(work, 'motorbike.stats.json'), 'w'))
    print('motorbike', tris, 'total', sum(tris.values()))
else:
    for view, cam, tgt in (('front', (1.8, 2.2, 1.3), (0, 0, .55)), ('side', (-3.0, -.1, .9), (0, 0, .55)), ('rear', (1.8, -2.4, 1.4), (0, 0, .55))):
        preview(os.path.join(work, 'motorbike.glb'), os.path.join(work, f'motorbike-{view}.png'), cam, tgt)
os._exit(0)
