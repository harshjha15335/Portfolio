import * as THREE from 'three';
import { DRIVE_PROFILE, VEHICLE_BODY, TrafficSpace, drive, exitBlocked, type Driver, type Hold, type JunctionReservations } from './TrafficSafety';
/**
 * One signal cycle for every zebra in the city (32 s). People may step off the kerb only early in the walk phase, and
 * traffic is held from just before it until the slowest of them (8 m of carriageway at about 1 m/s) is across, so
 * nobody is still on the road when the cars move off.
 */
export const SIGNAL_CYCLE=32,WALK_FROM=20,WALK_UNTIL=22.5,HOLD_UNTIL=31.5;
/** Traffic is held from this phase: 3 s of clearance before the walk signal, so a vehicle already past its line is across first. */
export const HOLD_FROM=WALK_FROM-3;
const phase=(time:number)=>((time%SIGNAL_CYCLE)+SIGNAL_CYCLE)%SIGNAL_CYCLE;
/** People waiting at the kerb may start to cross. */
export const pedestrianGreen=(time:number)=>phase(time)>=WALK_FROM&&phase(time)<WALK_UNTIL;
/** Vehicles stop at the line: the walk phase plus its clearance either side. */
export const crossingHeld=(time:number)=>phase(time)>=HOLD_FROM&&phase(time)<HOLD_UNTIL;
/**
 * Whether people at the kerb should wait although the walk signal is on: a vehicle is on the zebra (centred on
 * local `zebraZ`, its stop lines `line` m either side), or is moving towards it too close to stop at its line
 * and will drive through. Stopped vehicles at the line do not count.
 */
export function zebraBusy(vehicles:Iterable<{x:number;z:number;yaw:number;speed:number;halfLength:number;category?:string}>,zebraZ:number,line=2.8){
 for(const v of vehicles){
  if(v.category&&v.category!=='vehicle'&&v.category!=='ride')continue;if(Math.abs(v.x)>4)continue;
  const front=Math.abs(v.z-zebraZ)-v.halfLength,toward=(v.z-zebraZ)*Math.cos(v.yaw)>0;
  if(front<1.8||(toward&&v.speed>.3&&front<line+v.speed*v.speed/10+.3))return true;
 }
 return false;
}
/** The Fort Road loop: up the east lane, round at the cross street, down the west lane and round in the forecourt. */
export const FORT_LOOP:Array<[number,number,number]>=[[1.75,0,12],[1.75,0,-8],[1.75,0,-30],[1.75,0,-51],[0,0,-54],[-1.75,0,-51],[-1.75,0,-30],[-1.75,0,-8],[-1.75,0,12],[0,0,14]];
/** The movement id every vehicle on the Fort Road loop shares (they follow one another through its turns). */
export const FORT_LOOP_MOVEMENT='fort-loop';
/** Fort Road's stop lines: the northbound (east) lane stops at z −8.8, the southbound (west) one at −15.2, either side of the zebra. */
export const FORT_STOP={north:-8.8,south:-15.2};
/** Another vehicle on the same loop: its distance along it and its length. */
export interface LoopVehicle{s:number;length:number}
/** Cruising speed (m/s) of the street's taxis and autos round the loop. */
const LOOP_SPEED=3.1;
export class RoadTraffic {
 readonly curve=new THREE.CatmullRomCurve3(FORT_LOOP.map(p=>new THREE.Vector3(...p)),true,'centripetal');
 /** Taxi or auto length (m) by agent: agents 1 and 4 are autos. */
 static lengthOf=(i:number)=>i===1||i===4?2.7:4.1;
 static kindOf=(i:number)=>i===1||i===4?'auto' as const:'taxi' as const;
 readonly length=this.curve.getLength();readonly agents:Array<{distance:number;speed:number}>;
 /** The collision-safe drivers behind the agents (same order). */
 readonly drivers:Driver[];
 /** Only the first `active` agents move and count for spacing; the rest wait for a denser preset. */
 active:number;
 /**
  * Whether each agent is on the road. When a denser preset turns extras on, each joins only once its place on
  * the loop is clear (no vehicle on it or on the road just ahead), so a switch never stacks two vehicles.
  */
 readonly live:boolean[];
 private local=new TrafficSpace();
 constructor(count=3,extra=0){
  // Base agents keep their even spacing; extras sit between them, so switching density never stacks cars.
  this.agents=Array.from({length:count},(_,i)=>({distance:i*this.length/count,speed:0}));
  for(let i=0;i<extra;i++){const gap=i%count,slot=Math.floor(i/count)+1,slots=Math.ceil(extra/count)+1;this.agents.push({distance:(gap+slot/slots)*this.length/count,speed:0});}
  this.active=count;this.live=this.agents.map((_,i)=>i<count);
  this.drivers=this.agents.map((a,i)=>{const kind=RoadTraffic.kindOf(i),p=this.pose(i);return {env:{id:`fort-loop:${i}`,x:p.x,z:p.z,yaw:p.heading,halfLength:VEHICLE_BODY[kind].length/2,halfWidth:VEHICLE_BODY[kind].width/2,category:'vehicle',speed:0,movement:FORT_LOOP_MOVEMENT},speed:0,profile:DRIVE_PROFILE[kind],desired:LOOP_SPEED,state:'cruising',priority:1,blockedBy:null,interventions:0};});
 }
 private at(distance:number){const t=(((distance%this.length)+this.length)%this.length)/this.length,p=this.curve.getPointAt(t),d=this.curve.getTangentAt(t);return {x:p.x,z:p.z,yaw:Math.atan2(-d.x,-d.z)};}
 pose(i:number){const p=this.at(this.agents[i].distance);return {x:p.x,z:p.z,heading:p.yaw};}
 /** Put the active vehicles into a shared traffic space (so other systems see them before this one moves). */
 publish(space:TrafficSpace){
  this.drivers.forEach((d,i)=>{if(i>=this.active)this.live[i]=false;if(!this.live[i]){space.remove(d.env.id);return;}const p=this.at(this.agents[i].distance);d.env.x=p.x;d.env.z=p.z;d.env.yaw=p.yaw;d.speed=this.agents[i].speed;d.env.speed=d.speed;if(space.drivers.get(d.env.id)!==d)space.addDriver(d);});
 }
 /**
  * Advance the loop. `obstacles` are people on the road (the visitor first) and `loop` the other system's vehicles
  * on the same loop; both are used when no shared `space` is given. With a space, everything in it is respected.
  */
 step(delta:number,time:number,obstacles?:{x:number;z:number}|Array<{x:number;z:number}>,loop:LoopVehicle[]=[],space?:TrafficSpace,junctions?:{reservations:JunctionReservations;time:number}){
  delta=THREE.MathUtils.clamp(delta,0,.1);
  if(!space){
   space=this.local;space.clear();
   (Array.isArray(obstacles)?obstacles:obstacles?[obstacles]:[]).forEach((o,k)=>space!.add({id:`person:${k}`,x:o.x,z:o.z,yaw:0,halfLength:.3,halfWidth:.3,category:'person',speed:0}));
   loop.forEach((b,k)=>{const p=this.at(b.s);space!.add({id:`shared:${k}`,x:p.x,z:p.z,yaw:p.yaw,halfLength:b.length/2,halfWidth:.95,category:'vehicle',speed:0,movement:FORT_LOOP_MOVEMENT});});
  }
  this.publish(space);
  for(let i=0;i<this.active;i++){
   const a=this.agents[i],d=this.drivers[i];
   if(!this.live[i]){
    const p=this.at(a.distance),probe={...d.env,x:p.x,z:p.z,yaw:p.yaw};
    if(space.hit(probe,d.env.id,.5)||space.clearance(probe,s=>this.at(a.distance+s),d.env.halfLength+d.profile.minGap+3).blocker)continue;
    this.live[i]=true;a.speed=0;d.speed=0;d.state='spawning';d.blockedBy=null;junctions?.reservations.forget(d.env.id);space.addDriver(d);Object.assign(d.env,{x:p.x,z:p.z,yaw:p.yaw,speed:0});
   }
   const p=this.at(a.distance),direction=-Math.cos(p.yaw)<0?-1:1,holds:Hold[]=[];
   // Stop with the front at the line while the crossing is held, unless already too close to stop (committed).
   // Otherwise, behind slow traffic, wait there rather than stop on the zebra.
   const poseAt=(s:number)=>this.at(a.distance+s);
   if(Math.abs(-Math.cos(p.yaw))>.7){const line=direction<0?FORT_STOP.north:FORT_STOP.south,toLine=(line-p.z)*direction-d.env.halfLength;if(toLine>-.2&&toLine<14&&toLine>d.speed*d.speed/(2*d.profile.maxBrake)-.05){if(crossingHeld(time))holds.push({distance:toLine,state:'waiting-signal'});else if(exitBlocked(space,d,poseAt,toLine,FORT_STOP.north-FORT_STOP.south))holds.push({distance:toLine,state:'following'});}}
   const moved=drive(space,d,poseAt,delta,holds,undefined,junctions);
   a.distance=(a.distance+moved)%this.length;a.speed=d.speed;
  }
 }
}
