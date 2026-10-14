import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {characterCast} from '../src/data/characterCast';
import {STANDING_CAST,WALKER_CAST,loadable,placementNoise} from '../src/game/World/npc/cast';
import {solveTwoBone} from '../src/game/World/npc/DriverRig';
import {inspectCharacter} from '../scripts/lib/inspect-character.mjs';

describe('licensed street cast',()=>{
 it('ships every admitted character with matching bytes, MIT provenance and rig limits',()=>{
  const ids=Object.keys(characterCast);expect(ids.length).toBeGreaterThanOrEqual(8);
  for(const id of ids){const member=characterCast[id];
   expect(member.asset.license).toBe('MIT');expect(member.asset.source).toMatch(/^https:\/\/github\.com\/microsoft\/Microsoft-Rocketbox\/tree\/[0-9a-f]{40}\//);
   expect(member.asset.url).toMatch(/^\/models\/characters\/[a-z-]+-[0-9a-f]{16}\.glb$/);
   const bytes=readFileSync(`public${member.asset.url}`);expect(createHash('sha256').update(bytes).digest('hex')).toBe(member.asset.sha256);
   const inspection=inspectCharacter(bytes);expect(inspection.triangles).toBeLessThanOrEqual(12000);expect(inspection.lodTriangles).toBeLessThanOrEqual(inspection.triangles*.5);expect(inspection.primitives).toBe(1);
   expect(inspection.joints.every((j:number)=>j>=15&&j<=80)).toBe(true);expect(inspection.textures.length).toBeLessThanOrEqual(2);
   expect(member.height).toBeGreaterThan(1.5);expect(member.height).toBeLessThan(1.9);
  }
 });
 it('casts every street placement from an admitted, distinct set of people',()=>{
  for(const id of [...WALKER_CAST,...STANDING_CAST,'host','chai-vendor','taxi-driver','student'])expect(characterCast[id],id).toBeDefined();
  expect(new Set(WALKER_CAST).size).toBe(WALKER_CAST.length);
  expect(new Set(Object.values(characterCast).map(m=>m.asset.source)).size).toBe(Object.keys(characterCast).length);
 });
 it('only loads approved, reviewed members outside preview',()=>{
  const member={...Object.values(characterCast)[0],status:'candidate' as const,visualReview:null};expect(loadable(member,false)).toBe(false);expect(loadable(member,true)).toBe(true);
  expect(loadable({...member,status:'approved',visualReview:{reviewer:'r',date:'d',notes:'n'}},false)).toBe(true);expect(loadable(undefined,true)).toBe(false);
 });
 it('gives placements stable, varied animation phases',()=>{const a=placementNoise('4.9:0:7'),b=placementNoise('-4.9:0:1');expect(a).toBe(placementNoise('4.9:0:7'));expect(a).not.toBe(b);expect(a).toBeGreaterThanOrEqual(0);expect(a).toBeLessThan(1);});
});

describe('driver arm reach',()=>{
 it('places the wrist on a reachable grip and keeps bone lengths',()=>{
  const root=new THREE.Bone(),upper=new THREE.Bone(),fore=new THREE.Bone(),hand=new THREE.Bone();root.add(upper);upper.add(fore);fore.add(hand);
  upper.position.set(0,1.4,0);fore.position.set(0,-.3,.02);hand.position.set(0,-.27,0);const scene=new THREE.Group();scene.add(root);scene.updateMatrixWorld(true);
  const target=new THREE.Vector3(.1,1.15,-.4);solveTwoBone(upper,fore,hand,target);scene.updateMatrixWorld(true);
  const w=hand.getWorldPosition(new THREE.Vector3());expect(w.distanceTo(target)).toBeLessThan(.01);
  expect(upper.getWorldPosition(new THREE.Vector3()).distanceTo(fore.getWorldPosition(new THREE.Vector3()))).toBeCloseTo(Math.hypot(.3,.02),5);
 });
 it('stretches toward an out-of-reach grip without producing NaN rotations',()=>{
  const root=new THREE.Bone(),upper=new THREE.Bone(),fore=new THREE.Bone(),hand=new THREE.Bone();root.add(upper);upper.add(fore);fore.add(hand);fore.position.set(0,-.3,0);hand.position.set(0,-.27,0);root.updateMatrixWorld(true);
  solveTwoBone(upper,fore,hand,new THREE.Vector3(0,0,-3));root.updateMatrixWorld(true);for(const b of [upper,fore])expect([b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w].every(Number.isFinite)).toBe(true);
  expect(hand.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(-.5);
 });
});
