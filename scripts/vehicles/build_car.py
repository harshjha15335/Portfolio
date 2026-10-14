"""Original Mumbai private cars, modelled as code: a compact hatchback, a saloon and a compact SUV.

One parametric body loft per car (lower body, shoulder crease, glasshouse and roof in a single ring per
station), with arches cut round the wheels, tinted glass as a glossy body finish, door shut lines,
bumpers, lamps, grille, mirrors, handles and Indian number plates, and full wheels (tyre, rim, spokes,
hub). Built with vehicle_kit.py, so the GLB uses the street's shared baked material: base colour in
COLOR_0, (roughness, metalness) in TEXCOORD_0, lamps and tail lamps as separate parts.

The cars are generic, not replicas of any manufacturer's design.

Usage: python3.11 scripts/vehicles/build_car.py <work-dir> <hatchback|saloon|suv> [colour-hex] [--preview]
Output: <work-dir>/<kind>.glb and <kind>.stats.json.
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vehicle_kit import Part, export, preview, smooth, srgb, table

work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)
kind = sys.argv[2]
paint_hex = next((a for a in sys.argv[3:] if a.startswith('#')), None)

# Dimensions in metres, Blender axes: x right, y forward, z up. s runs along y.
SPECS = {
    # A small Indian hatchback: short bonnet, tall glasshouse, hatch.
    'hatchback': dict(L=3.75, Wd=.83, wb=2.43, wr=.30, track=.74, belt=.92, roof=1.52, roofw=.62,
                      ws=(1.0, .25), rs=(-1.83, -1.40), nose=.62, tail=.42, paint='#c7c9c8', hatch=True),
    # A three-box saloon: longer bonnet and a boot deck.
    'saloon': dict(L=4.40, Wd=.87, wb=2.62, wr=.31, track=.77, belt=.90, roof=1.47, roofw=.64,
                   ws=(1.06, .30), rs=(-1.62, -1.08), nose=.62, tail=.70, paint='#5a1f24', hatch=False),
    # A compact SUV: tall, square, black cladding over the arches, roof rails.
    'suv': dict(L=4.20, Wd=.90, wb=2.55, wr=.36, track=.78, belt=1.07, roof=1.72, roofw=.70,
                ws=(1.12, .40), rs=(-2.07, -1.78), nose=.60, tail=.40, paint='#e9e9e6', hatch=True, cladding=True, rails=True),
}
S = SPECS[kind]
L, WD, WB, WR, TRACK = S['L'], S['Wd'], S['wb'], S['wr'], S['track']
FRONT_WHEEL, REAR_WHEEL = WB / 2, -WB / 2
FRONT, REAR = L / 2, -L / 2
ARCH_R = WR + .07
paint = paint_hex or S['paint']

PALETTE = {
    'paint': (srgb(paint), .28, 0, 1), 'paintdark': (srgb(paint) * .55, .32, 0, 1),
    'window': (srgb('#0d1418'), .06, 0, .3), 'trim': (srgb('#121314'), .55, 0, 1),
    'chrome': (srgb('#d4d7d8'), .16, 1, .7), 'rubber': (srgb('#141414'), .82, 0, 1),
    'tread': (srgb('#0c0c0c'), .9, 0, 1), 'rim': (srgb('#a9adb0'), .3, .9, .8),
    'hub': (srgb('#3a3c3e'), .5, .6, 1), 'under': (srgb('#1a1a19'), .95, 0, 1),
    'gap': (srgb('#060606'), .9, 0, .4), 'grille': (srgb('#0b0c0c'), .5, .2, 1),
    'plate': (srgb('#f1f1ec'), .5, 0, .8), 'platetext': (srgb('#111111'), .5, 0, .8),
    'amber': (srgb('#d8892a'), .2, 0, .6), 'mirror': (srgb('#9fa6a8'), .05, 1, .3),
    'cladding': (srgb('#1c1d1e'), .7, 0, 1), 'lampglass': (srgb('#c9ced0'), .08, 0, .5),
}

# Plan-view half width along s, tapering into rounded nose and tail.
W = table([(FRONT, WD - .10), (FRONT - .06, WD - .05), (FRONT - .25, WD - .015), (FRONT_WHEEL, WD), (0, WD + .005),
           (REAR_WHEEL, WD), (REAR + .25, WD - .02), (REAR + .06, WD - .06), (REAR, WD - .11)])
# Height of the belt (window base) and of the bonnet / boot surfaces it falls to at the ends.
BELT = table([(FRONT, S['belt'] - .22), (FRONT - .10, S['belt'] - .13), (S['ws'][0] + .35, S['belt'] - .07), (S['ws'][0], S['belt'] - .03),
              (0, S['belt']), (S['rs'][1] - .05, S['belt'] + .02), (REAR + .12, S['belt'] - (.02 if S['hatch'] else .05)), (REAR, S['belt'] - .12)])
BOTTOM = table([(FRONT, .34), (FRONT - .25, .25), (FRONT_WHEEL + ARCH_R, .21), (REAR_WHEEL - ARCH_R, .21), (REAR + .2, .27), (REAR, .36)])


def arch(s):
    best = 0
    for w in (FRONT_WHEEL, REAR_WHEEL):
        d = s - w
        if abs(d) < ARCH_R: best = max(best, WR + .02 + math.sqrt(ARCH_R ** 2 - d * d) * .92)
    return best


# Glasshouse height factor: 0 on bonnet/boot, 1 under the roof. Windscreen runs ws[0] (base) -> ws[1] (top);
# the rear screen runs rs[1] (top) -> rs[0] (base). A hatch has a steep rear screen down to the tail.
WS0, WS1 = S['ws']; RS0, RS1 = S['rs']


def height(s):
    if s > WS1: return smooth(WS0, WS1, s) ** .85
    if s < RS1: return smooth(RS0, RS1, s) ** .85
    return 1.0


def roof_line(s):
    """Roof height and half width at s: crowned along the length, narrowing towards both screens."""
    mid, half = (WS1 + RS1) / 2, (WS1 - RS1) / 2
    t = min(1.0, abs(s - mid) / half)
    return S['roof'] - .045 * t * t, S['roofw'] - .06 * t * t


def section(s, inset=0.0):
    """Right half ring, bottom centre to roof centre, as (x, z). 13 points."""
    w = W(s) - inset; h = height(s); belt = BELT(s) - inset * .6; bot = BOTTOM(s) + inset * .6
    bo = max(bot, arch(s))
    # Over the arches the shoulder rises with the wheel lip, so the wing swells instead of folding through it.
    shoulder = max(belt - .15, bo + .10); belt = max(belt, shoulder + .07)
    top, rw = roof_line(s); rw -= inset * .5
    lip = bo > bot
    lower = [(0, bot), (w - .16, bot), (w - .04, bo + .015 if lip else bot + .05), (w + .005, min(bo + .07, shoulder - .03) if lip else bot + .14),
             (w + .012, shoulder), (w - .005, belt - .03), (w - .045, belt)]
    # Glasshouse with tumblehome and a crowned roof; on the bonnet and boot it lies down as a crowned deck.
    gw = w - .06; gh = top - belt
    glass = [(gw - (gw - rw) * .32, belt + gh * .3), (gw - (gw - rw) * .82, belt + gh * .8), (rw + .02, top - .035),
             (rw - .08, top + .012), (rw * .45, top + .032), (0, top + .038)]
    deck = [(gw * f, belt + .055 * (1 - f * f) - .004) for f in (.92, .8, .66, .5, .25, 0)]
    upper = [(g[0] * h + d[0] * (1 - h), g[1] * h + d[1] * (1 - h)) for g, d in zip(glass, deck)]
    return lower + upper


NP = len(section(0))


def ring(s, inset=0.0):
    half = section(s, inset)
    full = half + [(-x, z) for x, z in half[-2:0:-1]]
    return [(x, s, z) for x, z in full]


# Stations: dense at the ends (rounding), at the arches, and at door shut lines (pairs of close stations).
door_front, door_mid = WS0 - .12, (WS0 - .12 + RS1) / 2 if not S['hatch'] else (WS0 - .12 + RS1 + .1) / 2
door_rear = RS1 + .05 if S['hatch'] else RS0 + .05
SEAMS = [(door_front, door_front - .008), (door_mid, door_mid - .008), (door_rear, door_rear - .008)]
base = list(np.linspace(FRONT, REAR, 34))
extra = [FRONT - .008, FRONT - .022, REAR + .022, REAR + .008, WS0, WS1, RS0, RS1]
for w in (FRONT_WHEEL, REAR_WHEEL): extra += [w + d for d in np.linspace(-ARCH_R, ARCH_R, 9)]
for a, b in SEAMS: extra += [a, b]
STATIONS = sorted(set(round(v, 4) for v in base + extra if REAR <= v <= FRONT), reverse=True)


def end_inset(s):
    d = min(FRONT - s, s - REAR)
    return .06 * (1 - smooth(0, .03, d)) if d < .03 else 0


body, lamps, tail = Part(), Part(), Part()
rings = [ring(s, end_inset(s)) for s in STATIONS]
seam_pairs = {(round(a, 4), round(b, 4)) for a, b in SEAMS}


C_PILLAR = RS1 + (.32 if S['hatch'] else .06)   # side glass ends here; a hatch has a thick C-pillar


def region(i, j):
    s0, s1 = STATIONS[i], STATIONS[i + 1]; mid = (s0 + s1) / 2; h = height(mid)
    jj = j if j < NP - 1 else 2 * (NP - 1) - j - 1
    if jj == 0: return 'under'
    if jj in (1, 2) and S.get('cladding'): return 'cladding'
    if jj == 1: return 'trim'
    if jj == 2 and not (REAR_WHEEL - ARCH_R < mid < FRONT_WHEEL + ARCH_R): return 'trim'   # bumper corners
    if (s0, s1) in seam_pairs and 2 <= jj <= 5 and h > .5: return 'gap'
    slope = .06 < h < .97
    if jj in (6, 7):
        if h >= .97:
            if door_mid - .05 < mid < door_mid + .03: return 'trim'   # B-pillar
            return 'window' if mid > C_PILLAR else 'paint'
        if slope and mid > 0: return 'window' if h > .42 else 'paint'   # front quarter glass under the A-pillar
        return 'paint'
    if jj == 8: return 'trim' if (S.get('rails') and h >= .97) else 'paint'
    if slope and jj >= 9: return 'window'          # windscreen and rear screen
    if jj == 5 and h > .9: return 'trim'           # window seal at the belt
    return 'paint'


ids = body.grid(rings, region, closed=True)
body.fan(ids[0], (0, FRONT, .55), 'paint', flip=True)
body.fan(ids[-1], (0, REAR, .6), 'paint')

# Bumpers: the body's lowest band is dark plastic at both overhangs (see region), with a lower intake; plates; grille and lamps.
body.box((0, FRONT - .004, .395), (.86, .02, .07), 'grille')
for sign, y0 in ((1, FRONT), (-1, REAR)):
    pz = .48 if sign > 0 else .62
    body.box((0, y0 + sign * .005, pz), (.50, .012, .12), 'plate')
    for k in range(7):
        body.box((-.19 + k * .063, y0 + sign * .012, pz), (.035, .004, .065), 'platetext')
body.box((0, FRONT - .01, .55), (.62, .02, .11), 'grille')
for z in (.52, .58): body.box((0, FRONT - .002, z), (.58, .01, .012), 'chrome')


def surface_x(s, z):
    """Half width of the body side at height z, read off the section's lower points."""
    pts = section(s, end_inset(s))[2:7]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        if z0 <= z <= z1 and z1 > z0: return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
    return pts[-1][0] if z > pts[-1][1] else pts[0][0]


def corner_lamp(part, region, sign, x_in, depth, lo, hi, off=.006):
    """A lamp wrapped round a body corner: across the end face from x_in, then back along the flank."""
    y0 = FRONT if sign > 0 else REAR
    xe = W(y0) - .06
    outline = [(x, y0 + sign * off) for x in np.linspace(x_in, xe, 3)]
    flank = list(np.linspace(y0 - sign * .03, y0 - sign * depth, 3))
    for side in (1, -1):
        rows = [[(side * x, y, lo(y)), (side * x, y, hi(y))] for x, y in outline]
        rows += [[(side * (surface_x(y, z) + off), y, z) for z in (lo(y), hi(y))] for y in flank]
        part.grid(rows, lambda i, j: region, flip=(side * sign) < 0)


# Headlamps sweep back into the wings under the bonnet line; tail lamps wrap the rear corners.
corner_lamp(lamps, 'lamp', 1, .38, .20, lambda y: BELT(y) - .14, lambda y: BELT(y) - .03)
corner_lamp(body, 'trim', 1, .34, .23, lambda y: BELT(y) - .16, lambda y: BELT(y) - .015, off=.003)
if S['hatch']:
    corner_lamp(tail, 'tail', -1, W(REAR) - .30, .16, lambda y: BELT(y) - .26, lambda y: BELT(y) - .02)
else:
    corner_lamp(tail, 'tail', -1, .30, .24, lambda y: BELT(y) - .17, lambda y: BELT(y) - .05)
for x in (-1, 1):
    body.box((x * (WD - .12), FRONT - .05, .42), (.10, .02, .035), 'amber')

# Mirrors, handles, wipers.
for side in (-1, 1):
    bx = side * (W(WS0 - .1) - .02)
    body.tube([(bx, WS0 - .12, BELT(WS0) + .02), (bx + side * .09, WS0 - .14, BELT(WS0) + .1)], .012, 'trim', sides=4)
    body.ellipsoid((bx + side * .12, WS0 - .15, BELT(WS0) + .11), (.075, .04, .052), 'paint', nu=10, nv=4)
    body.box((bx + side * .125, WS0 - .19, BELT(WS0) + .11), (.1, .006, .07), 'mirror')
    for s in (door_front - .45, door_mid - .45):
        body.box((side * (W(s) + .012), s, BELT(s) - .08), (.015, .12, .025), 'chrome')
for x in (-.25, .2): body.tube([(x - .22, WS0 + .02, BELT(WS0) + .01), (x + .22, WS0 + .06, BELT(WS0) + .02)], .008, 'trim', sides=3)
if S.get('rails'):
    for side in (-1, 1):
        body.tube([(side * (S['roofw'] - .1), y, S['roof'] + .05) for y in (WS1 - .05, (WS1 + RS1) / 2, RS1 + .08)], .018, 'trim', sides=5)

# Wheels: tyre (sidewall rings and tread), rim dish, five spokes and hub, both sides.
def wheel(cx, cy):
    out = 1 if cx > 0 else -1
    rings = []
    for t in np.linspace(0, 2 * math.pi, 24, endpoint=False):
        c, s_ = math.cos(t), math.sin(t)
        prof = [(.105, WR * .66), (.11, WR * .9), (.095, WR), (-.095, WR), (-.11, WR * .9), (-.105, WR * .66)]
        rings.append([(cx + out * dx, cy + r * c, WR + r * s_) for dx, r in prof])
    rings.append(rings[0])
    body.grid(rings, lambda i, j: 'tread' if j == 2 else 'rubber')
    body.disc((cx + out * .09, cy, WR), (out, 0, 0), (WR * .66, WR * .66), 'rim', n=24, flip=out < 0)
    body.disc((cx + out * .097, cy, WR), (out, 0, 0), (WR * .2, WR * .2), 'hub', n=10, flip=out < 0)
    for k in range(5):
        a = k * 2 * math.pi / 5
        p0 = (cx + out * .1, cy + WR * .18 * math.cos(a), WR + WR * .18 * math.sin(a))
        p1 = (cx + out * .095, cy + WR * .6 * math.cos(a), WR + WR * .6 * math.sin(a))
        body.tube([p0, p1], (.012, .03), 'chrome' if kind == 'suv' else 'rim', sides=4, caps=False)


for x in (-TRACK, TRACK):
    for y in (FRONT_WHEEL, REAR_WHEEL): wheel(x, y)

parts = {'body': body, 'lamps': lamps, 'tail': tail}
palette = {**PALETTE, 'lamp': PALETTE['trim'], 'tail': PALETTE['trim']}
if '--preview' not in sys.argv:
    tris = export(parts, palette, os.path.join(work, f'{kind}.glb'), occluders=[])
    json.dump({'triangles': tris, 'length': L, 'wheelbase': WB, 'wheelRadius': WR, 'track': TRACK}, open(os.path.join(work, f'{kind}.stats.json'), 'w'))
    print(kind, tris, 'total', sum(tris.values()))
else:
    d = L * 1.15
    for name, cam, tgt in (('front', (d * .8, d * 1.1, 1.5), (0, 0, .7)), ('side', (d * 1.4, -.2, 1.2), (0, 0, .7)), ('rear', (-d * .8, -d * 1.1, 1.7), (0, 0, .7))):
        preview(os.path.join(work, f'{kind}.glb'), os.path.join(work, f'{kind}-{name}.png'), cam, tgt)
os._exit(0)
