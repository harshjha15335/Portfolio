import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {GLBAssetLibrary,validateGLB,type VerifiedGLB} from '../src/game/World/assets/GLBAssetLibrary';
function fixture(external=false){
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{mesh:0},{mesh:0,translation:[2,0,0]}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.5,.4,.3,1],metallicFactor:0,roughnessFactor:.8}}],buffers:[{byteLength:36,...(external?{uri:'https://unverified.test/data.bin'}:{})}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
 const text=new TextEncoder().encode(JSON.stringify(json));const length=Math.ceil(text.length/4)*4;const buffer=new ArrayBuffer(12+8+length+8+36);const v=new DataView(buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,buffer.byteLength,true);v.setUint32(12,length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(buffer,20,length).fill(32);new Uint8Array(buffer,20,text.length).set(text);v.setUint32(20+length,36,true);v.setUint32(24+length,0x004e4942,true);new Float32Array(buffer,28+length,9).set([0,0,0,1,0,0,0,1,0]);return buffer;
}
async function descriptor(bytes:ArrayBuffer):Promise<VerifiedGLB>{const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');return {id:'test-original-triangle',url:'/assets/test.glb',sha256,author:'Portfolio test fixture',license:'Original project fixture',source:'tests/glb-assets.test.ts'};}
afterEach(()=>vi.unstubAllGlobals());
describe('verified lazy GLB ownership',()=>{
 it('rejects external references, invalid headers and unverified origins before model loading',async()=>{
  expect(()=>validateGLB(fixture(true))).toThrow('embedded');expect(()=>validateGLB(new ArrayBuffer(4))).toThrow('Truncated');const library=new GLBAssetLibrary('https://portfolio.test');const asset=await descriptor(fixture());await expect(library.acquire({...asset,url:'https://other.test/model.glb'})).rejects.toThrow('same-origin');await expect(library.acquire({...asset,sha256:'not-verified'})).rejects.toThrow('SHA-256');await library.dispose();
 });
 it('verifies bytes, shares immutable resources across independent leases, and disposes once',async()=>{
  const bytes=fixture(),asset=await descriptor(bytes);const fetcher=vi.fn(async()=>new Response(bytes));vi.stubGlobal('fetch',fetcher);const library=new GLBAssetLibrary('https://portfolio.test');const a=await library.acquire(asset),b=await library.acquire(asset);expect(fetcher).toHaveBeenCalledTimes(1);expect(a.root).not.toBe(b.root);const meshes=(root:THREE.Object3D)=>{const out:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh)out.push(o as THREE.Mesh);});return out;};const am=meshes(a.root),bm=meshes(b.root);expect(am[0].geometry).toBe(bm[0].geometry);expect(am[0].material).toBe(bm[0].material);let disposed=0;am[0].geometry.addEventListener('dispose',()=>disposed++);a.release();expect(disposed).toBe(0);await library.dispose();expect(disposed).toBe(1);expect(b.root.parent).toBeNull();await expect(library.acquire(asset)).rejects.toThrow('disposed');
 });
 it('aborts an in-flight request when its world-owned library is disposed',async()=>{
  const asset=await descriptor(fixture());const fetcher=vi.fn((_url:RequestInfo|URL,options?:RequestInit)=>new Promise<Response>((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted')))));vi.stubGlobal('fetch',fetcher);const library=new GLBAssetLibrary('https://portfolio.test');const pending=library.acquire(asset);const rejected=expect(pending).rejects.toThrow('aborted');await library.dispose();await rejected;expect(fetcher).toHaveBeenCalledOnce();
 });
 it('refuses corrupted or oversized responses and preserves separate geometry LODs',async()=>{
  const bytes=fixture(),asset=await descriptor(bytes);vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes)));const small=new GLBAssetLibrary('https://portfolio.test',16);await expect(small.acquire(asset)).rejects.toThrow('byte budget');await small.dispose();const library=new GLBAssetLibrary('https://portfolio.test');await expect(library.acquire({...asset,sha256:'0'.repeat(64)})).rejects.toThrow('integrity');const lease=await library.acquire({...asset,lod:[{url:'/assets/test-far.glb',sha256:asset.sha256,distance:12}]});expect(lease.root).toBeInstanceOf(THREE.LOD);expect((lease.root as THREE.LOD).levels.map(x=>x.distance)).toEqual([0,12]);await library.dispose();
 });
});

import {GLBCharacter} from '../src/game/World/assets/GLBCharacter';
describe('licensed-character integration contract',()=>{
 it('rejects an unrigged model instead of silently substituting a procedural figure',()=>{
  const release=vi.fn();expect(()=>new GLBCharacter({root:new THREE.Group(),animations:[],release})).toThrow('rig');expect(release).toHaveBeenCalledOnce();
 });
 it('normalizes a real skin and runs named idle/walk clips without altering shared geometry',()=>{
  const bone=new THREE.Bone(),geometry=new THREE.BoxGeometry(.5,2,.4);const n=geometry.attributes.position.count;geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(n*4),4));const weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));const skin=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());skin.add(bone);skin.bind(new THREE.Skeleton([bone]));bone.name='root';const group=new THREE.Group();group.add(skin);const clips=[new THREE.AnimationClip('Idle',1,[new THREE.NumberKeyframeTrack('root.rotation[y]',[0,1],[0,.1])]),new THREE.AnimationClip('Walk',1,[new THREE.NumberKeyframeTrack('root.rotation[y]',[0,1],[0,.5])])];const release=vi.fn();const actor=new GLBCharacter({root:group,animations:clips,release});const size=new THREE.Box3().setFromObject(actor.root).getSize(new THREE.Vector3());expect(size.y).toBeCloseTo(1.72);expect(skin.geometry).toBe(geometry);actor.update(.1,false);actor.update(.2,true);actor.update(.2,true);expect(bone.rotation.y).toBeGreaterThan(.15);actor.dispose();expect(release).toHaveBeenCalledOnce();geometry.dispose();(skin.material as THREE.Material).dispose();skin.skeleton.dispose();
 });
});
