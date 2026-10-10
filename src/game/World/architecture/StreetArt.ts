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
