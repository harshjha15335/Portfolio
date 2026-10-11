import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Surface} from '../StreetMaterials';

/**
 * Shared material path for authored, baked architecture (the Irani café and the benchmark façade).
 * Every batch uses one atlas texture and one shader program ('hero-finish-v1'); per-part roughness
 * and metalness ride in a vertex attribute, so adding a building adds no textures or programs.
 */
export const FINISH:Record<Surface,[number,number]>={solid:[.83,0],wood:[.78,0],stone:[.85,0],plaster:[.96,0],fabric:[.98,0],metal:[.43,.48],glass:[.18,0],asphalt:[.98,0],paving:[.9,0],glow:[1,0],foliage:[.87,0]};
export const ATLAS_REGION=(surface:Surface)=>surface==='wood'?0:surface==='fabric'?1:surface==='metal'?2:surface==='glass'?3:surface==='plaster'?4:5;

let atlas:THREE.CanvasTexture|null=null;
/** Original small surface atlas: region-specific wear, no third-party images. Created once. */
export function surfaceAtlas(){
 if(atlas)return atlas;
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;const c=canvas.getContext('2d')!;
 c.fillStyle='#f5f2e8';c.fillRect(0,0,384,256);
 let state=94623;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 for(let region=0;region<6;region++){const x=region%3*128,y=Math.floor(region/3)*128;
  for(let i=0;i<1300;i++){const alpha=region===3?0:region===0?.11:region===4?.06:.04;c.fillStyle=`rgba(87,82,67,${random()*alpha})`;c.fillRect(x+random()*128,y+random()*128,1+random()*2,region===0?9+random()*25:1+random()*3);}
  if(region===1){c.strokeStyle='#8d897a10';for(let j=0;j<128;j+=3){c.beginPath();c.moveTo(x+j,y);c.lineTo(x+j,y+128);c.moveTo(x,y+j);c.lineTo(x+128,y+j);c.stroke();}}
  if(region===2){c.strokeStyle='#928b761b';for(let j=0;j<18;j++){const yy=y+random()*128;c.beginPath();c.moveTo(x+random()*70,yy);c.lineTo(x+80+random()*40,yy+random()*2);c.stroke();}}
  if(region===4){for(let i=0;i<6;i++){c.fillStyle='#93836314';c.beginPath();c.ellipse(x+random()*128,y+random()*128,6+random()*14,12+random()*23,random(),0,Math.PI*2);c.fill();}}
 }
 atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;return atlas;
}

/** Vertex-coloured, atlas-mapped material. `weather` only changes a uniform, never the program. */
export function bakedFinishMaterial(weather:number){
 const material=new THREE.MeshStandardMaterial({map:surfaceAtlas(),vertexColors:true,roughness:1,metalness:1,side:THREE.DoubleSide});material.userData.weather=weather;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec2 heroFinish; varying vec2 vHeroFinish;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHeroFinish = heroFinish;');
  shader.fragmentShader='varying vec2 vHeroFinish;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = vHeroFinish.x;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = vHeroFinish.y;');
 };
 material.customProgramCacheKey=()=> 'hero-finish-v1';
 return material;
}
export const bakedGlassMaterial=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.14,metalness:0,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});

/** How a part darkens itself: 'wall' deepens window reveals, 'part' darkens where it meets the wall. */
export type Occlusion='wall'|'part'|'recess'|'none';
type Triple=[number,number,number];

/**
 * Bakes many small parts into one opaque and one glass batch. Each part gets a per-vertex
 * approximation of ambient occlusion (undersides, reveal depth, wall contact) and a small colour
 * jitter, which is what keeps repeated modules from reading as identical boxes.
 */
export class BakedKit {
 private opaque:THREE.BufferGeometry[]=[];
 private glass:THREE.BufferGeometry[]=[];
 private fine:THREE.BufferGeometry[]=[];
 /** While true, opaque parts go to a separate near-distance detail batch (see `build`). */
 detail=false;
 private rounded=new Map<string,THREE.BufferGeometry>();
 readonly unitBox=new THREE.BoxGeometry(1,1,1);
 constructor(private random:()=>number){}
 /** Places `geometry` with `local` (then `frame`) and records it in the batch for its surface. */
 add(geometry:THREE.BufferGeometry,local:THREE.Matrix4,color:string|THREE.Color,surface:Surface='solid',occlusion:Occlusion='part',frame?:THREE.Matrix4,jitter=.05){
  const g=(geometry.index?geometry.toNonIndexed():geometry.clone());g.applyMatrix4(frame?frame.clone().multiply(local):local);
  if(!g.attributes.normal)g.computeVertexNormals();
  const base=new THREE.Color(color).multiplyScalar(1+(this.random()-.5)*2*jitter),p=g.attributes.position,n=g.attributes.normal,count=p.count;
  const colors=new Float32Array(count*3),finish=new Float32Array(count*2),[roughness,metalness]=FINISH[surface];
  for(let i=0;i<count;i++){
   const ny=n.getY(i),z=p.getZ(i);let f=ny<-.5?.56:ny>.5?1.04:1;
   if(occlusion==='wall'&&z<-.01)f*=.48+.52*THREE.MathUtils.smoothstep(z,-.32,0);
   else if(occlusion==='part'&&z<.045)f*=.74;
   else if(occlusion==='recess')f*=.72;
   colors[i*3]=base.r*f;colors[i*3+1]=base.g*f;colors[i*3+2]=base.b*f;finish[i*2]=roughness;finish[i*2+1]=metalness;
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('heroFinish',new THREE.BufferAttribute(finish,2));
  const generated=!(geometry instanceof THREE.BoxGeometry||geometry instanceof THREE.PlaneGeometry);
  if(!g.attributes.uv||generated)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2).fill(.5),2));
  const region=ATLAS_REGION(surface),uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,((region%3)+.04+uv.getX(i)*.92)/3,1-(Math.floor(region/3)+.04+uv.getY(i)*.92)/2);
  (surface==='glass'?this.glass:this.detail?this.fine:this.opaque).push(g);
 }
 static matrix(size:Triple,position:Triple,rotation:Triple=[0,0,0]){return new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...size));}
 box(size:Triple,position:Triple,color:string,surface:Surface='solid',occlusion:Occlusion='part',rotation:Triple=[0,0,0],frame?:THREE.Matrix4){this.add(this.unitBox,BakedKit.matrix(size,position,rotation),color,surface,occlusion,frame);}
 /** Chamfered box at true size, so every edge catches a highlight instead of a razor corner. */
 bevel(size:Triple,position:Triple,color:string,surface:Surface='solid',radius=.025,occlusion:Occlusion='part',rotation:Triple=[0,0,0],frame?:THREE.Matrix4){
  const r=Math.min(radius,size[0]/2-.001,size[1]/2-.001,size[2]/2-.001),key=`${size.map(v=>v.toFixed(3)).join('|')}|${r.toFixed(3)}`;
  if(!this.rounded.has(key))this.rounded.set(key,chamferBox(size[0],size[1],size[2],r));
  this.add(this.rounded.get(key)!,BakedKit.matrix([1,1,1],position,rotation),color,surface,occlusion,frame);
 }
 /** A vertical run-off stain: dark at the source, fading into the wall colour below. */
 streak(x:number,top:number,length:number,width:number,z:number,dark:string,wall:string,strength=1){
  const g=new THREE.PlaneGeometry(width,length,1,5);g.translate(x,top-length/2,z);
  const a=new THREE.Color(wall),b=new THREE.Color(dark),c=new THREE.Color(),p=g.attributes.position,colors=new Float32Array(p.count*3),finish=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const t=Math.pow(THREE.MathUtils.clamp((top-p.getY(i))/length,0,1),.6);c.copy(b).lerp(a,1-(1-t)*strength);colors.set([c.r,c.g,c.b],i*3);finish.set(FINISH.plaster,i*2);}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('heroFinish',new THREE.BufferAttribute(finish,2));
  const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(1+.04+uv.getX(i)*.92)/3,1-(1+.04+uv.getY(i)*.92)/2);
  this.opaque.push(g.toNonIndexed());g.dispose();
 }
 /**
  * Merge into the shared-program meshes. Fine parts become a separate `detail` mesh that the caller
  * hides beyond a near distance; it casts no shadow, so toggling it never invalidates cached shadows.
  */
 build(name:string,weather:number){
  const group=new THREE.Group();group.name=name;let triangles=0,detailTriangles=0;let detail:THREE.Mesh|null=null;
  const material=bakedFinishMaterial(weather);
  if(this.opaque.length){const geometry=mergeGeometries(this.opaque)!;const mesh=new THREE.Mesh(geometry,material);mesh.name=`${name}-opaque`;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);triangles+=geometry.attributes.position.count/3;}
  if(this.glass.length){const geometry=mergeGeometries(this.glass)!;const pane=new THREE.Mesh(geometry,bakedGlassMaterial());pane.name=`${name}-glass`;pane.receiveShadow=true;group.add(pane);triangles+=geometry.attributes.position.count/3;}
  if(this.fine.length){const geometry=mergeGeometries(this.fine)!;detail=new THREE.Mesh(geometry,material);detail.name=`${name}-detail`;detail.receiveShadow=true;group.add(detail);detailTriangles=geometry.attributes.position.count/3;}
  [...this.opaque,...this.glass,...this.fine].forEach(g=>g.dispose());this.opaque=[];this.glass=[];this.fine=[];
  this.rounded.forEach(g=>g.dispose());this.rounded.clear();this.unitBox.dispose();
  return {group,triangles,detail,detailTriangles};
 }
}

/** Box with 45° chamfers on every edge: an extruded, bevelled rectangle (about 28 triangles,
 * against 108 for a one-segment RoundedBoxGeometry). UVs are flattened by `add`. */
function chamferBox(w:number,h:number,d:number,r:number){
 const shape=new THREE.Shape(),x=w/2-r,y=h/2-r;shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.lineTo(-x,-y);
 const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(d-2*r,.001),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,curveSegments:1});
 g.translate(0,0,-(d-2*r)/2);return g;
}
