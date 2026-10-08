import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
let cached:THREE.BufferGeometry|null=null;
/** One continuous authored garment surface, including shoulders/sleeves; generated once. */
export function clothingGeometry(){
 if(cached)return cached;
 const resolution=24,material=new THREE.MeshBasicMaterial(),surface=new MarchingCubes(resolution,material,false,false,5000);surface.isolation=0;
 const profile=[[.94,.16],[1.06,.155],[1.2,.18],[1.34,.21],[1.42,.15],[1.46,.052]];
 const smoothUnion=(a:number,b:number,k:number)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
 for(let iz=0;iz<resolution;iz++)for(let iy=0;iy<resolution;iy++)for(let ix=0;ix<resolution;ix++){
  const x=(ix/resolution*2-1)*.35,y=(iy/resolution*2-1)*.35+1.2,z=(iz/resolution*2-1)*.16;
  let width=.16;for(let n=1;n<profile.length;n++)if(y>=profile[n-1][0]){const [lo,a]=profile[n-1],[hi,b]=profile[n];width=THREE.MathUtils.lerp(a,b,THREE.MathUtils.clamp((y-lo)/(hi-lo),0,1));}
  const torso=Math.max((Math.hypot(x/width,z/.105)-1)*.105,.94-y,y-1.46);
  const sleeve=Math.hypot(Math.abs(x)-.22,Math.max(0,Math.abs(y-1.27)-.1),z*.95)-.065;
  surface.field[iz*resolution*resolution+iy*resolution+ix]=-smoothUnion(torso,sleeve,.035);
 }
 surface.update();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(surface.positionArray.slice(0,surface.count*3),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(surface.normalArray.slice(0,surface.count*3),3));g.scale(.35,.35,.16);g.translate(0,1.2,0);g.setIndex(Array.from({length:surface.count},(_,i)=>i));g.normalizeNormals();
 const p=g.attributes.position,indices:number[]=[],weights:number[]=[],uv:number[]=[];
 for(let i=0;i<p.count;i++){const blend=THREE.MathUtils.smoothstep(Math.abs(p.getX(i)),.13,.25);indices.push(1,p.getX(i)<0?10:13,0,0);weights.push(1-blend,blend,0,0);uv.push(p.getX(i)+.5,(p.getY(i)-.9)*2);}
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));surface.geometry.dispose();material.dispose();cached=g;return g;
}
