import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createHuman} from '../src/game/World/npc/NPCFactory';
describe('original skinned humans',()=>{
 it('binds weighted skin to an articulated skeleton with outward cloth normals',()=>{const human=createHuman('guide','#778877');expect(human.mesh).toBeInstanceOf(THREE.SkinnedMesh);expect(human.bones).toHaveLength(16);const g=human.mesh.geometry,p=g.attributes.position,n=g.attributes.normal,w=g.attributes.skinWeight;for(let i=0;i<w.count;i++)expect(w.getX(i)+w.getY(i)).toBeCloseTo(1);expect(Array.from(n.array).every(Number.isFinite)).toBe(true);expect(p.count).toBeGreaterThan(1500);human.animate(2,true);expect(Math.abs(human.bones[4].rotation.x)).toBeGreaterThan(.05);human.animate(2,false,true);expect(human.bones[4].rotation.x).toBeCloseTo(-Math.PI/2);expect(human.bones[5].rotation.x).toBeCloseTo(Math.PI/2);});
});
