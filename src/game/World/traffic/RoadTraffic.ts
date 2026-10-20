import * as THREE from 'three';
/**
 * One signal cycle for every zebra in the city (32 s). People may step off the kerb only early in the walk phase, and
 * traffic is held from just before it until the slowest of them (8 m of carriageway at about 1 m/s) is across, so
 * nobody is still on the road when the cars move off.
 */
export const SIGNAL_CYCLE=32,WALK_FROM=20,WALK_UNTIL=22.5,HOLD_UNTIL=31.5;
const phase=(time:number)=>((time%SIGNAL_CYCLE)+SIGNAL_CYCLE)%SIGNAL_CYCLE;
/** People waiting at the kerb may start to cross. */
export const pedestrianGreen=(time:number)=>phase(time)>=WALK_FROM&&phase(time)<WALK_UNTIL;
/** Vehicles stop at the line: the walk phase plus its clearance. */
export const crossingHeld=(time:number)=>phase(time)>=WALK_FROM-.5&&phase(time)<HOLD_UNTIL;
/** The Fort Road loop: up the east lane, round at the cross street, down the west lane and round in the forecourt. */
export const FORT_LOOP:Array<[number,number,number]>=[[1.75,0,12],[1.75,0,-8],[1.75,0,-30],[1.75,0,-51],[0,0,-54],[-1.75,0,-51],[-1.75,0,-30],[-1.75,0,-8],[-1.75,0,12],[0,0,14]];
/** Another vehicle on the same loop: its distance along it and its length. */
export interface LoopVehicle{s:number;length:number}
export class RoadTraffic {
 readonly curve=new THREE.CatmullRomCurve3(FORT_LOOP.map(p=>new THREE.Vector3(...p)),true,'centripetal');
 /** Taxi or auto length (m) by agent: agents 1 and 4 are autos. */
 static lengthOf=(i:number)=>i===1||i===4?2.7:4.1;
 readonly length=this.curve.getLength();readonly agents:Array<{distance:number;speed:number}>;
 /** Only the first `active` agents move and count for spacing; the rest wait for a denser preset. */
 active:number;
 constructor(count=3,extra=0){
  // Base agents keep their even spacing; extras sit between them, so switching density never stacks cars.
  this.agents=Array.from({length:count},(_,i)=>({distance:i*this.length/count,speed:0}));
  for(let i=0;i<extra;i++){const gap=i%count,slot=Math.floor(i/count)+1,slots=Math.ceil(extra/count)+1;this.agents.push({distance:(gap+slot/slots)*this.length/count,speed:0});}
  this.active=count;
 }
 pose(i:number){const a=this.agents[i],t=(a.distance%this.length)/this.length,p=this.curve.getPointAt(t),d=this.curve.getTangentAt(t);return {x:p.x,z:p.z,heading:Math.atan2(-d.x,-d.z)};}
 step(delta:number,time:number,obstacles?:{x:number;z:number}|Array<{x:number;z:number}>,loop:LoopVehicle[]=[]){
  delta=THREE.MathUtils.clamp(delta,0,.1);const moving=this.agents.slice(0,this.active),positions=moving.map((_,i)=>this.pose(i));
  moving.forEach((a,i)=>{const p=positions[i],direction=p.x>0?-1:1;let target=3.1;
   const ahead=moving.map((b,j)=>j===i?Infinity:(b.distance-a.distance+this.length)%this.length).reduce((a,b)=>Math.min(a,b),Infinity);target=Math.min(target,Math.max(0,(ahead-6)*.8));
   // Other traffic sharing the loop (Fort Road's private cars): bumper-to-bumper gap, so nothing drives into a longer vehicle.
   for(const b of loop){const centre=((b.s-a.distance)%this.length+this.length)%this.length;if(centre<this.length/2)target=Math.min(target,Math.max(0,(centre-(RoadTraffic.lengthOf(i)+b.length)/2-2.2)*.8));}
   const stop=direction<0?-8.8:-15.2,approach=(stop-p.z)*direction;
   if(crossingHeld(time)&&approach>=-.2&&approach<10)target=Math.min(target,Math.max(0,approach*.8));
   for(const obstacle of Array.isArray(obstacles)?obstacles:obstacles?[obstacles]:[])if(Math.abs(p.x-obstacle.x)<1.5){const gap=(obstacle.z-p.z)*direction;if(gap>0&&gap<10)target=Math.min(target,Math.max(0,(gap-3)*.8));}
   const rate=target<a.speed?5:1.2;a.speed+=THREE.MathUtils.clamp(target-a.speed,-rate*delta,rate*delta);a.distance=(a.distance+a.speed*delta)%this.length;
  });
 }
}
