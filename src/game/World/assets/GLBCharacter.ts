import * as THREE from 'three';
import type {AssetLease} from './GLBAssetLibrary';
export interface CharacterOptions {
 /** Standing height in metres; the authored bind pose is scaled to it. */
 height?:number;
 /** 0–1 offset into every clip so a crowd sharing one asset does not move in lockstep. */
 phase?:number;
 /** Playback rate multiplier for small gait/idle variety. */
 rate?:number;
}
/** An actual rig with both clips is required; this never fabricates an idle/walk substitute. */
export class GLBCharacter {
 readonly root=new THREE.Group();private mixers:THREE.AnimationMixer[]=[];private idle:THREE.AnimationAction[]=[];private walk:THREE.AnimationAction[]=[];private moving=false;
 private extra=new Map<string,THREE.AnimationAction[]>();private posed:string|null=null;
 /** Primary skinned meshes and their reduced-detail geometry, when the asset carries an in-file `_LOD1` mesh. */
 private details:Array<{mesh:THREE.SkinnedMesh;close:THREE.BufferGeometry;far:THREE.BufferGeometry}>=[];private close=true;
 readonly meshes:THREE.SkinnedMesh[]=[];
 /** Ground speed implied by the walk clip's planted foot (m/s), used to match playback to real movement. */
 readonly walkSpeed:number;
 constructor(private lease:AssetLease,options:CharacterOptions={}){
  let skinned=false;lease.root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skinned=true;});
  const idle=lease.animations.find(a=>/idle/i.test(a.name)),walk=lease.animations.find(a=>/walk/i.test(a.name));
  if(!skinned||!idle||!walk){lease.release();throw new Error('Pedestrian requires a rig and named idle/walk clips');}
  // An in-file LOD shares the rig, so it swaps geometry on one skeleton instead of adding a second mixer and bone texture.
  const skins:THREE.SkinnedMesh[]=[];lease.root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skins.push(o as THREE.SkinnedMesh);});
  // A multi-material node loads as a group of primitives, so match LOD parts to close parts by node name and material.
  const owner=(mesh:THREE.Object3D)=>mesh.parent&&mesh.parent!==lease.root&&mesh.parent.type==='Group'?mesh.parent.name:mesh.name;
  for(const far of skins.filter(s=>/_LOD1$/.test(owner(s)))){const base=owner(far).replace(/_LOD1$/,''),close=skins.find(s=>s!==far&&owner(s)===base&&s.material===far.material);if(close)this.details.push({mesh:close,close:close.geometry,far:far.geometry});}
  for(const far of skins.filter(s=>/_LOD1$/.test(owner(s)))){const parent=far.parent;far.removeFromParent();if(parent&&parent!==lease.root&&/_LOD1$/.test(parent.name)&&!parent.children.length)parent.removeFromParent();}
  lease.root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)this.meshes.push(o as THREE.SkinnedMesh);});
  // People take the street's fog and light but none of its procedural grime.
  for(const mesh of this.meshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.userData.weather??=0;
  // Skinned bounds read bone world matrices, which a fresh clone has not computed yet.
  lease.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(lease.root);
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.1){lease.release();throw new Error('Invalid character bounds');}
  const scale=(options.height??1.72)/size.y;lease.root.scale.multiplyScalar(scale);lease.root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);if(lease.root instanceof THREE.LOD)lease.root.levels.forEach(level=>{level.distance/=scale;});this.root.add(lease.root);
  // Skinned bounds follow the animated pose rather than the T-pose, so culling stays safe while arms swing.
  for(const mesh of this.meshes){mesh.frustumCulled=true;mesh.computeBoundingSphere();mesh.boundingSphere!.radius*=1.3;}
  this.walkSpeed=measureGroundSpeed(lease.root,walk);
  const levels=lease.root instanceof THREE.LOD?lease.root.levels.map(l=>l.object):[lease.root];
  const phase=options.phase??0,rate=options.rate??1;
  for(const level of levels){const mixer=new THREE.AnimationMixer(level);mixer.timeScale=rate;this.mixers.push(mixer);const a=mixer.clipAction(idle).play(),b=mixer.clipAction(walk).play();a.time=phase*idle.duration;b.time=phase*walk.duration;a.setEffectiveWeight(1);b.setEffectiveWeight(0);this.idle.push(a);this.walk.push(b);
   for(const clip of lease.animations)if(clip!==idle&&clip!==walk){const action=mixer.clipAction(clip);action.time=phase*clip.duration;const list=this.extra.get(clip.name)??[];list.push(action);this.extra.set(clip.name,list);}}
 }
 get clips(){return [...this.extra.keys()];}
 /** Replace the idle layer with a named authored clip (Talk, Sit…), or return to Idle with null. */
 pose(name:string|null,fade=.35){
  if(name===this.posed||(name&&!this.extra.has(name)))return;const previous=this.posed?this.extra.get(this.posed)!:this.idle,next=name?this.extra.get(name)!:this.idle;this.posed=name;
  if(this.moving)return;previous.forEach(a=>a.fadeOut(fade));next.forEach(a=>a.reset().setEffectiveWeight(1).fadeIn(fade).play());
 }
 setDetail(close:boolean){if(close===this.close)return;this.close=close;for(const d of this.details)d.mesh.geometry=close?d.close:d.far;}
 get detailLevels(){return this.details.length?2:1;}
 bone(name:string){let found:THREE.Bone|undefined;this.root.traverse(o=>{if(!found&&(o as THREE.Bone).isBone&&o.name===name)found=o as THREE.Bone;});return found;}
 /** Lift or lower the current (seated) pose so the pelvis rests `clearance` above a seat at `height`, in the root's parent space. */
 seat(height:number,clearance=.1){const pelvis=this.bone('Bip01_Pelvis');if(!pelvis)return;this.root.updateMatrixWorld(true);const y=pelvis.getWorldPosition(new THREE.Vector3()).y-(this.root.parent?this.root.parent.getWorldPosition(new THREE.Vector3()).y:0);this.root.position.y+=height+clearance-y;this.root.updateMatrixWorld(true);}
 update(delta:number,moving:boolean,speed?:number){if(speed!==undefined&&moving&&this.walkSpeed>0){const scale=THREE.MathUtils.clamp(speed/this.walkSpeed,.55,1.6);this.walk.forEach(a=>{a.timeScale=scale;});}const rest=this.posed?this.extra.get(this.posed)!:this.idle;if(moving!==this.moving){this.moving=moving;rest.forEach(a=>moving?a.fadeOut(.3):a.reset().setEffectiveWeight(1).fadeIn(.3).play());this.walk.forEach(a=>moving?a.reset().setEffectiveWeight(1).fadeIn(.3).play():a.fadeOut(.3));}this.mixers.forEach(m=>m.update(delta));}
 dispose(){this.mixers.forEach(m=>{m.stopAllAction();m.uncacheRoot(m.getRoot());});for(const d of this.details)d.mesh.geometry=d.close;this.lease.release();this.root.removeFromParent();}
}

/** Average backward speed of the lower foot while it is planted: what the body must travel for the foot not to slide. */
function measureGroundSpeed(root:THREE.Object3D,walk:THREE.AnimationClip){
 let foot:THREE.Object3D|undefined;root.traverse(o=>{if(!foot&&/L_Foot$/.test(o.name))foot=o;});if(!foot)return 0;
 const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(walk).play(),samples:THREE.Vector3[]=[],steps=48;
 for(let i=0;i<=steps;i++){mixer.setTime(walk.duration*i/steps);root.updateMatrixWorld(true);samples.push(root.worldToLocal(foot.getWorldPosition(new THREE.Vector3())).multiply(root.scale));}
 action.stop();mixer.uncacheRoot(root);
 const low=Math.min(...samples.map(p=>p.y));let distance=0,time=0;
 for(let i=1;i<samples.length;i++)if(samples[i].y<low+.025&&samples[i-1].y<low+.025){distance+=Math.abs(samples[i].z-samples[i-1].z);time+=walk.duration/steps;}
 return time>0?distance/time:0;
}
