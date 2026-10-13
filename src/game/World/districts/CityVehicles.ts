import * as THREE from 'three';
import { ColorMesh, paintMaterial } from './ColorMesh';
import { createSeatedDriver } from '../npc/NPCFactory';
import { seededRandom } from '../StreetArchitecture';

/**
 * Mumbai road traffic as single-draw meshes: BEST double-decker, hatchbacks and sedans,
 * kaali-peeli taxis, autos, motorbikes, a Tata tempo, handcarts and milk bicycles.
 * Drivers are baked seated people merged into the body. Front faces -Z (the heading convention).
 */
export type CityVehicleKind = 'bus' | 'hatch' | 'sedan' | 'taxi' | 'auto' | 'bike' | 'tempo' | 'cart' | 'cycle' | 'suv';
export const VEHICLE_LENGTH: Record<CityVehicleKind, number> = { bus: 10.4, hatch: 3.7, sedan: 4.4, suv: 4.6, taxi: 4.1, auto: 2.7, bike: 2.0, tempo: 5.6, cart: 2.2, cycle: 1.8 };
export const VEHICLE_SPEED: Record<CityVehicleKind, number> = { bus: 4.2, hatch: 5.6, sedan: 5.8, suv: 5.8, taxi: 5.2, auto: 4.6, bike: 6.2, tempo: 4.4, cart: 1.1, cycle: 2.6 };

const driverCache = new Map<string, THREE.BufferGeometry>();
function driver(seed: string) {
  if (!driverCache.has(seed)) { const mesh = createSeatedDriver(`city:${seed}`, 'street'); driverCache.set(seed, mesh.geometry); }
  return driverCache.get(seed)!;
}
function addDriver(m: ColorMesh, seed: string, x: number, y: number, z: number) {
  m.colored(driver(seed), [x, y, z]);
}

const glass = '#26343a', chrome = '#a8aaa3', tyre = '#1b1d1e', lamp = '#f4e7c2', tail = '#9c2b22';

export function createCityVehicle(kind: CityVehicleKind, seed: string, rider = true) {
  const r = seededRandom(`vehicle:${seed}`), m = new ColorMesh(), pick = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
  switch (kind) {
    case 'bus': {
      const red = '#b0261d', cream = '#e8dcc2', L = 10.2;
      m.rounded([2.5, 1.95, L], [0, 1.33, 0], red); m.rounded([2.48, 1.85, L - .25], [0, 3.28, .1], red);
      m.box([2.54, .16, L - .1], [0, 2.32, 0], cream); m.rounded([2.42, .14, L - .4], [0, 4.24, .1], cream);
      for (const y of [1.72, 3.32]) for (const s of [-1, 1]) {
        m.box([.04, .78, L - 1.6], [s * 1.255, y, .45], glass);
        for (let z = -L / 2 + 1.3; z < L / 2 - .2; z += 1.12) m.box([.06, .8, .1], [s * 1.26, y, z], red);
      }
      m.box([2.2, .9, .05], [0, 1.85, -L / 2 - .01], glass); m.box([2.2, .75, .05], [0, 3.35, -L / 2 + .12], glass);
      m.box([1.7, .26, .06], [0, 4.0, -L / 2 + .1], '#e4b13d'); m.box([1.2, .12, .07], [0, 4.0, -L / 2 + .08], '#3b2a12');
      m.box([.9, 1.95, .05], [-1.26, 1.25, -L / 2 + 1.3], '#2a2f30'); m.box([.05, 1.95, .9], [-1.26, 1.25, L / 2 - 1.4], '#2a2f30');
      for (const s of [-1, 1]) { m.box([.28, .18, .05], [s * .9, .75, -L / 2 - .02], lamp); m.box([.25, .2, .05], [s * .95, .8, L / 2 + .02], tail); }
      m.box([2.4, .32, .2], [0, .48, -L / 2 - .05], '#2b2b2b'); m.box([.6, .12, .05], [0, .55, -L / 2 - .16], '#f2efe6');
      for (const z of [-L / 2 + 1.8, L / 2 - 2.2]) for (const s of [-1, 1]) m.wheel(.5, .34, [s * 1.08, .5, z]);
      if (rider) addDriver(m, `${seed}:bus`, .65, .25, -L / 2 + 1.0); break;
    }
    case 'hatch': case 'sedan': case 'suv': case 'taxi': {
      const L = kind === 'hatch' ? 3.6 : kind === 'taxi' ? 4.0 : kind === 'suv' ? 4.5 : 4.3, W = kind === 'suv' ? 1.8 : 1.62;
      const body = kind === 'taxi' ? '#1f2224' : pick(['#e9e8e2', '#b9bcbd', '#8d9296', '#a32c26', '#2a4d78', '#e3dfd2', '#5b5f63']);
      const H = kind === 'suv' ? .95 : .62, cabin = kind === 'hatch' ? [L * .58, .1] : kind === 'suv' ? [L * .7, .2] : [L * .48, .05];
      m.rounded([W, H, L], [0, .32 + H / 2, 0], body);
      if (kind === 'taxi') { m.rounded([W * .9, .52, L * .46], [0, 1.18, .12], '#d9b13b'); m.rounded([W * .86, .08, L * .42], [0, 1.45, .12], '#e0bb45'); m.box([.42, .12, .16], [0, 1.53, .12], '#d9b13b'); m.box([.34, .07, .17], [0, 1.53, .12], '#202020'); }
      else m.rounded([W * .9, kind === 'suv' ? .72 : .55, cabin[0]], [0, .32 + H + (kind === 'suv' ? .33 : .25), cabin[1] * L], body);
      const ch = kind === 'suv' ? 1.62 : 1.18, cw = cabin[0];
      for (const s of [-1, 1]) m.box([.03, kind === 'suv' ? .48 : .36, cw * .85], [s * W * .455, ch, cabin[1] * L], glass);
      m.box([W * .78, kind === 'suv' ? .48 : .38, .04], [0, ch, cabin[1] * L - cw / 2 - .01], glass, [-.35, 0, 0]);
      m.box([W * .78, .34, .04], [0, ch, cabin[1] * L + cw / 2 + .01], glass, [.35, 0, 0]);
      for (const s of [-1, 1]) { m.box([.3, .12, .04], [s * W * .33, .72, -L / 2 - .01], lamp); m.box([.26, .12, .04], [s * W * .36, .78, L / 2 + .01], tail); }
      m.box([W * .95, .16, .12], [0, .42, -L / 2 - .02], kind === 'taxi' ? chrome : '#2b2d2f'); m.box([.5, .12, .03], [0, .55, -L / 2 - .09], kind === 'taxi' ? '#f1d248' : '#f2efe6');
      for (const z of [-L * .33, L * .32]) for (const s of [-1, 1]) m.wheel(kind === 'suv' ? .36 : .3, .2, [s * W * .45, kind === 'suv' ? .36 : .3, z], tyre, chrome);
      if (rider) addDriver(m, `${seed}:car`, .36, kind === 'suv' ? -.12 : -.32, cabin[1] * L - .05); break;
    }
    case 'auto': {
      // Mumbai's black-and-yellow three-wheeler: open sides, canvas hood, bench seat.
      const black = '#1c1f1e', yellow = '#d8b23a';
      m.rounded([1.3, .5, 2.15], [0, .6, .12], black); m.rounded([.78, .62, .55], [0, 1.0, -.9], black);
      m.rounded([1.4, .1, 2.05], [0, 1.9, .12], yellow); m.rounded([1.42, .22, .2], [0, 1.82, -.88], yellow); m.rounded([1.36, .85, .06], [0, 1.42, 1.13], black);
      for (const s of [-1, 1]) { m.rod([s * .64, .85, -.86], [s * .66, 1.85, -.86], .025, '#2a2a2a'); m.rod([s * .64, .85, .92], [s * .66, 1.85, 1.0], .025, '#2a2a2a'); m.box([.04, .16, 1.9], [s * .66, 1.74, .1], yellow); }
      m.rounded([1.16, .32, .5], [0, .98, .68], '#4a3a2c'); m.rounded([1.16, .5, .12], [0, 1.25, .95], '#4a3a2c');
      m.box([.95, .55, .04], [0, 1.45, -.92], glass, [-.15, 0, 0]); m.box([.18, .14, .05], [0, .95, -1.18], lamp); m.box([.7, .12, .05], [0, .7, 1.2], '#e8d24a');
      m.wheel(.25, .14, [0, .25, -.95]); for (const s of [-1, 1]) m.wheel(.26, .16, [s * .62, .26, .75]);
      if (rider) addDriver(m, `${seed}:auto`, 0, -.27, -.25); break;
    }
    case 'bike': case 'cycle': {
      const frame = kind === 'bike' ? pick(['#1f2a44', '#7b1e1e', '#2b2b2b', '#5c6168']) : '#2a2f36', rad = kind === 'bike' ? .3 : .33;
      m.wheel(rad, .08, [0, rad, -.68], tyre, '#777'); m.wheel(rad, .08, [0, rad, .66], tyre, '#777');
      if (kind === 'bike') { m.rounded([.3, .28, .55], [0, .72, -.2], frame); m.rounded([.28, .12, .6], [0, .86, .25], '#1a1a1a'); m.rounded([.34, .3, .4], [0, .45, .05], '#55595b'); m.rod([0, .9, -.55], [0, .35, -.68], .025, chrome); m.box([.62, .03, .03], [0, 1.0, -.52], '#202020'); m.box([.16, .14, .1], [0, .92, -.62], lamp); }
      else { m.rod([0, .33, .66], [0, .82, .12], .02, frame); m.rod([0, .82, .12], [0, .9, -.5], .02, frame); m.rod([0, .33, -.68], [0, .95, -.55], .02, frame); m.rod([0, .33, .1], [0, .82, .12], .02, frame); m.box([.5, .03, .03], [0, 1.0, -.55], '#202020');
        for (const s of [-1, 1]) m.shape('cylinder', [.13, .4, .13], [s * .24, .62, .55], '#b9bab5'); }
      if (rider) addDriver(m, `${seed}:rider`, 0, kind === 'bike' ? -.15 : -.05, kind === 'bike' ? .2 : .25); break;
    }
    case 'tempo': {
      const cab = pick(['#2d5f8f', '#d4a13a', '#c9c2b0']);
      m.rounded([1.95, 1.55, 1.6], [0, 1.25, -1.9], cab); m.box([1.8, .7, .04], [0, 1.65, -2.71], glass, [-.1, 0, 0]);
      for (const s of [-1, 1]) m.box([.03, .55, .7], [s * .98, 1.6, -1.95], glass);
      m.box([2.05, .2, 3.6], [0, .78, .75], '#3d3a35');
      for (const s of [-1, 1]) m.box([.06, .6, 3.6], [s * 1.0, 1.15, .75], '#9b6b3a'); m.box([2.0, .6, .06], [0, 1.15, 2.55], '#9b6b3a');
      for (let i = 0; i < 6; i++) m.rounded([.75, .42, .62], [(i % 2 - .5) * .85, 1.12 + Math.floor(i / 4) * .3, -.4 + (i % 3) * .95], '#c4b08a');
      m.rounded([1.9, .2, 2.4], [0, 1.5, .9], '#3f6e8f');
      for (const s of [-1, 1]) { m.box([.24, .14, .04], [s * .7, .9, -2.71], lamp); m.wheel(.38, .24, [s * .85, .38, -1.85]); m.wheel(.38, .3, [s * .85, .38, 1.6]); }
      m.box([1.9, .3, .1], [0, .58, -2.72], '#2b2b2b');
      if (rider) addDriver(m, `${seed}:tempo`, .42, .03, -2.0); break;
    }
    case 'cart': {
      m.box([1.2, .08, 1.9], [0, .78, 0], '#8a6239'); for (const s of [-1, 1]) m.box([.06, .18, 1.9], [s * .6, .88, 0], '#6f4c2b');
      for (const s of [-1, 1]) m.wheel(.42, .07, [s * .66, .42, .15], '#5a3e24', '#3a2a1a');
      m.rod([-.45, .8, -.95], [-.45, .95, -1.35], .03, '#6f4c2b'); m.rod([.45, .8, -.95], [.45, .95, -1.35], .03, '#6f4c2b');
      const produce = pick([['#e3742b', '#e7a43a'], ['#5e8f3a', '#a7c45a'], ['#c8352d', '#e24f3a'], ['#f0d34a', '#8cbf4a']]);
      for (let i = 0; i < 26; i++) m.shape('sphere', [.09, .08, .09], [-.48 + (i % 6) * .19, .9 + Math.floor(i / 12) * .1, -.75 + (i % 5) * .37], produce[i % 2]);
      break;
    }
  }
  const mesh = new THREE.Mesh(m.build(), paintMaterial()); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `city-vehicle:${kind}`;
  return mesh;
}
