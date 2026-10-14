import * as THREE from 'three';
import taxiRecord from '../../../public/models/vehicles/taxi.provenance.json';
import autoRecord from '../../../public/models/vehicles/auto.provenance.json';
import {validateGLB} from './assets/GLBAssetLibrary';
import {vertexFinishGeometry} from './architecture/BakedKit';
import type {TransitKind} from './transit';

export const VEHICLE_BODIES:Record<TransitKind,typeof taxiRecord>={taxi:taxiRecord,auto:autoRecord};
export type VehicleBodyParts={body:THREE.BufferGeometry;glass:THREE.BufferGeometry;lamps:THREE.BufferGeometry;tail:THREE.BufferGeometry};

const loads=new Map<TransitKind,Promise<VehicleBodyParts>>();
/**
 * The original modelled bodies (scripts/vehicles/build_<kind>.py), fetched once per kind, verified
 * against their provenance record and shared by every vehicle of that kind.
 */
export function loadVehicleBody(kind:TransitKind,origin:string){
 let promise=loads.get(kind);
 if(!promise){
  const record=VEHICLE_BODIES[kind];
  promise=(async()=>{
   const response=await fetch(new URL(record.url,origin).href);if(!response.ok)throw new Error(`Vehicle body fetch ${response.status}`);
   const bytes=await response.arrayBuffer();if(bytes.byteLength!==record.bytes)throw new Error('Vehicle body size mismatch');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==record.sha256)throw new Error('Vehicle body integrity mismatch');
   validateGLB(bytes);
   const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   return vehicleBodyParts((await new GLTFLoader().parseAsync(bytes,'')).scene);
  })();
  loads.set(kind,promise);promise.catch(()=>loads.delete(kind));
 }
 return promise;
}

/** Splits a loaded body GLB into its four parts; the body is re-packed for the shared baked material. */
export function vehicleBodyParts(scene:THREE.Object3D):VehicleBodyParts{
 const found=new Map<string,THREE.BufferGeometry>();scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)found.set(mesh.name,mesh.geometry);});
 const part=(name:string)=>{const geometry=found.get(name);if(!geometry)throw new Error(`Vehicle body is missing ${name}`);return geometry;};
 const body=vertexFinishGeometry(part('body'));part('body').dispose();
 const plain=(name:string)=>{const source=part(name),g=new THREE.BufferGeometry();g.setIndex(source.index?source.index.clone():null);g.setAttribute('position',source.attributes.position.clone());g.setAttribute('normal',source.attributes.normal.clone());g.computeBoundingSphere();source.dispose();return g;};
 return {body,glass:plain('glass'),lamps:plain('lamps'),tail:plain('tail')};
}
