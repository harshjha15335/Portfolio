import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import type { StreetMaterials } from '../StreetMaterials';
import type { StreetInteraction } from '../MumbaiStreet';
import { SpatialIndex } from '../spatial/SpatialIndex';
import type { CityZone } from '../streetLayout';
import { DistrictKit } from './DistrictKit';
import { Crowd, LaneTraffic, SignAtlas, Water } from './DistrictSystems';
import { backdropBlock, streetLight, PASTELS, type Ctx } from './buildings';
import type { Outfit } from './CityFolk';
import { createCityVehicle, VEHICLE_LENGTH, type CityVehicleKind } from './CityVehicles';
import { paintMaterial, type V3 } from './ColorMesh';

export interface FrontageItem { w: number; setback?: number; gap?: number; build: (c: Ctx) => void }
export interface DistrictSpec {
  id: string; guide: string; guideOutfit: Outfit;
  /** Which kerbs exist; an 'open' side is dressed by the district (sea wall, beach, lake). */
  west?: 'street' | 'open'; east?: 'street' | 'open';
  palette?: string[]; skyline?: 'all' | 'east';
  /** Walkable limit on that side (default 19.5 m from the road centre). */
  westLimit?: number; eastLimit?: number;
  traffic: CityVehicleKind[];
  build: (d: District) => void;
}

/**
 * One walkable district. All districts share Fort Road's local frame — a road along Z,
 * pavements at |x|≈5, the walkable box x∈[−19,19], z∈[−63,20] — so rides, pickups and the
 * sun's shadow frustum work unchanged. The road runs on into the haze at both ends.
 */
export class District {
  readonly group = new THREE.Group();
  readonly kit: DistrictKit; readonly signs = new SignAtlas(); readonly crowd = new Crowd(); readonly traffic = new LaneTraffic();
  readonly interactions: StreetInteraction[] = [];
  readonly origin: THREE.Vector3;
  spatial!: SpatialIndex;
  private waters: Water[] = []; private motion: Array<(time: number, delta: number) => void> = []; private previous = 0;
  readonly ctx: Ctx;
  readonly buildMs: number;
  constructor(private physics: CANNON.World, surfaces: StreetMaterials, readonly zone: CityZone, readonly spec: DistrictSpec) {
    const started = performance.now(); this.origin = new THREE.Vector3(zone.originX, 0, 0); this.group.position.copy(this.origin); this.group.name = `district:${spec.id}`;
    this.kit = new DistrictKit(this.origin, physics, surfaces, spec.id); this.ctx = { kit: this.kit, signs: this.signs };
    this.street(); spec.build(this); this.guide(); this.populateTraffic();
    this.kit.build(); this.kit.group.children.slice().forEach(m => { this.group.add(m); m.position.set(0, 0, 0); });
    const signs = this.signs.build(); if (signs) this.group.add(signs);
    this.group.add(this.crowd.group, this.traffic.group); for (const w of this.waters) this.group.add(w.mesh);
    this.spatial = new SpatialIndex(this.kit.colliders); this.kit.colliders.forEach(g => g.dispose()); this.kit.colliders.length = 0;
    this.group.visible = false; this.buildMs = performance.now() - started;
  }
  /** Shared road, pavements, lights, limits and backdrop. */
  private street() {
    const { kit } = this, c = this.ctx, palette = this.spec.palette ?? PASTELS;
    kit.box([300, .1, 340], [0, -.12, -22], '#6d6f69', 'asphalt');
    kit.box([7.8, .04, 290], [0, -.03, -22], '#55585a', 'asphalt');
    for (let z = 118; z > -160; z -= 6) kit.box([.1, .01, 2.2], [0, .0, z], '#b8b09a');
    for (let i = 0; i < 8; i++) kit.box([.55, .01, 2.6], [-3 + i * .85, .0, -12], '#d4cfbf');
    kit.box([60, .035, 7], [0, -.015, 16.5], '#5a5d5e', 'asphalt'); kit.box([60, .035, 8], [0, -.015, -60.5], '#5a5d5e', 'asphalt');
    for (const side of [-1, 1]) {
      if ((side < 0 ? this.spec.west : this.spec.east) === 'open') continue;
      kit.box([2.9, .08, 290], [side * 5.35, .02, -22], '#aea493', 'paving');
      for (let z = 118; z > -160; z -= 1.7) kit.box([.24, .14, 1.6], [side * 3.98, .06, z], Math.floor(z / 1.7) % 2 ? '#c7a84f' : '#2f2e2b');
      for (let z = 10; z > -60; z -= 16) streetLight(c, side * 6.4, z, side);
      for (let z = 9; z > -60; z -= 4.5) kit.box([.65, .015, .45], [side * 3.45, .005, z], '#2a2e33', 'metal');
    }
    // The walkable envelope. Invisible; the road visibly continues past it.
    for (const side of [-1, 1]) kit.solid([1, 4, 86], [side * ((side < 0 ? this.spec.westLimit : this.spec.eastLimit) ?? 19.5), 2, -22]);
    kit.solid([40, 4, 1], [0, 2, -64]); kit.solid([40, 4, 1], [0, 2, 21]);
    // Continuation blocks beyond the walkable ends, facing the road.
    for (const side of [-1, 1]) {
      if ((side < 0 ? this.spec.west : this.spec.east) === 'open') continue;
      for (const [z0, z1] of [[21, 118], [-66, -160]]) for (let z = z0; z0 > 0 ? z < z1 : z > z1; z += (z0 > 0 ? 1 : -1) * 15) {
        const h = 10 + Math.abs(Math.sin(z * 1.7 + side)) * 16, w = 13.5;
        kit.frame([side * (8.5 + (Math.abs(z) % 3)), 0, z + (z0 > 0 ? 7 : -7)], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => backdropBlock(c, w, h, 12, palette[Math.abs(Math.round(z)) % palette.length]));
      }
    }
    for (let i = 0; i < 30; i++) {
      const a = i * Math.PI / 15, x = Math.sin(a) * 125, z = -22 + Math.cos(a) * 125;
      if (this.spec.skyline === 'east' && x < 10) continue;
      kit.frame([x, 0, z], a + Math.PI, () => backdropBlock(c, 24, 18 + (i % 5) * 5, 12, ['#9ba69e', '#afb1a2', '#97a4a0', '#a99c8c'][i % 4]));
    }
  }
  private guide() {
    // Beside the arrival point, towards the buildings, turned to greet the visitor.
    const s = this.zone.stop, side = s.x < 0 ? -1 : 1, gx = s.x + side * 1.05, gz = s.z - 2.3;
    const guide = this.crowd.idle(this.spec.guideOutfit, [gx, .03, gz], 0, 'talk');
    guide.group.rotation.y = Math.atan2(gx - s.x, gz - s.z);
    this.interactions.push({ id: this.spec.id, label: `Talk to ${this.spec.guide}`, position: new THREE.Vector3(this.origin.x + gx, 1.45, gz) });
  }
  private populateTraffic() {
    const kinds = this.spec.traffic, north = this.traffic.lane([[1.6, 0, 120], [1.6, 0, -160]]), south = this.traffic.lane([[-1.6, 0, -160], [-1.6, 0, 120]]);
    kinds.forEach((kind, i) => this.traffic.vehicle(i % 2 ? south : north, kind, ((i >> 1) + (i % 2) * .5) / Math.ceil(kinds.length / 2), `${this.spec.id}:${i}`));
  }
  /* --------- helpers used by district builders --------- */
  /** Line one side of the walkable road with buildings from z = 14 northwards. */
  frontage(side: number, items: FrontageItem[], start = 14) {
    let z = start;
    for (const item of items) {
      const zc = z - item.w / 2, x = side * (7 + (item.setback ?? 0));
      this.kit.frame([x, 0, zc], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => item.build(this.ctx));
      z -= item.w + (item.gap ?? .4);
    }
    return z;
  }
  /** A parked vehicle: static, solid, no driver unless asked. */
  parked(kind: CityVehicleKind, x: number, z: number, yaw: number, rider = false) {
    const mesh = createCityVehicle(kind, `${this.spec.id}:parked:${x}:${z}`, rider); mesh.position.set(x, .02, z); mesh.rotation.y = yaw; this.group.add(mesh);
    const length = VEHICLE_LENGTH[kind], width = kind === 'bus' ? 2.5 : kind === 'bike' || kind === 'cycle' ? .7 : 1.7;
    this.kit.solid([width, 1.4, length], [x, .7, z], yaw); return mesh;
  }
  water(width: number, depth: number, center: V3, color: string, amplitude?: number) { const w = new Water(width, depth, center, color, amplitude); this.waters.push(w); return w; }
  animate(step: (time: number, delta: number) => void) { this.motion.push(step); }
  walkers(outfits: Outfit[], lanes: number[], z0 = 12, z1 = -56, speed = 1.05) {
    outfits.forEach((o, i) => { const x = lanes[i % lanes.length] + ((i * 37) % 7 - 3) * .08; this.crowd.walker(o, [[x, .03, z0], [x, .03, z1]], speed * (.85 + ((i * 13) % 5) * .07), ((i * 29) % 17) / 17); });
  }
  setActive(active: boolean) { this.group.visible = active; }
  update(time: number, reduced: boolean, view: THREE.Vector3) {
    const delta = reduced ? 0 : Math.min(.08, Math.max(0, time - this.previous)); this.previous = time;
    const local = view.clone().sub(this.origin);
    this.crowd.update(reduced ? 0 : time, delta, local);
    this.traffic.update(time, delta, [local]);
    if (!reduced) for (const w of this.waters) w.update(time);
    for (const m of this.motion) m(reduced ? 0 : time, delta);
  }
  /** Release physics bodies and every GPU resource this district owns (shared street maps stay). */
  dispose() {
    for (const body of this.kit.bodies) this.physics.removeBody(body);
    this.spatial.dispose(); this.signs.texture.dispose(); this.group.removeFromParent();
    const shared = paintMaterial();
    this.group.traverse(object => {
      const mesh = object as THREE.SkinnedMesh; if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
      for (const g of [mesh.geometry, ...((mesh.userData?.lodGeometries ?? []) as THREE.BufferGeometry[])]) g?.dispose();
      for (const m of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) if (m !== shared) m.dispose();
    });
  }
}
