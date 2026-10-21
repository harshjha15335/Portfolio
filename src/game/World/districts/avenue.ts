import * as THREE from 'three';
import type * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StreetMaterials } from '../StreetMaterials';
import { AVENUE_LENGTH, cityZones, northEdge, SOUTH_EDGE } from '../streetLayout';
import { DistrictKit } from './DistrictKit';
import type { SignAtlas } from './DistrictSystems';
import { backdropBlock, busStop, hoarding, rooftop, sign, streetLight, towerRelief, tree, palm, PASTELS, type Ctx } from './buildings';
import { createCityVehicle, VEHICLE_LENGTH, type CityVehicleKind } from './CityVehicles';
import { paintMaterial, withFinish, type V3 } from './ColorMesh';

/**
 * The avenue between two districts: a Mumbai arterial road lined with shophouses (shops on the ground floor,
 * flats above, signs, awnings, balconies and water tanks), side lanes, a garden, a wayside shrine, street trees
 * and lamps, parked scooters and cars, towers behind, and a Western Railway bridge over the road halfway along.
 *
 * It is drawn in its own frame: along the avenue from the southern district's north edge (u = 0, z' = 0) to the
 * northern district's south edge (u = AVENUE_LENGTH, z' = −u), x as in every street. Each of the two districts
 * builds the whole avenue, translated into its own frame, from the same seed and in the same order, so both copies
 * are identical and the visitor can cross from one district's copy to the other's at the seam without a seam.
 */
export const AVENUE_TAIL = 45;
const L = AVENUE_LENGTH;
/** Ground-floor shops of the avenue (English, local script). */
const SHOPS: Array<[string, string?]> = [
  ['MEDICAL & GENERAL', 'मेडिकल'], ['KIRANA STORES', 'किराणा'], ['MOBILE REPAIRING', 'मोबाईल'], ['SHREE SWEETS', 'मिठाई'], ['TAILORS', 'शिंपी'],
  ['HARDWARE & PAINTS', 'हार्डवेअर'], ['IRANI BAKERY', 'बेकरी'], ['XEROX · PRINTS'], ['OPTICIANS', 'चष्मे'], ['PAAN CORNER', 'पान'],
  ['UDUPI CAFE', 'उपहार गृह'], ['HAIR SALOON', 'केशकर्तनालय'], ['BOOK DEPOT', 'पुस्तके'], ['ELECTRICALS', 'इलेक्ट्रिकल'], ['FOOTWEAR', 'चप्पल'],
  ['JEWELLERS', 'ज्वेलर्स'], ['VADA PAV', 'वडा पाव'], ['BANK · ATM'], ['CYCLE MART', 'सायकल'], ['DRY FRUITS', 'सुका मेवा'],
  ['SAREE CENTRE', 'साडी'], ['STATIONERY', 'स्टेशनरी'], ['CHEMIST 24×7', 'औषधे'], ['TEA HOUSE', 'चहा'], ['FLOUR MILL', 'गिरणी'],
];
const SHOP_BG = ['#244a5c', '#7d2a24', '#2f5a3a', '#7a5a1d', '#3a3a6a', '#1f1f1f', '#a33a2a', '#0f5e5a', '#5a2a5e', '#c26a1c'];
const AWNINGS = ['#2c6f8f', '#b23a32', '#3d7a4f', '#c7892f', '#5a4a8a', '#2b5d9b', '#8a8f3a'];
const shade = (c: string, k: number) => new THREE.Color(c).multiplyScalar(k).getStyle();

export interface AvenueOptions {
  /** Zone index of the southern district (the avenue leads to index + 1). */
  index: number;
  /** Which end the district building this copy sits at: 'south' builds it as its north avenue. */
  end: 'south' | 'north';
  signs: SignAtlas;
  /** Lay a ground slab under the avenue (where the district's own ground does not reach). */
  ground?: boolean;
  /** The district kit to draw the avenue's architecture with (no meshes of its own); else it builds its own. */
  into?: DistrictKit;
  /** A parked vehicle (district-local), so the district's traffic keeps clear of it. */
  onParked?: (kind: CityVehicleKind, x: number, z: number, yaw: number) => void;
}

export class Avenue {
  readonly group = new THREE.Group();
  readonly kit: DistrictKit;
  /** Local z of the avenue's u = 0 in the building district's frame. */
  readonly frameZ: number;
  private ctx: Ctx; private parts: THREE.BufferGeometry[] = [];
  /** Draw a fine-detail piece at u (set up by `content`): in full on this copy's own half, `far` (or nothing) beyond. */
  private piece: (u: number, key: string, full: () => void, far?: () => void) => void = () => {};
  constructor(physics: CANNON.World, surfaces: StreetMaterials, readonly origin: THREE.Vector3, readonly options: AvenueOptions) {
    const { index, end } = options;
    this.frameZ = end === 'south' ? northEdge(index) : SOUTH_EDGE + L;
    this.kit = new DistrictKit(origin, physics, surfaces, `avenue:${cityZones[index].id}`, new THREE.Vector3(0, 0, -this.frameZ));
    this.ctx = { kit: this.kit, signs: options.signs };
    this.group.name = `avenue:${cityZones[index].id}-${cityZones[index + 1].id}`;
  }
  /** Avenue u → this district's local z. */
  z(u: number) { return this.frameZ - u; }
  /** Build in slices (for a time-sliced district build). Ends with the merged meshes in `group`. */
  *steps(): Generator<void> {
    const { kit } = this, c = this.ctx;
    const tail: [number, number] = this.options.end === 'south' ? [0, L + AVENUE_TAIL] : [-AVENUE_TAIL, L];
    yield* kit.frameSteps([0, 0, this.frameZ], 0, () => this.content(c, tail));
    if (this.options.into) yield* kit.bakeInto(this.options.into);
    else { yield* kit.buildSteps(); kit.group.children.slice().forEach(m => { this.group.add(m); m.position.set(0, 0, 0); }); }
    if (this.parts.length) {
      const mesh = new THREE.Mesh(mergeGeometries(withFinish(this.parts))!, paintMaterial()); this.parts.forEach(g => g.dispose()); this.parts = [];
      mesh.name = 'district:avenue-parked'; mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    }
    // Colliders serve the district's line-of-sight index; the avenue has no interactions, so only the bodies stay.
    kit.colliders.forEach(g => g.dispose()); kit.colliders.length = 0;
  }
  /**
   * Everything along the avenue, in avenue space (z' = −u). Generators yield between pieces. The order and the
   * random draws must not depend on the district building it: both copies have to come out the same.
   */
  private *content(c: Ctx, [u0, u1]: [number, number]): Generator<void> {
    const { kit } = c, from = cityZones[this.options.index], to = cityZones[this.options.index + 1];
    // Every loop runs over the whole avenue with both tails, drawing only this copy's stretch (`at`), so each copy
    // makes the same random draws in the same order whichever stretch it draws.
    const F0 = -AVENUE_TAIL, F1 = L + AVENUE_TAIL;
    const at = (u: number, draw: () => void) => { const was = kit.muted; kit.muted = was || u < u0 || u > u1; try { draw(); } finally { kit.muted = was; } };
    // Fine detail (shop fronts, street trees, parked scooters, poles and cables) on this copy's own half and 40 m past
    // the seam; beyond that the visitor only ever sees it from afar, and the other district's copy draws it in full.
    // Each such piece draws from its own random stream, so leaving it out cannot change the rest.
    const near = (u: number) => this.options.end === 'south' ? u < L / 2 + 40 : u > L / 2 - 40;
    const piece = (u: number, key: string, full: () => void, far?: () => void) => at(u, () => kit.isolated(`${this.group.name}:${key}:${u.toFixed(1)}`, () => near(u) ? full() : far?.()));
    this.piece = piece;
    const span = u1 - u0, mid = -(u0 + u1) / 2;
    if (this.options.ground) kit.box([160, .1, span + 40], [0, -.13, mid], '#6d6f69', 'asphalt');
    // Carriageway, lane line, kerbs (black and yellow, as Mumbai paints them) and pavements.
    kit.box([7.8, .04, span], [0, -.03, mid], '#55585a', 'asphalt');
    for (let u = F0 + 2; u < F1; u += 6) at(u, () => kit.box([.1, .01, 2.2], [0, 0, -u], '#b8b09a'));
    for (const side of [-1, 1]) {
      kit.box([2.9, .08, span], [side * 5.35, .02, mid], '#aea493', 'paving');
      for (let u = F0; u < F1; u += 1.7) at(u + .8, () => kit.box([.24, .14, 1.6], [side * 3.98, .06, -u - .8], Math.floor((u + 1000) / 1.7) % 2 ? '#c7a84f' : '#2f2e2b'));
      // The pavement's back edge: the visitor walks the avenue, not into the lanes between its buildings.
      kit.solid([.6, 4, L + 2], [side * 7.25, 2, -L / 2]);
    }
    yield;
    // Frontages, south to north on each side, from a shared seeded sequence.
    for (const side of [-1, 1]) { yield* this.frontage(c, side, F0, F1, at); }
    // Second row: towers behind the frontage close the sky over the shops.
    for (const side of [-1, 1]) for (let u = F0 + 8; u < F1; u += 22 + kit.rand() * 10) {
      const h = 22 + kit.rand() * 40, w = 14 + kit.rand() * 8, tone = PASTELS[Math.floor(kit.rand() * PASTELS.length)];
      if (Math.abs(u - L / 2) < 14) continue;
      const x = side * (24 + kit.rand() * 10);
      piece(u, `tower${side}`, () => kit.frame([x, 0, -u], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => { backdropBlock(c, w, h, 14, tone); towerRelief(c, w, h, 14, tone); if (kit.rand() > .5) rooftop(c, w, h, 14); }),
        () => kit.frame([x, 0, -u], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => backdropBlock(c, w, h, 14, tone)));
      yield;
    }
    // Street lamps, trees and the odd utility pole with its sagging cables.
    for (const side of [-1, 1]) {
      for (let u = F0 + (side > 0 ? 6 : 18); u < F1 - 2; u += 24) if (Math.abs(u - L / 2) > 9) at(u, () => streetLight(c, side * 6.4, -u, side));
      // Coconut palms along the kerb (the gardens hold the broad-leaved trees); from afar, every other one.
      for (let [u, n] = [F0 + (side > 0 ? 14 : 3), 0]; u < F1 - 2; u += 21, n++) {
        if (Math.abs(u - L / 2) < 10) continue;
        piece(u, `tree${side}`, () => palm(c, side * 5.9, -u, 7 + kit.rand() * 2, .2), () => { if (n % 2) palm(c, side * 5.9, -u, 7 + kit.rand() * 2, .2); });
      }
      for (let u = F0 + 9 + (side > 0 ? 0 : 11); u < F1; u += 47) piece(u, `pole${side}`, () => {
        const x = side * 4.25; kit.cylinder(.11, 8.5, [x, 4.25, -u], '#5a4c3e', 'wood', true); kit.solid([.3, 3, .3], [x, 1.5, -u]); kit.box([1.2, .08, .08], [x, 7.6, -u], '#4a3e33', 'wood');
        for (let k = 0; k < 2; k++) { const y = 7 + k * .2, end: V3 = [side * 7.1, y - 1.1, -u + (k - .5) * 1.6], sag: V3 = [(x + end[0]) / 2, y - .5, (-u + end[2]) / 2]; kit.rod([x, y, -u], sag, .012, '#1d1e1e'); kit.rod(sag, end, .012, '#1d1e1e'); }
      });
      yield;
    }
    // A BEST stop on each side, a hoarding over the roofs, the direction gantries and the railway bridge.
    busStop(c, 5.9, -(L * .3), -Math.PI / 2, `${to.label.split(' ·')[0]} · BEST ROUTE ${120 + this.options.index * 7}`);
    busStop(c, -5.9, -(L * .7), Math.PI / 2, `${from.label.split(' ·')[0]} · BEST ROUTE ${120 + this.options.index * 7}`); yield;
    hoarding(c, -9, 13, -(L * .62), Math.PI / 2 - .5, 9, billboard(this.options.index), 'AD'); yield;
    this.gantry(c, -12, `${place(to)} ↑`, `${place(to)} · ${(2 + this.options.index * .6).toFixed(1)} KM`, 0);
    this.gantry(c, -(L - 12), `${place(from)} ↓`, `${place(from)} · ${(2 + this.options.index * .6).toFixed(1)} KM`, Math.PI); yield;
    this.railBridge(c, -L / 2); yield;
    // Kerbside parking: scooter rows nose-in at the kerb (a parked car would stand in the traffic lane here).
    for (const side of [-1, 1]) {
      for (let u = F0 + 10 + kit.rand() * 6; u < F1 - 6; u += 24 + kit.rand() * 14) {
        if (Math.abs(u - L / 2) < 12 || Math.abs(u - L * .3) < 7 || Math.abs(u - L * .7) < 7) continue;
        const n = 1 + Math.floor(kit.rand() * 3);
        piece(u, `bikes${side}`, () => {
          for (let i = 0; i < n; i++) this.park('bike', side * 3.45, -u - i * 2.1, (side > 0 ? Math.PI : 0) + (kit.rand() - .5) * .14, false);
          kit.solid([.8, 1.2, n * 2.1], [side * 3.45, .6, -u - (n - 1) * 1.05]);
        });
      }
      yield;
    }
  }
  /** One side's buildings, gaps and set pieces from u0 to u1 (drawn through `at`). */
  private *frontage(c: Ctx, side: number, u0: number, u1: number, at: (u: number, draw: () => void) => void): Generator<void> {
    const { kit } = c, r = () => kit.rand();
    let u = u0 + .5;
    while (u < u1 - 4) {
      // Keep the railway bridge's footings clear.
      if (u < L / 2 + 6 && u + 10 > L / 2 - 6) { u = L / 2 + 6; continue; }
      const pickType = r();
      let w: number;
      if (pickType < .1) { w = 6; at(u + w / 2, () => this.lane(c, side, -(u + w / 2))); }
      else if (pickType < .16) { w = 14; at(u + w / 2, () => this.garden(c, side, -(u + w / 2))); }
      else if (pickType < .2) { w = 7; at(u + w / 2, () => this.shrine(c, side, -(u + w / 2))); }
      else {
        w = 10 + Math.floor(r() * 4) * 2;
        const floors = 2 + Math.floor(r() * 4), color = PASTELS[Math.floor(r() * PASTELS.length)];
        const frame = (far: boolean) => () => kit.frame([side * 7.4, 0, -(u + w / 2)], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => shophouse(c, w, floors, color, far));
        this.piece(u + w / 2, `shop${side}`, frame(false), frame(true));
      }
      u += w + .3; yield;
    }
  }
  /** A lane between buildings, closed by a block across its far end. */
  private lane(c: Ctx, side: number, z: number) {
    const { kit } = c;
    kit.box([12, .05, 5.4], [side * 13, .0, z], '#8f8a7e', 'paving');
    kit.frame([side * 20, 0, z], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => backdropBlock(c, 8, 9 + kit.rand() * 6, 8, PASTELS[Math.floor(kit.rand() * PASTELS.length)]));
    for (const s of [-1, 1]) kit.box([12, 8, .3], [side * 13, 4, z + s * 2.85], '#a59a88', 'plaster');
  }
  /** A municipal garden behind railings with a shade tree. */
  private garden(c: Ctx, side: number, z: number) {
    const { kit } = c;
    kit.box([12, .06, 13.4], [side * 13.2, .02, z], '#5f7a45', 'foliage');
    kit.box([.3, .55, 13.4], [side * 7.3, .27, z], '#c9bda6', 'stone');
    for (let k = -6.5; k <= 6.5; k += .45) kit.box([.035, .9, .035], [side * 7.3, .9, z + k], '#3d4a44', 'metal');
    kit.box([.05, .05, 13.4], [side * 7.3, 1.35, z], '#3d4a44', 'metal');
    // One shade tree (a palm from afar), on its own random stream (see `piece`).
    this.piece(-z, 'garden', () => tree(c, side * 12.5, z, 7, '#4f7a3c', .9, 'almond'), () => palm(c, side * 12.5, z, 8, .15));
    kit.box([.3, 6, 13.4], [side * 19.3, 3, z], '#b3a893', 'plaster');
  }
  /** A small roadside shrine: steps, a white dome and a saffron flag. */
  private shrine(c: Ctx, side: number, z: number) {
    const { kit } = c;
    kit.frame([side * 8.6, 0, z], side > 0 ? -Math.PI / 2 : Math.PI / 2, () => {
      kit.box([5, .25, 3], [0, .12, -1.2], '#d8d0c0', 'stone'); kit.box([4, .25, 2.4], [0, .37, -1.4], '#d8d0c0', 'stone');
      kit.box([3, 2.4, 2.2], [0, 1.7, -1.6], '#f1e6d2', 'plaster'); kit.solid([3, 3, 2.2], [0, 1.5, -1.6]);
      kit.box([1.2, 1.6, .06], [0, 1.4, -.48], '#c2581c', 'fabric');
      kit.shape('cone', [1.2, 2.2, 1.2], [0, 4, -1.6], '#f4ede0', 'plaster'); kit.shape('sphere', [.18, .18, .18], [0, 5.2, -1.6], '#d4a33a', 'metal');
      kit.rod([.9, 2.9, -1.6], [.9, 6.4, -1.6], .025, '#6b5b45'); kit.shape('box', [.7, .45, .02], [1.25, 6.1, -1.6], '#ff7a1c', 'fabric', [0, 0, -.1]);
      for (const s of [-1, 1]) kit.box([.6, 4.5, 6], [s * 3.2, 2.25, -3.5], '#bdb2a0', 'plaster');
      sign(c, 'श्री गणेश मंदिर', 2.2, [0, 3.2, -.47], { bg: '#a3341c', fg: '#ffe7a8', border: 'none' }, [256, 64]);
    });
  }
  /** An overhead direction sign across the road at avenue z, facing `yaw` (0 faces traffic heading north). */
  private gantry(c: Ctx, z: number, title: string, sub: string, yaw: number) {
    const { kit } = c;
    for (const s of [-1, 1]) { kit.cylinder(.16, 6.6, [s * 6.6, 3.3, z], '#7a7f7a', 'metal', true); kit.solid([.4, 3, .4], [s * 6.6, 1.5, z]); }
    kit.box([13.4, .3, .3], [0, 6.2, z], '#7a7f7a', 'metal');
    kit.frame([0, 0, z], yaw, () => { kit.box([7.2, 1.8, .12], [1.4, 6.6, .2], '#1d5a3a', 'metal'); sign(c, title, 7, [1.4, 6.6, .27], { bg: '#1d5a3a', fg: '#ffffff', local: sub }, [512, 128]); });
  }
  /** The Western Railway crossing the avenue on a girder bridge halfway along; its piers stand behind the pavements. */
  private railBridge(c: Ctx, z: number) {
    const { kit } = c;
    for (const s of [-1, 1]) {
      kit.wall([3, 7.2, 9], [s * 9, 3.6, z], '#a39985', 'stone');
      kit.box([3.4, .5, 9.4], [s * 9, .25, z], '#8f8676', 'stone');
    }
    kit.box([40, 1.4, 8], [0, 7.9, z], '#8d8577', 'stone'); kit.box([40, .4, 8.6], [0, 7.1, z], '#6f685d', 'stone');
    for (const dz of [-3.9, 3.9]) { kit.box([40, 1.2, .25], [0, 9.2, z + dz], '#5b6f63', 'metal'); for (let x = -19; x <= 19; x += 2.4) kit.box([.12, 1.2, .3], [x, 9.2, z + dz], '#4a5b51', 'metal'); }
    for (let x = -18; x <= 18; x += 6) kit.box([.25, 6, .25], [x, 12, z - 3.4], '#4a4f4b', 'metal');
    kit.box([40, .08, .08], [0, 14.6, z - 3.4], '#2b2d2c', 'metal');
    for (const s of [-1, 1]) sign(c, 'WESTERN RAILWAY', 6, [0, 7.95, z + s * 4.03], { bg: '#6f685d', fg: '#f2e6c8', border: 'none', local: 'पश्चिम रेल्वे' }, [512, 128], s > 0 ? 0 : Math.PI);
  }
  private park(kind: CityVehicleKind, x: number, z: number, yaw: number, solid = true) {
    if (this.kit.muted) return;
    const mesh = createCityVehicle(kind, `avenue:${this.options.index}:${x}:${z.toFixed(2)}`, false, 2);
    // Avenue space → the district's frame: the kit frame is a translation along z.
    const lz = z + this.frameZ; mesh.position.set(x, .02, lz); mesh.rotation.y = yaw; mesh.updateMatrix(); this.parts.push(mesh.geometry.applyMatrix4(mesh.matrix));
    if (solid) { const width = kind === 'bike' ? .7 : 1.7; this.kit.solid([width, 1.4, VEHICLE_LENGTH[kind]], [x, .7, z], yaw); }
    this.options.onParked?.(kind, x, lz, yaw);
  }
  dispose(physics: CANNON.World) {
    this.kit.discard(); for (const body of this.kit.bodies) physics.removeBody(body);
    this.group.removeFromParent();
    const shared = paintMaterial();
    this.group.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.geometry.dispose(); for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat !== shared) mat.dispose(); });
  }
}

/** A district's name as the road signs give it. */
const place = (zone: { label: string; id: string }) => zone.id === 'cst' ? 'CST · FORT' : zone.label.split(' ·')[0].replace(' SEA FACE', '');

/** A shophouse in a facade frame: open shops below, painted flats above, a sunshade, balconies, tanks on the roof. */
/** `far`: as seen from a district down the avenue: the shell and shop fronts only, no goods, signs or fittings. */
function shophouse(c: Ctx, w: number, floors: number, color: string, far = false) {
  const { kit } = c, r = () => kit.rand(), d = 11, H = 3.6 + floors * 3.05, trim = shade(color, 1.1);
  kit.box([w, H - 3.6, d], [0, 3.6 + (H - 3.6) / 2, -d / 2], color, 'facade');
  for (const s of [-1, 1]) kit.box([.3, 3.6, d], [s * (w / 2 - .15), 1.8, -d / 2], shade(color, .9), 'plaster');
  kit.box([w, 3.6, .3], [0, 1.8, -d + .15], shade(color, .9), 'plaster');
  kit.box([w + .3, .18, 1.1], [0, 3.62, .4], trim, 'stone');
  kit.box([w + .2, .25, d + .2], [0, H + .12, -d / 2], shade(color, .85), 'stone');
  kit.solid([w, 4, d], [0, 2, -d / 2]);
  // Ground-floor shops: three or four bays, open or shuttered.
  const bays = Math.max(2, Math.round(w / 3.6)), bw = w / bays;
  if (far) {
    // Lit or shuttered bays under their coloured sign boards, between the piers.
    for (let i = 0; i < bays; i++) {
      const cx = -w / 2 + bw * (i + .5);
      kit.box([bw - .3, 2.7, .1], [cx, 1.35, -.9], r() > .3 ? '#c9b48e' : '#8f918a', 'plaster');
      kit.box([bw - .3, .55, .12], [cx, 3.08, .16], pick(r, SHOP_BG), 'plaster');
      kit.box([.3, 3.6, .4], [cx - bw / 2 + .15, 1.8, 0], shade(color, .92), 'plaster');
    }
    kit.box([.3, 3.6, .4], [w / 2 - .15, 1.8, 0], shade(color, .92), 'plaster');
    return;
  }
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + bw * (i + .5), [en, local] = SHOPS[Math.floor(r() * SHOPS.length)], open = r() > .22;
    kit.box([bw - .3, 3.1, .1], [cx, 1.55, -1.7], open ? pick(r, ['#d8c4a0', '#c9d4cf', '#e3d7c3', '#efe2c4']) : '#4a4743', 'plaster');
    kit.box([.3, 3.6, .4], [cx - bw / 2 + .15, 1.8, 0], shade(color, .92), 'plaster');
    if (open) {
      kit.box([bw - .7, .07, .07], [cx, 2.95, -.1], '#ffd9a0', 'glow');
      for (const y of [.8, 1.5]) { kit.box([bw - .7, .05, .4], [cx, y, -1.45], '#8a6a48', 'wood'); for (let n = 0; n < 3; n++) kit.box([.45, .25, .3], [cx - bw / 2 + .7 + n * (bw - 1.4) / 2, y + .16, -1.45], pick(r, ['#c9463d', '#e0b43c', '#3f7fbf', '#5aa05a', '#e07a30', '#d5d5d0', '#7a4a8a'])); }
      kit.box([bw - 1, .9, .6], [cx, .45, -.6], '#7a5d43', 'wood');
    } else {
      kit.box([bw - .35, 2.9, .06], [cx, 1.45, -.05], '#8f918a', 'metal');
      for (let y = .4; y < 2.9; y += .5) kit.box([bw - .33, .04, .03], [cx, y, -.01], '#6b6e69', 'metal');
    }
    sign(c, en, bw - .3, [cx, 3.08, .22], { bg: pick(r, SHOP_BG), fg: '#f4e6c0', local }, [256, 64]);
    if (open && r() > .3) kit.shape('box', [bw - .2, .05, 1.2], [cx, 2.78, .62], pick(r, AWNINGS), 'fabric', [.28, 0, 0]);
  }
  kit.box([.3, 3.6, .4], [w / 2 - .15, 1.8, 0], shade(color, .92), 'plaster');
  // Upper floors: balconies, box ACs and the odd painted name.
  for (let f = 0; f < floors; f++) {
    const y = 3.6 + f * 3.05 + .15;
    if (r() < .45) { const bw2 = w * (.35 + r() * .3), x = (r() - .5) * (w - bw2); kit.box([bw2, .12, .9], [x, y, .45], trim, 'stone'); kit.box([bw2, .9, .04], [x, y + .5, .88], '#4a4f4b', 'metal'); }
    if (r() < .5) kit.box([.72, .46, .36], [(r() - .5) * (w - 2), y + 1.4, .2], '#d7d6cf', 'metal');
  }
  if (r() < .35) sign(c, pick(r, ['SAI KRUPA', 'GANESH BHAVAN', 'LAXMI NIWAS', 'SHIV SHAKTI', 'ANAND APTS', 'MOTI MAHAL', 'SAGAR KUNJ']), Math.min(5, w * .45), [0, H - .7, .05], { bg: shade(color, .8), fg: '#3b2a1c', border: 'none' }, [256, 64]);
  if (r() < .6) rooftop(c, w, H, d);
}
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];

/** Rooftop hoardings: original artwork, plain canvas calls. */
function billboard(index: number) {
  const ads: Array<[string, string, string, string]> = [
    ['#1f4e79', '#f2c14e', 'MUMBAI METRO', 'Line 3 · Colaba–Bandra–SEEPZ'], ['#7a1f2b', '#f6d38a', 'CHAI & CODE', 'Open late · Wi-Fi · cutting chai'],
    ['#2c5e3a', '#f0e2b0', 'MONSOON READY?', 'Umbrellas · raincoats · since 1962'], ['#3a2f6a', '#e9a33c', 'SHIP IT', 'Open source, one pull request at a time'],
    ['#6b3a1f', '#f4d488', 'VADA PAV', 'Mumbai’s burger · ₹20'], ['#14303a', '#f0b03a', 'BEST', 'Bus · Electric · Every 6 minutes'], ['#4a1f22', '#f0b03a', 'FILM CITY', 'Studio tours · Goregaon'],
  ];
  const [bg, accent, title, sub] = ads[index % ads.length];
  return (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = accent; ctx.fillRect(x, y + h * .74, w, h * .26);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fffaf0'; ctx.font = `bold ${Math.round(h * .2)}px Arial, sans-serif`; ctx.fillText(title, x + w * .05, y + h * .36, w * .9);
    ctx.font = `${Math.round(h * .09)}px Arial, sans-serif`; ctx.fillText(sub, x + w * .05, y + h * .52, w * .9);
    ctx.fillStyle = bg; ctx.font = `bold ${Math.round(h * .1)}px Arial, sans-serif`; ctx.fillText('HARSH JHA · PORTFOLIO CITY', x + w * .05, y + h * .92, w * .9);
  };
}
