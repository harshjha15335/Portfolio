import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StreetMaterials, Surface } from '../StreetMaterials';
import { plain, type V3, type UnitShape } from './ColorMesh';
import { seededRandom } from '../StreetArchitecture';
import { FACADE_PLAIN_V, FACADE_TILE, facadeNightTexture, facadeTexture } from './FacadeTexture';
import { lightPoolMesh, nightEmissive, POOL_COLOR } from '../time/nightLights';

/** Street surfaces plus 'facade': painted apartment walls with windows (see FacadeTexture). */
/** Kit surfaces: the street's, plus the façade atlas and 'pool', the ground decal of light under a lamp (see nightLights). */
export type KitSurface = Surface | 'facade' | 'pool';
/** Surfaces whose walls are subdivided and aged: baked contact shadow and grime need vertices to live on. */
const AGED = new Set<KitSurface>(['plaster', 'stone', 'facade']);
/** Surfaces underfoot or overhead that never block the visitor. */
const WALK_THROUGH = new Set<KitSurface>(['paving', 'asphalt', 'glow', 'pool']);
const SOLID_KINDS = new Set<string>(['box', 'rounded', 'cylinder', 'cylinderLow']);
const boxes = new Map<string, THREE.BufferGeometry>();
function segmentedBox(sx: number, sy: number, sz: number) {
  const key = `${sx},${sy},${sz}`; let g = boxes.get(key);
  if (!g) { g = new THREE.BoxGeometry(1, 1, 1, sx, sy, sz); boxes.set(key, g); }
  return g;
}
const segments = (metres: number) => Math.max(1, Math.min(8, Math.ceil(metres / 3.5)));

const unit: Record<UnitShape | 'plane', THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rounded: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylinderLow: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 10, 7),
  cone: new THREE.ConeGeometry(1, 1, 8),
  dome: new THREE.SphereGeometry(1, 28, 14),
  plane: new THREE.PlaneGeometry(1, 1),
  tyre: new THREE.CylinderGeometry(1, 1, 1, 16),
  rim: new THREE.CylinderGeometry(1, 1, 1, 12),
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
  private parts = new Map<KitSurface, THREE.BufferGeometry[]>();
  private matrix = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];
  private random: () => number;
  /**
   * `pattern` is where texture tiling and baked grime are measured from (default `origin`). An avenue is built
   * twice, once in each district it joins; giving both the same pattern frame makes the two copies identical.
   */
  constructor(readonly origin: THREE.Vector3, private physics: CANNON.World, private surfaces: StreetMaterials, seed: string, private pattern = origin) {
    this.group.position.copy(origin); this.random = seededRandom(`district:${seed}`);
  }
  /** The current local frame (district space), for placing signs on a building. */
  get here() { return this.matrix.clone(); }
  /** Walk-in rooms in the district frame (for indoor sound); see `markRoom`. */
  readonly rooms: THREE.Box3[] = [];
  /** Record a room's interior (local min/max in the current frame) as a district-frame box. */
  markRoom(min: V3, max: V3) { if (this.muted) return; this.rooms.push(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)).applyMatrix4(this.matrix)); }
  rand() { return this.random(); }
  /** While set, parts, solids and signs are worked out (drawing the same random numbers) but not kept. */
  muted = false;
  /** Run `build` with `matrix` as the current frame (a frame captured earlier with `here`). */
  within(matrix: THREE.Matrix4, build: () => void) { this.stack.push(this.matrix.clone()); this.matrix.copy(matrix); build(); this.matrix.copy(this.stack.pop()!); }
  /** Run `build` inside a local frame (a building, a stall). Frames nest. */
  frame(position: V3, rotationY: number, build: () => void) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1));
    this.stack.push(this.matrix.clone()); this.matrix.multiply(local); build(); this.matrix.copy(this.stack.pop()!);
  }
  /** `frame` for a builder that yields between pieces (a time-sliced build). */
  *frameSteps(position: V3, rotationY: number, build: () => Generator<void>): Generator<void> {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1));
    this.stack.push(this.matrix.clone()); this.matrix.multiply(local);
    try { yield* build(); } finally { this.matrix.copy(this.stack.pop()!); }
  }
  add(source: THREE.BufferGeometry, color: string, surface: KitSurface, position: V3, scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0], jitter = .05) {
    const g = plain(source);
    if (surface === 'facade') facadeUv(g, position, scale);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, m));
    // Small per-part value shifts keep repeated modules from reading as one flat paint.
    const c = new THREE.Color(color).multiplyScalar(1 - jitter + this.random() * jitter * 2), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (this.muted) return g;
    const list = this.parts.get(surface) ?? []; list.push(g); this.parts.set(surface, list); return g;
  }
  /** Merge a geometry that carries its own vertex colours (trees, terrain) in the current frame. */
  addColored(source: THREE.BufferGeometry, surface: KitSurface, position: V3, scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0]) {
    const g = plain(source); g.setAttribute('color', source.getAttribute('color').clone());
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, m));
    if (this.muted) return g;
    const list = this.parts.get(surface) ?? []; list.push(g); this.parts.set(surface, list); return g;
  }
  shape(kind: UnitShape | 'plane', size: V3, position: V3, color: string, surface: KitSurface = 'solid', rotation: V3 = [0, 0, 0]) {
    const source = kind === 'box' && AGED.has(surface) && Math.max(...size) > 3.5 ? segmentedBox(segments(size[0]), segments(size[1]), segments(size[2])) : unit[kind];
    const g = this.add(source, color, surface, position, size, rotation);
    if (SOLID_KINDS.has(kind) && !WALK_THROUGH.has(surface) && !this.muted) this.consider(g, kind === 'box' || kind === 'rounded' ? 1 : 4, size);
    return g;
  }
  /**
   * Ground-level parts the builders drew without a collider (stalls, kiosks, plinths, hedges, counters):
   * an upright, axis-aligned box or cylinder spanning knee to head height becomes solid at build time.
   */
  private consider(g: THREE.BufferGeometry, fill: number, size: V3) {
    // `fill`: how much bigger than size³ the unit shape's bounds are (a radius-1 cylinder spans 2 × 2).
    g.computeBoundingBox(); const b = g.boundingBox!;
    if (b.min.y > 1.5 || b.max.y < .35 || b.max.y - b.min.y < .3) return;
    // Only parts whose bounds are their own footprint (turned in quarter turns): a leaning rod's bounds are mostly air.
    const volume = (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z), own = Math.abs(size[0] * size[1] * size[2]) * fill;
    if (!own || volume > own * 1.05) return;
    this.candidates.push(b.clone());
  }
  private candidates: THREE.Box3[] = []; private solids: THREE.Box3[] = [];
  /** Local (district-space) bounds of every low solid, for crowds to walk around. */
  readonly lowSolids: THREE.Box3[] = [];
  private solidifyCandidates() {
    const inside = (b: THREE.Box3) => this.solids.some(s => s.min.x <= b.min.x + .05 && s.min.z <= b.min.z + .05 && s.max.x >= b.max.x - .05 && s.max.z >= b.max.z - .05 && s.max.y >= Math.min(b.max.y, 1.6) - .05);
    for (const b of this.candidates) {
      if (inside(b)) continue;
      const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)), position: new CANNON.Vec3(c.x + this.origin.x, c.y, c.z + this.origin.z) });
      this.physics.addBody(body); this.bodies.push(body); this.lowSolids.push(b); this.solids.push(b);
    }
    this.candidates = [];
  }
  box(size: V3, position: V3, color: string, surface: KitSurface = 'solid', rotationY = 0) { return this.shape('box', size, position, color, surface, [0, rotationY, 0]); }
  cylinder(radius: number, height: number, position: V3, color: string, surface: KitSurface = 'solid', low = false) { return this.shape(low ? 'cylinderLow' : 'cylinder', [radius, height, radius], position, color, surface); }
  rod(a: V3, b: V3, radius: number, color: string, surface: KitSurface = 'metal') {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
    return this.add(unit.cylinderLow, color, surface, va.clone().add(vb).multiplyScalar(.5).toArray() as V3, [radius, va.distanceTo(vb), radius], [e.x, e.y, e.z], 0);
  }
  /** Physics + line-of-sight collider for an axis box in the current frame. */
  solid(size: V3, position: V3, rotationY = 0) {
    if (this.muted) return;
    const m = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, this.origin.z), this.matrix)
      .multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY), new THREE.Vector3(1, 1, 1)));
    const p = new THREE.Vector3(), q = new THREE.Quaternion(); m.decompose(p, q, new THREE.Vector3());
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), position: new CANNON.Vec3(p.x, p.y, p.z) });
    body.quaternion.set(q.x, q.y, q.z, q.w); this.physics.addBody(body); this.bodies.push(body);
    const collider = new THREE.BoxGeometry(...size).applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1))); this.colliders.push(collider);
    collider.computeBoundingBox(); const local = collider.boundingBox!.clone().translate(this.origin.clone().negate()); this.solids.push(local);
    if (local.min.y < 1.6 && local.max.y > .2) this.lowSolids.push(local);
  }
  /** A visible box that is also solid. */
  wall(size: V3, position: V3, color: string, surface: KitSurface = 'plaster', rotationY = 0) { this.box(size, position, color, surface, rotationY); this.solid(size, position, rotationY); }
  readonly bodies: CANNON.Body[] = [];
  /** Merge everything into one mesh per surface. Returns the number of meshes created. */
  build() { let meshes = 0; for (const _ of this.buildSteps()) meshes++; return meshes; }
  /** `build`, one surface per step. */
  *buildSteps(): Generator<void> {
    this.solidifyCandidates();
    for (const [surface, list] of this.parts) {
      if (!list.length) continue;
      const g = mergeGeometries(list)!; list.forEach(p => p.dispose());
      if (surface !== 'facade' && surface !== 'pool') worldUv(g, surface, this.pattern, this.surfaces);
      age(g, surface, this.pattern);
      if (surface === 'pool') {
        const mesh = lightPoolMesh(g, POOL_COLOR); mesh.name = 'district:pool'; this.group.add(mesh); yield; continue;
      }
      const base = this.surfaces.get('#ffffff', surface === 'facade' ? 'plaster' : surface);
      const material = surface === 'facade' ? nightEmissive(new THREE.MeshStandardMaterial({ map: facadeTexture(), roughness: .9, emissiveMap: facadeNightTexture(), emissive: '#ffffff' }), 1.6) : base.clone() as THREE.MeshStandardMaterial;
      material.vertexColors = true; if ((material as THREE.MeshStandardMaterial).color) material.color.set('#ffffff');
      material.userData = { ...base.userData, district: true };
      if (surface === 'foliage') swayInWind(material);
      const mesh = new THREE.Mesh(g, material); mesh.name = `district:${surface}`;
      mesh.castShadow = surface !== 'glow' && surface !== 'glass'; mesh.receiveShadow = surface !== 'glow';
      this.group.add(mesh); yield;
    }
    this.parts.clear();
  }
  /** Drop everything not yet merged (an unfinished build being thrown away). */
  discard() { for (const list of this.parts.values()) list.forEach(p => p.dispose()); this.parts.clear(); this.colliders.forEach(g => g.dispose()); this.colliders.length = 0; }
}

/** Seconds of world time driving the foliage sway; `District.update` advances it. Shared by every district. */
export const foliageWind = { value: 0 };
/**
 * Leaves sway in the sea breeze: a vertex shift that grows with height above the ground (trunks and low shrubs barely
 * move, crowns move a few centimetres) and varies with position, so neighbouring trees are out of step. One shader
 * variant for every district's foliage; shadows use the rest pose.
 */
function swayInWind(material: THREE.Material) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uWind = foliageWind;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float sway = clamp((position.y - 1.5) / 7.0, 0.0, 1.0); sway *= sway;
      float phase = position.x * .23 + position.z * .31;
      transformed.x += (sin(uWind * 1.3 + phase) * .06 + sin(uWind * 3.1 + phase * 2.7) * .02) * sway;
      transformed.z += cos(uWind * 1.1 + phase * 1.3) * .045 * sway;`);
  };
  material.customProgramCacheKey = () => 'district-foliage-wind';
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

/** Façade UVs in the part's own frame, so bays line up with the building's corners and floors with the ground. */
function facadeUv(g: THREE.BufferGeometry, position: V3, scale: V3) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = new Float32Array(p.count * 2), base = position[1] - scale[1] / 2;
  for (let i = 0; i < p.count; i++) {
    const x = (p.getX(i) + .5) * scale[0], y = (p.getY(i) + .5) * scale[1] + base, z = (p.getZ(i) + .5) * scale[2], nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    if (Math.abs(ny) > .5) { uv[i * 2] = x / FACADE_TILE; uv[i * 2 + 1] = FACADE_PLAIN_V; continue; }
    // Run each face left-to-right as seen from outside.
    const u = Math.abs(nz) >= Math.abs(nx) ? (nz > 0 ? x : scale[0] - x) : (nx > 0 ? scale[2] - z : z);
    uv[i * 2] = u / FACADE_TILE; uv[i * 2 + 1] = y / FACADE_TILE;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Smooth value noise in [0, 1]; cheap enough to evaluate per vertex at build time. */
function hash(x: number, y: number, z: number) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (k: number) => lerp(lerp(hash(ix, iy, k), hash(ix + 1, iy, k), sx), lerp(hash(ix, iy + 1, k), hash(ix + 1, iy + 1, k), sx), sy);
  return lerp(plane(iz), plane(iz + 1), sz);
}
const GRIMED = new Set<KitSurface>(['plaster', 'stone', 'facade', 'paving', 'asphalt', 'wood', 'metal', 'solid']);
/**
 * Bake light the renderer doesn't compute: contact darkening where walls meet the ground,
 * shade under ledges and sunshades, and large blotches of monsoon grime, into vertex colours.
 */
function age(g: THREE.BufferGeometry, surface: KitSurface, origin: THREE.Vector3) {
  if (surface === 'glow' || surface === 'glass' || surface === 'foliage' || surface === 'pool') return;
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color'), grime = GRIMED.has(surface);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + origin.x, y = p.getY(i), z = p.getZ(i) + origin.z, ny = n.getY(i);
    let f = 1;
    if (ny < -.5) f *= .6;
    else if (ny < .5) f *= 1 - .4 * Math.exp(-Math.max(0, y) / .7);
    if (grime) f *= .84 + .24 * noise(x * .09, y * .14, z * .09) + .06 * (noise(x * .6, y * .9, z * .6) - .5);
    c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f);
  }
}
