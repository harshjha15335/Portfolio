import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import type { StreetMaterials } from '../StreetMaterials';
import type { StreetInteraction } from '../MumbaiStreet';
import { SpatialIndex } from '../spatial/SpatialIndex';
import type { CityZone } from '../streetLayout';
import { DistrictKit } from './DistrictKit';
import { Crowd, LaneTraffic, SignAtlas, Water } from './DistrictSystems';
import { backdropBlock, constructionSite, rooftop, skylineCrown, streetClutter, streetLight, towerRelief, PASTELS, type Ctx } from './buildings';
import type { Outfit } from './CityFolk';
import { createCityVehicle, VEHICLE_LENGTH, type CityVehicleKind } from './CityVehicles';
import { paintMaterial, type V3 } from './ColorMesh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * How full the districts are, set from the graphics preset before a district is built
 * (a district already built keeps its crowd until it is rebuilt on the next visit).
 */
export const cityDensity = { crowd: 1.35, traffic: 1.7 };
export function setCityDensity(preset: 'low' | 'medium' | 'high') {
  Object.assign(cityDensity, preset === 'low' ? { crowd: .9, traffic: 1 } : preset === 'high' ? { crowd: 2.6, traffic: 2.4 } : { crowd: 1.35, traffic: 1.7 });
}

export interface FrontageItem { w: number; setback?: number; gap?: number; build: (c: Ctx) => void }
export interface DistrictSpec {
  id: string; guide: string; guideOutfit: Outfit;
  /** Which kerbs exist; an 'open' side is dressed by the district (sea wall, beach, lake). */
  west?: 'street' | 'open'; east?: 'street' | 'open';
  palette?: string[]; skyline?: 'all' | 'east';
  /** Walkable limit on that side (default 19.5 m from the road centre). */
  westLimit?: number; eastLimit?: number;
  traffic: CityVehicleKind[];
  /** Scales this district's share of the crowd (the bazaar is already packed with stalls). */
  crowd?: number;
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
    this.street(); spec.build(this); this.guide(); this.populateTraffic(); this.streetLife();
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
      streetClutter(c, side, this.zone.stop);
    }
    // The walkable envelope. Invisible; the road visibly continues past it.
    for (const side of [-1, 1]) kit.solid([1, 4, 86], [side * ((side < 0 ? this.spec.westLimit : this.spec.eastLimit) ?? 19.5), 2, -22]);
    kit.solid([40, 4, 1], [0, 2, -64]); kit.solid([40, 4, 1], [0, 2, 21]);
    // Continuation blocks beyond the walkable ends, facing the road.
    for (const side of [-1, 1]) {
      if ((side < 0 ? this.spec.west : this.spec.east) === 'open') continue;
      for (const [z0, z1] of [[21, 118], [-66, -160]]) for (let z = z0; z0 > 0 ? z < z1 : z > z1; z += (z0 > 0 ? 1 : -1) * 15) {
        const h = 10 + Math.abs(Math.sin(z * 1.7 + side)) * 16, w = 13.5;
        kit.frame([side * (8.5 + (Math.abs(z) % 3)), 0, z + (z0 > 0 ? 7 : -7)], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => { backdropBlock(c, w, h, 12, palette[Math.abs(Math.round(z)) % palette.length]); rooftop(c, w, h, 12); });
      }
    }
    // Skyline: a ring of mid-rises, slab blocks and the odd tall tower with a crown or a crane.
    const tones = ['#c9c3b4', '#d6c7b2', '#b9b8ae', '#cdb9a8', '#c2c7c4', '#d9d0bd', '#bfae9a', '#aeb7bd'];
    for (let i = 0; i < 34; i++) {
      const a = i * Math.PI * 2 / 34 + (this.kit.rand() - .5) * .05, ring = 118 + (i % 3) * 14, x = Math.sin(a) * ring, z = -22 + Math.cos(a) * ring;
      if (this.spec.skyline === 'east' && x < 10) continue;
      const pickType = this.kit.rand(), tone = tones[i % tones.length];
      kit.frame([x, 0, z], a + Math.PI, () => {
        if (pickType < .28) { const h = 55 + this.kit.rand() * 45; backdropBlock(c, 16, h, 16, tone); towerRelief(c, 16, h, 16, tone); skylineCrown(c, 16, h, this.kit.rand()); }
        else if (pickType < .5) { const h = 24 + this.kit.rand() * 10; backdropBlock(c, 34, h, 12, tone); towerRelief(c, 34, h, 12, tone); }
        else { const h = 18 + (i % 5) * 5; backdropBlock(c, 24, h, 12, tone); towerRelief(c, 24, h, 12, tone); rooftop(c, 24, h, 12); }
      });
    }
    // A tower going up somewhere on the horizon, with its crane.
    const ca = (this.spec.skyline === 'east' ? .6 : -.9) + this.kit.rand() * .4;
    kit.frame([Math.sin(ca) * 132, 0, -22 + Math.cos(ca) * 132], ca + Math.PI, () => constructionSite(c));
  }
  private guide() {
    // Beside the arrival point, towards the buildings, turned to greet the visitor.
    const s = this.zone.stop, side = s.x < 0 ? -1 : 1, gx = s.x + side * 1.05, gz = s.z - 2.3;
    const guide = this.crowd.idle(this.spec.guideOutfit, [gx, .03, gz], 0, 'talk');
    guide.group.rotation.y = Math.atan2(gx - s.x, gz - s.z);
    this.interactions.push({ id: this.spec.id, label: `Talk to ${this.spec.guide}`, position: new THREE.Vector3(this.origin.x + gx, 1.45, gz) });
  }
  private populateTraffic() {
    const n = Math.round(this.spec.traffic.length * cityDensity.traffic), kinds = Array.from({ length: n }, (_, i) => this.spec.traffic[(i * 7) % this.spec.traffic.length]), north = this.traffic.lane([[1.6, 0, 120], [1.6, 0, -160]]), south = this.traffic.lane([[-1.6, 0, -160], [-1.6, 0, 120]]);
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
  /** Swap moving traffic onto the modelled bodies (parked cars are merged at build time and keep what they were built with). */
  refreshVehicles() { this.traffic.refresh(); }
  parked(kind: CityVehicleKind, x: number, z: number, yaw: number, rider = false) {
    // Parked cars merge into one static mesh, so they use the far build (still lofted and round-wheeled).
    const mesh = createCityVehicle(kind, `${this.spec.id}:parked:${x}:${z}`, rider, true); mesh.position.set(x, .02, z); mesh.rotation.y = yaw; mesh.updateMatrix();
    this.parkedParts.push(mesh.geometry.applyMatrix4(mesh.matrix));
    const length = VEHICLE_LENGTH[kind], width = kind === 'bus' ? 2.5 : kind === 'bike' || kind === 'cycle' ? .7 : 1.7;
    this.kit.solid([width, 1.4, length], [x, .7, z], yaw);
  }
  water(width: number, depth: number, center: V3, color: string, amplitude?: number) { const w = new Water(width, depth, center, color, amplitude); this.waters.push(w); return w; }
  animate(step: (time: number, delta: number) => void) { this.motion.push(step); }
  private mix: Outfit[] = [];
  walkers(base: Outfit[], lanes: number[], z0 = 12, z1 = -56, speed = 1.05) {
    this.mix.push(...base);
    const outfits = Array.from({ length: Math.round(base.length * cityDensity.crowd * (this.spec.crowd ?? 1)) }, (_, i) => base[(i * 5) % base.length]);
    outfits.forEach((o, i) => { const x = lanes[i % lanes.length] + ((i * 37) % 7 - 3) * .08; this.crowd.walker(o, [[x, .03, z0], [x, .03, z1]], speed * (.85 + ((i * 13) % 5) * .07), ((i * 29) % 17) / 17); });
  }
  /** Is a pavement spot clear of the stop, the guide and the zebra crossing? */
  private clearOf(x: number, z: number) {
    const s = this.zone.stop; return Math.hypot(x - s.x, z - s.z) > 6 && Math.abs(z + 12) > 3;
  }
  /**
   * The life between the authored set pieces: knots of people chatting on the pavements and
   * rows of parked two-wheelers along the kerb, scaled by `cityDensity`.
   */
  private streetLife() {
    const r = () => this.kit.rand(), mix = this.mix.length ? this.mix : ['shirt', 'office', 'sari', 'kurta'] as Outfit[];
    for (const side of [-1, 1]) {
      if ((side < 0 ? this.spec.west : this.spec.east) === 'open') continue;
      // Knots of two or three people facing each other.
      const knots = Math.round(4 * cityDensity.crowd * (this.spec.crowd ?? 1));
      for (let k = 0; k < knots; k++) {
        const z = 8 - (k + .3 + r() * .4) * (64 / knots), x = side * (5.9 + r() * .5); if (!this.clearOf(x, z)) continue;
        // Leave room around people the district already placed (vendors, a queue).
        if (this.crowd.standing().some(p => Math.hypot(p.group.position.x - x, p.group.position.z - z) < 2)) continue;
        // Spread evenly round the knot at conversation distance, each turned to its centre.
        const size = 2 + (r() > .6 ? 1 : 0), turn = r() * Math.PI * 2, radius = size === 2 ? .55 : .62;
        for (let i = 0; i < size; i++) {
          const a = turn + i / size * Math.PI * 2, px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
          const p = this.crowd.idle(mix[Math.floor(r() * mix.length)], [px, .03, pz], 0, i === 0 || r() > .5 ? 'talk' : 'stand');
          p.group.rotation.y = Math.atan2(px - x, pz - z);
        }
      }
      // Two-wheelers parked nose-in at the kerb, in clusters.
      const kinds = ['bike', 'bike', 'cycle', 'bike'] as const;
      for (let z = 10 - r() * 4; z > -58; z -= 14 + r() * 8) {
        if (!this.clearOf(side * 3.4, z) || !this.clearOf(side * 3.4, z - 4)) continue;
        const count = 3 + Math.floor(r() * 3);
        for (let i = 0; i < count; i++) this.parkedLite(kinds[Math.floor(r() * kinds.length)], side * 3.35, z - i * .85, side > 0 ? -Math.PI / 2 + (r() - .5) * .2 : Math.PI / 2 + (r() - .5) * .2);
        this.kit.solid([1.6, 1.2, count * .85], [side * 3.35, .6, z - (count - 1) * .85 / 2]);
      }
    }
    this.flushParked();
  }
  private parkedParts: THREE.BufferGeometry[] = [];
  /** Queue a static vehicle into the district's single merged parked-vehicle mesh. */
  parkedLite(kind: CityVehicleKind, x: number, z: number, yaw: number) {
    const mesh = createCityVehicle(kind, `${this.spec.id}:row:${x}:${z.toFixed(2)}`, false, true);
    mesh.position.set(x, .02, z); mesh.rotation.y = yaw; mesh.updateMatrix(); this.parkedParts.push(mesh.geometry.applyMatrix4(mesh.matrix));
  }
  private flushParked() {
    if (!this.parkedParts.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(this.parkedParts)!, paintMaterial()); this.parkedParts.forEach(g => g.dispose()); this.parkedParts = [];
    mesh.name = 'district:parked'; mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
  }
  setActive(active: boolean) { this.group.visible = active; }
  update(time: number, reduced: boolean, view: THREE.Vector3, others: THREE.Vector3[] = []) {
    const delta = reduced ? 0 : Math.min(.08, Math.max(0, time - this.previous)); this.previous = time;
    const local = view.clone().sub(this.origin);
    this.crowd.update(reduced ? 0 : time, delta, local);
    this.traffic.update(time, delta, [local, ...others.map(o => o.clone().sub(this.origin))]);
    if (!reduced) for (const w of this.waters) w.update(time);
    for (const m of this.motion) m(reduced ? 0 : time, delta);
  }
  /** Release physics bodies and every GPU resource this district owns (shared street maps stay). */
  dispose() {
    for (const body of this.kit.bodies) this.physics.removeBody(body);
    this.spatial.dispose(); this.signs.texture.dispose(); this.group.removeFromParent();
    for (const person of this.crowd.people()) person.cast?.dispose();
    this.traffic.dispose();
    const shared = paintMaterial();
    this.group.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      // Licensed cast figures borrow the shared cast's geometry, material and skeleton.
      if (mesh.userData?.districtCast) return;
      if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
      for (const g of [mesh.geometry, ...((mesh.userData?.lodGeometries ?? []) as THREE.BufferGeometry[])]) g?.dispose();
      for (const m of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) if (m !== shared) m.dispose();
    });
  }
}
