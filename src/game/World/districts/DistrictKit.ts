import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StreetMaterials, Surface } from '../StreetMaterials';
import { plain, type V3, type UnitShape } from './ColorMesh';
import { seededRandom } from '../StreetArchitecture';

const unit: Record<UnitShape | 'plane', THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rounded: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylinderLow: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 10, 7),
  cone: new THREE.ConeGeometry(1, 1, 8),
  dome: new THREE.SphereGeometry(1, 28, 14),
  plane: new THREE.PlaneGeometry(1, 1),
};
/** Texture tile size in metres per surface; UVs are generated in world metres, not per box. */
const TILE: Partial<Record<Surface, number>> = { plaster: 2.6, stone: 1.8, paving: 2.2, asphalt: 7, wood: 1.2, fabric: 1.1 };

/**
 * Static district architecture. Every primitive is merged into one mesh per surface family
 * (≈ ten draws for a whole district) on clones of the street's own materials, so the
 * districts share the street's verified surface textures and its weathering/haze patch.
 */
export class DistrictKit {
  readonly group = new THREE.Group();
  readonly colliders: THREE.BufferGeometry[] = [];
  private parts = new Map<Surface, THREE.BufferGeometry[]>();
  private matrix = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];
  private random: () => number;
  constructor(readonly origin: THREE.Vector3, private physics: CANNON.World, private surfaces: StreetMaterials, seed: string) {
    this.group.position.copy(origin); this.random = seededRandom(`district:${seed}`);
  }
  /** The current local frame (district space), for placing signs on a building. */
  get here() { return this.matrix.clone(); }
  rand() { return this.random(); }
  /** Run `build` inside a local frame (a building, a stall). Frames nest. */
  frame(position: V3, rotationY: number, build: () => void) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1));
    this.stack.push(this.matrix.clone()); this.matrix.multiply(local); build(); this.matrix.copy(this.stack.pop()!);
  }
  add(source: THREE.BufferGeometry, color: string, surface: Surface, position: V3, scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0], jitter = .05) {
    const g = plain(source);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, m));
    // Small per-part value shifts keep repeated modules from reading as one flat paint.
    const c = new THREE.Color(color).multiplyScalar(1 - jitter + this.random() * jitter * 2), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const list = this.parts.get(surface) ?? []; list.push(g); this.parts.set(surface, list); return g;
  }
  shape(kind: UnitShape | 'plane', size: V3, position: V3, color: string, surface: Surface = 'solid', rotation: V3 = [0, 0, 0]) { return this.add(unit[kind], color, surface, position, size, rotation); }
  box(size: V3, position: V3, color: string, surface: Surface = 'solid', rotationY = 0) { return this.shape('box', size, position, color, surface, [0, rotationY, 0]); }
  cylinder(radius: number, height: number, position: V3, color: string, surface: Surface = 'solid', low = false) { return this.shape(low ? 'cylinderLow' : 'cylinder', [radius, height, radius], position, color, surface); }
  rod(a: V3, b: V3, radius: number, color: string, surface: Surface = 'metal') {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    return this.add(unit.cylinderLow, color, surface, va.clone().add(vb).multiplyScalar(.5).toArray() as V3, [radius, va.distanceTo(vb), radius], [e.x, e.y, e.z], 0);
  }
  /** Physics + line-of-sight collider for an axis box in the current frame. */
  solid(size: V3, position: V3, rotationY = 0) {
    const m = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, this.origin.z), this.matrix)
      .multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1)));
    const p = new THREE.Vector3(), q = new THREE.Quaternion(); m.decompose(p, q, new THREE.Vector3());
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), position: new CANNON.Vec3(p.x, p.y, p.z) });
    body.quaternion.set(q.x, q.y, q.z, q.w); this.physics.addBody(body); this.bodies.push(body);
    this.colliders.push(new THREE.BoxGeometry(...size).applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1))));
  }
  /** A visible box that is also solid. */
  wall(size: V3, position: V3, color: string, surface: Surface = 'plaster', rotationY = 0) { this.box(size, position, color, surface, rotationY); this.solid(size, position, rotationY); }
  readonly bodies: CANNON.Body[] = [];
  /** Merge everything into one mesh per surface. Returns the number of meshes created. */
  build() {
    let meshes = 0;
    for (const [surface, list] of this.parts) {
      if (!list.length) continue;
      const g = mergeGeometries(list)!; list.forEach(p => p.dispose());
      worldUv(g, surface, this.origin, this.surfaces);
      const base = this.surfaces.get('#ffffff', surface);
      const material = base.clone() as THREE.MeshStandardMaterial;
      material.vertexColors = true; if ((material as THREE.MeshStandardMaterial).color) material.color.set('#ffffff');
      material.userData = { ...base.userData, district: true };
      const mesh = new THREE.Mesh(g, material); mesh.name = `district:${surface}`;
      mesh.castShadow = surface !== 'glow' && surface !== 'glass'; mesh.receiveShadow = surface !== 'glow';
      this.group.add(mesh); meshes++;
    }
    this.parts.clear(); return meshes;
  }
}

/** Planar UVs in metres chosen by the dominant normal axis, divided by the map's repeat. */
function worldUv(g: THREE.BufferGeometry, surface: Surface, origin: THREE.Vector3, surfaces: StreetMaterials) {
  const tile = TILE[surface] ?? 2, p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = new Float32Array(p.count * 2);
  const map = (surfaces.get('#ffffff', surface) as THREE.MeshStandardMaterial).map, rx = map?.repeat.x || 1, ry = map?.repeat.y || 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + origin.x, y = p.getY(i), z = p.getZ(i) + origin.z, ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u / tile / rx; uv[i * 2 + 1] = v / tile / ry;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
