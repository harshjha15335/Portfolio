"""Original Bajaj RE-style auto-rickshaw body, modelled as code.

Keeps the existing wheel positions, seats and driver of src/game/World/TransitModel.ts:
- front wheel at x 0, forward +0.94; rear wheels at x +-0.69, forward -0.78; radius 0.255;
- black lower body and canopy, yellow upper cowl, open sides, steel canopy pillars.

Usage: python3.11 scripts/vehicles/build_auto.py <work-dir> [--preview]
Output: <work-dir>/auto.glb and auto.stats.json, admitted by `node scripts/vehicles/import-vehicle.mjs auto <work-dir>`.
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vehicle_kit import Part, export, preview, smooth, srgb, table

work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)

PALETTE = {
    'black': (srgb('#17191a'), .34, 0, 1), 'yellow': (srgb('#e2ad1e'), .34, 0, 1),
    'canvas': (srgb('#232524'), .92, 0, 1), 'steel': (srgb('#b9bcbb'), .28, 1, .7),
    'rubber': (srgb('#141414'), .8, 0, 1), 'under': (srgb('#1b1b1a'), .95, 0, 1),
    'floor': (srgb('#2a2a29'), .95, 0, 1), 'plate': (srgb('#e6c632'), .5, 0, .8),
    'amber': (srgb('#d8892a'), .2, 0, .6), 'mirror': (srgb('#9fa6a8'), .05, 1, .3),
}
FRONT_WHEEL, REAR_WHEEL, REAR_TRACK, WHEEL_R = .94, -.78, .69, .255
body, glass, lamps, tail = Part(), Part(), Part(), Part()

# Front cowl: horizontal U-shaped rings (open toward the driver), lofted from the floor to the windscreen.
COWL_Z = [.40, .47, .56, .66, .76, .86, .95, 1.03, 1.09, 1.12]
FACE = table([(.40, 1.20), (.56, 1.215), (.76, 1.20), (.95, 1.15), (1.12, 1.06)])   # forward reach of the face
HALF = table([(.40, .30), (.56, .36), (.76, .46), (.95, .55), (1.12, .60)])       # half-width at the back edge
BACK = .62


def cowl_ring(z):
    f, w = FACE(z), HALF(z); pts = []
    for t in np.linspace(-1, 1, 13):
        a = t * math.pi / 2
        x = w * math.sin(a); y = BACK + (f - BACK) * math.cos(a) ** .55
        pts.append((x, y, z))
    return pts


cowl = [cowl_ring(z) for z in COWL_Z]
body.grid(cowl, lambda i, j: 'yellow' if COWL_Z[i] >= .855 else 'black')
# Rolled top lip toward the dash.
lip = [[(x * .97, BACK + (y - BACK) * .94, 1.12) for x, y, _ in cowl[-1]]]
body.grid([cowl[-1], [(x, y, 1.14) for x, y, _ in lip[0]]], lambda i, j: 'yellow')

# Floor and rear body: a closed loft; the floor is low between the cowl and the bench, the rear body
# rises under the bench and over the engine, with arches for the rear wheels.
STATIONS = [.62, .30, -.30, -.36, -.46, -.56, -.67, -.78, -.89, -1.00, -1.10, -1.16, -1.18]
WIDTH = table([(.62, .52), (.30, .62), (-.30, .70), (-.46, .74), (-1.18, .74)])
TOP = table([(.62, .45), (-.30, .45), (-.36, .80), (-1.18, .80)])
BOT = table([(.62, .30), (-1.0, .30), (-1.18, .34)])


def arch(s):
    d = s - REAR_WHEEL
    return WHEEL_R + math.sqrt(max(0, .33 ** 2 - d * d)) if abs(d) < .33 else 0


def floor_ring(s):
    w, top, bot = WIDTH(s), TOP(s), BOT(s); bo = max(bot, arch(s))
    if s < -1.17: w -= .02; top -= .02
    half = [(0, bot), (.45, bot), (w - .04, bo), (w, bo + .04), (w + .005, .5 * (bo + top) + .02), (w, top - .04), (w - .04, top), (.45, top + .005), (0, top + .01)]
    full = half + [(-x, z) for x, z in half[-2:0:-1]]
    return [(x, s, z) for x, z in full]


FN = len(floor_ring(0))


def floor_region(i, j):
    mid = (STATIONS[i] + STATIONS[i + 1]) / 2; jj = j if j < 8 else 2 * 8 - j - 1
    if jj < 2: return 'under'
    if jj >= 6: return 'floor' if TOP(mid) < .6 else 'black'
    if jj == 4 and mid > -.33: return 'steel'  # running-board edge
    return 'black'


ids = body.grid([floor_ring(s) for s in STATIONS], floor_region, closed=True)
body.fan(ids[0], (0, .62, .38), 'under', flip=True)
body.fan(ids[-1], (0, -1.18, .56), 'black')
body.box((0, .25, .49), (.44, .34, .08), 'black')                       # driver seat pedestal

# Canopy: black canvas lofted front to back, with a yellow brow over the windscreen and a rear wall with a window.
CANOPY = [.70, .66, .60, .40, -.30, -.95, -1.04, -1.08]
CW = table([(.70, .58), (.60, .62), (.20, .69), (-.70, .73), (-1.08, .72)])
CE = table([(.70, 1.64), (.66, 1.69), (.60, 1.72), (-1.04, 1.74), (-1.08, 1.68)])   # edge height
CC = table([(.70, 1.72), (.60, 1.86), (.20, 1.92), (-.95, 1.92), (-1.04, 1.86), (-1.08, 1.74)])  # centre height


def canopy_ring(s):
    w, e, c = CW(s), CE(s), CC(s); pts = []
    for t in np.linspace(-1, 1, 13):
        x = w * t * (1.04 - .04 * abs(t)); z = e + (c - e) * (1 - abs(t) ** 2.4)
        pts.append((x, s, z))
    hem = [(pts[0][0] * 1.01, s, e - .05)]; hem_r = [(pts[-1][0] * 1.01, s, e - .05)]
    return hem + pts + hem_r


canopy = [canopy_ring(s) for s in CANOPY]
body.grid(canopy, lambda i, j: 'yellow' if i == 0 else 'canvas')
# Rear wall: canvas from the canopy's back edge down to the rear body, with a small window.
back = canopy[-1]; wall_z = [r[2] for r in back]
rows = [back, [(x, -1.085, max(1.40, z - .30)) for x, _, z in back], [(x, -1.09, 1.10) for x, _, z in back], [(x * .99, -1.10, .80) for x, _, z in back]]
win = lambda i, j: i == 0 and 5 <= j <= 9
body.grid(rows, lambda i, j: None if win(i, j) else 'canvas')
glass.grid([[(x, -1.088, z) for x, _, z in rows[0]], [(x, -1.098, z) for x, _, z in rows[1]]], lambda i, j: 'glass' if win(i, j) else None)

# Windscreen: glass between two steel pillars, in a yellow frame; pillars rise from the cowl to the canopy.
for side in (-1, 1):
    body.tube([(side * .57, .80, 1.10), (side * .61, .64, 1.70)], .024, 'black', sides=6)
    body.tube([(side * .70, -1.02, .80), (side * .72, -1.04, 1.74)], .022, 'steel', sides=6)
    body.tube([(side * .68, -.36, .80), (side * .70, -.34, 1.08), (side * .70, -.62, 1.10)], .014, 'steel', sides=5, caps=False)   # grab rail
glass.grid([[(-.55, .79, 1.13), (.55, .79, 1.13)], [(-.58, .655, 1.68), (.58, .655, 1.68)]], lambda i, j: 'glass')
body.tube([(-.57, .80, 1.12), (.57, .80, 1.12)], .02, 'yellow', sides=5)

# Front: single headlamp in a chrome ring, indicators, fork and mudguard over the front wheel, mirrors.
lamps.ellipsoid((0, FACE(.87) + .012, .87), (.11, .03, .11), 'lamp', nu=10, nv=4)
body.torus((0, FACE(.87) + .016, .87), (0, 1, 0), .118, .017, 'steel', nu=12, nv=3)
for side in (-1, 1):
    body.box((side * .33, FACE(.98) - .05, .98), (.07, .03, .04), 'amber')
    body.tube([(side * .075, FRONT_WHEEL, WHEEL_R), (side * .07, 1.05, .56)], .022, 'steel', sides=5)
    body.tube([(side * .45, .90, 1.02), (side * .70, .78, 1.26)], .01, 'black', sides=4)
    body.disc((side * .72, .748, 1.28), (0, -1, 0), (.05, .04), 'mirror', n=8, flip=side < 0)
guard = [(0, FRONT_WHEEL + .31 * math.cos(a), WHEEL_R + .31 * math.sin(a)) for a in np.linspace(math.radians(20), math.radians(160), 9)]
body.tube(guard, (.09, .012), 'black', sides=4)

# Rear: tail lamps, bumper and plate.
for x in (-.5, .5):
    tail.ellipsoid((x, -1.186, .62), (.05, .02, .08), 'tail', nu=8, nv=3)
body.tube([(-.66, -1.16, .40), (-.60, -1.215, .40), (.60, -1.215, .40), (.66, -1.16, .40)], .03, 'steel', sides=6)
body.box((0, -1.19, .56), (.30, .012, .11), 'black'); body.box((0, -1.197, .56), (.26, .012, .09), 'plate')

parts = {'body': body, 'glass': glass, 'lamps': lamps, 'tail': tail}
palette = {**PALETTE, 'glass': PALETTE['black'], 'lamp': PALETTE['black'], 'tail': PALETTE['black']}
wheels = [((0, FRONT_WHEEL, WHEEL_R), WHEEL_R, .1)] + [((side * REAR_TRACK, REAR_WHEEL, WHEEL_R), WHEEL_R, .1) for side in (-1, 1)]
if '--preview' not in sys.argv:
    tris = export(parts, palette, os.path.join(work, 'auto.glb'), occluders=wheels)
    json.dump({'triangles': tris}, open(os.path.join(work, 'auto.stats.json'), 'w'))
    print('auto', tris, 'total', sum(tris.values()))
else:
    for name, cam, tgt in (('front', (2.6, 3.8, 1.5), (0, 0, .9)), ('side', (4.6, -.2, 1.3), (0, 0, .9)), ('rear', (-2.6, -3.8, 1.7), (0, 0, .9))):
        preview(os.path.join(work, 'auto.glb'), os.path.join(work, f'auto-{name}.png'), cam, tgt)
os._exit(0)
