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

const shadeHex = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const glass = '#26343a', chrome = '#a8aaa3', tyre = '#1b1d1e', lamp = '#f4e7c2', tail = '#9c2b22';

export function createCityVehicle(kind: CityVehicleKind, seed: string, rider = true, lite = false) {
  const r = seededRandom(`vehicle:${seed}`), m = new ColorMesh(lite), pick = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
  switch (kind) {
    case 'bus': {
      // BEST: most are the red double-decker; some are the newer single-deck red AC buses.
      const red = '#b3241b', deep = '#8c1a14', cream = '#ece2c8', L = 10.2, double = r() < .65;
      m.rounded([2.5, 1.95, L], [0, 1.33, 0], red);
      if (double) { m.rounded([2.48, 1.86, L - .2], [0, 3.28, .08], red); m.box([2.53, .2, L - .06], [0, 2.32, 0], cream); m.rounded([2.4, .16, L - .5], [0, 4.25, .1], deep); }
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
      if (rider) addDriver(m, `${seed}:bus`, .65, .25, -L / 2 + 1.0); break;
    }
    case 'hatch': case 'sedan': case 'suv': case 'taxi': {
      const L = kind === 'hatch' ? 3.7 : kind === 'taxi' ? 4.1 : kind === 'suv' ? 4.5 : 4.35, W = kind === 'suv' ? 1.82 : 1.66;
      const body = kind === 'taxi' ? '#1d2022' : pick(['#e9e8e2', '#b9bcbd', '#8d9296', '#a32c26', '#2a4d78', '#e3dfd2', '#5b5f63', '#f0efe9', '#3b3f43']);
      const belt = kind === 'suv' ? 1.12 : .86, sill = kind === 'suv' ? .42 : .3, wr = kind === 'suv' ? .37 : .31;
      // Glasshouse: length, centre offset, height and how much the roof is drawn in.
      const [gl, gz, gh] = kind === 'hatch' ? [L * .56, L * .1, .5] : kind === 'suv' ? [L * .68, L * .1, .55] : [L * .5, L * .05, .48];
      // Lower body with a sloping bonnet and boot, then bumpers and sills.
      m.rounded([W, belt - sill, L - .1], [0, (belt + sill) / 2, 0], body);
      m.taper([W * .98, .1, L * .3], [0, belt + .03, -L * .33], body, .96, .9, .04);
      m.rounded([W + .04, .2, .22], [0, sill + .1, -L / 2 + .06], kind === 'taxi' ? chrome : shadeHex(body, .82));
      m.rounded([W + .04, .2, .22], [0, sill + .1, L / 2 - .06], kind === 'taxi' ? chrome : shadeHex(body, .82));
      m.box([W + .01, .08, L * .62], [0, sill + .03, 0], '#202224');
      // Wheel wells read as dark discs around the tyres.
      for (const z of [-L * .32, L * .31]) { m.shape('tyre', [wr * 1.18, W + .015, wr * 1.18], [0, wr, z], '#141516', [0, 0, Math.PI / 2]); for (const sd of [-1, 1]) m.wheel(wr, .2, [sd * (W / 2 - .08), wr, z], tyre, kind === 'suv' ? '#6d7073' : chrome); }
      // Glasshouse in tinted glass, pillars and roof in body colour (yellow roof for a kaali-peeli).
      m.taper([W * .9, gh, gl], [0, belt + gh / 2, gz], glass, .86, kind === 'hatch' ? .82 : .7, kind === 'hatch' ? .06 : 0);
      const roof = kind === 'taxi' ? '#e0b33a' : body;
      m.taper([W * .78, .07, gl * (kind === 'hatch' ? .84 : .72)], [0, belt + gh + .03, gz + (kind === 'hatch' ? gl * .05 : 0)], roof, .97, .95);
      for (const sd of [-1, 1]) {
        m.box([.05, gh * .95, .09], [sd * W * .42, belt + gh / 2, gz], body);
        m.box([.08, .06, .14], [sd * (W / 2 + .05), belt + .05, gz - gl / 2 + .05], body);
        for (const dz of [-L * .1, L * .17]) m.box([.01, (belt - sill) * .8, .015], [sd * (W / 2 + .003), (belt + sill) / 2 + .02, dz], '#2a2c2e');
        m.box([.01, .03, .2], [sd * (W / 2 + .004), belt - .12, -L * .02], '#9a9d9f');
      }
      if (kind === 'taxi') { m.box([.5, .14, .18], [0, belt + gh + .14, gz], '#e0b33a'); m.box([.42, .08, .19], [0, belt + gh + .14, gz], '#202020'); m.taper([W * .97, .03, L * .3], [0, belt + .09, -L * .33], '#e0b33a', .96, .9, .04); }
      // Lamps, grille and plates.
      for (const sd of [-1, 1]) { m.box([.34, .12, .05], [sd * W * .33, belt - .14, -L / 2 + .02], lamp); m.box([.3, .1, .05], [sd * W * .36, belt - .12, L / 2 - .02], tail); }
      m.box([W * .36, .14, .05], [0, belt - .18, -L / 2 + .01], '#1a1b1c');
      m.box([.46, .11, .03], [0, sill + .12, -L / 2 - .06], kind === 'taxi' ? '#f1d248' : '#f2efe6'); m.box([.46, .11, .03], [0, sill + .3, L / 2 + .01], kind === 'taxi' ? '#f1d248' : '#f2efe6');
      if (rider) addDriver(m, `${seed}:car`, .36, kind === 'suv' ? -.1 : -.3, gz - .05); break;
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
      const scooter = kind === 'bike' && r() < .6;
      if (scooter) {
        // A gearless scooter: step-through floorboard, front apron, swollen rear cowl.
        const body = pick(['#e9e7e1', '#b52a24', '#8d9399', '#2b4f7a', '#1e1f21', '#c8b89a', '#5e6b52']), rad = .25;
        m.wheel(rad, .1, [0, rad, -.62], tyre, '#9a9c98'); m.wheel(rad, .1, [0, rad, .6], tyre, '#9a9c98');
        m.rounded([.34, .07, .56], [0, .3, .02], '#2a2b2c');
        m.rounded([.4, .36, .74], [0, .52, .42], body); m.rounded([.3, .1, .64], [0, .75, .36], '#1b1b1c');
        m.rounded([.42, .66, .12], [0, .6, -.3], body, [.22, 0, 0]); m.rounded([.2, .1, .4], [0, .55, -.6], body);
        m.rod([0, .5, -.58], [0, .98, -.4], .025, '#3a3b3c');
        m.rounded([.48, .13, .2], [0, 1.0, -.4], body); m.box([.14, .08, .04], [0, 1.0, -.51], lamp);
        for (const sd of [-1, 1]) { m.rod([sd * .2, 1.03, -.38], [sd * .3, 1.0, -.36], .015, '#2a2a2a'); m.rod([sd * .17, 1.06, -.4], [sd * .2, 1.22, -.42], .008, '#2a2a2a'); m.box([.07, .05, .02], [sd * .2, 1.24, -.42], '#3d4448'); }
        m.box([.16, .06, .03], [0, .62, .8], tail); m.rounded([.14, .12, .3], [.14, .32, .62], '#4b4d4f');
        if (rider) addDriver(m, `${seed}:rider`, 0, -.12, .25); break;
      }
      const frame = kind === 'bike' ? pick(['#1f2a44', '#7b1e1e', '#2b2b2b', '#5c6168']) : '#2a2f36', rad = kind === 'bike' ? .3 : .33;
      m.wheel(rad, kind === 'bike' ? .09 : .045, [0, rad, -.68], tyre, '#8a8c88'); m.wheel(rad, kind === 'bike' ? .1 : .045, [0, rad, .66], tyre, '#8a8c88');
      if (kind === 'bike') {
        // Commuter motorcycle: teardrop tank, finned engine, long seat, chrome exhaust.
        m.rounded([.3, .22, .5], [0, .78, -.18], frame); m.rounded([.26, .1, .62], [0, .84, .3], '#1a1a1a');
        m.rounded([.26, .26, .3], [0, .45, .0], '#5d6163'); for (let i = 0; i < 4; i++) m.box([.3, .02, .26], [0, .38 + i * .05, -.02], '#7d8183');
        m.rod([.14, .36, .05], [.16, .4, .75], .035, chrome); m.rounded([.22, .14, .3], [0, .62, .62], frame);
        m.rod([0, .95, -.5], [0, .32, -.68], .022, chrome); m.rod([-.32, 1.02, -.48], [.32, 1.02, -.48], .014, '#202020');
        m.shape('sphere', [.09, .09, .07], [0, .9, -.6], lamp); m.rounded([.16, .06, .38], [0, .62, -.68], frame); m.box([.12, .05, .03], [0, .72, .78], tail);
      } else {
        m.rod([0, .33, .66], [0, .82, .12], .02, frame); m.rod([0, .82, .12], [0, .9, -.5], .02, frame); m.rod([0, .33, -.68], [0, .95, -.55], .02, frame); m.rod([0, .33, .1], [0, .82, .12], .02, frame); m.rod([-.25, 1.0, -.55], [.25, 1.0, -.55], .015, '#202020');
        m.rounded([.14, .06, .26], [0, .92, .14], '#1d1d1d'); m.box([.42, .03, .3], [0, .82, .78], '#3a3a3a');
        for (const s of [-1, 1]) m.shape('cylinder', [.13, .4, .13], [s * .24, .62, .55], '#b9bab5');
      }
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

/** A vehicle carrying a near and a far geometry; `setVehicleDetail` swaps them by distance. */
export function createCityVehicleLod(kind: CityVehicleKind, seed: string, rider = true) {
  const mesh = createCityVehicle(kind, seed, rider), far = createCityVehicle(kind, seed, rider, true);
  const geometries = [mesh.geometry, far.geometry]; mesh.userData.lodGeometries = geometries; return mesh;
}
export function setVehicleDetail(mesh: THREE.Mesh, near: boolean) {
  const lods = mesh.userData.lodGeometries as THREE.BufferGeometry[] | undefined; if (lods) mesh.geometry = lods[near ? 0 : 1];
}
