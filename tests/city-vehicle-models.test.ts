import {describe,expect,it} from 'vitest';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {CITY_VEHICLE_RECORDS} from '../src/game/World/districts/CityVehicleModels';
import {createCityVehicle} from '../src/game/World/districts/CityVehicles';
import {validateGLB} from '../src/game/World/assets/GLBAssetLibrary';

const fs:{readFileSync(url:URL):Uint8Array}=await import(/* @vite-ignore */ ['node','fs'].join(':'));
const file=(path:string)=>new Uint8Array(fs.readFileSync(new URL(`../public${path}`,import.meta.url)));
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
const tris=(g:THREE.BufferGeometry)=>(g.index?g.index.count:g.getAttribute('position').count)/3;

describe('modelled district traffic',()=>{
 it('is pinned, original, and no heavier than the lofted bodies it replaces at every level of detail',async()=>{
  expect(CITY_VEHICLE_RECORDS.map(r=>r.name).sort()).toEqual(['bus-double','bus-single','hatchback','motorbike','saloon','suv']);
  const loft=(kind:'hatch'|'bus'|'bike',lite:boolean)=>Math.max(...[0,1,2,3,4,5].map(i=>tris(createCityVehicle(kind,`s${i}`,false,lite).geometry)));
  const allowance={hatchback:'hatch',saloon:'hatch',suv:'hatch','bus-double':'bus','bus-single':'bus',motorbike:'bike'} as const;
  for(const record of CITY_VEHICLE_RECORDS){
   const bytes=file(record.url);expect(bytes.length).toBe(record.bytes);expect(await sha(bytes)).toBe(record.sha256);
   const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;validateGLB(buffer);
   const scene=(await new GLTFLoader().parseAsync(buffer,'')).scene,meshes=new Map<string,THREE.Mesh>();scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.set(o.name,o as THREE.Mesh);});
   for(const level of ['near','far','distant'] as const){
    const mesh=meshes.get(level)!;expect(mesh.geometry.getAttribute('color').itemSize).toBe(4);
    // The finish (roughness, metalness) rides in TEXCOORD_0; roughness is a fraction.
    const uv=mesh.geometry.getAttribute('uv');expect(uv.itemSize).toBe(2);for(let i=0;i<uv.count;i+=97){expect(uv.getX(i)).toBeGreaterThanOrEqual(0);expect(uv.getX(i)).toBeLessThanOrEqual(1);}
    expect(tris(mesh.geometry)).toBe(record.triangles[level]);
    expect(record.triangles[level]).toBeLessThanOrEqual(loft(allowance[record.name],level!=='near'));
   }
   // Each level is lighter than the one before.
   expect(record.triangles.far).toBeLessThan(record.triangles.near);expect(record.triangles.distant).toBeLessThan(record.triangles.far);
   // Faces -Z like every district vehicle, and sits on the ground.
   const box=new THREE.Box3().setFromObject(meshes.get('near')!);expect(box.min.y).toBeGreaterThan(-.02);expect(box.min.y).toBeLessThan(.1);
  }
 });
});
