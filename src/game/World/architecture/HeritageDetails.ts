import * as THREE from 'three';
/** Original pointed stone surround; the opening is empty, not a dark painted arch. */
export function pointedArchGeometry(){
 const s=new THREE.Shape();const outline=(width:number,spring:number,peak:number)=>[[-width,0],[-width,spring],[-width*.75,spring+(peak-spring)*.44],[0,peak],[width*.75,spring+(peak-spring)*.44],[width,spring],[width,0]];
 const outer=outline(.86,.78,1.74),inner=outline(.67,.78,1.48);s.moveTo(...outer[0] as [number,number]);for(const p of outer.slice(1))s.lineTo(...p as [number,number]);for(const p of inner.reverse())s.lineTo(...p as [number,number]);s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.20,bevelEnabled:false});
}
/** Ribbed drum-to-dome profile, shared by the station centre and cupolas. */
export function heritageDomeGeometry(){return new THREE.LatheGeometry([[.86,0],[.95,.08],[.95,.18],[.94,.35],[.84,.61],[.64,.88],[.36,1.06],[.06,1.18],[0,1.2]].map(([x,y])=>new THREE.Vector2(x,y)),20);}
