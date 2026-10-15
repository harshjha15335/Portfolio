"""Original Premier Padmini ("kaali-peeli") taxi body, modelled as code.

Proportions follow the Padmini (Fiat 1100 Delight) at the game's slightly enlarged scale, keeping the
existing wheel positions, cabin, seats and driver of src/game/World/TransitModel.ts:
- wheels at x +-0.88, forward +1.13 / -1.12, radius 0.32;
- body 3.78 m long, roof 1.71 m, black lower body and yellow roof, chrome bumpers and trim.

Usage: python3.11 scripts/vehicles/build_taxi.py <work-dir> [--preview]
Output: <work-dir>/taxi.glb and taxi.stats.json, admitted by `node scripts/vehicles/import-vehicle.mjs taxi <work-dir>`.
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vehicle_kit import Part, export, preview, smooth, srgb, table

work = os.path.abspath(sys.argv[1]); os.makedirs(work, exist_ok=True)

# Finish regions: linear colour, roughness, metalness, AO weight.
PALETTE = {
    'black': (srgb('#16181a'), .26, 0, 1), 'yellow': (srgb('#eaa90f'), .3, 0, 1),
    'chrome': (srgb('#d9dcdc'), .14, 1, .7), 'rubber': (srgb('#151515'), .8, 0, 1),
    'under': (srgb('#1d1d1c'), .95, 0, 1), 'gap': (srgb('#050505'), .9, 0, .4),
    'interior': (srgb('#3b3833'), .85, 0, 1), 'floor': (srgb('#202020'), .95, 0, 1),
    'grille': (srgb('#0d0e0e'), .6, .3, 1), 'plate': (srgb('#e6c632'), .5, 0, .8),
    'amber': (srgb('#d8892a'), .2, 0, .6), 'mirror': (srgb('#9fa6a8'), .05, 1, .3),
}
FRONT_WHEEL, REAR_WHEEL, TRACK, WHEEL_R, ARCH_R = 1.13, -1.12, .88, .32, .40

W = table([(1.90, .78), (1.80, .83), (1.55, .88), (1.13, .895), (.5, .885), (-.6, .885), (-1.12, .895), (-1.55, .875), (-1.75, .84), (-1.89, .78)])
BELT = table([(1.90, .93), (1.75, .95), (1.4, .965), (.92, 1.0), (-1.24, 1.02), (-1.5, .99), (-1.75, .93), (-1.89, .86)])
CROWN = table([(1.90, -.13), (1.6, -.07), (1.2, -.02), (.92, .01), (-1.25, .02), (-1.6, .03), (-1.89, -.04)])
BOTTOM = table([(1.90, .47), (1.6, .42), (1.4, .40), (-1.4, .40), (-1.7, .44), (-1.89, .50)])
# Cabin opening (k = 1) and its floor: footwell, seat floor, parcel shelf behind the rear seat.
FLOOR = table([(.905, .66), (.62, .66), (.60, .45), (-.84, .45), (-.88, .96), (-1.235, .96)])


def cabin(s):
    return 1.0 if -1.235 <= s <= .905 else 0.0


def arch(s):
    best = 0
    for w in (FRONT_WHEEL, REAR_WHEEL):
        d = s - w
        if abs(d) < ARCH_R: best = max(best, WHEEL_R + math.sqrt(ARCH_R ** 2 - d * d))
    return best


def section(s, inset=0.0):
    """Right half of the lower-body ring, bottom centre to top centre, as (x, z)."""
    w, belt, crown, bot, k = W(s) - inset, BELT(s) - inset * .8, CROWN(s), BOTTOM(s) + inset * .8, cabin(s)
    bo = max(bot, arch(s)); sw = min(.80, belt - .10)
    f = FLOOR(s)
    deck = lambda x, frac: (x, belt + crown * frac)
    pts = [(0, bot), (.62, bot), (w - .06, bo), (w + .012, sw - .006), (w + .012, sw + .006),
           (w, belt - .07), (w - .03, belt - .012), (w - .07, belt)]
    inner = [((w - .15, belt + crown * .3), (w - .10, belt - .03)), ((w - .34, belt + crown * .7), (w - .11, f + .02)),
             ((0, belt + crown), (0, f))]
    pts += [(a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k) for a, b in inner]
    return pts


RIGHT = len(section(0))  # points per half, including both centre points


def ring(s, inset=0.0):
    half = section(s, inset)
    full = half + [(-x, z) for x, z in half[-2:0:-1]]
    return [(x, s, z) for x, z in full]


STATIONS = [1.90, 1.892, 1.875, 1.76, 1.62, 1.53, 1.43, 1.33, 1.23, 1.13, 1.03, .95, .915, .905, .875, .869,
            .80, .73, .62, .60, .023, .017, -.70, -.706, -.78, -.84, -.88, -.97, -1.06, -1.14,
            -1.235, -1.245, -1.32, -1.42, -1.52, -1.64, -1.76, -1.865, -1.882, -1.89]


def end_inset(s):
    if s > 1.87: return {1.90: .05, 1.892: .035, 1.875: .012}.get(s, 0)
    if s < -1.86: return {-1.89: .05, -1.882: .035, -1.865: .012}.get(s, 0)
    return 0


body, glass, lamps, tail = Part(), Part(), Part(), Part()

# Lower body: one closed loft. Region by point index (see section()).
rings = [ring(s, end_inset(s)) for s in STATIONS]
SEAMS = {(.875, .869), (.023, .017), (-.70, -.706)}
n_pts = len(rings[0])


def lower_region(i, j):
    s0, s1 = STATIONS[i], STATIONS[i + 1]; mid = (s0 + s1) / 2
    jj = j if j < RIGHT - 1 else 2 * (RIGHT - 1) - j - 1  # the matching right-half face
    if jj < 2: return 'under'
    if (s0, s1) in SEAMS and 2 <= jj <= 7: return 'gap'
    if jj == 3: return 'chrome' if -1.72 < mid < 1.62 else 'black'
    if jj >= 8 and cabin(mid) > .5: return 'floor' if jj >= 9 else 'interior'
    return 'black'


ids = body.grid(rings, lower_region, closed=True)
body.fan(ids[0], (0, 1.90, .70), 'black', flip=True)
body.fan(ids[-1], (0, -1.89, .70), 'black')

# Greenhouse: an outer shell lofted from the windscreen base to the rear-window base, with real openings.
ROOF_H, ROOF_W, ROOF_CROWN = 1.67, .66, .04
GH = [.93, .90, .85, .78, .70, .62, .55, .50, .46, .42, .04, .02, -.02, -.04, -.70, -.75, -.80,
      -.88, -.96, -1.04, -1.12, -1.18, -1.22, -1.25]


def height(s):
    if s > .46: return smooth(.93, .46, s) ** .8
    if s < -.75: return smooth(-1.25, -.75, s) ** .8
    return 1.0


def gh_ring(s):
    h = height(s); B = BELT(s) - .005; T = B + h * (ROOF_H - B); Wb = W(s) - .075
    Wr = Wb * (1 - h) + ROOF_W * h; H = T - B
    half = [(Wb, B - .015), (Wb - .012, B + min(.035, .25 * H)), (Wb * .5 + (Wr + .035) * .5, B + .5 * H),
            (Wr + .035, T - min(.075, .3 * H)), (Wr + .018, T - min(.035, .12 * H)), (Wr - .03, T),
            (Wr - .2, T + ROOF_CROWN * .55 * h), (Wr - .42, T + ROOF_CROWN * .9 * h), (0, T + ROOF_CROWN * h)]
    full = half + [(-x, z) for x, z in half[-2::-1]]
    return [(x, s, z) for x, z in full]


gh = [gh_ring(s) for s in GH]
GN = len(gh[0])


def opening(i, j):
    mid = (GH[i] + GH[i + 1]) / 2; jj = min(j, GN - 2 - j)
    if .505 < mid < .875 and jj >= 5: return 'windscreen'
    if (.03 < mid < .44 or -.74 < mid < -.03) and jj in (1, 2): return 'side'
    if -1.19 < mid < -.79 and jj >= 5: return 'rear'
    return None


def gh_region(i, j):
    if opening(i, j): return None
    mid = (GH[i] + GH[i + 1]) / 2; jj = min(j, GN - 2 - j)
    if jj == 0: return 'black'
    if jj >= 3 and -.77 < mid < .49: return 'yellow'
    return 'black'


body.grid(gh, gh_region)
# Window seals: thin dark faces just inside each opening edge, and the glass, set 8 mm in.
G = np.array(gh)
normals = np.zeros_like(G)
for i in range(len(GH)):
    for j in range(GN):
        a = G[min(i + 1, len(GH) - 1), j] - G[max(i - 1, 0), j]; b = G[i, min(j + 1, GN - 1)] - G[i, max(j - 1, 0)]
        n = np.cross(b, a); normals[i, j] = n / (np.linalg.norm(n) + 1e-9)
glass.grid(G - normals * .008, lambda i, j: 'glass' if opening(i, j) else None)
for i in range(len(GH) - 1):
    for j in range(GN - 1):
        if not opening(i, j): continue
        for (a, b), (ni, nj) in ((((i, j), (i, j + 1)), (i - 1, j)), (((i + 1, j), (i + 1, j + 1)), (i + 1, j)),
                                 (((i, j), (i + 1, j)), (i, j - 1)), (((i, j + 1), (i + 1, j + 1)), (i, j + 1))):
            if 0 <= ni < len(GH) - 1 and 0 <= nj < GN - 1 and opening(ni, nj): continue
            pa, pb = G[a], G[b]; qa, qb = pa - normals[a] * .03, pb - normals[b] * .03
            body.add_face([body.add_vert(p) for p in (pa, pb, qb, qa)], 'rubber')

# Bumpers: chrome blades wrapping round the corners, with overriders; then the plates.
for sign, y0 in ((1, 1.935), (-1, -1.925)):
    path = [(x, y0 - sign * .13 * (abs(x) / .84) ** 4, .50 + .02 * (abs(x) / .84) ** 2) for x in np.linspace(-.84, .84, 9)]
    path = [(-.80, y0 - sign * .24, .50)] + path + [(.80, y0 - sign * .24, .50)]
    body.tube(path, (.045, .06), 'chrome', sides=6)
    for x in (-.34, .34): body.tube([(x, y0 + sign * .03, .43), (x, y0 + sign * .045, .52), (x, y0 + sign * .03, .62)], .028, 'chrome', sides=4)
    body.box((0, y0 + sign * .055, .50) if sign > 0 else (0, -1.905, .64), (.38, .012, .12), 'black')
    body.box((0, y0 + sign * .062, .50) if sign > 0 else (0, -1.912, .64), (.34, .012, .10), 'plate')

# Grille: an oval chrome surround with horizontal bars over a dark recess, between the headlamps.
body.disc((0, 1.902, .67), (0, 1, 0), (.36, .075), 'grille', n=20)
oval = [(.38 * math.cos(t), 1.906, .67 + .085 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 17)]
body.tube(oval, .016, 'chrome', sides=4, caps=False)
for z in (.63, .67, .71): body.tube([(-.33, 1.906, z), (.33, 1.906, z)], (.007, .009), 'chrome', sides=4)

# Headlamps in chrome bezels on the wing fronts, amber indicators below; small tail lamps on the rear wings.
for x in (-.58, .58):
    lamps.ellipsoid((x, 1.90, .775), (.105, .03, .105), 'lamp', nu=10, nv=4)
    body.torus((x, 1.905, .775), (0, 1, 0), .112, .016, 'chrome', nu=12, nv=3)
    body.box((x * 1.02, 1.895, .60), (.08, .02, .045), 'amber')
    tail.ellipsoid((x * 1.04, -1.885, .76), (.05, .025, .085), 'tail', nu=8, nv=4)

# Wing mirrors, door handles, wipers and rear mud flaps.
for side in (-1, 1):
    base = np.array([side * .74, 1.28, .965]); head = np.array([side * .80, 1.25, 1.09])
    body.tube([base, head], .012, 'chrome', sides=5)
    body.ellipsoid(head + (0, -.01, 0), (.052, .022, .045), 'chrome', nu=6, nv=3)
    body.disc(head + (0, -.033, 0), (0, -1, 0), (.042, .036), 'mirror', n=10, flip=side < 0)
    for s in (.10, -.62): body.box((side * (W(s) + .012), s, .93), (.02, .11, .022), 'chrome')
    body.box((side * .78, -1.60, .30), (.02, .14, .22), 'rubber')

parts = {'body': body, 'glass': glass, 'lamps': lamps, 'tail': tail}
palette = {**PALETTE, 'glass': PALETTE['black'], 'lamp': PALETTE['black'], 'tail': PALETTE['black']}
wheels = [((side * TRACK, s, WHEEL_R), WHEEL_R, .12) for side in (-1, 1) for s in (FRONT_WHEEL, REAR_WHEEL)]
if '--preview' not in sys.argv:
    tris = export(parts, palette, os.path.join(work, 'taxi.glb'), occluders=wheels)
    json.dump({'triangles': tris}, open(os.path.join(work, 'taxi.stats.json'), 'w'))
    print('taxi', tris, 'total', sum(tris.values()))
else:
    for name, cam, tgt in (('front', (3.6, 5.2, 1.6), (0, 0, .75)), ('side', (5.8, -.4, 1.3), (0, 0, .8)), ('rear', (-3.4, -5.0, 1.8), (0, 0, .8))):
        preview(os.path.join(work, 'taxi.glb'), os.path.join(work, f'taxi-{name}.png'), cam, tgt)
os._exit(0)
