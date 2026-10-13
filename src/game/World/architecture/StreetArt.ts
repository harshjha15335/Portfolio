import * as THREE from 'three';
import {seededRandom} from '../StreetArchitecture';

/** Original draped cloth; woven stripes follow the surface instead of floating boxes. */
export function awningGeometry(style:number) {
 const geometry=new THREE.PlaneGeometry(7.65,1.17,32,6);geometry.rotateX(-Math.PI/2);
 const p=geometry.attributes.position,colors=[];
 const tintA=new THREE.Color(['#ded0ac','#a5b7a2','#c0aba0','#c3bc9b'][style]);
 const tintB=new THREE.Color(['#917955','#5d786e','#7d5547','#687d80'][style]);
 for(let i=0;i<p.count;i++){
  const u=(p.getZ(i)+.585)/1.17;
  p.setY(i,-u*.17-Math.sin(u*Math.PI)*.055+Math.sin(p.getX(i)*13)*.014*u);
  const color=Math.floor((p.getX(i)+3.825)/.48)%2?tintA:tintB;colors.push(color.r,color.g,color.b);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}

/** Small irregular paint/damp outlines. Applied only to solid piers, never across openings. */
export function patinaGeometry(width:number,height:number,seed:string) {
 const random=seededRandom(seed),shape=new THREE.Shape();
 shape.moveTo(-width/2,-height/2);
 for(let i=0;i<=5;i++)shape.lineTo(-width/2+width*i/5,height*(.15+random()*.35));
 shape.lineTo(width/2,-height/2);
 for(let i=5;i>=0;i--)shape.lineTo(-width/2+width*i/5,-height*(.30+random()*.20));
 shape.closePath();return new THREE.ShapeGeometry(shape);
}

/** Rain run-off below sills and parapets: tapered streaks, dark where water leaves the ledge and
 * fading toward the wall colour. Each span is [x, top, length, width] in the façade's plane. */
export function runoffGeometry(spans:Array<[number,number,number,number]>,wall:THREE.Color,stain:THREE.Color){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const top=wall.clone().lerp(stain,.74),tip=wall.clone().lerp(stain,.26);
 for(const [x,y,length,width] of spans){
  const n=positions.length/3,taper=width*.18;
  positions.push(x-width/2,y,0,x+width/2,y,0,x+taper,y-length,0,x-taper,y-length,0);
  for(const c of [top,top,tip,tip])colors.push(c.r,c.g,c.b);
  indices.push(n,n+2,n+1,n,n+3,n+2);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map((_,i)=>i%3===2?1:0),3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);return geometry;
}
