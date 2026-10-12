import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import record from '../../../../public/models/vehicles/scooter.provenance.json';
import {validateGLB} from '../assets/GLBAssetLibrary';
import {ATLAS_REGION,BakedKit,bakedFinishMaterial} from './BakedKit';
import {twoWheeler} from './StreetProps';

export type ParkedScooter={x:number;z:number;yaw:number;body:string};
export const SCOOTER_ASSET=record;

/** Parked scooters within this many metres along the street use the authored model when on foot. */
const NEAR=24;
/** Small finish variations (material colour multiplies the baked colour); the two-tone paint stays the model's own. */
const TINTS=['#ffffff','#f4e7df','#e3ebf0','#efefe6','#f7eadc'];

/**
 * Parked scooters with two representations.
 * - Authored: the CC-BY "Vino" scooter (see public/models/vehicles/scooter.provenance.json), decimated to
 *   about 4.4k triangles with colour and finish in vertex data, so it draws with the shared baked material
 *   (no textures, no extra shader program). Only scooters near the viewer, only on foot.
 * - Code-modelled stand-ins (about 410 triangles each), drawn while riding and before the model arrives.
 *   On foot they keep rendering into the shadow map but stop writing colour and depth, so the authored
 *   scooters get the stand-ins' (approximate) shadows without a second shadow caster.
 * Each authored scooter is its own mesh with its own material from the start (empty until the model loads),
 * so the street's weathering patch reaches them and no instanced program variant is introduced.
 */
export class ParkedScooters {
 readonly group=new THREE.Group();
 private standIn:THREE.Mesh;
 private standInMaterial:THREE.MeshStandardMaterial;
 private placements:ParkedScooter[];
 private ranges:Array<[number,number]>;
 private authored:THREE.Mesh[];
 private loaded=false;
 private abort=new AbortController();
 status:'loading'|'ready'|'fallback'='loading';
 constructor(placements:ParkedScooter[],random:()=>number){
  this.group.name='Parked scooters';
  // Stand-ins are merged in street order, so the ones near the viewer are one contiguous vertex range:
  // one draw, trimmed per frame with drawRange like the prop batches' 30 m cut-off.
  this.placements=[...placements].sort((a,b)=>b.z-a.z);
  const parts=this.placements.map(p=>{const kit=new BakedKit(random);twoWheeler(kit,p.x,p.z,p.yaw,'scooter',p.body);const built=kit.build('stand-in',.3);const mesh=built.group.children[0] as THREE.Mesh;(mesh.material as THREE.Material).dispose();return mesh.geometry;});
  let start=0;this.ranges=parts.map(g=>{const range=[start,g.attributes.position.count] as [number,number];start+=g.attributes.position.count;return range;});
  this.standInMaterial=bakedFinishMaterial(.3);this.standIn=new THREE.Mesh(mergeGeometries(parts)!,this.standInMaterial);parts.forEach(g=>g.dispose());
  this.standIn.name='Parked scooter stand-ins';this.standIn.castShadow=this.standIn.receiveShadow=true;this.group.add(this.standIn);
  this.authored=this.placements.map((p,i)=>{
   const material=bakedFinishMaterial(.3);material.color.set(TINTS[i%TINTS.length]);
   const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.name=`Parked scooter ${i} (authored)`;mesh.visible=false;
   mesh.position.set(p.x,0,p.z);mesh.rotation.set(0,p.yaw,.06,'YXZ');mesh.castShadow=false;mesh.receiveShadow=true;
   this.group.add(mesh);return mesh;
  });
 }
 /** Fetches, verifies and installs the authored model. Failure keeps the stand-ins. */
 async load(origin:string){
  try{
   const response=await fetch(new URL(record.url,origin).href,{signal:this.abort.signal});if(!response.ok)throw new Error(`Scooter fetch ${response.status}`);
   const bytes=await response.arrayBuffer();if(bytes.byteLength!==record.bytes)throw new Error('Scooter size mismatch');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==record.sha256)throw new Error('Scooter integrity mismatch');
   validateGLB(bytes);
   const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   const gltf=await new GLTFLoader().parseAsync(bytes,'');
   const meshes:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
   if(meshes.length!==1)throw new Error('Scooter must be one mesh');
   const geometry=scooterGeometry(meshes[0].geometry);meshes[0].geometry.dispose();
   if(this.abort.signal.aborted){geometry.dispose();return;}
   for(const mesh of this.authored){mesh.geometry.dispose();mesh.geometry=geometry;}
   this.loaded=true;this.status='ready';
  }catch(error){if(!this.abort.signal.aborted){this.status='fallback';console.warn('Authored scooter unavailable; code-modelled stand-ins kept',error);}}
 }
 /** Per frame: authored scooters near the viewer while walking, stand-ins otherwise. */
 update(view:THREE.Vector3,onFoot:boolean){
  const useAuthored=this.loaded&&onFoot;
  this.standInMaterial.colorWrite=this.standInMaterial.depthWrite=!useAuthored;
  this.authored.forEach((mesh,i)=>{mesh.visible=useAuthored&&Math.abs(this.placements[i].z-view.z)<NEAR;});
  // Stand-ins: the same window on foot (where they only cast shadow), the props' 30 m while riding.
  const reach=useAuthored?NEAR:30;let first=-1,last=-1;
  this.placements.forEach((p,i)=>{if(Math.abs(p.z-view.z)<reach){if(first<0)first=i;last=i;}});
  this.standIn.visible=first>=0;if(first>=0)this.standIn.geometry.setDrawRange(this.ranges[first][0],this.ranges[last][0]+this.ranges[last][1]-this.ranges[first][0]);
 }
 dispose(){this.abort.abort();this.standIn.geometry.dispose();this.standInMaterial.dispose();const shared=new Set(this.authored.map(m=>m.geometry));shared.forEach(g=>g.dispose());this.authored.forEach(m=>(m.material as THREE.Material).dispose());}
}

/**
 * The GLB stores linear base colour in COLOR_0 and (roughness, 1 - metalness) in TEXCOORD_0. Re-pack it
 * into the baked material's attributes: `color`, `heroFinish`, and a uv pinned inside the plain atlas region.
 */
export function scooterGeometry(source:THREE.BufferGeometry){
 const g=new THREE.BufferGeometry();g.setIndex(source.index?source.index.clone():null);
 g.setAttribute('position',source.attributes.position.clone());g.setAttribute('normal',source.attributes.normal.clone());
 const colour=source.attributes.color,finish=source.attributes.uv,count=g.attributes.position.count;
 if(!colour||!finish)throw new Error('Scooter is missing baked colour or finish');
 const colours=new Float32Array(count*3),finishes=new Float32Array(count*2),uvs=new Float32Array(count*2);
 const region=ATLAS_REGION('glass'),u=((region%3)+.5)/3,v=1-(Math.floor(region/3)+.5)/2;
 for(let i=0;i<count;i++){colours[i*3]=colour.getX(i);colours[i*3+1]=colour.getY(i);colours[i*3+2]=colour.getZ(i);finishes[i*2]=finish.getX(i);finishes[i*2+1]=1-finish.getY(i);uvs[i*2]=u;uvs[i*2+1]=v;}
 g.setAttribute('color',new THREE.BufferAttribute(colours,3));g.setAttribute('heroFinish',new THREE.BufferAttribute(finishes,2));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
 g.computeBoundingSphere();return g;
}
