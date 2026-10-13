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
};
export type UnitShape = keyof typeof unit;

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
  colored(source: THREE.BufferGeometry, position: V3) {
    const g = plain(source); g.setAttribute('color', source.getAttribute('color').clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, new THREE.Matrix4().makeTranslation(...position))); this.parts.push(g);
  }
  shape(kind: UnitShape, size: V3, position: V3, color: string | THREE.Color, rotation: V3 = [0, 0, 0]) { return this.add(unit[kind], color, position, size, rotation); }
  box(size: V3, position: V3, color: string | THREE.Color, rotation: V3 = [0, 0, 0]) { return this.shape('box', size, position, color, rotation); }
  rounded(size: V3, position: V3, color: string | THREE.Color, rotation: V3 = [0, 0, 0]) { return this.shape('rounded', size, position, color, rotation); }
  /** A wheel or drum lying across X. */
  wheel(radius: number, width: number, position: V3, color = '#1d2021', hub = '#8b8d86') {
    this.shape('cylinder', [radius, width, radius], position, color, [0, 0, Math.PI / 2]);
    this.shape('cylinderLow', [radius * .48, width * 1.06, radius * .48], position, hub, [0, 0, Math.PI / 2]);
  }
  /** A thin rod between two points. */
  rod(a: V3, b: V3, radius: number, color: string) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), mid = va.clone().add(vb).multiplyScalar(.5), length = va.distanceTo(vb);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()), e = new THREE.Euler().setFromQuaternion(q);
    return this.add(unit.cylinderLow, color, mid.toArray() as V3, [radius, length, radius], [e.x, e.y, e.z]);
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
