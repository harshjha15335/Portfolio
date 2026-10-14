import * as THREE from 'three';
import { ColorMesh, paintMaterial, type V3 } from './ColorMesh';
import { arch, carBody, CAR_SHAPES, sweep } from './CarBodies';
import { createSeatedDriver } from '../npc/NPCFactory';
import { seededRandom } from '../StreetArchitecture';
import { cityVehicleGeometry } from './CityVehicleModels';

/**
 * Mumbai road traffic as single-draw meshes: BEST double-decker, hatchbacks and sedans,
 * kaali-peeli taxis, autos, motorbikes, a Tata tempo, handcarts and milk bicycles.
 * Drivers are baked seated people merged into the body. Front faces -Z (the heading convention).
 */
export type CityVehicleKind = 'bus' | 'hatch' | 'sedan' | 'taxi' | 'auto' | 'bike' | 'tempo' | 'cart' | 'cycle' | 'suv';
export const VEHICLE_LENGTH: Record<CityVehicleKind, number> = { bus: 11.0, hatch: 3.7, sedan: 4.4, suv: 4.6, taxi: 4.1, auto: 2.7, bike: 2.0, tempo: 5.6, cart: 2.2, cycle: 1.8 };
export const VEHICLE_SPEED: Record<CityVehicleKind, number> = { bus: 4.2, hatch: 5.6, sedan: 5.8, suv: 5.8, taxi: 5.2, auto: 4.6, bike: 6.2, tempo: 4.4, cart: 1.1, cycle: 2.6 };

const driverCache = new Map<string, THREE.BufferGeometry>();
function driver(seed: string) {
  if (!driverCache.has(seed)) { const mesh = createSeatedDriver(`city:${seed}`, 'street'); driverCache.set(seed, mesh.geometry); }
  return driverCache.get(seed)!;
}
function addDriver(m: ColorMesh, seed: string, x: number, y: number, z: number) {
  m.colored(driver(seed), [x, y, z]);
}

const shadeHex = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const glass = '#26343a', chrome = '#a8aaa3', tyre = '#1b1d1e', lamp = '#f4e7c2', tail = '#9c2b22';

export function createCityVehicle(kind: CityVehicleKind, seed: string, rider = true, lite = false) {
  const r = seededRandom(`vehicle:${seed}`), m = new ColorMesh(lite), pick = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
  // Where the driver or rider sits; a licensed cast figure takes this seat when the baked one is left out.
  let seat: V3 | null = null;
  const ride = (key: string, x: number, y: number, z: number) => { seat = [x, y + .92, z]; if (rider) addDriver(m, key, x, y, z); };
  switch (kind) {
    case 'bus': {
      // BEST: most are the red double-decker; some are the newer single-deck red AC buses.
      const red = '#b3241b', deep = '#8c1a14', cream = '#ece2c8', L = 10.2, double = r() < .65;
      // The modelled BEST bus once loaded (CityVehicleModels); the lofted shell below stands in until then.
      const modelled = cityVehicleGeometry(double ? 'bus-double' : 'bus-single', lite);
      if (modelled) { m.model(modelled); ride(`${seed}:bus`, .65, .25, -L / 2 + 1.0); break; }
      // Shells are swept through rounded sections with softened front and rear corners.
      const shell = (y0: number, y1: number, w: number, len: number, dz: number, color: string) => { const e = len / 2; m.loft(sweep([[dz - e, w * .9, y0 + .04, y1 - .05], [dz - e + .06, w * .985, y0, y1], [dz - e + .25, w, y0, y1], [dz + e - .25, w, y0, y1], [dz + e - .06, w * .985, y0, y1], [dz + e, w * .9, y0 + .04, y1 - .05]], lite ? 12 : 20, 9), color); };
      shell(.36, 2.3, 1.25, L, 0, red);
      if (double) { shell(2.35, 4.21, 1.24, L - .2, .08, red); m.box([2.53, .2, L - .06], [0, 2.32, 0], cream); m.rounded([2.4, .16, L - .5], [0, 4.25, .1], deep); }
      else { m.rounded([2.48, .85, L - .1], [0, 2.62, 0], red); m.rounded([2.3, .22, L * .5], [0, 3.12, .8], '#cfcfca'); for (let i = 0; i < 6; i++) m.box([.12, .03, L * .45], [-.7 + i * .28, 3.25, .8], '#8d8f8c'); }
      m.box([2.54, .26, L - .3], [0, .5, 0], '#2a2a2a');
      // Window bands: individual panes between red pillars, the driver's cab glass, and the open door.
      for (const y of double ? [1.78, 3.36] : [2.0]) for (const sd of [-1, 1]) {
        const h = double ? .78 : 1.05; m.box([.04, h, L - 1.5], [sd * 1.256, y, .4], glass);
        for (let z = -L / 2 + 1.3; z < L / 2 - .2; z += 1.12) m.box([.07, h + .04, .12], [sd * 1.262, y, z], red);
        m.box([.05, .05, L - 1.5], [sd * 1.262, y + h / 2 + .03, .4], cream);
      }
      m.box([2.24, 1.05, .05], [0, 1.9, -L / 2 - .01], glass, [-.06, 0, 0]); if (double) m.box([2.2, .78, .05], [0, 3.36, -L / 2 + .1], glass);
      m.box([.06, 1.0, .05], [0, 1.9, -L / 2 - .03], red);
      // Destination board: amber route number and destination on black.
      const boardY = double ? 2.82 : 2.72; m.box([2.0, .32, .07], [0, boardY, -L / 2 + .02], '#151515'); m.box([.42, .2, .08], [-.72, boardY, -L / 2 + .015], '#f0a32a'); m.box([1.2, .14, .08], [.25, boardY, -L / 2 + .015], '#e8962a');
      m.box([.9, 1.95, .05], [-1.26, 1.25, -L / 2 + 1.35], '#1f2324'); m.box([.05, 1.95, .95], [-1.262, 1.25, L / 2 - 1.5], '#1f2324');
      for (const sd of [-1, 1]) { m.rod([sd * 1.24, 2.25, -L / 2 + .2], [sd * 1.5, 2.1, -L / 2 - .2], .02, '#2a2a2a'); m.box([.08, .32, .2], [sd * 1.52, 1.95, -L / 2 - .22], '#202224'); }
      for (const sd of [-1, 1]) { m.box([.3, .18, .05], [sd * .9, .78, -L / 2 - .03], lamp); m.box([.22, .32, .05], [sd * .98, .95, L / 2 + .02], tail); m.box([.08, .08, .04], [sd * 1.12, .62, -L / 2 - .03], '#e8a33a'); }
      m.box([2.46, .34, .22], [0, .5, -L / 2 - .06], '#262626'); m.box([.6, .14, .05], [0, .55, -L / 2 - .18], '#f2efe6');
      m.box([1.6, .6, .05], [0, 1.0, L / 2 + .02], '#3d3d3b'); for (let i = 0; i < 5; i++) m.box([1.5, .04, .06], [0, .8 + i * .1, L / 2 + .04], '#222');
      for (const z of [-L / 2 + 1.9, L / 2 - 2.3]) { m.shape('tyre', [.6, 2.52, .6], [0, .5, z], '#121314', [0, 0, Math.PI / 2]); for (const sd of [-1, 1]) m.wheel(.5, .3, [sd * 1.1, .5, z], tyre, '#8d8f8a'); }
      ride(`${seed}:bus`, .65, .25, -L / 2 + 1.0); break;
    }
    case 'hatch': case 'sedan': case 'suv': case 'taxi': {
      // Lofted pressed-metal body (CarBodies); the kaali-peeli gets its yellow roof. Glass is opaque, so no driver is baked in.
      const body = kind === 'taxi' ? '#1d2022' : pick(['#e9e8e2', '#b9bcbd', '#8d9296', '#a32c26', '#2a4d78', '#e3dfd2', '#5b5f63', '#f0efe9', '#3b3f43', '#6b2a2a', '#c9c2ad']);
      const modelled = kind === 'taxi' ? null : cityVehicleGeometry(kind === 'hatch' ? 'hatchback' : kind === 'sedan' ? 'saloon' : 'suv', lite, body);
      if (modelled) { m.model(modelled); break; }
      carBody(m, CAR_SHAPES[kind], body, { glass, dark: '#1a1b1c', lamp, tail, plate: kind === 'taxi' ? '#f1d248' : '#f2efe6', bumper: kind === 'taxi' ? chrome : shadeHex(body, .78), roof: kind === 'taxi' ? '#e0b33a' : undefined });
      if (kind === 'taxi') { const t = CAR_SHAPES.taxi; m.rounded([.5, .14, .18], [0, t.roof + .09, -t.L / 2 + (t.roofFront + t.roofRear) / 2], '#e0b33a'); }
      break;
    }
    case 'auto': {
      // Mumbai's black-and-yellow three-wheeler: a rounded tub and nose, an open-sided canvas hood, a bench seat.
      const black = '#1c1f1e', yellow = '#d8b23a', q = lite ? 10 : 18, arc = lite ? 6 : 12;
      m.loft(sweep([[-1.24, .2, .5, .78], [-1.12, .34, .38, .98], [-.86, .42, .34, 1.06], [-.6, .58, .34, .94], [-.3, .66, .34, .8], [.4, .67, .34, .86], [1.05, .66, .36, .9], [1.17, .6, .42, .86]], q, 4), black);
      m.loft(arch([[-.96, .62, 1.42, 1.86], [-.82, .69, 1.52, 1.96], [-.2, .71, 1.58, 1.99], [.6, .71, 1.58, 1.99], [1.08, .7, 1.5, 1.95], [1.17, .68, 1.0, 1.9]], arc, 5), black, false, false);
      m.loft(arch([[-.84, .6, 1.95, 1.985], [-.2, .62, 1.99, 2.03], [.6, .62, 1.99, 2.03], [1.06, .6, 1.94, 1.975]], arc >> 1, 5, Math.PI * .22, Math.PI * .78), yellow, false, false);
      m.rounded([1.3, .9, .05], [0, 1.42, 1.16], black); m.rounded([1.36, .1, .12], [0, 1.0, 1.18], yellow);
      for (const s of [-1, 1]) { m.rod([s * .6, .98, -.9], [s * .65, 1.5, -.92], .03, black); m.rod([s * .66, .92, 1.0], [s * .69, 1.62, 1.05], .03, '#2a2a2a'); m.box([.03, .1, 1.95], [s * .705, 1.62, .1], yellow); }
      m.taper([1.0, .5, .05], [0, 1.27, -1.0], glass, .92, 1, 0); m.rounded([1.08, .07, .1], [0, 1.5, -1.0], black);
      m.rounded([1.16, .3, .5], [0, 1.0, .72], '#4a3a2c'); m.rounded([1.16, .48, .12], [0, 1.26, .97], '#4a3a2c');
      m.rounded([.2, .12, .08], [0, .9, -1.22], lamp); m.rounded([.7, .1, .05], [0, .72, 1.19], '#e8d24a');
      m.rod([-.32, 1.18, -.62], [.32, 1.18, -.62], .015, '#202020');
      m.wheel(.25, .14, [0, .25, -.94]); for (const s of [-1, 1]) m.wheel(.255, .16, [s * .69, .255, .78]);
      ride(`${seed}:auto`, 0, -.27, -.25); break;
    }
    case 'bike': case 'cycle': {
      const scooter = kind === 'bike' && r() < .6, q = lite ? 8 : 14;
      if (scooter) {
        // A gearless scooter: swollen rear cowl, step-through floor, curved front apron, handlebar cowl.
        const body = pick(['#e9e7e1', '#b52a24', '#8d9399', '#2b4f7a', '#1e1f21', '#c8b89a', '#5e6b52']), rad = .22;
        m.wheel(rad, .1, [0, rad, -.62], tyre, '#9a9c98'); m.wheel(rad, .1, [0, rad, .6], tyre, '#9a9c98');
        m.loft(sweep([[-.08, .1, .34, .5], [.08, .2, .3, .66], [.4, .23, .3, .74], [.72, .2, .34, .72], [.9, .1, .44, .64]], q, 2.6), body);
        m.loft(sweep([[-.05, .16, .73, .79], [.35, .17, .74, .82], [.7, .14, .72, .79]], q, 3), '#1b1b1c');
        m.rounded([.32, .06, .5], [0, .3, -.15], '#2a2b2c');
        m.loft(sweep([[-.62, .08, .3, .62], [-.55, .2, .34, .9], [-.42, .2, .34, .98], [-.36, .1, .4, .92]], q, 3), body);
        m.rod([0, .42, -.6], [0, 1.0, -.46], .025, '#3a3b3c');
        m.loft(sweep([[-.56, .1, .93, 1.04], [-.47, .24, .94, 1.08], [-.36, .2, .95, 1.05]], q, 3), body); m.rounded([.12, .07, .04], [0, 1.0, -.565], lamp);
        for (const sd of [-1, 1]) { m.rod([sd * .2, 1.05, -.44], [sd * .32, 1.04, -.42], .016, '#2a2a2a'); m.rod([sd * .16, 1.07, -.44], [sd * .2, 1.24, -.46], .008, '#2a2a2a'); m.rounded([.08, .05, .02], [sd * .2, 1.25, -.46], '#3d4448'); }
        m.rounded([.16, .06, .03], [0, .62, .9], tail); m.rounded([.14, .12, .3], [.13, .3, .56], '#4b4d4f');
        ride(`${seed}:rider`, 0, -.12, .25); break;
      }
      const frame = kind === 'bike' ? pick(['#1f2a44', '#7b1e1e', '#2b2b2b', '#5c6168']) : '#2a2f36', rad = kind === 'bike' ? .3 : .33;
      const modelled = kind === 'bike' ? cityVehicleGeometry('motorbike', lite, frame) : null;
      if (modelled) { m.model(modelled); ride(`${seed}:rider`, 0, -.14, .45); break; }
      m.wheel(rad, kind === 'bike' ? .09 : .045, [0, rad, -.68], tyre, '#8a8c88'); m.wheel(rad, kind === 'bike' ? .1 : .045, [0, rad, .66], tyre, '#8a8c88');
      if (kind === 'bike') {
        // Commuter motorcycle: teardrop tank, finned engine, long seat, chrome exhaust.
        m.loft(sweep([[-.44, .07, .72, .82], [-.34, .15, .66, .94], [-.1, .15, .68, .94], [.05, .09, .72, .86]], q, 2.4), frame);
        m.loft(sweep([[.0, .11, .8, .86], [.2, .13, .8, .9], [.55, .1, .82, .88], [.66, .06, .82, .86]], q, 3), '#1a1a1a');
        m.rounded([.26, .26, .3], [0, .45, .0], '#5d6163'); for (let i = 0; i < 4; i++) m.rounded([.3, .02, .26], [0, .38 + i * .05, -.02], '#7d8183');
        m.rod([.14, .36, .05], [.16, .42, .75], .035, chrome); m.loft(sweep([[.45, .1, .58, .7], [.62, .11, .6, .74], [.78, .06, .66, .72]], q, 3), frame);
        m.rod([0, .95, -.5], [0, .32, -.68], .022, chrome); m.rod([-.32, 1.02, -.48], [.32, 1.02, -.48], .014, '#202020');
        m.shape('sphere', [.09, .09, .07], [0, .9, -.6], lamp); m.loft(sweep([[-.84, .07, .56, .62], [-.68, .09, .6, .7], [-.52, .07, .62, .66]], q, 3), frame); m.rounded([.12, .05, .03], [0, .72, .78], tail);
      } else {
        m.rod([0, .33, .66], [0, .82, .12], .02, frame); m.rod([0, .82, .12], [0, .9, -.5], .02, frame); m.rod([0, .33, -.68], [0, .95, -.55], .02, frame); m.rod([0, .33, .1], [0, .82, .12], .02, frame); m.rod([-.25, 1.0, -.55], [.25, 1.0, -.55], .015, '#202020');
        m.rounded([.14, .06, .26], [0, .92, .14], '#1d1d1d'); m.box([.42, .03, .3], [0, .82, .78], '#3a3a3a');
        for (const s of [-1, 1]) m.shape('cylinder', [.13, .4, .13], [s * .24, .62, .55], '#b9bab5');
      }
      ride(`${seed}:rider`, 0, kind === 'bike' ? -.15 : -.05, kind === 'bike' ? .2 : .25); break;
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
      ride(`${seed}:tempo`, .42, .03, -2.0); break;
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
  const mesh = new THREE.Mesh(m.build(), paintMaterial()); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `city-vehicle:${kind}`; mesh.userData.seat = seat;
  return mesh;
}

/** A vehicle carrying a near and a far geometry; `setVehicleDetail` swaps them by distance. */
export function createCityVehicleLod(kind: CityVehicleKind, seed: string, rider = true) {
  const mesh = createCityVehicle(kind, seed, rider), far = createCityVehicle(kind, seed, rider, true);
  const geometries = [mesh.geometry, far.geometry]; mesh.userData.lodGeometries = geometries; return mesh;
}
const NOTHING = new THREE.BufferGeometry();
/** 'hidden' draws nothing (beyond the haze), without touching `visible`, which traffic uses for vehicles off the road. */
export function setVehicleDetail(mesh: THREE.Mesh, near: boolean | 'hidden') {
  const lods = mesh.userData.lodGeometries as THREE.BufferGeometry[] | undefined; if (lods) mesh.geometry = near === 'hidden' ? NOTHING : lods[near ? 0 : 1];
}
