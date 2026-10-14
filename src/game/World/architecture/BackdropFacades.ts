import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {bakedFinishMaterial} from './BakedKit';

/**
 * Painted façades for the backdrop buildings at the street ends and the skyline.
 *
 * Each face becomes a grid of quads, one per 3 m bay and storey, mapped to a cell of the generated
 * atlas (scripts/generate-facade-atlas.py): rows 0-2 are upper-storey bays, row 3 shopfronts. A building
 * keeps to a small palette of bays so it reads as one design, and its tint rides in vertex colours.
 * All faces share the baked-architecture program ('hero-finish-v1'), so this adds one texture and no programs.
 */
export const FACADE_CELL_METRES=3;
const EDGE=1.5/1024;
/** Upper-storey cells as [column,row]. */
const UPPER:Array<[number,number]>=[[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1],[0,2],[1,2],[2,2],[3,2]];
/** Building palettes (indices into UPPER): grilled windows, balconied chawl, mixed with tarpaulins. */
const PALETTES=[[0,1,3,9],[2,10,0,6],[4,5,1,11],[7,0,8,3],[0,11,2,5]];

export interface FacadeFace{frame:THREE.Matrix4;width:number;height:number;tint:THREE.Color;seed:number;ground?:boolean;coarse?:boolean}

export class FacadeBatch{
  private pieces:THREE.BufferGeometry[]=[];
  quads=0;
  add({frame,width,height,tint,seed,ground=true,coarse=false}:FacadeFace){
    let state=(seed*2654435761)>>>0||1;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
    const palette=PALETTES[Math.floor(random()*PALETTES.length)];
    const storeys=Math.max(1,Math.round(height/FACADE_CELL_METRES)),storey=height/storeys;
    // A coarse face (distant skyline) spans a whole atlas row per quad: four bays at once.
    const span=coarse?4:1,bays=Math.max(1,Math.round(width/(FACADE_CELL_METRES*span))),bay=width/bays;
    const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
    for(let s=0;s<storeys;s++)for(let b=0;b<bays;b++){
      const shop=ground&&s===0;
      const [column,row]=shop?[Math.floor(random()*4),3]:UPPER[palette[Math.floor(random()*palette.length)]];
      const u0=coarse?EDGE:column/4+EDGE,u1=coarse?1-EDGE:(column+1)/4-EDGE,v1=1-row/4-EDGE,v0=1-(row+1)/4+EDGE;
      const x0=-width/2+b*bay,y0=s*storey,n=positions.length/3;
      positions.push(x0,y0,0,x0+bay,y0,0,x0+bay,y0+storey,0,x0,y0+storey,0);uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);
      // Slight per-storey value change, as repainting rarely matches floor to floor.
      const f=1.08*(.95+random()*.1);for(let i=0;i<4;i++)colors.push(tint.r*f,tint.g*f,tint.b*f);
      indices.push(n,n+1,n+2,n,n+2,n+3);this.quads++;
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(positions.length/3).fill([0,0,1]).flat(),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('heroFinish',new THREE.Float32BufferAttribute(new Array(positions.length/3).fill([.93,0]).flat(),2));
    geometry.setIndex(indices);geometry.applyMatrix4(frame);this.pieces.push(geometry);
  }
  /** One mesh for every face added; null when empty. */
  build(atlas:THREE.Texture,name:string){
    if(!this.pieces.length)return null;
    const material=bakedFinishMaterial(.5);material.map=atlas;
    const mesh=new THREE.Mesh(mergeGeometries(this.pieces)!,material);mesh.name=name;mesh.receiveShadow=true;
    this.pieces.forEach(g=>g.dispose());this.pieces=[];return mesh;
  }
}

/** Frame for a face in `root` space: `parent` (a placed group under root) then a face offset and turn. */
export function faceFrame(root:THREE.Object3D,parent:THREE.Object3D,offset:THREE.Vector3,yaw:number){
  root.updateMatrixWorld(true);
  return root.matrixWorld.clone().invert().multiply(parent.matrixWorld).multiply(new THREE.Matrix4().compose(offset,new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0)),new THREE.Vector3(1,1,1)));
}
