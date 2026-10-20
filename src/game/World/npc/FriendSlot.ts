import * as THREE from 'three';
import type {GLBAssetLibrary} from '../assets/GLBAssetLibrary';
import type {GLBCharacter} from '../assets/GLBCharacter';
import {loadable,placementNoise,type CastMember} from './cast';

/**
 * A named person standing in a district (a friend of Harsh's, see src/data/friends.ts). Unlike the crowd, who
 * share the district cast's skeleton, each friend is one GLBCharacter with its own rig: there is at most two
 * per district, and they turn to face the visitor and gesture while being talked to.
 */
interface Source {library:GLBAssetLibrary;cast:Record<string,CastMember>;preview:boolean;loaded?:()=>void}
let source:Source|null=null;const waiting=new Set<FriendSlot>();
/** Called once the licensed cast can load; slots created before then load now. */
export function setFriendSource(next:Source|null){source=next;if(next)for(const slot of waiting)void slot.load();waiting.clear();}

export class FriendSlot {
 readonly group=new THREE.Group();
 actor:GLBCharacter|null=null;
 private disposed=false;private loading=false;private last=-1;private talking=false;
 constructor(readonly castId:string,private readonly rest:number){this.group.rotation.y=rest;this.group.name=`friend:${castId}`;if(source)void this.load();else waiting.add(this);}
 async load(){
  if(this.loading||this.actor||this.disposed||!source)return;this.loading=true;
  const member=source.cast[this.castId];if(!loadable(member,source.preview)){this.loading=false;return;}
  try{
   const [{GLBCharacter},lease]=await Promise.all([import('../assets/GLBCharacter'),source.library.acquire(member.asset)]);
   if(this.disposed){lease.release();return;}
   const actor=new GLBCharacter(lease,{height:member.height,phase:placementNoise(this.castId)});
   // Rocketbox characters face +Z; the group's forward is −Z like the street's figures.
   actor.root.rotation.y=Math.PI;actor.update(0,false);this.group.add(actor.root);this.actor=actor;source?.loaded?.();
  }catch(error){console.warn(`Friend ${this.castId} unavailable`,error);}finally{this.loading=false;}
 }
 /** `view` is the visitor in the slot's parent space. Within a few metres they turn towards it and talk. */
 update(time:number,view:THREE.Vector3){
  const actor=this.actor;if(!actor)return;const delta=this.last<0||time===0?0:Math.min(.1,Math.max(0,time-this.last));this.last=time;
  const dx=view.x-this.group.position.x,dz=view.z-this.group.position.z,d=Math.hypot(dx,dz);actor.root.visible=d<48;if(!actor.root.visible)return;
  actor.setDetail(d<8);
  const near=d<3.4,target=near?Math.atan2(-dx,-dz):this.rest;let turn=target-this.group.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));
  // Under reduced motion (time 0) they face the visitor at once and keep the idle pose, since a cross-fade never advances.
  this.group.rotation.y+=turn*(time===0?1:Math.min(1,delta*3));
  if(time>0&&near!==this.talking&&actor.clips.includes('Talk')){this.talking=near;actor.pose(near?'Talk':null);}
  actor.update(delta,false);
 }
 dispose(){this.disposed=true;waiting.delete(this);this.actor?.dispose();this.actor=null;this.group.removeFromParent();}
}
