import * as THREE from 'three';
import records from '../../../../public/models/vehicles/city/provenance.json';
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
  })).then(results => { results.forEach(r => { if (r.status === 'rejected') console.warn('City vehicle model unavailable; lofted body retained', r.reason); }); });
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
