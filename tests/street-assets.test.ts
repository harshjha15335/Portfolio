import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {patinaGeometry,runoffGeometry} from '../src/game/World/architecture/StreetArt';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import surfaces from '../public/surfaces/provenance.json';
import {ParkedScooters,SCOOTER_ASSET,scooterGeometry} from '../src/game/World/architecture/ParkedScooters';
import {validateGLB} from '../src/game/World/assets/GLBAssetLibrary';
import {VEHICLE_BODIES,vehicleBodyParts} from '../src/game/World/AuthoredVehicles';
import {createTransitModel} from '../src/game/World/TransitModel';
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

describe('scanned surfaces',()=>{
 it('replaces each surface\'s maps one for one with pinned CC0 scans',async()=>{
  const channels=(surface:string)=>surfaces.files.filter(r=>r.surface===surface).map(r=>r.channel).sort();
  expect(channels('asphalt')).toEqual(['color','normal','roughness']);expect(channels('plaster')).toEqual(['color','normal','roughness']);
  // Stone and paving keep their single colour slot, so the street's texture count is unchanged.
  expect(channels('stone')).toEqual(['color']);expect(channels('paving')).toEqual(['color']);
  for(const r of surfaces.files){
   expect(r).toMatchObject({origin:'scanned',license:'CC0-1.0',width:r.surface==='asphalt'?512:1024});expect(r.source).toMatch(/^https:\/\/polyhaven\.com\/a\//);
   const bytes=file(`/surfaces/${r.file}`);expect(bytes.length).toBe(r.bytes);expect(await sha(bytes)).toBe(r.sha256);
  }
 });
 it('maps world metres through the shared weathering patch without a new program key',()=>{
  const uniforms=createAtmosphereUniforms(new THREE.Vector3(-39,13,-72),new THREE.Vector3(0,0,-26),'#f2b682');
  const road=new THREE.MeshStandardMaterial();road.userData={surface:'asphalt',worldUv:1/3};const wall=new THREE.MeshStandardMaterial();wall.userData={surface:'plaster'};
  patchMaterial(road,uniforms);patchMaterial(wall,uniforms);
  expect(road.customProgramCacheKey()).toBe(wall.customProgramCacheKey());
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <fog_fragment>'};
  road.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
  expect(shader.uniforms.uWorldUv.value).toBeCloseTo(1/3);expect(shader.vertexShader).toContain('weatherWorld.xz * uWorldUv');expect(shader.vertexShader).toContain('vMapUv = worldUv;');
 });
 it('tiles the scanned render every 1.5 m on wall faces, with the same program key',()=>{
  const uniforms=createAtmosphereUniforms(new THREE.Vector3(-39,13,-72),new THREE.Vector3(0,0,-26),'#f2b682');
  const wall=new THREE.MeshStandardMaterial();wall.userData={surface:'plaster',wallUv:1/1.5};const glass=new THREE.MeshStandardMaterial();glass.userData={surface:'glass'};
  patchMaterial(wall,uniforms);patchMaterial(glass,uniforms);expect(wall.customProgramCacheKey()).toBe(glass.customProgramCacheKey());
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <normal_fragment_maps>\n#include <fog_fragment>'};
  wall.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
  expect(shader.uniforms.uWallUv.value).toBeCloseTo(1/1.5);expect(shader.vertexShader).toContain('vBumpMapUv = worldUv;');expect(shader.uniforms.uWorldUv.value).toBe(0);
  // Relief perturbs the shading normal from world-space noise; no texture is sampled for it.
  expect(shader.fragmentShader).toContain('normal = normalize( abs( rdet ) * normal - rgrad );');
  const plaster=surfaces.files.filter(r=>r.surface==='plaster');expect(plaster).toHaveLength(3);
  for(const r of plaster)expect(r).toMatchObject({width:1024,height:1024,tileMetres:1.5,source:'https://polyhaven.com/a/plaster_grey_04'});
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

describe('modelled taxi and auto bodies',()=>{
 for(const kind of ['taxi','auto'] as const){
  const record=VEHICLE_BODIES[kind],bytes=file(record.url);
  it(`${kind}: pinned, original and carries no textures`,async()=>{
   expect(bytes.length).toBe(record.bytes);expect(await sha(bytes)).toBe(record.sha256);
   expect(record).toMatchObject({origin:'original',source:`scripts/vehicles/build_${kind}.py`});
   const json=validateGLB(buffer(bytes));expect(json.images??[]).toHaveLength(0);expect(json.materials??[]).toHaveLength(0);
  });
  it(`${kind}: re-packs for the shared baked material and fits the wheels, cabin and roof`,async()=>{
   const parts=vehicleBodyParts((await new GLTFLoader().parseAsync(buffer(bytes),'')).scene);
   for(const name of ['color','heroFinish','uv','normal'])expect(parts.body.attributes[name]).toBeDefined();
   const triangles=Object.values(parts).reduce((sum,g)=>sum+(g.index?.count??g.attributes.position.count)/3,0);
   expect(triangles).toBe(record.triangles);
   // Budget-neutral: never more than the code-built exterior it replaces.
   let exterior=0;createTransitModel(kind).traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh&&mesh.name.includes(':exterior:'))exterior+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});
   expect(exterior).toBeGreaterThan(1000);expect(triangles).toBeLessThanOrEqual(exterior);
   parts.body.computeBoundingBox();const box=parts.body.boundingBox!;
   // Front is -Z, like the code-built vehicle; the wheels (taxi radius .32 at z +-1.13, auto front at -.94) sit under the body.
   if(kind==='taxi'){expect(box.min.z).toBeCloseTo(-2,1);expect(box.max.z).toBeCloseTo(1.98,1);expect(box.max.y).toBeCloseTo(1.71,1);expect(box.max.x).toBeLessThan(.95);}
   else{expect(box.min.z).toBeLessThan(-1.2);expect(box.max.z).toBeGreaterThan(1.2);expect(box.max.y).toBeCloseTo(1.92,1);expect(box.max.x).toBeLessThan(.8);}
   expect(box.min.y).toBeGreaterThan(.15);
   let metal=0;const finish=parts.body.attributes.heroFinish;for(let i=0;i<finish.count;i++)if(finish.getY(i)>.5)metal++;expect(metal).toBeGreaterThan(0);
   Object.values(parts).forEach(g=>g.dispose());
  });
 }
});

describe('façade run-off',()=>{
 it('merges with the damp patina and costs two triangles a streak',()=>{
  const runoff=runoffGeometry([[0,4,.5,.1],[1,8,2,.12]],new THREE.Color('#b9a48a'),new THREE.Color('#23241f'));
  expect(runoff.index!.count/3).toBe(4);
  const damp=patinaGeometry(.2,.4,'seed');damp.setAttribute('color',new THREE.Float32BufferAttribute(new Array(damp.attributes.position.count*3).fill(.5),3));
  const merged=mergeGeometries([damp,runoff]);expect(merged).not.toBeNull();
  // Darkest where water leaves the ledge, nearer the wall colour at the tip.
  const c=runoff.attributes.color;expect(c.getX(0)).toBeLessThan(c.getX(2));
 });
});
