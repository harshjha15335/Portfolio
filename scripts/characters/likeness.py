"""Stylised likeness pass for the named cast (Harsh and friends), painted onto a Rocketbox avatar's maps.

Each recipe re-colours the source body/head maps toward one real person, working from photos they agreed to share:
skin tone, hair colour and texture, beard or stubble, iris colour and the clothes they wore. The face geometry stays
the Rocketbox one; this is a likeness in colour and costume, not a portrait.
Called by rocketbox_atlas.py when the character id has a recipe. Coordinates are fractions of the 2048² source map
(x right, y down). Run directly to write previews:  python3.11 likeness.py <textures-dir> <id> <code> <out.jpg>
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def arr(img): return np.asarray(img.convert('RGB')).astype(np.float32) / 255
def img(a): return Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))
def lum(a): return a @ np.array([.299, .587, .114], np.float32)
def hsv(a):
    mx, mn = a.max(2), a.min(2); d = np.maximum(mx - mn, 1e-5); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return np.where(mx - mn < 1e-4, 0, h), np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-5), 0), mx
def grid(a):
    h, w = a.shape[:2]; y, x = np.mgrid[0:h, 0:w].astype(np.float32); return x / w, y / h
def box(a, x0, y0, x1, y1):
    x, y = grid(a); return ((x >= x0) & (x < x1) & (y >= y0) & (y < y1)).astype(np.float32)
def ellipse(a, cx, cy, rx, ry, soft=.25):
    x, y = grid(a); d = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2); return np.clip((1 - d) / soft, 0, 1)
def blur(m, r): return np.asarray(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
def skin_like(a):
    h, s, v = hsv(a); return ((h < 32) | (h > 345)) & (s > .14) & (s < .62) & (v > .3)
def rgb(hex_): return np.array([int(hex_[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
def shading(a, m, smooth=0, soft=0, ignore=None):
    """Fold and seam shading of a garment as a multiplier around 1, optionally with thin dark stripes or prints closed out.
    `ignore` marks a graphic on the base garment; it is shaded flat so the print disappears."""
    L = lum(a)
    if ignore is not None:
        ig = blur(ignore, 6); L = L * (1 - ig) + np.median(L[(m > .5) & (ignore < .5)]) * ig
    if soft: L = blur_f(L, soft)
    if smooth:
        # Grey closing (max then min) removes dark features narrower than `smooth` px, e.g. the base polo's stripes.
        im = Image.fromarray((L * 255).astype(np.uint8)); L2 = np.asarray(im.filter(ImageFilter.MaxFilter(smooth)).filter(ImageFilter.MinFilter(smooth // 2 * 2 + 1 if smooth > 3 else 3)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
        L = np.where(m > 0, L2, L)
    ref = np.median(L[m > .5]) if (m > .5).any() else .5
    return np.clip(L / max(ref, 1e-3), .25, 1.6) ** .85
def recolour(a, m, colour, smooth=0, contrast=1.0, floor=0, soft=0, ignore=None):
    sh = np.maximum(shading(a, m, smooth, soft, ignore) ** contrast, floor); out = rgb(colour)[None, None, :] * sh[..., None]
    return a * (1 - m[..., None]) + np.clip(out, 0, 1) * m[..., None]
def garment(a, region, keep_skin=True):
    h, s, v = hsv(a); m = region * (v > .04)
    if keep_skin:
        # Skin is a large area; an opening drops thin skin-coloured features such as brown stripes from the skin mask.
        sk = Image.fromarray((skin_like(a) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(15)).filter(ImageFilter.MaxFilter(19))
        m = m * (np.asarray(sk) < 128)
    return blur(m.astype(np.float32), 1.2)

# ---------------- body ----------------
def leaf_print(a, m, colour, seed, size=(90, 140), spacing=135):
    """Sage outline leaves scattered over a garment, the hand-drawn print of Aarush's white shirt."""
    H, W = a.shape[:2]; layer = Image.new('L', (W, H), 0); d = ImageDraw.Draw(layer); r = random.Random(seed)
    for gy in range(0, H, spacing):
        for gx in range(0, W, spacing):
            cx, cy = gx + r.uniform(0, spacing), gy + r.uniform(0, spacing); L = r.uniform(*size); ang = r.uniform(0, math.tau)
            pts = []
            for i in range(19):
                t = i / 18; w = math.sin(math.pi * t) * L * .32 * (1 + .25 * math.sin(t * 18 + r.random()))
                for side in (1,) if i < 18 else ():
                    pass
                pts.append((t * L - L / 2, w))
            outline = pts + [(x, -y) for x, y in reversed(pts)]
            rot = lambda p: (cx + p[0] * math.cos(ang) - p[1] * math.sin(ang), cy + p[0] * math.sin(ang) + p[1] * math.cos(ang))
            # Broken outline: draw the contour in a few strokes with gaps, like a block print.
            poly = [rot(p) for p in outline]
            for k in range(0, len(poly) - 1, 3):
                if r.random() < .82: d.line(poly[k:k + 4], fill=255, width=10)
            d.line([rot((-L * .45, 0)), rot((L * .3, 0))], fill=255, width=5)
    print_m = np.asarray(layer.filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255 * m
    sh = shading(a, m, 0)
    return a * (1 - print_m[..., None]) + (rgb(colour)[None, None] * sh[..., None]) * print_m[..., None]

def stripes(a, m, colour, period=7, width=2, vertical=True):
    x, y = grid(a); H, W = a.shape[:2]; c = (x * W if vertical else y * H) % period < width
    k = (c.astype(np.float32) * m * .55)[..., None]; return a * (1 - k) + rgb(colour)[None, None] * shading(a, m)[..., None] * k

def ribs(a, m, period=6, depth=.12):
    x, _ = grid(a); W = a.shape[1]; r = 1 - depth * (0.5 + 0.5 * np.sin(x * W / period * math.tau)); return a * (1 - m[..., None]) + (a * r[..., None]) * m[..., None]

def watch(a, x0, y, x1, colour='#202124'):
    """A dark strap and face across the wrist (body map), for Harsh."""
    out = a.copy(); H, W = a.shape[:2]; m = box(a, x0, y - .006, x1, y + .006); out = out * (1 - m[..., None]) + rgb(colour)[None, None] * m[..., None]
    m2 = ellipse(a, (x0 + x1) / 2, y, .014, .011, .15); return out * (1 - m2[..., None]) + rgb('#2e3236')[None, None] * m2[..., None]

def erase_print(a, region, r=24):
    """Paint over a garment graphic (a logo or tattoo) with the colour around it (a blur that ignores the graphic itself)."""
    m = blur(np.clip(region * 1.0, 0, 1), 2); keep = (m < .05).astype(np.float32)
    num = np.stack([blur_f(a[..., i] * keep, r) for i in range(3)], -1); den = blur_f(keep, r)[..., None]
    bg = num / np.maximum(den, 1e-4); return a * (1 - m[..., None]) + bg * m[..., None]
def blur_f(x, r):
    """Float Gaussian blur (no 8-bit rounding), for normalised convolution."""
    # Three box passes approximate a Gaussian of radius r; cumulative sums keep each pass O(pixels).
    x = x.astype(np.float32); h = max(1, int(r * .87))
    for _ in range(3):
        for axis in (0, 1):
            pad = np.pad(x, [(h + 1, h) if i == axis else (0, 0) for i in range(2)], mode='edge'); c = np.cumsum(pad, axis=axis)
            x = (np.take(c, range(2 * h + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * h - 1), axis=axis)) / (2 * h + 1)
    return x

# ---------------- head ----------------
FACES = {  # cx, mouth y, chin y, jaw half-width, eyebrow y
    'm002': (.493, .400, .468, .150, .248), 'm014': (.493, .400, .475, .155, .250),
    'm019': (.500, .401, .505, .165, .255), 'm017': (.490, .401, .470, .170, .248),
    'm027': (.497, .403, .482, .168, .250),
    'f005': (.500, .405, .470, .140, .245), 'cm001': (.500, .405, .480, .150, .265),
}
def hair_mask(a, code):
    cx, mouth, chin, jaw, brow = FACES[code]; x, y = grid(a)
    skin = rgb('#000000'); H, W = a.shape[:2]
    sample = np.concatenate([a[int(.35 * H):int(.37 * H), int((cx + o - .015) * W):int((cx + o + .015) * W)].reshape(-1, 3) for o in (-.1, .1)]).mean(0)
    dist = np.linalg.norm(a - sample[None, None], axis=2); h, s, v = hsv(a)
    # Hair: away from the forehead colour, above the jaw line and not the cut-out background; skin tones never count.
    m = np.clip((dist - .12) / .1, 0, 1) * (v > .05) * (y < .62) * ~skin_like(a)
    if code in BLOND:
        # Fair hair is close to skin in colour: take everything above the ears that is not the face itself.
        m = np.maximum(m, ((v > .05) & (y < .44)).astype(np.float32) * (1 - ellipse(a, cx, .37, .175, .215, .25)))
    face = ellipse(a, cx, .37, .17, .2, .4)
    # Ears are shaded skin, not hair; on short-haired bases they sit in the open.
    ears = np.maximum(ellipse(a, .225, .365, .042, .07, .5), ellipse(a, .775, .365, .042, .07, .5)) if code in OPEN_EARS else 0
    return blur(m * (1 - face * (y > brow + .02)) * (1 - ears), 1.5)
OPEN_EARS = {'m014', 'm019', 'm017', 'm027', 'cm001'}
BLOND = {'m019'}

def darken_hair(a, m, base='#1b1512', curls=0.0, seed=1):
    L = lum(a); ref = np.median(L[m > .5]) if (m > .5).any() else .3
    out = rgb(base)[None, None] * (np.clip(L / max(ref, 1e-3), .4, 1.7) ** .9)[..., None]
    if curls:
        H, W = a.shape[:2]; layer = Image.new('L', (W, H), 128); d = ImageDraw.Draw(layer); r = random.Random(seed)
        for _ in range(int(W * H / 900 * curls)):
            x, y, rr = r.uniform(0, W), r.uniform(0, H * .62), r.uniform(5, 13); a0 = r.uniform(0, 360)
            d.arc((x - rr, y - rr, x + rr, y + rr), a0, a0 + r.uniform(160, 300), fill=r.choice((185, 200, 60, 70)), width=2)
        k = (np.asarray(layer.filter(ImageFilter.GaussianBlur(.7))).astype(np.float32) / 255 - .5) * 1.1
        out = out * (1 + k[..., None])
    return a * (1 - m[..., None]) + np.clip(out, 0, 1) * m[..., None]

def brows(a, code, strength=.6, colour='#1a1411'):
    cx, mouth, chin, jaw, brow = FACES[code]; band = (ellipse(a, cx - .075, brow, .055, .016, .5) + ellipse(a, cx + .075, brow, .055, .016, .5)).clip(0, 1)
    L = lum(a); dark = np.clip((blur(L, 6) - L) * 9, 0, 1) * band * strength + band * .25 * strength
    return a * (1 - dark[..., None]) + rgb(colour)[None, None] * dark[..., None]

def beard(a, code, density, kind='stubble', colour='#2a1f1a', seed=3):
    """Stubble or a short beard: moustache, chin and jaw, never the lips; per-pixel grain so it reads as hair."""
    cx, mouth, chin, jaw, brow = FACES[code]
    tache = ellipse(a, cx, mouth - .022, .062, .016, .6)
    lips = ellipse(a, cx, mouth + .002, .046, .013, .3)
    if kind == 'goatee':
        # From under the lower lip down to the chin, soft-edged so the sides thin out like the real one.
        m = np.maximum(np.clip(tache * 1.3, 0, 1), ellipse(a, cx, (mouth + chin) / 2 + .008, .062, (chin - mouth) / 2 + .014, .7))
    else:
        x, y = grid(a); jawm = ellipse(a, cx, mouth + .012, jaw, (chin - mouth) + .03, .35) * np.clip((y - (mouth - .05)) / .03, 0, 1)
        # Fade out up the cheeks: full along the jaw edge and chin, thinner beside the mouth.
        if kind == 'beard':
            m = np.maximum(tache, jawm); m = np.maximum(m, ellipse(a, cx, chin + .035, jaw * .75, .045, .6) * .55)
        else:
            # Stubble: moustache and chin, with only a trace along the jaw.
            m = np.maximum(tache * .9, ellipse(a, cx, chin - .015, .06, .04, .7)); m = np.maximum(m, jawm * .3)
    m = np.clip(m - lips * 1.4, 0, 1)
    rng = np.random.default_rng(seed); grain = blur(rng.random(a.shape[:2]).astype(np.float32), .6)
    k = (m * density * (.35 + 1.3 * grain)).clip(0, 1)
    return a * (1 - k[..., None]) + rgb(colour)[None, None] * k[..., None]

def irises(a, colour='#3b2416'):
    """Rocketbox eyes are grey-green; find the eyeball in the lower-left of the head map and make the iris dark brown."""
    H, W = a.shape[:2]; x0, y0, x1, y1 = int(.17 * W), int(.80 * H), int(.36 * W), int(.99 * H)
    reg = a[y0:y1, x0:x1]; h, s, v = hsv(reg); sclera = (v > .72) & (s < .2)
    if not sclera.any(): return a
    yy, xx = np.nonzero(sclera); cy, cx = yy.mean() + y0, xx.mean() + x0
    x, y = grid(a); r = np.hypot(x * W - cx, y * H - cy); m = np.clip((.019 * W - r) / 3, 0, 1)
    L = lum(a); out = rgb(colour)[None, None] * (np.clip(L / .45, .2, 1.6))[..., None]
    return a * (1 - m[..., None]) + out * m[..., None]

def chain(a, code, colour='#c9c9c4'):
    """A thin silver chain resting at the base of the neck (head map), for Aarush and Pavit."""
    cx, mouth, chin, jaw, brow = FACES[code]; H, W = a.shape[:2]; layer = Image.new('L', (W, H), 0); d = ImageDraw.Draw(layer)
    pts = [((cx + t * .085) * W, (chin + .17 + .045 * (1 - t * t)) * H) for t in np.linspace(-1, 1, 40)]
    d.line(pts, fill=255, width=4); d.line([(p[0], p[1] + 2) for p in pts[::2]], fill=150, width=2)
    m = np.asarray(layer.filter(ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255
    return a * (1 - m[..., None]) + rgb(colour)[None, None] * m[..., None]

def frame_patch(a, colour):
    """A small solid swatch in the empty corner of the head map that the glasses geometry samples (see rocketbox_to_glb.py)."""
    m = box(a, .968, .968, .998, .998); return a * (1 - m[..., None]) + rgb(colour)[None, None] * m[..., None]
GLASSES_UV = (.983, .017)  # head-map u, v (v up) at the centre of frame_patch

# ---------------- recipes ----------------
TORSO = (.325, 0, .675, .87)
SLEEVES = [(0, .42, .31, .62), (.69, .42, 1, .62)]
LEGS = [(0, 0, .31, .42), (.69, 0, 1, .42)]
COLLAR = [(.14, .33, .33, .5), (.67, .33, .86, .5)]
def region(a, boxes): return np.clip(sum(box(a, *b) for b in boxes), 0, 1)

def body_aarush(a):
    shirt = garment(a, region(a, [TORSO] + SLEEVES + COLLAR))
    a = recolour(a, shirt, '#ece9df', smooth=23, contrast=.8, floor=.8)
    a = leaf_print(a, shirt, '#62806a', 'aarush')
    return recolour(a, garment(a, region(a, LEGS)), '#3a3b40')
def head_aarush(a):
    a = darken_hair(a, hair_mask(a, 'm002'), '#17110e', curls=.7, seed=11)
    a = brows(a, 'm002', .7); a = beard(a, 'm002', .5); a = irises(a); a = chain(a, 'm002'); return a

def body_pavit(a):
    shirt = garment(a, region(a, [TORSO] + SLEEVES + COLLAR))
    a = recolour(a, shirt, '#1b1b1e', smooth=23, contrast=1.2); a = ribs(a, shirt, 6, .1)
    return recolour(a, garment(a, region(a, LEGS)), '#4d6a92')
def head_pavit(a):
    a = darken_hair(a, hair_mask(a, 'm002'), '#120d0b', curls=1.3, seed=21)
    a = brows(a, 'm002', .7); a = beard(a, 'm002', .26); a = irises(a); a = chain(a, 'm002'); return a

def body_anuj(a):
    tee = garment(a, region(a, [TORSO] + SLEEVES))
    a = recolour(a, tee, '#3f8db6', contrast=.9, ignore=box(a, .42, .55, .58, .75))
    # A small white chest logo, as on the photo's t-shirt.
    a = a * (1 - (logo := ellipse(a, .555, .2, .016, .01, .4) * .85)[..., None]) + logo[..., None]
    return recolour(a, garment(a, region(a, LEGS)), '#55585f', smooth=0, contrast=.7)
def head_anuj(a):
    a = darken_hair(a, hair_mask(a, 'm019'), '#1c1410', curls=1.4, seed=31)
    a = brows(a, 'm019', 1.0); a = beard(a, 'm019', .72, 'beard'); a = irises(a); return frame_patch(a, '#26272a')

def body_harsh(a):
    shirt = garment(a, region(a, [(.325, 0, .675, .92), (0, .42, .31, .74), (.69, .42, 1, .74), (.13, .32, .31, .42), (.69, .32, .87, .42)]))
    a = recolour(a, shirt, '#efd3cf', contrast=.75); a = stripes(a, shirt, '#fbf4f1', 9, 3)
    a = recolour(a, garment(a, region(a, LEGS)), '#a4b2bf', contrast=.75)
    return watch(a, .015, .835, .23)
def head_harsh(a):
    a = darken_hair(a, hair_mask(a, 'm014'), '#141010', curls=0, seed=41)
    a = brows(a, 'm014', .9); a = beard(a, 'm014', .14); a = irises(a); return frame_patch(a, '#2b1d16')

def body_arham(a):
    # The base is a hoodie: take the sleeves down over their cuffs and shade the drawstrings and pocket flat, so it reads as a tee.
    tee = garment(a, region(a, [(.325, 0, .675, .92), (0, .42, .31, .7), (.69, .42, 1, .7)]))
    a = recolour(a, tee, '#74386c', contrast=.9, ignore=box(a, .42, .42, .6, .8))
    legs = garment(a, region(a, LEGS)); a = recolour(a, legs, '#1d1d20', contrast=.8)
    # The grey side stripe runs down the outer seam, which is the outer edge of each leg panel.
    for x0, x1 in ((.012, .022), (.978, .988)):
        s = box(a, x0, .02, x1, .4) * legs; a = a * (1 - s[..., None]) + rgb('#8d9096')[None, None] * s[..., None]
    return a
def head_arham(a):
    # Round-faced base (Male_Adult_20): thick short black hair, a thin moustache over the lip and a sparse chin goatee.
    a = darken_hair(a, hair_mask(a, 'm027'), '#0c0908', curls=.4, seed=51)
    a = brows(a, 'm027', 1.0); a = beard(a, 'm027', .7, 'goatee', '#181210'); a = irises(a); return frame_patch(a, '#121214')

def brush_print(a, m, seed):
    """Ranjan's shirt: big abstract brush strokes in mustard, orange, navy and grey on white."""
    H, W = a.shape[:2]; layer = Image.new('RGB', (W, H), (0, 0, 0)); alpha = Image.new('L', (W, H), 0); d, da = ImageDraw.Draw(layer), ImageDraw.Draw(alpha); r = random.Random(seed)
    colours = [(214, 160, 58), (226, 136, 60), (226, 136, 60), (44, 54, 84), (112, 108, 100), (196, 178, 70)]
    for _ in range(int(W * H / 26000)):
        x, y, L, w, ang = r.uniform(0, W), r.uniform(0, H), r.uniform(60, 190), r.uniform(18, 40), r.uniform(0, math.pi); c = r.choice(colours)
        dx, dy = math.cos(ang) * L / 2, math.sin(ang) * L / 2; pts = [(x - dx, y - dy), (x + dx, y + dy)]
        d.line(pts, fill=c, width=int(w)); da.line(pts, fill=235, width=int(w))
        for px, py in pts: d.ellipse((px - w * .45, py - w * .45, px + w * .45, py + w * .45), fill=c); da.ellipse((px - w * .45, py - w * .45, px + w * .45, py + w * .45), fill=235)
    k = np.asarray(alpha.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)[..., None] / 255 * m[..., None]
    paint = np.asarray(layer).astype(np.float32) / 255 * shading(a, m)[..., None]
    return a * (1 - k) + paint * k

def text_print(a, x, y, lines, size, colour='#f4efe6'):
    """Small chest lettering (body map); `x`, `y` are the centre of the block."""
    from PIL import ImageFont
    H, W = a.shape[:2]; layer = Image.new('L', (W, H), 0); d = ImageDraw.Draw(layer)
    try: font = ImageFont.truetype('DejaVuSans-Bold.ttf', size)
    except OSError: font = ImageFont.load_default()
    for i, line in enumerate(lines):
        w = d.textlength(line, font=font); d.text((x * W - w / 2, y * H + (i - len(lines) / 2) * size * 1.15), line, fill=255, font=font)
    m = np.asarray(layer.filter(ImageFilter.GaussianBlur(.6))).astype(np.float32) / 255 * .9
    return a * (1 - m[..., None]) + rgb(colour)[None, None] * m[..., None]

def body_ranjan(a):
    shirt = garment(a, region(a, [TORSO] + SLEEVES + COLLAR))
    a = recolour(a, shirt, '#f1efe9', smooth=23, contrast=.8, floor=.8); a = brush_print(a, shirt, 'ranjan')
    # Reading glasses hooked on the shirt front, below the collar.
    H, W = a.shape[:2]; layer = Image.new('L', (W, H), 0); d = ImageDraw.Draw(layer)
    for k in (0, 1): d.rounded_rectangle((W * .505, H * (.6 + k * .05), W * .555, H * (.64 + k * .05)), radius=10, outline=255, width=6)
    g = np.asarray(layer.filter(ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255; a = a * (1 - g[..., None]) + rgb('#141416')[None, None] * g[..., None]
    a = recolour(a, garment(a, region(a, LEGS)), '#8f8574', contrast=.8)
    return watch(a, .77, .835, .985, '#d4621f')  # the orange thread (kalava) on the wrist
def head_ranjan(a):
    a = darken_hair(a, hair_mask(a, 'm002'), '#141110', curls=0, seed=61)
    a = brows(a, 'm002', .9); a = beard(a, 'm002', .55, 'stubble', '#3b3532'); a = irises(a); return a

def body_rina(a):
    top = garment(a, np.clip(box(a, 0, 0, 1, .55) + box(a, .28, .55, .72, .95), 0, 1), keep_skin=False)
    top = top * (1 - box(a, 0, .55, .28, 1)) * (1 - box(a, .72, .55, 1, 1)) * (1 - box(a, 0, 0, .31, .2)) * (1 - box(a, .69, 0, 1, .2))
    # The base jacket is a fine plaid; shade from a softened luminance so the red reads as plain crepe.
    a = recolour(a, top, '#c41d1f', contrast=.9, soft=5)
    # The ruffle down the front of the top: a wavy fold of light and shade either side of the placket.
    x, y = grid(a); wave = np.sin(y * 260) * .006; band = np.clip(1 - np.abs(x - .5 - wave) / .02, 0, 1) * box(a, .44, .45, .56, .8) * top
    a = a * (1 - band[..., None] * .35) + (a * (1 + np.sin(y * 520)[..., None] * .4)) * band[..., None] * .35
    jeans = garment(a, box(a, 0, .55, .28, 1) + box(a, .72, .55, 1, 1)); a = recolour(a, jeans, '#47699c', contrast=1.1)
    rng = np.random.default_rng(7); scuff = blur((rng.random(a.shape[:2]) > .985).astype(np.float32), 5) * 6
    scuff = np.clip(scuff, 0, 1) * (ellipse(a, .14, .8, .08, .04, .8) + ellipse(a, .86, .8, .08, .04, .8)) * jeans
    return a * (1 - scuff[..., None] * .8) + rgb('#dfe6ee')[None, None] * scuff[..., None] * .8
def head_rina(a):
    a = darken_hair(a, hair_mask(a, 'f005'), '#1a1210', curls=.5, seed=71)
    a = irises(a)
    cx, mouth = FACES['f005'][:2]; lips = ellipse(a, cx, mouth + .002, .05, .014, .5) * .5
    return a * (1 - lips[..., None]) + rgb('#a8505f')[None, None] * shading(a, lips)[..., None] * lips[..., None]

def body_abhinav(a):
    tee = garment(a, region(a, [TORSO, (0, .42, .31, .62), (.69, .42, 1, .62)]))
    a = recolour(a, tee, '#b4532c', contrast=.9, ignore=box(a, .43, .5, .58, .7))
    a = text_print(a, .5, .535, ['POWER UP', 'IN PROGRESS'], 34)
    # The base has long sleeves; below the elbow they become forearm so the shirt reads as a t-shirt.
    fore = garment(a, region(a, [(0, .62, .31, .83), (.69, .62, 1, .83)]))
    tone = a[int(.9 * a.shape[0]):int(.93 * a.shape[0]), int(.05 * a.shape[1]):int(.15 * a.shape[1])].reshape(-1, 3).mean(0)
    a = a * (1 - fore[..., None]) + tone[None, None] * shading(a, fore, soft=4)[..., None] ** .5 * fore[..., None]
    return recolour(a, garment(a, region(a, [(0, 0, .3, .44), (.7, 0, 1, .44)])), '#26365a', contrast=1.0)
def head_abhinav(a):
    # A generic young-teen face: no likeness, only dark short hair and a common skin tone.
    return irises(darken_hair(a, hair_mask(a, 'cm001'), '#151110'))

RECIPES = {
    'ranjan': (body_ranjan, head_ranjan), 'rina': (body_rina, head_rina), 'abhinav': (body_abhinav, head_abhinav),
    'aarush': (body_aarush, head_aarush), 'pavit': (body_pavit, head_pavit), 'anuj': (body_anuj, head_anuj),
    'harsh': (body_harsh, head_harsh), 'arham': (body_arham, head_arham),
}
CARDS = {'ranjan': '#141110', 'rina': '#1a1210', 'abhinav': '#151110', 'aarush': '#17110e', 'pavit': '#120d0b', 'harsh': '#141010', 'arham': '#16110e', 'anuj': '#1c1410'}

def apply(cid, kind, image):
    """kind: 'body' | 'head' | 'cards'. Returns the image unchanged for characters without a recipe."""
    if cid not in RECIPES: return image
    if kind == 'cards':
        rgba = image.convert('RGBA'); a = arr(rgba); m = np.ones(a.shape[:2], np.float32)
        out = img(darken_hair(a, m, CARDS[cid])).convert('RGBA'); out.putalpha(rgba.getchannel('A')); return out
    return img(RECIPES[cid][0 if kind == 'body' else 1](arr(image)))

if __name__ == '__main__':
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from skintone import warm
    tex, cid, code, out = sys.argv[1:5]; tone = float(sys.argv[5]) if len(sys.argv) > 5 else 0
    parts = []
    for kind in ('body', 'head'):
        im = Image.open(f'{tex}/{code}_{kind}_color.tga').convert('RGB')
        if tone: im, _ = warm(im, tone)
        parts.append(apply(cid, kind, im).resize((1024, 1024)))
    sheet = Image.new('RGB', (2048, 1024)); [sheet.paste(p, (i * 1024, 0)) for i, p in enumerate(parts)]; sheet.save(out, quality=88)
