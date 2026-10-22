import * as THREE from 'three';
import type { DistrictCast } from './DistrictCast';
import type { Outfit } from './CityFolk';
import { CAB_WHEEL, type RiderGrip } from './CityVehicles';
import { bakeFigure, footOn, gripWith, turnBone } from './bakePose';

/**
 * Drivers and riders of district traffic with their hands on the controls: the auto's and two-wheelers' handlebar
 * grips, the bus's and tempo's steering wheel. Each cast member is baked once per grip into a static body (the sit
 * clip, the spine leaned towards the bars, both arms solved onto the grips, fingers closed), so a street of riders
 * adds no skinning and no bone texture.
 *
 * Grip points are in seat space: metres from the vehicle's seat point (`userData.seat`), vehicle axes (front −Z).
 * The left hand is on −X; the right one mirrors it.
 */
/** The left hand at ten to the hour on CAB_WHEEL's rim (the right one mirrors it to two). */
function wheelGrip(): [number, number, number] {
  const { at, radius, tilt } = CAB_WHEEL, side = Math.sin(Math.PI / 3) * radius, up = Math.cos(Math.PI / 3) * radius;
  return [at[0] - side, at[1] + up * Math.cos(tilt), at[2] - up * Math.sin(tilt) + .02];
}
interface Grip { hand: [number, number, number]; lean: number; forward: number; foot?: [number, number, number] }
export const RIDER_GRIPS: Record<RiderGrip, Grip> = {
  auto: { hand: [-.27, .41, -.37], lean: .08, forward: 0, foot: [-.13, -.42, -.42] },
  scooter: { hand: [-.27, .25, -.68], lean: .3, forward: -.1, foot: [-.12, -.5, -.38] },
  'scooter-model': { hand: [-.3, .33, -.5], lean: .14, forward: 0, foot: [-.12, -.5, -.38] },
  motorbike: { hand: [-.28, .25, -.68], lean: .32, forward: -.08 },
  'motorbike-model': { hand: [-.33, .29, -.75], lean: .3, forward: -.08 },
  cycle: { hand: [-.23, .13, -.8], lean: .5, forward: -.06 },
  bus: { hand: wheelGrip(), lean: .04, forward: 0 },
  tempo: { hand: wheelGrip(), lean: .04, forward: 0 },
};
/** Pelvis height above the seat point (as the seated cast elsewhere: the cushion is under the seat point). */
const PELVIS_ABOVE_SEAT = .12;
/** LOD 1 (the in-file reduced body) near the visitor, LOD 2 (simplified) beyond. */
const LEVELS = [1, 2] as const;

const bodies = new WeakMap<DistrictCast, Map<string, { geometries: THREE.BufferGeometry[]; material: THREE.Material | THREE.Material[] }>>();

/** The baked body for this member and grip (built on first use, shared by every rider like it). */
function body(cast: DistrictCast, outfit: Outfit, key: string, grip: RiderGrip) {
  const figure = cast.figure(outfit, 'sit', key), id = `${figure.member.id}:${grip}`;
  let byCast = bodies.get(cast); if (!byCast) { byCast = new Map(); bodies.set(cast, byCast); }
  let entry = byCast.get(id);
  if (!entry) {
    const g = RIDER_GRIPS[grip], drop = PELVIS_ABOVE_SEAT - figure.pelvisHeight;
    // Seat space ← person space: the seated body lowered onto the cushion and moved up to the controls.
    const place = new THREE.Matrix4().makeTranslation(0, drop, g.forward);
    const person = (p: [number, number, number], mirror: number) => new THREE.Vector3(p[0] * mirror, p[1] - drop, p[2] - g.forward);
    const geometries = LEVELS.map(level => bakeFigure(cast, figure, level, place, (bones, toRig) => {
      // Lean the body from the hips towards the bars (spine and neck share it), then reach and grip.
      const spine = bones(/_Spine$/), neck = bones(/_Neck$/), right = new THREE.Vector3(1, 0, 0);
      if (spine) turnBone(spine, toRig, right, -g.lean); if (neck) turnBone(neck, toRig, right, g.lean * .6);
      if (g.foot) { footOn(bones, toRig, 'L', person(g.foot, 1)); footOn(bones, toRig, 'R', person(g.foot, -1)); }
      gripWith(bones, toRig, [person(g.hand, 1), person(g.hand, -1)]);
    }));
    entry = { geometries, material: figure.member.material }; byCast.set(id, entry);
  }
  figure.dispose();
  return entry;
}

/** A static rider in a vehicle's seat, holding its controls. Same interface as a cast figure for the traffic. */
export class BakedRider {
  readonly mesh: THREE.Mesh; private level = 0;
  constructor(private geometries: THREE.BufferGeometry[], material: THREE.Material | THREE.Material[], seat: [number, number, number]) {
    this.mesh = new THREE.Mesh(geometries[0], material); this.mesh.position.set(...seat);
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.name = 'district:rider';
    // Like the cast figures: the district's GPU sweep must leave the shared material and baked bodies alone.
    this.mesh.userData.districtCast = true;
  }
  setLevel(level: 0 | 1 | 2) { const index = level < 2 ? 0 : 1; if (index === this.level) return; this.level = index; this.mesh.geometry = this.geometries[index]; }
  dispose() { this.mesh.removeFromParent(); }
}

/** Seat a rider in `vehicle` if it has a driving seat and a grip, or return null (cars with opaque glass, carts). */
export function seatRider(vehicle: THREE.Object3D, cast: DistrictCast, outfit: Outfit, key: string) {
  const seat = vehicle.userData.seat as [number, number, number] | null, grip = vehicle.userData.grip as RiderGrip | null;
  if (!seat || !grip) return null;
  const { geometries, material } = body(cast, outfit, key, grip);
  const rider = new BakedRider(geometries, material, seat); vehicle.add(rider.mesh); return rider;
}
