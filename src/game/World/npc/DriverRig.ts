import * as THREE from 'three';
import type {GLBCharacter} from '../assets/GLBCharacter';

type Kind='taxi'|'auto';
/** Seat cushion tops and hand grips in vehicle space (see TransitModel). Vehicles face -Z. */
const SEATS:Record<Kind,{x:number;y:number;z:number}>={taxi:{x:.34,y:.645,z:-.02},auto:{x:0,y:.645,z:-.2}};
const WHEEL={centre:new THREE.Vector3(.34,1.07,-.53),radius:.195,tilt:-.36};
const BAR={pivot:new THREE.Vector3(0,1.06,-.75),half:.21};
const SIDES=['L','R'] as const;
/** Grip shaping applied after the arm reaches: wrist twist about the forearm (palms toward the rim) and finger curl. */
export const DRIVER_HANDS={twist:{taxi:0,auto:0},bend:{taxi:-.25,auto:-.35},curl:1.0,thumb:.5};

/** Bind-pose rotation of `child` relative to `parent`, from the skeleton's inverse bind matrices. */
function restLocal(actor:GLBCharacter,parent:THREE.Bone,child:THREE.Bone){
 const skeleton=actor.meshes[0].skeleton,index=(b:THREE.Bone)=>skeleton.bones.indexOf(b),pi=index(parent),ci=index(child);if(pi<0||ci<0)return child.quaternion.clone();
 const p=skeleton.boneInverses[pi].clone().invert(),c=skeleton.boneInverses[ci].clone().invert();return new THREE.Quaternion().setFromRotationMatrix(p.invert().multiply(c));
}
/** Rotate a two-bone chain (upper arm, forearm) so the hand bone reaches `target`, bending in its current plane. */
export function solveTwoBone(a:THREE.Bone,b:THREE.Bone,c:THREE.Bone,target:THREE.Vector3){
 const A=a.getWorldPosition(new THREE.Vector3()),B=b.getWorldPosition(new THREE.Vector3()),C=c.getWorldPosition(new THREE.Vector3());
 const lab=A.distanceTo(B),lcb=B.distanceTo(C),lat=THREE.MathUtils.clamp(A.distanceTo(target),.01,lab+lcb-.002);
 const ac=C.clone().sub(A).normalize(),ab=B.clone().sub(A).normalize(),ba=A.clone().sub(B).normalize(),bc=C.clone().sub(B).normalize(),at=target.clone().sub(A).normalize();
 const acos=(x:number)=>Math.acos(THREE.MathUtils.clamp(x,-1,1));
 const acab0=acos(ac.dot(ab)),babc0=acos(ba.dot(bc)),acat0=acos(ac.dot(at));
 const acab1=acos((lcb*lcb-lab*lab-lat*lat)/(-2*lab*lat)),babc1=acos((lat*lat-lab*lab-lcb*lcb)/(-2*lab*lcb));
 const axis0=new THREE.Vector3().crossVectors(ac,ab);if(axis0.lengthSq()<1e-10)axis0.set(1,0,0);axis0.normalize();
 const axis1=new THREE.Vector3().crossVectors(ac,at);const r2=axis1.lengthSq()<1e-10?new THREE.Quaternion():new THREE.Quaternion().setFromAxisAngle(axis1.normalize(),acat0);
 const r0=new THREE.Quaternion().setFromAxisAngle(axis0,acab1-acab0),r1=new THREE.Quaternion().setFromAxisAngle(axis0,babc1-babc0);
 const agr=a.getWorldQuaternion(new THREE.Quaternion()),bgr=b.getWorldQuaternion(new THREE.Quaternion()),parent=a.parent!.getWorldQuaternion(new THREE.Quaternion());
 const wa=r2.clone().multiply(r0).multiply(agr),wb=r2.clone().multiply(r0).multiply(r1).multiply(bgr);
 a.quaternion.copy(parent.invert().multiply(wa));b.quaternion.copy(wa.clone().invert().multiply(wb));a.updateMatrixWorld(true);
}

/** A licensed character seated at a vehicle's controls: hands on the wheel or handlebar grips, steering with the vehicle. */
export class DriverRig {
 private arms:Array<{upper:THREE.Bone;fore:THREE.Bone;hand:THREE.Bone;rest:THREE.Quaternion;fingers:THREE.Bone[];thumbs:THREE.Bone[]}>=[];private baked:THREE.Mesh[]=[];
 constructor(readonly actor:GLBCharacter,readonly vehicle:THREE.Group,readonly kind:Kind,readonly live:boolean){
  const seat=SEATS[kind];actor.pose('Sit',0);actor.update(0,false);
  actor.root.rotation.y=Math.PI;actor.root.position.set(seat.x,0,seat.z);actor.seat(seat.y);
  for(const side of SIDES){const upper=actor.bone(`Bip01_${side}_UpperArm`),fore=actor.bone(`Bip01_${side}_Forearm`),hand=actor.bone(`Bip01_${side}_Hand`);if(upper&&fore&&hand)this.arms.push({upper,fore,hand,rest:restLocal(actor,fore,hand),fingers:[1,2,3,4].flatMap(n=>['',`${n}`,'2'].map(k=>actor.bone(`Bip01_${side}_Finger${n}${k}`))).filter((b):b is THREE.Bone=>Boolean(b)),thumbs:['0','01','02'].map(k=>actor.bone(`Bip01_${side}_Finger${k}`)).filter((b):b is THREE.Bone=>Boolean(b))});}
  vehicle.add(actor.root);vehicle.traverse(o=>{if(o.name===`${kind}:driver`)o.visible=false;});
  this.reach(0);
  if(!live)this.bake();
 }
 /** World-space wrist targets: the 10-and-2 rim points of the wheel, or the handlebar grips, turned by `steering`. */
 private targets(steering:number){
  this.vehicle.updateMatrixWorld(true);const out:THREE.Vector3[]=[];
  for(const [i] of SIDES.entries()){
   // Character's left hand is on the vehicle's -X side once the character is turned to face -Z.
   const s=i===0?-1:1;let p:THREE.Vector3;
   if(this.kind==='taxi'){const angle=s*.55+Math.PI/2*(1-s)-steering*1.4;const local=new THREE.Vector3(Math.cos(angle)*WHEEL.radius,Math.sin(angle)*WHEEL.radius,0).applyAxisAngle(new THREE.Vector3(1,0,0),WHEEL.tilt);p=WHEEL.centre.clone().add(local).add(new THREE.Vector3(0,-.015,.05));}
   else{p=new THREE.Vector3(s*BAR.half,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),-steering*.5).add(BAR.pivot).add(new THREE.Vector3(0,-.01,.07));}
   out.push(p.applyMatrix4(this.vehicle.matrixWorld));
  }
  return out;
 }
 private reach(steering:number){this.actor.root.updateMatrixWorld(true);const t=this.targets(steering);this.arms.forEach((arm,i)=>{solveTwoBone(arm.upper,arm.fore,arm.hand,t[i]);
  // Straight wrist from the bind pose, turned so the palm wraps the rim, then fingers closed around it.
  const side=i===0?-1:1;arm.hand.quaternion.copy(arm.rest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(side*DRIVER_HANDS.twist[this.kind],0,DRIVER_HANDS.bend[this.kind])));
  for(const f of arm.fingers)f.rotation.z+=DRIVER_HANDS.curl;for(const f of arm.thumbs)f.rotation.z+=DRIVER_HANDS.thumb;arm.hand.updateMatrixWorld(true);});}
 update(delta:number,steering:number){this.actor.update(delta,false);this.reach(steering);}
 /** Traffic drivers never come close: freeze the pose into the reduced mesh, so traffic adds no skeleton or bone texture. */
 private bake(){
  this.actor.setDetail(false);this.actor.root.updateMatrixWorld(true);this.vehicle.updateMatrixWorld(true);
  const toVehicle=new THREE.Matrix4().copy(this.vehicle.matrixWorld).invert();
  for(const mesh of this.actor.meshes){
   mesh.skeleton.update();const source=mesh.geometry,geometry=new THREE.BufferGeometry(),p=source.attributes.position,n=source.attributes.normal,w=source.attributes.skinWeight,j=source.attributes.skinIndex;
   const positions=new Float32Array(p.count*3),normals=new Float32Array(p.count*3),matrix=new THREE.Matrix4().multiplyMatrices(toVehicle,mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
   const bones=mesh.skeleton.bones.map((b,i)=>new THREE.Matrix4().multiplyMatrices(b.matrixWorld,mesh.skeleton.boneInverses[i])),bind=mesh.bindMatrix,bindInverse=mesh.bindMatrixInverse;
   const v=new THREE.Vector3(),nv=new THREE.Vector3(),skin=new THREE.Matrix4();
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(matrix);positions.set([v.x,v.y,v.z],i*3);
    skin.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);for(let k=0;k<4;k++){const weight=w.getComponent(i,k);if(weight)skin.elements.forEach((_,e)=>{skin.elements[e]+=bones[j.getComponent(i,k)].elements[e]*weight;});}
    skin.premultiply(bindInverse).multiply(bind);nv.fromBufferAttribute(n,i).transformDirection(skin).applyMatrix3(normalMatrix).normalize();normals.set([nv.x,nv.y,nv.z],i*3);
   }
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
   for(const name of ['uv'])if(source.attributes[name])geometry.setAttribute(name,source.attributes[name]);
   geometry.setIndex(source.index);for(const g of source.groups)geometry.addGroup(g.start,g.count,g.materialIndex);geometry.computeBoundingSphere();
   const baked=new THREE.Mesh(geometry,mesh.material);baked.name=`${this.kind}:licensed-driver`;baked.castShadow=true;baked.receiveShadow=true;this.vehicle.add(baked);this.baked.push(baked);
  }
  this.actor.dispose();
 }
 dispose(){if(this.baked.length){this.baked.forEach(m=>{m.removeFromParent();m.geometry.dispose();});this.baked=[];}else this.actor.dispose();this.vehicle.traverse(o=>{if(o.name===`${this.kind}:driver`)o.visible=true;});}
}
