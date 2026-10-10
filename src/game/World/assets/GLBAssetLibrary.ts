import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

export interface VerifiedGLB {
  id:string; url:string; sha256:string;
  source:string; author:string; license:string;
  /** Separate artist-authored geometry levels, metres from the camera. */
  lod?:Array<{url:string;sha256:string;distance:number}>;
}
export interface AssetLease {root:THREE.Object3D;animations:THREE.AnimationClip[];release():void;}
type Template={scene:THREE.Group;animations:THREE.AnimationClip[]};

/** Only verified, self-contained, same-origin GLBs. No remote decoders or inferred licences. */
export class GLBAssetLibrary {
  private templates=new Map<string,Promise<Template>>();
  private materials=new Map<string,THREE.Material>();
  private released=false;
  private abort=new AbortController();
  private leases=new Set<AssetLease>();
  constructor(private origin:string,private maxBytes=8*1024*1024,private maxAssets=8){}
  private async template(url:string,sha256:string):Promise<Template>{
    const address=new URL(url,this.origin);
    if(address.origin!==new URL(this.origin).origin||!address.pathname.endsWith('.glb'))throw new Error('GLB must be a same-origin .glb');
    if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('A verified SHA-256 is required');
    const key=`${address.href}:${sha256}`;
    if(this.templates.has(key))return this.templates.get(key)!;
    if(this.released||this.templates.size>=this.maxAssets)throw new Error('Asset library unavailable or full');
    const promise=(async()=>{
      const response=await fetch(address.href,{signal:this.abort.signal});if(!response.ok)throw new Error(`GLB fetch failed: ${response.status}`);
      const chunks:Uint8Array[]=[];let size=0;const reader=response.body?.getReader();if(!reader)throw new Error('GLB response body unavailable');
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>this.maxBytes)throw new Error('GLB byte budget exceeded');chunks.push(value);}}finally{await reader.cancel();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
      if(digest!==sha256)throw new Error('GLB integrity mismatch');
      validateGLB(bytes.buffer);
      const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
      const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
      if(this.released){disposeTemplate(gltf.scene);throw new Error('Asset library disposed during load');}
      let triangles=0;gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});
      if(triangles>120000){disposeTemplate(gltf.scene);throw new Error('GLB geometry budget exceeded');}
      gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.castShadow=mesh.receiveShadow=true;
        const reuse=(material:THREE.Material)=>{const m=material as THREE.MeshStandardMaterial;const {uuid:_uuid,name:_name,metadata:_metadata,...record}=m.toJSON();const key=JSON.stringify(record);const existing=this.materials.get(key);if(existing&&existing!==material){material.dispose();return existing;}this.materials.set(key,material);return material;};
        mesh.material=Array.isArray(mesh.material)?mesh.material.map(reuse):reuse(mesh.material);
      });
      return {scene:gltf.scene,animations:gltf.animations};
    })();this.templates.set(key,promise);
    try{return await promise;}catch(error){this.templates.delete(key);throw error;}
  }
  async acquire(asset:VerifiedGLB):Promise<AssetLease>{
    if(this.released)throw new Error('Asset library disposed');
    if(!asset.author||!asset.source||!asset.license)throw new Error('Asset provenance is required');
    const levels=[{url:asset.url,sha256:asset.sha256,distance:0},...(asset.lod??[])];
    if(levels.some((level,i)=>!Number.isFinite(level.distance)||level.distance<0||(i>0&&level.distance<=levels[i-1].distance)))throw new Error('LOD distances must increase');
    const templates=await Promise.all(levels.map(level=>this.template(level.url,level.sha256)));if(this.released)throw new Error('Asset library disposed');
    const root=levels.length===1?cloneSkeleton(templates[0].scene):new THREE.LOD();
    if(root instanceof THREE.LOD)templates.forEach((template,i)=>root.addLevel(cloneSkeleton(template.scene),levels[i].distance));
    let released=false;const lease:AssetLease={root,animations:templates[0].animations,release:()=>{if(released)return;released=true;root.removeFromParent();root.traverse(o=>{const mesh=o as THREE.SkinnedMesh;if(mesh.isSkinnedMesh)mesh.skeleton.dispose();});this.leases.delete(lease);}};
    this.leases.add(lease);return lease;
  }
  async dispose(){if(this.released)return;this.released=true;this.abort.abort();for(const lease of [...this.leases])lease.release();const resources=await Promise.allSettled(this.templates.values());const geometries=new Set<THREE.BufferGeometry>(),textures=new Set<THREE.Texture>();for(const r of resources)if(r.status==='fulfilled')r.value.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);const skinned=mesh as THREE.SkinnedMesh;if(skinned.isSkinnedMesh)skinned.skeleton.dispose();}});geometries.forEach(g=>g.dispose());disposeTextures(textures);this.materials.forEach(m=>m.dispose());this.materials.clear();this.templates.clear();}
}
function disposeTemplate(root:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(m);Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});}const skin=mesh as THREE.SkinnedMesh;if(skin.isSkinnedMesh)skin.skeleton.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());disposeTextures(textures);}
/** Reject external image/buffer references before Three's loader can request them. */
export function validateGLB(buffer:ArrayBuffer){
 if(buffer.byteLength<20)throw new Error('Truncated GLB');const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw new Error('Invalid GLB header');
 const length=view.getUint32(12,true);if(view.getUint32(16,true)!==0x4e4f534a||length+20>buffer.byteLength)throw new Error('Invalid GLB JSON');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
 if(json.asset?.version!=='2.0'||[...(json.buffers??[]),...(json.images??[])].some(item=>Object.prototype.hasOwnProperty.call(item,"uri")))throw new Error('GLB must contain embedded buffers and images');
 if((json.extensionsRequired??[]).some((e:string)=>!['KHR_materials_unlit','KHR_materials_emissive_strength'].includes(e)))throw new Error('Unsupported GLB decoder/extension');
 return json;
}

/** GLTFLoader may own ImageBitmaps as well as GPU texture objects. */
function disposeTextures(textures:Set<THREE.Texture>){
 const images=new Set<{close():void}>();
 for(const texture of textures){texture.dispose();const image=texture.image;if(image&&typeof image.close==='function')images.add(image);}
 images.forEach(image=>image.close());
}
