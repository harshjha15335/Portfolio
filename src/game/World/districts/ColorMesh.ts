import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];

const unit = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rounded: new RoundedBoxGeometry(1, 1, 1, 2, .12),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  cylinderLow: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 10, 7),
  cone: new THREE.ConeGeometry(1, 1, 8),
  dome: new THREE.SphereGeometry(1, 28, 14),
  tyre: new THREE.CylinderGeometry(1, 1, 1, 20),
  rim: new THREE.CylinderGeometry(1, 1, 1, 14),
};
/** Cheaper stand-ins for the distant version of a vehicle or prop. */
const liteUnit: Record<UnitShape, THREE.BufferGeometry> = { ...unit, rounded: new RoundedBoxGeometry(1, 1, 1, 1, .1), cylinder: unit.cylinderLow, tyre: new THREE.CylinderGeometry(1, 1, 1, 12), rim: new THREE.CylinderGeometry(1, 1, 1, 9), sphere: new THREE.SphereGeometry(1, 6, 4), cone: new THREE.ConeGeometry(1, 1, 5) };
export type UnitShape = keyof typeof unit;
const tapers = new Map<string, THREE.BufferGeometry>();
const lathes = new Map<string, THREE.BufferGeometry>();
/** Unit tyre and rim profiles turned about Y (radius 1, width 1). */
function lathe(segments: number, kind: 'tyre' | 'rim') {
  const key = `${kind}:${segments}`; let g = lathes.get(key);
  if (!g) {
    const v = (x: number, y: number) => new THREE.Vector2(x, y);
    const profile = kind === 'tyre'
      ? [v(.62, -.5), v(.9, -.5), v(.98, -.42), v(1, -.25), v(1, .25), v(.98, .42), v(.9, .5), v(.62, .5)]
      : [v(0, -.42), v(.5, -.44), v(.64, -.38), v(.66, 0), v(.64, .38), v(.5, .44), v(0, .42)];
    g = new THREE.LatheGeometry(profile, segments); lathes.set(key, g);
  }
  return g;
}

/** Strip a geometry down to indexed position + normal so different sources merge. */
export function plain(geometry: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geometry.getAttribute('position').clone());
  const normal = geometry.getAttribute('normal');
  if (normal) g.setAttribute('normal', normal.clone());
  if (geometry.index) g.setIndex(geometry.index.clone());
  else g.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
  if (!normal) g.computeVertexNormals();
  return g;
}

/**
 * Collects many coloured primitives into ONE indexed geometry with per-vertex colour,
 * so a whole vehicle, cart or crowd prop is a single draw on a shared material.
 */
export class ColorMesh {
  /** `lite` builds the far version: low-segment shapes, no fine parts, no baked occupants. */
  constructor(readonly lite = false) {}
  private parts: THREE.BufferGeometry[] = [];
  private matrix = new THREE.Matrix4();
  private frames: THREE.Matrix4[] = [];
  /** Nest a local frame (e.g. a building or a vehicle body) for subsequent parts. */
  frame(position: V3, rotationY = 0, run: () => void) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)), new THREE.Vector3(1, 1, 1));
    this.frames.push(this.matrix.clone()); this.matrix.multiply(local); run(); this.matrix.copy(this.frames.pop()!);
  }
  add(source: THREE.BufferGeometry, color: string | THREE.Color, position: V3, scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0]) {
    const g = plain(source);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, m));
    const c = color instanceof THREE.Color ? color : new THREE.Color(color), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); this.parts.push(g); return g;
  }
  /** Merge a geometry that already carries vertex colours (e.g. a baked seated driver). */
  /** Add a whole modelled vehicle (position, normal, colour), at every level of detail. Takes ownership of it. */
  model(geometry: THREE.BufferGeometry) {
    geometry.applyMatrix4(this.matrix); this.parts.push(geometry);
  }
  colored(source: THREE.BufferGeometry, position: V3) {
    if (this.lite) return;
    const g = plain(source); g.setAttribute('color', source.getAttribute('color').clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, new THREE.Matrix4().makeTranslation(...position))); this.parts.push(g);
  }
  shape(kind: UnitShape, size: V3, position: V3, color: string | THREE.Color, rotation: V3 = [0, 0, 0]) {
    if (this.lite && Math.max(...size) < .13) return null;
    // Small rounded parts (lamps, mirrors, seats) keep one bevel segment; it reads the same at a fraction of the cost.
    const cheap = this.lite || kind === 'rounded' && Math.max(...size) < .7;
    return this.add((cheap ? liteUnit : unit)[kind], color, position, size, rotation);
  }
  box(size: V3, position: V3, color: string | THREE.Color, rotation: V3 = [0, 0, 0]) { return this.shape('box', size, position, color, rotation); }
  rounded(size: V3, position: V3, color: string | THREE.Color, rotation: V3 = [0, 0, 0]) { return this.shape('rounded', size, position, color, rotation); }
  /** A wheel lying across X: a rounded tyre, a dished rim with spokes and a hub cap. */
  wheel(radius: number, width: number, position: V3, color = '#1d2021', hub = '#8b8d86') {
    const turn: V3 = [0, 0, Math.PI / 2];
    // Far away a wheel is just a tyre drum and a rim disc.
    if (this.lite) { this.shape('tyre', [radius, width, radius], position, color, turn); this.shape('rim', [radius * .64, width * 1.06, radius * .64], position, hub, turn); return; }
    this.add(lathe(18, 'tyre'), color, position, [radius, width, radius], turn);
    this.add(lathe(12, 'rim'), hub, position, [radius, width, radius], turn);
    this.shape('cylinder', [radius * .16, width * 1.02, radius * .16], position, '#c9cbc6', turn);
    // Five spokes stand proud of the dish on both faces.
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, y = Math.cos(a) * radius * .33, z = Math.sin(a) * radius * .33;
      this.box([width * .98, radius * .09, radius * .42], [position[0], position[1] + y, position[2] + z], hub, [a - Math.PI / 2, 0, 0]);
    }
  }
  /**
   * A smooth surface through rings of points (each ring a closed loop), e.g. a car body lofted
   * through its cross-sections. `cap` closes the first and last ring with a fan; an open
   * (`closed` false) ring makes a strip, such as a roof skin.
   */
  loft(rings: THREE.Vector3[][], color: string | THREE.Color, cap = true, closed = true) {
    const n = rings[0].length, position: number[] = [], index: number[] = [];
    for (const ring of rings) for (const p of ring) position.push(p.x, p.y, p.z);
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = r * n + i, b = r * n + (i + 1) % n, c = a + n, d = b + n; index.push(a, b, c, b, d, c);
    }
    if (cap) for (const [r, flip] of [[0, true], [rings.length - 1, false]] as const) {
      const centre = rings[r].reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(n), k = position.length / 3; position.push(centre.x, centre.y, centre.z);
      for (let i = 0; i < n; i++) { const a = r * n + i, b = r * n + (i + 1) % n; index.push(...(flip ? [k, b, a] : [k, a, b])); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setIndex(index); g.computeVertexNormals();
    this.add(g, color, [0, 0, 0]); g.dispose();
  }
  /** A thin rod between two points. */
  rod(a: V3, b: V3, radius: number, color: string) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), mid = va.clone().add(vb).multiplyScalar(.5), length = va.distanceTo(vb);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()), e = new THREE.Euler().setFromQuaternion(q);
    if (this.lite && radius < .03) return null;
    return this.add(unit.cylinderLow, color, mid.toArray() as V3, [radius, length, radius], [e.x, e.y, e.z]);
  }
  /**
   * A box whose top face is narrowed and shifted (a car's glasshouse, a roof, a hood wedge).
   * topX/topZ scale the top face; shiftZ moves it along Z, both in unit-box terms.
   */
  taper(size: V3, position: V3, color: string | THREE.Color, topX: number, topZ: number, shiftZ = 0) {
    const key = `${topX},${topZ},${shiftZ}`; let g = tapers.get(key);
    if (!g) {
      g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * topX, p.getY(i), p.getZ(i) * topZ + shiftZ);
      g.computeVertexNormals(); tapers.set(key, g);
    }
    return this.add(g, color, position, size);
  }
  get empty() { return this.parts.length === 0; }
  build() {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const g = mergeGeometries(this.parts)!; this.parts.forEach(p => p.dispose()); this.parts = []; g.computeBoundingSphere(); return g;
  }
}

let shared: THREE.MeshStandardMaterial | null = null;
/** One vertex-coloured paint material for every authored vehicle and prop in the districts. */
export function paintMaterial() {
  shared ??= Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .12, envMapIntensity: .3 }), { userData: { surface: 'solid', weather: .15 } });
  return shared;
}
