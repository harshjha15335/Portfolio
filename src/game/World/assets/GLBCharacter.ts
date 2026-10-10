import * as THREE from 'three';
import type {AssetLease} from './GLBAssetLibrary';
/** An actual rig with both clips is required; this never fabricates an idle/walk substitute. */
export class GLBCharacter {
 readonly root=new THREE.Group();private mixers:THREE.AnimationMixer[]=[];private idle:THREE.AnimationAction[]=[];private walk:THREE.AnimationAction[]=[];private moving=false;
 constructor(private lease:AssetLease){
  let skinned=false;lease.root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skinned=true;});
  const idle=lease.animations.find(a=>/idle/i.test(a.name)),walk=lease.animations.find(a=>/walk/i.test(a.name));
  if(!skinned||!idle||!walk){lease.release();throw new Error('Pedestrian requires a rig and named idle/walk clips');}
  const bounds=new THREE.Box3().setFromObject(lease.root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.1){lease.release();throw new Error('Invalid character bounds');}
  const scale=1.72/size.y;lease.root.scale.multiplyScalar(scale);lease.root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);if(lease.root instanceof THREE.LOD)lease.root.levels.forEach(level=>{level.distance/=scale;});this.root.add(lease.root);
  const levels=lease.root instanceof THREE.LOD?lease.root.levels.map(l=>l.object):[lease.root];
  for(const level of levels){const mixer=new THREE.AnimationMixer(level);this.mixers.push(mixer);const a=mixer.clipAction(idle).play(),b=mixer.clipAction(walk).play();a.setEffectiveWeight(1);b.setEffectiveWeight(0);this.idle.push(a);this.walk.push(b);}
 }
 update(delta:number,moving:boolean){if(moving!==this.moving){this.moving=moving;this.idle.forEach(a=>moving?a.fadeOut(.25):a.reset().setEffectiveWeight(1).fadeIn(.25).play());this.walk.forEach(a=>moving?a.reset().setEffectiveWeight(1).fadeIn(.25).play():a.fadeOut(.25));}this.mixers.forEach(m=>m.update(delta));}
 dispose(){this.mixers.forEach(m=>{m.stopAllAction();m.uncacheRoot(m.getRoot());});this.lease.release();this.root.removeFromParent();}
}
