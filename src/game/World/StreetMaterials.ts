import * as THREE from 'three';
import { seededRandom } from './StreetArchitecture';
export type Surface = 'plaster' | 'stone' | 'asphalt' | 'paving' | 'metal' | 'wood' | 'fabric' | 'glass' | 'solid' | 'glow';

/** Small original, repeatable surface maps. No downloaded artwork. */
export class StreetMaterials {
  private materials = new Map<string, THREE.Material>();
  private maps = new Map<Surface, THREE.CanvasTexture>();
  constructor() {
    for (const surface of ['plaster', 'stone', 'asphalt', 'paving', 'wood', 'fabric'] as Surface[]) this.maps.set(surface, this.texture(surface));
  }
  get(color: string, surface: Surface = 'solid') {
    const key = `${surface}:${color}`;
    if (!this.materials.has(key)) {
      const map = this.maps.get(surface) ?? null;
      const roughness = { plaster:.94, stone:.84, asphalt:.98, paving:.9, metal:.48, wood:.76, fabric:.96, glass:.22, solid:.8, glow:1 }[surface];
      const material = surface === 'glow' ? new THREE.MeshBasicMaterial({color}) : new THREE.MeshStandardMaterial({color, map, roughness, metalness:surface === 'metal' ? .35 : 0, bumpMap:map, bumpScale:surface === 'asphalt' ? .018 : surface === 'plaster' ? .008 : .012, envMapIntensity:surface === 'glass' ? .6 : .25});
      material.userData.surface = surface; this.materials.set(key, material);
    }
    return this.materials.get(key)!;
  }
  private texture(surface: Surface) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!;
    const random = seededRandom(`material:${surface}`);
    ctx.fillStyle = surface === 'asphalt' ? '#a3a4a4' : '#d3cfc6'; ctx.fillRect(0,0,256,256);
    for (let i=0;i<5500;i++) { const v=surface==='asphalt' ? 65+random()*140 : 145+random()*100; ctx.fillStyle=`rgba(${v},${v},${v},${surface==='asphalt'?.27:.12})`; ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*3); }
    if (surface === 'plaster' || surface === 'stone') {
      for(let i=0;i<35;i++) { ctx.fillStyle='#4c443b0b';ctx.fillRect(random()*256,random()*256,1+random()*5,15+random()*70); }
    }
    if (surface === 'paving' || surface === 'stone') {
      ctx.fillStyle='#524e4524'; for(let y=0;y<256;y+=surface==='paving'?64:32) {ctx.fillRect(0,y,256,2); for(let x=(y%128?32:0);x<256;x+=64)ctx.fillRect(x,y,1,64);}
    }
    if(surface==='asphalt') {
      ctx.fillStyle='#74747020';ctx.fillRect(22,38,95,37);ctx.fillRect(153,174,70,42);
      // Thin meandering cracks, drawn as tiny connected strips, not loud noise.
      for(let i=0;i<3;i++) { let x=random()*200+20; for(let y=20;y<230;y+=3){x+=random()*4-2;ctx.fillStyle='#35393d45';ctx.fillRect(x,y,.8,4);} }
    }
    if(surface==='wood'||surface==='fabric') {
      for(let i=0;i<256;i+=surface==='wood'?3:2){ctx.fillStyle=surface==='wood'?'#66554412':'#6655440b';ctx.fillRect(i,0,1,256);}
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(surface==='asphalt')t.repeat.set(4,35);else if(surface==='paving')t.repeat.set(2,30);else if(surface==='plaster')t.repeat.set(3,3);return t;
  }
}
