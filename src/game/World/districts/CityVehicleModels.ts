import * as THREE from 'three';
import records from '../../../../public/models/vehicles/city/provenance.json';
import scooterRecord from '../../../../public/models/vehicles/scooter.provenance.json';
import { validateGLB } from '../assets/GLBAssetLibrary';

/**
 * Modelled district traffic (scripts/vehicles/build_car.py, build_bus.py, build_bike.py): hatchback, saloon,
 * SUV, the BEST double-decker and single-deck buses, and a commuter motorbike. Each GLB holds three levels of
 * detail, each modelled at its own resolution: 'near', 'far' and 'distant' (body, lamps and tail joined),
 * vertex-coloured for the districts' shared paint material. COLOR_0 alpha marks paint faces, recoloured per
 * vehicle; TEXCOORD_0 carries each face's finish (roughness, 1 − metalness), read as the `finish` attribute.
 * Until the models load (or if they fail) the lofted bodies in CityVehicles stand in.
 */
export type CityVehicleModel = 'hatchback' | 'saloon' | 'suv' | 'bus-double' | 'bus-single' | 'motorbike';
/** Level of detail: 0 near, 1 far, 2 distant. */
export type VehicleDetail = 0 | 1 | 2;
const LEVELS = ['near', 'far', 'distant'] as const;
interface Record_ { name: CityVehicleModel; url: string; sha256: string; bytes: number; paintKey: string; triangles: { near: number; far: number; distant: number } }
interface Loaded { levels: THREE.BufferGeometry[]; key: number }
export const CITY_VEHICLE_RECORDS = records.files as Record_[];

const loaded = new Map<CityVehicleModel, Loaded>();
let loading: Promise<void> | null = null;

/** Fetch, verify and unpack every model once. Resolves when all have loaded or failed (failures keep the lofts). */
export function preloadCityVehicleModels(origin: string) {
  loading ??= Promise.allSettled(CITY_VEHICLE_RECORDS.map(async record => {
    const response = await fetch(new URL(record.url, origin).href); if (!response.ok) throw new Error(`City vehicle fetch ${response.status}`);
    const bytes = await response.arrayBuffer(); if (bytes.byteLength !== record.bytes) throw new Error('City vehicle size mismatch');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join(''); if (digest !== record.sha256) throw new Error('City vehicle integrity mismatch');
    validateGLB(bytes);
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const scene = (await new GLTFLoader().parseAsync(bytes, '')).scene;
    loaded.set(record.name, unpack(scene, record));
  }).concat(preloadScooterModel(origin))).then(results => { results.forEach(r => { if (r.status === 'rejected') console.warn('City vehicle model unavailable; lofted body retained', r.reason); }); });
  return loading;
}

function unpack(scene: THREE.Object3D, record: Record_): Loaded {
  const found = new Map<string, THREE.BufferGeometry>(); scene.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) found.set(mesh.name, mesh.geometry); });
  const part = (name: typeof LEVELS[number]) => {
    const source = found.get(name); if (!source) throw new Error(`City vehicle ${record.name} is missing ${name}`);
    const colour = source.getAttribute('color'); if (!colour || colour.itemSize !== 4) throw new Error(`City vehicle ${record.name} needs RGBA COLOR_0`);
    const uv = source.getAttribute('uv'); if (!uv) throw new Error(`City vehicle ${record.name} needs its finish in TEXCOORD_0`);
    const g = new THREE.BufferGeometry(), n = colour.count, rgb = new Float32Array(n * 3), finish = new Float32Array(n * 2), paint = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      rgb[i * 3] = colour.getX(i); rgb[i * 3 + 1] = colour.getY(i); rgb[i * 3 + 2] = colour.getZ(i); paint[i] = colour.getW(i) > .5 ? 1 : 0;
      // Roughness is floored above 0, which paintMaterial reads as 'no finish'.
      finish[i * 2] = Math.max(.04, uv.getX(i)); finish[i * 2 + 1] = 1 - uv.getY(i);
    }
    g.setAttribute('position', source.getAttribute('position').clone()); g.setAttribute('normal', source.getAttribute('normal').clone());
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3)); g.setAttribute('finish', new THREE.BufferAttribute(finish, 2)); g.setIndex(source.index ? source.index.clone() : null);
    g.userData.paint = paint; g.computeBoundingSphere(); source.dispose(); return g;
  };
  const key = new THREE.Color(record.paintKey);
  return { levels: LEVELS.map(part), key: key.r + key.g + key.b };
}

/** A model's geometry with its paint recoloured; null while the model is not loaded. The caller owns the result. */
export function cityVehicleGeometry(name: CityVehicleModel, detail: VehicleDetail, paint?: string) {
  const model = loaded.get(name); if (!model) return null;
  const source = model.levels[detail], g = source.clone();
  if (paint) {
    const target = new THREE.Color(paint), mask = source.userData.paint as Uint8Array, colour = g.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < colour.count; i++) {
      if (!mask[i]) continue;
      // Paint faces carry key colour x baked occlusion; keep the occlusion, swap the colour.
      const shade = (colour.getX(i) + colour.getY(i) + colour.getZ(i)) / model.key;
      colour.setXYZ(i, target.r * shade, target.g * shade, target.b * shade);
    }
  }
  return g;
}

/**
 * The authored "Vino" scooter (public/models/vehicles/scooter.provenance.json), the blue scooty parked at CST, rides
 * and parks as every scooter in the districts. Its near level is the model itself; the far and distant levels are
 * meshoptimizer simplifications of it. Turned to face −Z like the rest of the traffic; its blue panels are the paint.
 */
let scooter: Loaded | null = null;
async function preloadScooterModel(origin: string) {
  const response = await fetch(new URL(scooterRecord.url, origin).href); if (!response.ok) throw new Error(`Scooter fetch ${response.status}`);
  const bytes = await response.arrayBuffer(); if (bytes.byteLength !== scooterRecord.bytes) throw new Error('Scooter size mismatch');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join(''); if (digest !== scooterRecord.sha256) throw new Error('Scooter integrity mismatch');
  validateGLB(bytes);
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const scene = (await new GLTFLoader().parseAsync(bytes, '')).scene;
  let source: THREE.BufferGeometry | null = null; scene.traverse(o => { if ((o as THREE.Mesh).isMesh) source ??= (o as THREE.Mesh).geometry; });
  if (!source) throw new Error('Scooter has no mesh');
  const { MeshoptSimplifier } = await import('meshoptimizer'); await MeshoptSimplifier.ready;
  scooter = scooterLevels(source, (index, positions, ratio) => MeshoptSimplifier.simplify(index, positions, 3, Math.floor(index.length * ratio / 3) * 3, .02, ['LockBorder'])[0]);
}
type Simplify = (index: Uint32Array, positions: Float32Array, ratio: number) => Uint32Array;
/** The scooter's three levels in the city vehicles' layout (RGB colour, `finish`, a paint mask over the blue panels). */
export function scooterLevels(source: THREE.BufferGeometry, simplify: Simplify): Loaded {
  const colour = source.getAttribute('color'), uv = source.getAttribute('uv'), position = source.getAttribute('position'), n = position.count;
  if (!colour || !uv) throw new Error('Scooter needs baked colour and finish');
  const base = new THREE.BufferGeometry(), rgb = new Float32Array(n * 3), finish = new Float32Array(n * 2), paint = new Uint8Array(n), xyz = new Float32Array(n * 3), normal = new Float32Array(n * 3);
  const sourceNormal = source.getAttribute('normal'), key = new THREE.Color(0, 0, 0); let painted = 0;
  for (let i = 0; i < n; i++) {
    const r = colour.getX(i), g = colour.getY(i), b = colour.getZ(i);
    rgb.set([r, g, b], i * 3); finish.set([Math.max(.04, uv.getX(i)), 1 - uv.getY(i)], i * 2);
    // Turned half round about Y: the model faces +Z, traffic faces −Z.
    xyz.set([-position.getX(i), position.getY(i), -position.getZ(i)], i * 3); normal.set([-sourceNormal.getX(i), sourceNormal.getY(i), -sourceNormal.getZ(i)], i * 3);
    if (b > .12 && b > r * 1.3 && b > g * 1.05) { paint[i] = 1; key.r += r; key.g += g; key.b += b; painted++; }
  }
  base.setAttribute('position', new THREE.BufferAttribute(xyz, 3)); base.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  base.setAttribute('color', new THREE.BufferAttribute(rgb, 3)); base.setAttribute('finish', new THREE.BufferAttribute(finish, 2));
  const index = source.index ? Uint32Array.from(source.index.array as ArrayLike<number>) : Uint32Array.from({ length: n }, (_, i) => i);
  base.setIndex(new THREE.BufferAttribute(index, 1)); base.userData.paint = paint; base.computeBoundingSphere();
  const level = (ratio: number) => { const g = base.clone(); g.setIndex(new THREE.BufferAttribute(simplify(index, xyz, ratio), 1)); g.userData.paint = paint; g.computeBoundingSphere(); return g; };
  const k = painted ? (key.r + key.g + key.b) / painted : 1;
  return { levels: [base, level(.28), level(.09)], key: k };
}
/** The scooter at `detail`, its blue panels repainted `paint` (kept blue when omitted); null until it has loaded. */
export function scooterGeometry(detail: VehicleDetail, paint?: string) {
  const model = scooter; if (!model) return null;
  const source = model.levels[detail], g = source.clone(); g.userData.paint = source.userData.paint;
  if (paint) {
    const target = new THREE.Color(paint), mask = source.userData.paint as Uint8Array, colour = g.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < colour.count; i++) if (mask[i]) { const shade = (colour.getX(i) + colour.getY(i) + colour.getZ(i)) / model.key; colour.setXYZ(i, target.r * shade, target.g * shade, target.b * shade); }
  }
  return g;
}
