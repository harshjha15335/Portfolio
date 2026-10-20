import type { Blocker } from '../collision/DynamicBlockers';
import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import type { StreetMaterials } from '../StreetMaterials';
import type { StreetInteraction } from '../MumbaiStreet';
import { SpatialIndex } from '../spatial/SpatialIndex';
import type { CityZone } from '../streetLayout';
import { DistrictKit } from './DistrictKit';
import { Crowd, LaneTraffic, SignAtlas, Water } from './DistrictSystems';
import { backdropBlock, constructionSite, rooftop, skylineCrown, streetClutter, streetLight, towerRelief, PASTELS, ZEBRA_Z, type Ctx } from './buildings';
import type { Outfit } from './CityFolk';
import { createCityVehicle, VEHICLE_LENGTH, type CityVehicleKind } from './CityVehicles';
import { paintMaterial, withFinish, type V3 } from './ColorMesh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildExhibits } from './exhibits';
import { exhibitsOf } from '../../../data/districtExhibits';
import { crossingHeld, pedestrianGreen } from '../traffic/RoadTraffic';

/**
 * How full the districts are, set from the graphics preset before a district is built
 * (a district already built keeps its crowd until it is rebuilt on the next visit).
 */
/** Where district traffic enters and leaves the road (z): far enough out that vehicles appear and vanish beyond the haze. */
const LANE_END = [150, -190] as const;
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
  /** Stretches of the east limit (z ranges) left open because a walk-in building's own walls enclose them. */
  eastOpen?: Array<[number, number]>;
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
  /** Exhibit boards' own atlas (null when the district has none). */
  private exhibitSigns: SignAtlas | null = null;
  readonly buildMs: number;
  constructor(private physics: CANNON.World, surfaces: StreetMaterials, readonly zone: CityZone, readonly spec: DistrictSpec) {
    const started = performance.now(); this.origin = new THREE.Vector3(zone.originX, 0, 0); this.group.position.copy(this.origin); this.group.name = `district:${spec.id}`;
    this.kit = new DistrictKit(this.origin, physics, surfaces, spec.id); this.ctx = { kit: this.kit, signs: this.signs };
    this.street(); spec.build(this); this.exhibitSigns = buildExhibits(this); this.guide(); this.populateTraffic(); this.crossing(); this.streetLife();
    this.kit.build(); this.kit.group.children.slice().forEach(m => { this.group.add(m); m.position.set(0, 0, 0); });
    const signs = this.signs.build(); if (signs) this.group.add(signs);
    const boards = this.exhibitSigns?.build(); if (boards) { boards.name = 'district:exhibits'; this.group.add(boards); }
    this.group.add(this.crowd.group, this.traffic.group); for (const w of this.waters) this.group.add(w.mesh);
    // Low solids (stalls, benches, posts, parked rows) are what walkers on the pavement must step around.
    for (const b of this.kit.lowSolids) this.crowd.obstacles.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
    this.spatial = new SpatialIndex(this.kit.colliders); this.kit.colliders.forEach(g => g.dispose()); this.kit.colliders.length = 0;
    this.group.visible = false; this.buildMs = performance.now() - started;
  }
  /** Shared road, pavements, lights, limits and backdrop. */
  private street() {
    const { kit } = this, c = this.ctx, palette = this.spec.palette ?? PASTELS;
    kit.box([300, .1, 340], [0, -.12, -22], '#6d6f69', 'asphalt');
    kit.box([7.8, .04, 340], [0, -.03, -22], '#55585a', 'asphalt');
    for (let z = 118; z > -160; z -= 6) kit.box([.1, .01, 2.2], [0, .0, z], '#b8b09a');
    for (let i = 0; i < 8; i++) kit.box([.55, .01, 2.6], [-3 + i * .85, .0, ZEBRA_Z], '#d4cfbf');
    kit.box([60, .035, 7], [0, -.015, 16.5], '#5a5d5e', 'asphalt'); kit.box([60, .035, 8], [0, -.015, -60.5], '#5a5d5e', 'asphalt');
    for (const side of [-1, 1]) {
      if ((side < 0 ? this.spec.west : this.spec.east) === 'open') continue;
      kit.box([2.9, .08, 340], [side * 5.35, .02, -22], '#aea493', 'paving');
      for (let z = 118; z > -160; z -= 1.7) kit.box([.24, .14, 1.6], [side * 3.98, .06, z], Math.floor(z / 1.7) % 2 ? '#c7a84f' : '#2f2e2b');
      for (let z = 10; z > -60; z -= 16) streetLight(c, side * 6.4, z, side);
      for (let z = 9; z > -60; z -= 4.5) kit.box([.65, .015, .45], [side * 3.45, .005, z], '#2a2e33', 'metal');
      streetClutter(c, side, this.zone.stop);
    }
    // The walkable envelope. Invisible; the road visibly continues past it.
    for (const side of [-1, 1]) {
      const x = side * ((side < 0 ? this.spec.westLimit : this.spec.eastLimit) ?? 19.5);
      // The limit runs z −65…21, broken where a walk-in building takes over.
      const open = side > 0 ? [...(this.spec.eastOpen ?? [])].sort((a, b) => b[1] - a[1]) : [];
      let top = 21;
      for (const [z0, z1] of [...open, [-65, -65] as [number, number]]) { if (top - z1 > .01) kit.solid([1, 4, top - z1], [x, 2, (top + z1) / 2]); top = Math.min(top, z0); }
    }
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
    const n = Math.round(this.spec.traffic.length * cityDensity.traffic), kinds = Array.from({ length: n }, (_, i) => this.spec.traffic[(i * 7) % this.spec.traffic.length]), north = this.traffic.lane([[1.6, 0, LANE_END[0]], [1.6, 0, LANE_END[1]]]), south = this.traffic.lane([[-1.6, 0, LANE_END[1]], [-1.6, 0, LANE_END[0]]]);
    kinds.forEach((kind, i) => this.traffic.vehicle(i % 2 ? south : north, kind, ((i >> 1) + (i % 2) * .5) / Math.ceil(kinds.length / 2), `${this.spec.id}:${i}`));
    // Both lanes stop short of the zebra (z −13.3…−10.7) while the crossing is held.
    this.traffic.stopLine(north, ZEBRA_Z + 2.8, crossingHeld); this.traffic.stopLine(south, ZEBRA_Z - 2.8, crossingHeld);
  }
  /** The zebra's signals and the people who use it. */
  private crossing() {
    const { kit } = this, mix = this.mix.length ? this.mix : ['shirt', 'office'] as Outfit[];
    const walk: THREE.BufferGeometry[] = [], wait: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      // A pole at each kerb with a head facing across the road: red standing figure above, green walking one below.
      const x = side * 4.45, z = ZEBRA_Z - 1.75;
      kit.rod([x, 0, z], [x, 2.9, z], .05, '#2b2f31'); kit.box([.34, .62, .26], [x, 2.55, z], '#1f2224', 'metal');
      for (const [list, y] of [[wait, 2.7], [walk, 2.4]] as const) list.push(new THREE.BoxGeometry(.04, .2, .16).translate(x - side * .18, y, z));
    }
    const lamp = (list: THREE.BufferGeometry[], color: string) => { const m = new THREE.Mesh(mergeGeometries(list)!, new THREE.MeshBasicMaterial({ color })); list.forEach(g => g.dispose()); m.name = 'signal-lamps'; this.group.add(m); return m; };
    this.signalLamps = { walk: lamp(walk, '#7dff9a'), wait: lamp(wait, '#ff5a4a') };
    // Two people use the zebra, one from each side, at a walking pace that clears the road inside the hold.
    this.crowd.crosser(mix[1 % mix.length], ZEBRA_Z - .5, -4.4, 4.4); this.crowd.crosser(mix[3 % mix.length], ZEBRA_Z + .5, 4.4, -4.4);
    // A slow cart or bus can still be on the stripes when the walk signal comes; nobody steps out in front of it.
    this.crowd.crossingBusy = () => this.traffic.moving.some(v => Math.abs(v.position.z - ZEBRA_Z) < v.length / 2 + 1.8);
  }
  private signalLamps: { walk: THREE.Mesh; wait: THREE.Mesh } | null = null;
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
    const s = this.zone.stop; return Math.hypot(x - s.x, z - s.z) > 6 && Math.abs(z - ZEBRA_Z) > 3 && exhibitsOf(this.spec.id).every(e => Math.hypot(x - e.x, z - e.z) > 2.6);
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
      // Two-wheelers parked in line along the kerb, in clusters. Nose-in rows would reach into the traffic lane
      // (a 2 m bike from the kerb ends where a passing car's flank is), so they stand parallel, clear of it.
      const kinds = ['bike', 'bike', 'cycle', 'bike'] as const;
      for (let z = 10 - r() * 4; z > -58; z -= 16 + r() * 8) {
        const count = 2 + Math.floor(r() * 3), span = count * 2.2;
        if (!this.clearOf(side * 3.45, z) || !this.clearOf(side * 3.45, z - span)) continue;
        for (let i = 0; i < count; i++) this.parkedLite(kinds[Math.floor(r() * kinds.length)], side * 3.45, z - 1.1 - i * 2.2, (side > 0 ? Math.PI : 0) + (r() - .5) * .12);
        this.kit.solid([.8, 1.2, span], [side * 3.45, .6, z - span / 2]);
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
    const mesh = new THREE.Mesh(mergeGeometries(withFinish(this.parkedParts))!, paintMaterial()); this.parkedParts.forEach(g => g.dispose()); this.parkedParts = [];
    mesh.name = 'district:parked'; mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
  }
  setActive(active: boolean) { this.group.visible = active; }
  update(time: number, reduced: boolean, view: THREE.Vector3, others: THREE.Vector3[] = []) {
    const delta = reduced ? 0 : Math.min(.08, Math.max(0, time - this.previous)); this.previous = time;
    const local = view.clone().sub(this.origin);
    this.crowd.update(reduced ? 0 : time, delta, local);
    this.traffic.update(time, delta, [local, ...others.map(o => o.clone().sub(this.origin))], this.crowd.onRoad());
    if (this.signalLamps) { const walk = pedestrianGreen(reduced ? 0 : time); this.signalLamps.walk.visible = walk; this.signalLamps.wait.visible = !walk; }
    if (!reduced) for (const w of this.waters) w.update(time);
    for (const m of this.motion) m(reduced ? 0 : time, delta);
  }
  /** People and moving vehicles near `view` (world space) that the visitor cannot walk through. */
  collectBlockers(out: Blocker[], view: THREE.Vector3) {
    const local = this.blockView.copy(view).sub(this.origin);
    this.crowd.collectBlockers(out, this.origin, local); this.traffic.collectBlockers(out, this.origin, local);
  }
  private blockView = new THREE.Vector3();
  /** Release physics bodies and every GPU resource this district owns (shared street maps stay). */
  dispose() {
    for (const body of this.kit.bodies) this.physics.removeBody(body);
    this.spatial.dispose(); this.signs.texture.dispose(); this.exhibitSigns?.texture.dispose(); this.group.removeFromParent();
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
