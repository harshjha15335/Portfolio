import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {casterPrefix,restrictInstanceShadows} from '../src/core/ShadowInstances';
import {createHuman} from '../src/game/World/npc/NPCFactory';

describe('pass-specific instance submission',()=>{
 it('retains every main instance and restores count after repeated shadow draws',()=>{
  const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry();
  const sources=[false,true,false,true].map((casts,i)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=casts;m.position.x=i*3;return m;});
  const packed=casterPrefix(sources),batch=new THREE.InstancedMesh(geometry,material,packed.meshes.length);
  packed.meshes.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);});restrictInstanceShadows(batch,packed.count);
  const matrix=new THREE.Matrix4(),positions=[];for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);positions.push(matrix.elements[12]);}expect(positions.sort((a,b)=>a-b)).toEqual([0,3,6,9]);
  for(let n=0;n<3;n++){batch.onBeforeShadow(null!,null!,null!,null!,null!,null!,null!);expect(batch.count).toBe(2);batch.onAfterShadow(null!,null!,null!,null!,null!,null!,null!);expect(batch.count).toBe(4);}
  geometry.dispose();material.dispose();
 });
 it('excludes noncasting batches without hiding them from the main pass',()=>{const m=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),7);restrictInstanceShadows(m,0);expect(m.castShadow).toBe(false);expect(m.visible).toBe(true);expect(m.count).toBe(7);m.geometry.dispose();(m.material as THREE.Material).dispose();});
});

it('the conservative humanoid culling sphere contains animated vertices across both LODs',()=>{
 const human=createHuman('bounded-walking-host','#82725e');let maximumDistanceSquared=0;
 for(const close of [true,false])for(const walking of [true,false])for(let t=0;t<6;t+=.3){
  human.setDetail(close);human.animate(t,walking);human.group.updateMatrixWorld(true);human.mesh.skeleton.update();
  const position=human.mesh.geometry.getAttribute('position'),point=new THREE.Vector3();
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i);human.mesh.applyBoneTransform(i,point);maximumDistanceSquared=Math.max(maximumDistanceSquared,point.distanceToSquared(human.mesh.boundingSphere!.center));}
 }
 expect(maximumDistanceSquared).toBeLessThanOrEqual(human.mesh.boundingSphere!.radius**2);
 human.mesh.userData.lodGeometries.forEach((g:THREE.BufferGeometry)=>g.dispose());(human.mesh.material as THREE.Material).dispose();human.mesh.skeleton.dispose();
});
