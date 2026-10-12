import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import surfaces from '../public/surfaces/provenance.json';
import {ParkedScooters,SCOOTER_ASSET,scooterGeometry} from '../src/game/World/architecture/ParkedScooters';
import {validateGLB} from '../src/game/World/assets/GLBAssetLibrary';
import {seededRandom} from '../src/game/World/StreetArchitecture';
import {createAtmosphereUniforms,patchMaterial} from '../src/game/World/StreetAtmosphere';

beforeEach(()=>vi.stubGlobal('document',{createElement:()=>({getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},fill(){}})})}));
afterEach(()=>vi.unstubAllGlobals());
// Node's fs without pulling Node types into the browser-targeted tsconfig.
const fs:{readFileSync(url:URL,encoding?:string):Uint8Array&string}=await import(/* @vite-ignore */ ['node','fs'].join(':'));
const readFileSync=fs.readFileSync;
const file=(path:string)=>new Uint8Array(readFileSync(new URL(`../public${path}`,import.meta.url)));
const buffer=(bytes:Uint8Array)=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer(bytes)))).map(n=>n.toString(16).padStart(2,'0')).join('');

describe('scanned asphalt',()=>{
 it('replaces the generated asphalt maps one for one with a pinned CC0 scan',async()=>{
  const asphalt=surfaces.files.filter(r=>r.surface==='asphalt');
  expect(asphalt.map(r=>r.channel).sort()).toEqual(['color','normal','roughness']);
  for(const r of asphalt){
   expect(r).toMatchObject({origin:'scanned',license:'CC0-1.0',width:512,height:512});
   const bytes=file(`/surfaces/${r.file}`);expect(bytes.length).toBe(r.bytes);expect(await sha(bytes)).toBe(r.sha256);
  }
  // Plaster is still the original generator's output, and says so.
  expect(surfaces.files.filter(r=>r.surface==='plaster').every(r=>(r as {origin?:string}).origin==='generated')).toBe(true);
 });
 it('maps world metres through the shared weathering patch without a new program key',()=>{
  const uniforms=createAtmosphereUniforms(new THREE.Vector3(-39,13,-72),new THREE.Vector3(0,0,-26),'#f2b682');
  const road=new THREE.MeshStandardMaterial();road.userData={surface:'asphalt',worldUv:1/3};const wall=new THREE.MeshStandardMaterial();wall.userData={surface:'plaster'};
  patchMaterial(road,uniforms);patchMaterial(wall,uniforms);
  expect(road.customProgramCacheKey()).toBe(wall.customProgramCacheKey());
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <fog_fragment>'};
  road.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
  expect(shader.uniforms.uWorldUv.value).toBeCloseTo(1/3);expect(shader.vertexShader).toContain('vMapUv = weatherWorld.xz * uWorldUv');
 });
});

describe('authored parked scooter',()=>{
 const bytes=file(SCOOTER_ASSET.url);
 it('is pinned, credited and carries no textures',async()=>{
  expect(bytes.length).toBe(SCOOTER_ASSET.bytes);expect(await sha(bytes)).toBe(SCOOTER_ASSET.sha256);
  expect(SCOOTER_ASSET).toMatchObject({license:'CC-BY-4.0',author:'minghauLoh'});expect(SCOOTER_ASSET.credit).toContain('CC-BY-4.0');
  const json=validateGLB(buffer(bytes));
  expect(json.images??[]).toHaveLength(0);expect(json.textures??[]).toHaveLength(0);
  expect(readFileSync(new URL('../CREDITS.md',import.meta.url),'utf8')).toContain('minghauLoh');
 });
 it('re-packs into the baked material attributes at real scooter size and cost',async()=>{
  const gltf=await new GLTFLoader().parseAsync(buffer(bytes),'');
  let mesh:THREE.Mesh|null=null;gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)mesh=o as THREE.Mesh;});
  const geometry=scooterGeometry(mesh!.geometry),triangles=(geometry.index?.count??geometry.attributes.position.count)/3;
  expect(triangles).toBe(SCOOTER_ASSET.triangles);expect(triangles).toBeLessThan(5000);
  for(const name of ['color','heroFinish','uv','normal'])expect(geometry.attributes[name]).toBeDefined();
  geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new THREE.Vector3());
  expect(size.z).toBeGreaterThan(1.5);expect(size.z).toBeLessThan(2.1);expect(size.y).toBeGreaterThan(1);expect(size.y).toBeLessThan(1.4);expect(geometry.boundingBox!.min.y).toBeCloseTo(0,2);
  // Roughness and metalness stay physical; the chrome parts read as metal.
  const finish=geometry.attributes.heroFinish;let metal=0;for(let i=0;i<finish.count;i++){expect(finish.getX(i)).toBeGreaterThanOrEqual(0);expect(finish.getX(i)).toBeLessThanOrEqual(1);if(finish.getY(i)>.5)metal++;}
  expect(metal).toBeGreaterThan(0);
 });
 it('keeps code-modelled stand-ins casting the cached shadows and only shows the model on foot nearby',()=>{
  const scooters=new ParkedScooters([{x:5.6,z:2,yaw:.4,body:'#2c4a6b'},{x:-5.6,z:-50,yaw:-.4,body:'#7d1f25'}],seededRandom('test'));
  const [standIn,near,far]=scooters.group.children as THREE.Mesh[];
  expect(standIn.castShadow).toBe(true);expect(near.castShadow).toBe(false);
  expect((near.material as THREE.MeshStandardMaterial).customProgramCacheKey()).toBe('hero-finish-v1');
  (scooters as unknown as {loaded:boolean}).loaded=true;
  scooters.update(new THREE.Vector3(0,1.7,5),true);
  expect([near.visible,far.visible]).toEqual([true,false]);expect((standIn.material as THREE.Material).colorWrite).toBe(false);
  scooters.update(new THREE.Vector3(0,1.7,5),false);
  expect(near.visible).toBe(false);expect((standIn.material as THREE.Material).colorWrite).toBe(true);
  scooters.dispose();
 });
});
