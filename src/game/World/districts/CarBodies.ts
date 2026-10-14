import * as THREE from 'three';
import type { ColorMesh } from './ColorMesh';

/**
 * Lofted private-car bodies: the shell is swept through rounded cross-sections along the car,
 * following a side profile (nose, bonnet, windscreen, roof, rear glass, boot), so cars read as
 * smooth pressed metal instead of stacked boxes. Front faces −Z, like every district vehicle.
 */
export interface CarShape {
  L: number; W: number; sill: number; belt: number; roof: number;
  /** Height of the nose top, and of the boot lid at the tail. */
  nose: number; tail: number;
  /** z of the windscreen base, the roof's front and rear edges, and the rear glass base (from the front, metres). */
  screen: number; roofFront: number; roofRear: number; rearGlass: number;
  wheel: number; wheelbase: [number, number];
}
export const CAR_SHAPES: Record<'hatch' | 'sedan' | 'suv' | 'taxi', CarShape> = {
  hatch: { L: 3.7, W: 1.66, sill: .3, belt: .88, roof: 1.48, nose: .7, tail: .84, screen: .95, roofFront: 1.75, roofRear: 3.2, rearGlass: 3.52, wheel: .3, wheelbase: [.72, 3.0] },
  sedan: { L: 4.35, W: 1.7, sill: .3, belt: .86, roof: 1.44, nose: .68, tail: .84, screen: 1.25, roofFront: 1.95, roofRear: 3.05, rearGlass: 3.62, wheel: .31, wheelbase: [.9, 3.45] },
  suv: { L: 4.5, W: 1.84, sill: .44, belt: 1.12, roof: 1.8, nose: .98, tail: 1.08, screen: 1.0, roofFront: 1.62, roofRear: 4.15, rearGlass: 4.3, wheel: .37, wheelbase: [.85, 3.55] },
  taxi: { L: 4.1, W: 1.62, sill: .3, belt: .84, roof: 1.46, nose: .7, tail: .8, screen: 1.15, roofFront: 1.75, roofRear: 2.95, rearGlass: 3.4, wheel: .3, wheelbase: [.8, 3.25] },
};

const smooth = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** A superellipse point: angle t, exponent 2/n keeps sides flat and corners round. */
const se = (t: number, n: number) => [Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** (2 / n), Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** (2 / n)];

export function carBody(m: ColorMesh, s: CarShape, paint: string, trim: { glass: string; dark: string; lamp: string; tail: string; plate: string; bumper: string; roof?: string }) {
  const lite = m.lite, rings = lite ? 9 : 16, around = lite ? 12 : 18, z0 = -s.L / 2;
  // Bonnet rises from the nose to the windscreen; the boot falls from the rear glass to the tail.
  const top = (z: number) => {
    const d = z - z0;
    if (d < s.screen) return s.nose + (s.belt - s.nose) * smooth(0, s.screen, d) - .08 * (1 - smooth(0, .3, d));
    if (d > s.rearGlass) return s.belt + (s.tail - s.belt) * smooth(s.rearGlass, s.L, d) - .07 * smooth(s.L - .3, s.L, d);
    return s.belt;
  };
  // Plan view: square-ish with rounded corners, a little narrower at the bumpers.
  const half = (z: number) => s.W / 2 * (1 - .07 * Math.abs((z - z0) / s.L * 2 - 1) ** 6);
  const lower: THREE.Vector3[][] = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings, d = (1 - Math.cos(u * Math.PI)) / 2 * s.L, z = z0 + d, end = Math.min(d, s.L - d), shrink = 1 - .14 * (1 - smooth(0, .22, end));
    const hi = top(z), lo = s.sill + .06 * (1 - smooth(0, .4, end)), w = half(z) * shrink, yc = (hi + lo) / 2, hh = (hi - lo) / 2 * (end < .02 ? .8 : 1);
    lower.push(Array.from({ length: around }, (_, k) => { const [x, y] = se(k / around * Math.PI * 2, 4.5); return new THREE.Vector3(x * w, yc + y * hh, z); }));
  }
  m.loft(lower, paint);
  // Glasshouse: tumblehome sides, windscreen and rear glass, in tinted glass with the roof skinned over it.
  const glassRings = lite ? 6 : 10, side = lite ? 8 : 10, roofZ = (z: number) => {
    const d = z - z0; return d < s.roofFront ? s.belt + (s.roof - s.belt) * smooth(s.screen, s.roofFront, d) * .98 + (d > s.screen ? .01 : 0)
      : d > s.roofRear ? s.roof + (top(z) - s.roof) * smooth(s.roofRear, s.rearGlass, d) : s.roof + .02 * Math.sin((d - s.roofFront) / (s.roofRear - s.roofFront) * Math.PI);
  };
  const house = (from: number, to: number, a0: number, a1: number, grow: number, closed: boolean, count: number) => {
    const out: THREE.Vector3[][] = [];
    for (let i = 0; i <= count; i++) {
      const z = z0 + from + (to - from) * i / count, h = Math.max(.004, roofZ(z) - s.belt + .015), wb = half(z) * .95, wt = half(z) * .74, ring: THREE.Vector3[] = [];
      for (let k = 0; k <= side; k++) {
        const t = a0 + (a1 - a0) * k / side, [x, y] = se(t, 6), f = Math.max(0, y);
        ring.push(new THREE.Vector3(x * (wb + (wt - wb) * f) * grow, s.belt - .015 + f * h * grow, z));
      }
      if (closed) ring.push(new THREE.Vector3(-wb, s.belt - .02, z), new THREE.Vector3(wb, s.belt - .02, z));
      out.push(ring);
    }
    return out;
  };
  m.loft(house(s.screen, s.rearGlass, 0, Math.PI, 1, true, glassRings), trim.glass, false);
  m.loft(house(s.roofFront + .03, s.roofRear - .03, Math.PI * .3, Math.PI * .7, 1.012, false, Math.max(2, glassRings >> 1)), trim.roof ?? paint, false, false);
  // Pillars in body colour along the glass edges.
  const wb = half(z0 + s.screen) * .95, wt = half(z0 + s.roofFront) * .74;
  for (const sd of [-1, 1]) {
    m.rod([sd * wb, s.belt, z0 + s.screen + .02], [sd * wt * .93, s.roof - .03, z0 + s.roofFront], .026, paint);
    m.rod([sd * half(z0 + s.roofRear) * .74 * .93, s.roof - .03, z0 + s.roofRear], [sd * half(z0 + s.rearGlass) * .95, top(z0 + s.rearGlass), z0 + s.rearGlass - .02], .034, paint);
    const bz = z0 + (s.roofFront + s.roofRear) / 2; m.rod([sd * half(bz) * .955, s.belt, bz], [sd * half(bz) * .72, s.roof - .03, bz - .02], .03, trim.dark);
    // Mirror, door shut lines, a chrome waist strip and handles.
    m.rounded([.06, .1, .16], [sd * (s.W / 2 + .07), s.belt + .06, z0 + s.screen + .12], paint);
    for (const dz of [s.screen + .05, (s.roofFront + s.roofRear) / 2]) m.box([.006, (s.belt - s.sill) * .78, .012], [sd * (s.W / 2 + .001), (s.belt + s.sill) / 2 + .03, z0 + dz], trim.dark);
    m.box([.006, .022, s.rearGlass - s.screen - .1], [sd * (s.W / 2 * .975), s.belt - .03, z0 + (s.screen + s.rearGlass) / 2], '#a6a9a8');
    for (const dz of [s.screen + .5, (s.roofFront + s.roofRear) / 2 + .45]) m.box([.02, .025, .13], [sd * (s.W / 2 + .004), s.belt - .13, z0 + dz], shade(paint, .7));
  }
  // Bumpers, lamps, grille and plates.
  for (const [z, front] of [[z0 + .06, true], [z0 + s.L - .06, false]] as const) {
    m.rounded([s.W * .9, .17, .2], [0, s.sill + .1, z + (front ? .04 : -.04)], trim.bumper);
    m.box([.42, .11, .02], [0, s.sill + (front ? .1 : .3), z + (front ? -.11 : .11)], trim.plate);
  }
  for (const sd of [-1, 1]) {
    m.rounded([.36, .13, .08], [sd * s.W * .33, s.nose - .1, z0 + .1], trim.lamp);
    m.rounded([.34, .12, .08], [sd * s.W * .35, s.tail - .12, z0 + s.L - .08], trim.tail);
    m.box([.05, .04, .02], [sd * s.W * .43, s.sill + .14, z0 + .015], '#e3a23a');
  }
  m.rounded([s.W * .38, .14, .06], [0, s.nose - .14, z0 + .07], trim.dark);
  // Wheels stand just proud of dark arch openings.
  for (const d of s.wheelbase) {
    const z = z0 + d;
    for (const sd of [-1, 1]) {
      m.shape('tyre', [s.wheel * 1.17, .02, s.wheel * 1.17], [sd * (half(z) + .004), s.wheel + .02, z], '#121314', [0, 0, Math.PI / 2]);
      m.wheel(s.wheel, .2, [sd * (s.W / 2 - .07), s.wheel, z], '#1b1d1e', '#a5a8a6');
    }
  }
  return { z0 };
}
const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

/**
 * Rings for a smooth lofted part: at each station along z, a superellipse cross-section of half-width
 * w and from y0 to y1. `n` sets how square the section is (2 round, 6 nearly boxy).
 */
export function sweep(stations: Array<[z: number, w: number, y0: number, y1: number]>, around: number, n = 4, x = 0) {
  return stations.map(([z, w, y0, y1]) => Array.from({ length: around }, (_, k) => {
    const [cx, cy] = se(k / around * Math.PI * 2, n); return new THREE.Vector3(x + cx * w, (y0 + y1) / 2 + cy * (y1 - y0) / 2, z);
  }));
}
/** Upper half (a canopy or a hood) of the same sections, as an open strip from one side to the other. */
export function arch(stations: Array<[z: number, w: number, y0: number, y1: number]>, segments: number, n = 4, a0 = 0, a1 = Math.PI) {
  return stations.map(([z, w, y0, y1]) => Array.from({ length: segments + 1 }, (_, k) => {
    const [cx, cy] = se(a0 + (a1 - a0) * k / segments, n); return new THREE.Vector3(cx * w, y0 + Math.max(0, cy) * (y1 - y0), z);
  }));
}
