import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DistrictKit } from './DistrictKit';
import type { V3 } from './ColorMesh';

/**
 * Natural shapes for the districts, built as vertex-coloured geometry on the kit's merged
 * surfaces (no new textures or shaders): clumped tree crowns, feathered palm fronds,
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

const clumps = new Map<number, THREE.BufferGeometry>();
/** A lumpy leaf clump: an icosphere pushed in and out by noise, flattened underneath. */
function clump(variant: number) {
  let g = clumps.get(variant);
  if (!g) {
    g = mergeVertices(new THREE.IcosahedronGeometry(1, 1)); const p = g.getAttribute('position'), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const k = .78 + .44 * fbm(v.x * 2.1 + variant * 7.3, v.z * 2.1 + v.y * 1.7, 3);
      v.multiplyScalar(k); if (v.y < -.25) v.y = -.25 + (v.y + .25) * .35; p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); clumps.set(variant, g);
  }
  return g;
}
/**
 * A broad Mumbai street tree (rain tree, gulmohar): a forked trunk under an umbrella of
 * lumpy leaf clumps, lit from above and shaded underneath in the vertex colours.
 */
export function canopyTree(kit: DistrictKit, x: number, z: number, h = 6, crown = '#5d7f43', size = 1) {
  const trunk = '#5c4a38', top = h * .7, R = 2.3 * size;
  kit.rod([x, 0, z], [x + .15 * size, top * .62, z], .2 * size, trunk, 'wood');
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + kit.rand(), reach = (.6 + kit.rand() * .5) * size; kit.rod([x + .15 * size, top * .6, z], [x + Math.cos(a) * reach, top + .7 * size, z + Math.sin(a) * reach], .1 * size, trunk, 'wood'); }
  kit.solid([.45, 2, .45], [x, 1, z]);
  // Clumps sit on a dome so the crown reads as a rounded mass, darker and tucked in underneath.
  const base = colorOf(crown), count = 13;
  for (let i = 0; i < count; i++) {
    const a = i * 2.399 + kit.rand() * .4, phi = i === 0 ? 0 : Math.acos(1 - (i / count) * 1.35), d = Math.sin(phi) * R, r = (1.05 + kit.rand() * .5) * size;
    const cy = top + 1.1 * size + Math.cos(phi) * R * .55, tint = (.82 + kit.rand() * .3) * (1 - .18 * (1 - Math.cos(phi)));
    const g = painted(clump(i % 5).clone(), (p, n) => base.clone().multiplyScalar(tint * (.5 + .55 * Math.max(0, n.y) + .1 * p.y) * (.85 + .3 * fbm(p.x * 3, p.z * 3, 2))));
    kit.addColored(g, 'foliage', [x + Math.cos(a) * d, cy, z + Math.sin(a) * d], [r * 1.1, r * .92, r * 1.1], [0, a, 0]); g.dispose();
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
