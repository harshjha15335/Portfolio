import * as THREE from 'three';
import type { DistrictKit } from './DistrictKit';
import type { V3 } from './ColorMesh';

/**
 * Natural shapes for the districts, built as vertex-coloured geometry on the kit's merged
 * surfaces (no new textures or shaders): branching trees with leaf sprays, feathered palm fronds,
 * noise-shaped hills and worn maidan ground with grass patches.
 */
function hash(x: number, y: number) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** Fractal noise in [0, 1]. */
export function fbm(x: number, y: number, octaves = 4) { let v = 0, a = .5, f = 1, t = 0; for (let i = 0; i < octaves; i++) { v += a * noise(x * f, y * f); t += a; a *= .5; f *= 2.03; } return v / t; }
const colorOf = (hex: string) => new THREE.Color(hex);
function painted(g: THREE.BufferGeometry, paint: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), colors = new Float32Array(p.count * 3), v = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); m.fromBufferAttribute(n, i); paint(v, m).toArray(colors, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return g;
}

const sprays = new Map<string, THREE.BufferGeometry>();
/**
 * A leaf spray: a short twig carrying `leaves` leaf blades (each a pointed four-triangle leaf with a raised midrib),
 * alternating left and right and fanning outwards, vertex-coloured lighter at the tips. About a metre long. `broad`
 * leaves (Indian almond) are wide and few; narrow ones (rain tree leaflets) are many and small.
 */
function leafSpray(kind: 'broad' | 'fine', variant: number) {
  const key = `${kind}:${variant}`; let g = sprays.get(key);
  if (g) return g;
  const pos: number[] = [], col: number[] = [], index: number[] = [], dark = colorOf(kind === 'broad' ? '#3f6a2c' : '#4d7434'), light = colorOf(kind === 'broad' ? '#7fa04a' : '#8bab55');
  const leaves = kind === 'broad' ? 7 : 12, length = kind === 'broad' ? .34 : .22, width = kind === 'broad' ? .15 : .065;
  let seed = variant * 9.17 + (kind === 'broad' ? 3 : 0); const rand = () => { seed += 1; return hash(seed, seed * .37); };
  for (let i = 0; i < leaves; i++) {
    const t = (i + .5) / leaves, side = i % 2 ? 1 : -1, along = t * .9, yaw = side * (.7 + rand() * .5) - (t - .5) * .3, droop = -.25 - rand() * .35, l = length * (.75 + rand() * .45), w = width * (.8 + rand() * .4);
    const dir = new THREE.Vector3(Math.sin(yaw), Math.sin(droop), Math.cos(yaw)).normalize(), across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(w / 2);
    const base = new THREE.Vector3(0, -t * .12, along), tip = base.clone().addScaledVector(dir, l), mid = base.clone().addScaledVector(dir, l * .45);
    const n = pos.length / 3, shade = dark.clone().lerp(light, .3 + t * .5 + rand() * .2);
    for (const [v, c] of [[base, dark], [mid.clone().add(across), shade], [tip, light], [mid.clone().sub(across), shade], [mid.clone().add(new THREE.Vector3(0, w * .12, 0)), shade]] as const) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    index.push(n, n + 1, n + 4, n + 1, n + 2, n + 4, n + 2, n + 3, n + 4, n + 3, n, n + 4);
  }
  // The twig: a thin flat strip under the leaves.
  const n = pos.length / 3, bark = colorOf('#5b4a36');
  for (const [x, y, z] of [[-.008, 0, 0], [.008, 0, 0], [.004, -.12, .95], [-.004, -.12, .95]]) { pos.push(x, y, z); col.push(bark.r, bark.g, bark.b); }
  index.push(n, n + 1, n + 2, n, n + 2, n + 3);
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(index); g.computeVertexNormals();
  sprays.set(key, g); return g;
}
export type TreeSpecies = 'raintree' | 'almond';
/**
 * A broad Mumbai street tree with a real branch structure: a trunk that forks into spreading limbs, each splitting
 * into smaller branches, and leaf sprays clustered round every branch tip (no blob crowns). The rain tree (Shivaji
 * Park, Dadar) spreads into a wide umbrella of fine leaflets; the Indian almond (Juhu) grows tiers of near-horizontal
 * branches with large broad leaves. `crown` tints the foliage; `size` scales the whole tree.
 */
export function canopyTree(kit: DistrictKit, x: number, z: number, h = 6, crown = '#5d7f43', size = 1, species: TreeSpecies = 'raintree') {
  const trunk = '#5c4a38', bark = '#6b5845', s = size, ref = colorOf('#5d7f43'), c = colorOf(crown), tint = new THREE.Color(c.r / ref.r, c.g / ref.g, c.b / ref.b);
  const almond = species === 'almond', fork = (almond ? .38 : .34) * h * s;
  const top: V3 = [x + .12 * s, fork, z + .05 * s];
  kit.rod([x, 0, z], top, (almond ? .17 : .24) * s, trunk, 'wood');
  kit.rod([x, 0, z], [x, .5 * s, z], (almond ? .24 : .34) * s, trunk, 'wood');
  kit.solid([.45 * s, 2, .45 * s], [x, 1, z]);
  const tips: Array<{ p: V3; a: number }> = [];
  const limb = (from: V3, a: number, rise: number, length: number, radius: number, depth: number) => {
    const to: V3 = [from[0] + Math.cos(a) * length * Math.cos(rise), from[1] + Math.sin(rise) * length, from[2] + Math.sin(a) * length * Math.cos(rise)];
    kit.rod(from, to, radius, depth ? bark : trunk, 'wood');
    if (depth >= 2) { tips.push({ p: to, a }); return; }
    const forks = depth === 0 ? 3 : 2;
    for (let i = 0; i < forks; i++) limb(to, a + (i - (forks - 1) / 2) * (almond ? .7 : .55) + (kit.rand() - .5) * .3, almond ? .05 + kit.rand() * .15 : rise * .6 + .1 + kit.rand() * .2, length * (.62 + kit.rand() * .15), radius * .6, depth + 1);
  };
  if (almond) {
    // Pagoda tiers: whorls of four or five near-horizontal limbs up the leader.
    const tiers = 3, leaderTop: V3 = [top[0], h * .92 * s, top[2]]; kit.rod(top, leaderTop, .1 * s, trunk, 'wood');
    for (let t = 0; t < tiers; t++) { const y = fork + (leaderTop[1] - fork) * t / tiers, count = 5 - (t > 1 ? 1 : 0), reach = (1.9 - t * .45) * s; for (let i = 0; i < count; i++) limb([top[0], y, top[2]], i / count * Math.PI * 2 + t * .6 + kit.rand() * .3, .06 + kit.rand() * .08, reach * .55, (.09 - t * .02) * s, 1); }
    tips.push({ p: leaderTop, a: kit.rand() * 6 });
  } else {
    for (let i = 0; i < 5; i++) limb(top, i / 5 * Math.PI * 2 + kit.rand() * .5, .42 + kit.rand() * .25, (1.35 + kit.rand() * .4) * s, .14 * s, 0);
  }
  // Leaf sprays round each tip, pointing outwards and fanning up and down, a little darker inside the crown.
  for (const [k, tip] of tips.entries()) {
    const sprays = almond ? 5 : 6;
    for (let i = 0; i < sprays; i++) {
      const g = leafSpray(almond ? 'broad' : 'fine', (k * 7 + i) % 6).clone(), yaw = tip.a + (i / sprays - .5) * 2.4 + (kit.rand() - .5) * .4, pitch = (kit.rand() - .35) * .9, inner = .82 + .25 * (i % 3) / 2;
      const c = g.getAttribute('color'); for (let v = 0; v < c.count; v++) c.setXYZ(v, c.getX(v) * tint.r * inner, c.getY(v) * tint.g * inner, c.getZ(v) * tint.b * inner);
      const scale = (almond ? 1.35 : 1.22) * s * (.85 + kit.rand() * .35);
      kit.addColored(g, 'foliage', [tip.p[0] + (kit.rand() - .5) * .3 * s, tip.p[1] + (kit.rand() - .3) * .35 * s, tip.p[2] + (kit.rand() - .5) * .3 * s], [scale, scale, scale], [pitch, Math.PI / 2 - yaw, 0]); g.dispose();
    }
  }
}

/** One feathered frond: a V-folded midrib strip whose edges alternate long and short leaflets. */
function frond(length: number, droop: number, steps: number) {
  const pos: number[] = [], col: number[] = [], index: number[] = [], green = colorOf('#5f8a3a'), dry = colorOf('#8a8a45');
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, z = t * length, y = droop * (t * .6 - t * t * 1.4), w = (.08 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * .5) * (i % 2 ? .55 : 1);
    const c = green.clone().lerp(dry, t * .5).multiplyScalar(.85 + (i % 3) * .07);
    for (const [x, dy] of [[-w, -w * .45], [0, .02], [w, -w * .45]]) { pos.push(x, y + dy, z); col.push(c.r, c.g, c.b); }
    if (i < steps) { const k = i * 3; index.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(index); g.computeVertexNormals();
  return g;
}
/** A coconut palm: a curving ringed trunk and a crown of drooping feathered fronds with a few coconuts. */
export function coconutPalm(kit: DistrictKit, x: number, z: number, h = 7.5, lean = .3) {
  let p: V3 = [x, 0, z];
  for (let i = 1; i <= 7; i++) { const q: V3 = [x + Math.sin(i / 7 * 1.4) * lean * h * .3, i / 7 * h, z]; kit.rod(p, q, .17 - i * .011, i % 2 ? '#7d6a52' : '#736049', 'wood'); p = q; }
  kit.solid([.4, 2, .4], [x, 1, z]);
  for (let a = 0; a < 13; a++) {
    const ang = a / 13 * Math.PI * 2 + kit.rand() * .3, tilt = -.35 + (a % 3) * .25, g = frond(2.6 + kit.rand() * .8, 1.6 + kit.rand() * .6, 12);
    g.rotateX(tilt); g.rotateY(Math.PI / 2 - ang); kit.addColored(g, 'foliage', [p[0], p[1] + .05, p[2]]); g.dispose();
  }
  for (let i = 0; i < 4; i++) { const a = i * 1.6; kit.shape('sphere', [.13, .15, .13], [p[0] + Math.cos(a) * .2, p[1] - .2, p[2] + Math.sin(a) * .2], '#6b5a2c', 'wood'); }
}

/**
 * A wooded hill: a disc of terrain raised by fractal noise into ridges and saddles, coloured
 * green on its scrubby slopes, brown on the cuts and grey on the steepest rock.
 */
export function hill(kit: DistrictKit, center: V3, rx: number, rz: number, height: number, seed = 0, rings = 14, spokes = 40) {
  const pos: number[] = [], index: number[] = [];
  for (let r = 0; r <= rings; r++) for (let s = 0; s < spokes; s++) {
    const t = r / rings, a = s / spokes * Math.PI * 2, x = Math.cos(a) * t * rx, z = Math.sin(a) * t * rz;
    const n = fbm(x * .035 + seed, z * .035 - seed, 5), ridge = 1 - Math.abs(fbm(x * .07 - seed, z * .07 + seed, 3) * 2 - 1), dome = Math.cos(t * Math.PI / 2) ** 1.4;
    const y = height * dome * (.35 + 1.1 * n + .35 * ridge) + (fbm(x * .4, z * .4, 2) - .5) * 1.2 * dome - (t > .97 ? 2 : 0);
    pos.push(x, y, z);
    if (r < rings) { const k = r * spokes + s, l = r * spokes + (s + 1) % spokes; index.push(k, l, k + spokes, l, l + spokes, k + spokes); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals();
  const scrub = colorOf('#4f6a3f'), dark = colorOf('#3b5232'), earth = colorOf('#7d6a4c'), rock = colorOf('#77746a');
  painted(g, (p, n) => {
    const k = fbm(p.x * .12 + seed, p.z * .12, 3), steep = 1 - n.y, speck = fbm(p.x * .9, p.z * .9, 2);
    return scrub.clone().lerp(dark, k).multiplyScalar(.8 + speck * .4).lerp(earth, THREE.MathUtils.smoothstep(steep, .35, .6) * .7).lerp(rock, THREE.MathUtils.smoothstep(steep, .55, .8) * .8);
  });
  kit.addColored(g, 'solid', center); g.dispose();
}

/**
 * Worn maidan ground: red-brown dust where feet and bats have worn it, patchy dry and green
 * grass towards the edges, and a pale rolled pitch strip, as one gently uneven grid.
 */
export function maidan(kit: DistrictKit, center: V3, w: number, d: number, pitch?: { x: number; z: number; w: number; d: number }) {
  const g = new THREE.PlaneGeometry(w, d, Math.ceil(w / .75), Math.ceil(d / .75)); g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, (fbm(p.getX(i) * .3, p.getZ(i) * .3, 2) - .5) * .05);
  g.computeVertexNormals();
  const dust = colorOf('#86684a'), red = colorOf('#76503a'), dry = colorOf('#7a7444'), grass = colorOf('#4c6832'), rolled = colorOf('#b39d76');
  painted(g, v => {
    const edge = Math.min(w / 2 - Math.abs(v.x), d / 2 - Math.abs(v.z)), patch = fbm(v.x * .22 + 3, v.z * .22, 4), fine = fbm(v.x * 1.7, v.z * 1.7, 2);
    let c = dust.clone().lerp(red, fbm(v.x * .08, v.z * .08, 3) * .8);
    const greenness = THREE.MathUtils.smoothstep(patch + THREE.MathUtils.clamp(1.6 - edge * .35, 0, .6) * .5, .4, .56);
    c = c.lerp(dry.clone().lerp(grass, THREE.MathUtils.smoothstep(fine, .35, .65)), greenness);
    // Worn paths cut across the grass where people walk to the pitch.
    const path = Math.abs(v.z - v.x * .55 - 2 + (fbm(v.x * .2, 9, 2) - .5) * 3);
    if (path < .9) c.lerp(dust, (1 - path / .9) * .75);
    if (pitch && Math.abs(v.x - pitch.x) < pitch.w / 2 && Math.abs(v.z - pitch.z) < pitch.d / 2) c = rolled.clone().multiplyScalar(.92 + fine * .12);
    return c.multiplyScalar(.7 + fine * .35);
  });
  kit.addColored(g, 'solid', center); g.dispose();
}
