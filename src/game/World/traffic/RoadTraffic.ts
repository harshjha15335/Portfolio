import * as THREE from 'three';
export const pedestrianGreen=(time:number)=>time%32>=20&&time%32<27;
export class RoadTraffic {
 readonly curve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.75,0,12),new THREE.Vector3(1.75,0,-8),new THREE.Vector3(1.75,0,-30),new THREE.Vector3(1.75,0,-51),new THREE.Vector3(0,0,-54),new THREE.Vector3(-1.75,0,-51),new THREE.Vector3(-1.75,0,-30),new THREE.Vector3(-1.75,0,-8),new THREE.Vector3(-1.75,0,12),new THREE.Vector3(0,0,14)],true,'centripetal');
 readonly length=this.curve.getLength();readonly agents:Array<{distance:number;speed:number}>;
 constructor(count=3){this.agents=Array.from({length:count},(_,i)=>({distance:i*this.length/count,speed:0}));}
 pose(i:number){const a=this.agents[i],t=(a.distance%this.length)/this.length,p=this.curve.getPointAt(t),d=this.curve.getTangentAt(t);return {x:p.x,z:p.z,heading:Math.atan2(-d.x,-d.z)};}
 step(delta:number,time:number,obstacles?:{x:number;z:number}|Array<{x:number;z:number}>){
  delta=THREE.MathUtils.clamp(delta,0,.1);const positions=this.agents.map((_,i)=>this.pose(i));
  this.agents.forEach((a,i)=>{const p=positions[i],direction=p.x>0?-1:1;let target=3.1;
   const ahead=this.agents.map((b,j)=>j===i?Infinity:(b.distance-a.distance+this.length)%this.length).reduce((a,b)=>Math.min(a,b),Infinity);target=Math.min(target,Math.max(0,(ahead-6)*.8));
   const stop=direction<0?-8.8:-15.2,approach=(stop-p.z)*direction;
   if(pedestrianGreen(time)&&approach>=-.2&&approach<10)target=Math.min(target,Math.max(0,approach*.8));
   for(const obstacle of Array.isArray(obstacles)?obstacles:obstacles?[obstacles]:[])if(Math.abs(p.x-obstacle.x)<1.5){const gap=(obstacle.z-p.z)*direction;if(gap>0&&gap<10)target=Math.min(target,Math.max(0,(gap-3)*.8));}
   const rate=target<a.speed?5:1.2;a.speed+=THREE.MathUtils.clamp(target-a.speed,-rate*delta,rate*delta);a.distance=(a.distance+a.speed*delta)%this.length;
  });
 }
}
