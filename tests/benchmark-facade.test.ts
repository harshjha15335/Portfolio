import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createBenchmarkFacade} from '../src/game/World/architecture/BenchmarkFacade';
import {BakedKit,bakedFinishMaterial} from '../src/game/World/architecture/BakedKit';
import {twoWheeler} from '../src/game/World/architecture/StreetProps';
import {facadeSpec,seededRandom} from '../src/game/World/StreetArchitecture';
import {STREET_MOOD} from '../src/game/World/streetMood';

beforeEach(()=>vi.stubGlobal('document',{createElement:()=>({getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},fill(){}})})}));
afterEach(()=>vi.unstubAllGlobals());
const meshes=(group:THREE.Object3D)=>{const list:THREE.Mesh[]=[];group.traverse(o=>{if((o as THREE.Mesh).isMesh)list.push(o as THREE.Mesh);});return list;};

describe('Radio House benchmark façade',()=>{
 it('bakes into base, glass and near-detail batches on the shared café program and atlas',()=>{
  const facade=createBenchmarkFacade(facadeSpec(-1,1)),parts=meshes(facade.group);
  expect(parts).toHaveLength(3);
  const lit=parts.filter(m=>(m.material as THREE.MeshStandardMaterial).map);
  expect(lit).toHaveLength(2);
  // Same program key and the very same texture object as the Irani café storefront.
  const cafe=bakedFinishMaterial(.35);
  for(const mesh of lit){const material=mesh.material as THREE.MeshStandardMaterial;expect(material.customProgramCacheKey()).toBe('hero-finish-v1');expect(material.map).toBe(cafe.map);}
  expect(facade.detail&&facade.detail.castShadow).toBe(false);
 });
 it('stays inside its triangle allowance and keeps decoration out of the carriageway',()=>{
  const spec=facadeSpec(-1,1),facade=createBenchmarkFacade(spec);
  expect(facade.triangles).toBeLessThan(12000);
  // Casement sashes moved into the near-detail batch (out of the always-drawn base), which put it just over 8k.
  expect(facade.detailTriangles).toBeLessThan(9000);
  const bounds=new THREE.Box3().setFromObject(facade.group);
  // Local +Z faces the street: nothing may project much past the 1 m balcony line (pavement is 2.8 m).
  expect(bounds.max.z).toBeLessThan(1.1);
  expect(bounds.min.y).toBeGreaterThan(0);
  expect(bounds.max.x-bounds.min.x).toBeLessThan(spec.width+1);
 });
 it('darkens undersides and reveal depth in the baked vertex colour',()=>{
  const kit=new BakedKit(seededRandom('ao'));kit.box([1,1,1],[0,0,-.15],'#ffffff','plaster','wall');
  const {group}=kit.build('ao',0),geometry=(group.children[0] as THREE.Mesh).geometry,color=geometry.attributes.color,normal=geometry.attributes.normal,position=geometry.attributes.position;
  let top=0,bottom=1,front=0,back=1;
  for(let i=0;i<color.count;i++){const c=color.getX(i);if(normal.getY(i)>.5)top=Math.max(top,c);if(normal.getY(i)<-.5)bottom=Math.min(bottom,c);if(normal.getZ(i)>.5)front=Math.max(front,c);if(position.getZ(i)<-.6)back=Math.min(back,c);}
  expect(bottom).toBeLessThan(top*.7);expect(back).toBeLessThan(front);
 });
});

describe('street dressing and light',()=>{
 it('authors two-wheelers as compact, grounded props',()=>{
  for(const kind of ['scooter','motorcycle'] as const){
   const kit=new BakedKit(seededRandom(kind));twoWheeler(kit,0,0,0,kind,'#2c4a6b');const {group,triangles}=kit.build(kind,.3);
   const size=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
   expect(triangles).toBeLessThan(850);expect(size.z).toBeGreaterThan(1.5);expect(size.z).toBeLessThan(2.1);expect(size.y).toBeGreaterThan(1);expect(size.y).toBeLessThan(1.4);
  }
 });
 it('throws a warm unshadowed street bounce from the north-east that is weaker than the sun',()=>{
  expect(STREET_MOOD.bounceIntensity).toBeLessThan(STREET_MOOD.sunIntensity*.4);
  const direction=new THREE.Vector3(...STREET_MOOD.bouncePosition).sub(new THREE.Vector3(...STREET_MOOD.bounceTarget)).normalize();
  // Reaches the south station face (normal -Z) and east-facing façades (normal +X), not the sunlit side.
  expect(direction.dot(new THREE.Vector3(0,0,-1))).toBeGreaterThan(.7);expect(direction.x).toBeGreaterThan(0);
  expect(new THREE.Color(STREET_MOOD.bounceColor).r).toBeGreaterThan(new THREE.Color(STREET_MOOD.bounceColor).b);
 });
});
