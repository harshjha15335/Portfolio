import * as THREE from 'three';
import provenance from '../../../public/surfaces/provenance.json';
import { seededRandom } from './StreetArchitecture';
export type Surface = 'plaster' | 'stone' | 'asphalt' | 'paving' | 'metal' | 'wood' | 'fabric' | 'glass' | 'solid' | 'glow' | 'foliage';

/**
 * Repeatable surface maps: small original canvas maps, upgraded at runtime to the verified files in
 * public/surfaces (CC0 Poly Haven scans of asphalt, plaster, sandstone and pavers; see provenance.json).
 */
export class StreetMaterials {
  private materials = new Map<string, THREE.Material>();
  private maps = new Map<Surface, THREE.CanvasTexture>();
  private pbr = new Map<string,THREE.Texture>();
  private abort = new AbortController();
  private disposed=false;
  readonly ready:Promise<void>;
  status='loading';
  constructor() {
    for (const surface of ['plaster', 'stone', 'asphalt', 'paving', 'wood', 'fabric'] as Surface[]) this.maps.set(surface, this.texture(surface));
    for(const surface of ['asphalt','plaster'] as Surface[])for(const channel of ['roughness','normal']){const pixel=channel==='normal'?[128,128,255,255]:[255,255,255,255];const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d')!;ctx.fillStyle=`rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;ctx.fillRect(0,0,1,1);const texture=new THREE.CanvasTexture(c);texture.needsUpdate=true;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.copy(this.maps.get(surface)!.repeat);this.pbr.set(`${surface}:${channel}`,texture);}
    this.ready=typeof location==='undefined'?Promise.resolve():this.loadMaps().then(()=>{this.status='verified';}).catch(error=>{if(!this.disposed){this.status='fallback';console.warn('Verified surface maps unavailable; original textures retained',error);}});
  }
  get(color: string, surface: Surface = 'solid') {
    const key = `${surface}:${color}`;
    if (!this.materials.has(key)) {
      // Painted and metal parts borrow the cement-render maps: grain and grime instead of flat colour,
      // with the very same textures and shader program as the walls.
      const maps:Surface=surface==='solid'||surface==='metal'?'plaster':surface;
      const map = surface==='wood'?null:this.maps.get(maps) ?? null;
      const roughness = { plaster:.94, stone:.84, asphalt:.98, paving:.9, metal:.48, wood:.76, fabric:.96, glass:.22, solid:.8, glow:1, foliage:.87 }[surface];
      const material = surface === 'glow' ? new THREE.MeshBasicMaterial({color}) : new THREE.MeshStandardMaterial({color, map, roughness, metalness:surface === 'metal' ? .35 : 0, normalMap:this.pbr.get(`${maps}:normal`)??null, normalScale:new THREE.Vector2(surface==='asphalt'?.42:surface==='plaster'?.8:maps==='plaster'?.4:.22,surface==='asphalt'?.42:surface==='plaster'?.8:maps==='plaster'?.4:.22),roughnessMap:this.pbr.get(`${maps}:roughness`)??null,bumpMap:this.pbr.has(`${maps}:normal`)?null:map, bumpScale:surface === 'asphalt' ? .018 : surface === 'plaster' ? .008 : .012, envMapIntensity:surface === 'glass' ? .6 : .25});
      if(surface==='foliage'&&material instanceof THREE.MeshStandardMaterial){material.side=THREE.DoubleSide;material.vertexColors=true;material.emissive.set(color);material.emissiveIntensity=.045;}
      // Scanned asphalt is mapped in world metres (one 3 m tile), so wide and narrow road boxes share its scale.
      if(surface==='asphalt')material.userData.worldUv=1/3;
      // Scanned render covers 1.5 m per tile on every wall face (tileMetres in provenance.json).
      if(maps==='plaster')material.userData.wallUv=1/1.5;
      // Sandstone ashlar: five courses per 1.8 m tile, so courses land about 36 cm apart on every face.
      if(surface==='stone')material.userData.wallUv=1/1.8;
      // Interlocking concrete pavers on footpaths, laid flat in world metres (one 1.92 m tile).
      if(surface==='paving')material.userData.worldUv=1/1.92;
      material.userData.surface = surface; this.materials.set(key, material);
    }
    return this.materials.get(key)!;
  }
  private async loadMaps(){
    await Promise.all(provenance.files.map(async record=>{
      const response=await fetch(`/surfaces/${record.file}`,{signal:this.abort.signal});if(!response.ok)throw new Error(`Surface fetch ${response.status}`);
      const bytes=await response.arrayBuffer();if(bytes.byteLength!==record.bytes)throw new Error('Surface size mismatch');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==record.sha256)throw new Error('Surface integrity mismatch');
      const image=await createImageBitmap(new Blob([bytes],{type:record.file.endsWith('.png')?'image/png':'image/jpeg'}),{imageOrientation:'flipY',colorSpaceConversion:'none'});if(this.disposed){image.close();return;}if(image.width!==record.width||image.height!==record.height){image.close();throw new Error('Unexpected surface dimensions');}
      const texture=record.channel==='color'?this.maps.get(record.surface as Surface)!:this.pbr.get(`${record.surface}:${record.channel}`)!;
      // A texture already on the GPU has immutable storage at its old size, so a larger image must
      // reallocate it: without dispose() the upload fails (GL "offset overflows") and the old map stays.
      texture.dispose();texture.image=image;texture.colorSpace=record.channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
    }));
  }
  dispose(){this.disposed=true;this.abort.abort();for(const texture of [...this.maps.values(),...this.pbr.values()]){texture.dispose();const image=texture.image as {close?:()=>void};image?.close?.();}this.materials.forEach(m=>m.dispose());}
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
