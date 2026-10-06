import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {facadeSpec,seededRandom} from '../src/game/World/StreetArchitecture';
import {createTransitModel,animateTransit} from '../src/game/World/TransitModel';
import {AdaptiveQuality} from '../src/core/AdaptiveQuality';

describe('visual rebuild systems',()=>{
  it('keeps city architecture deterministic and genuinely varied',()=>{
    const a=seededRandom('fort'),b=seededRandom('fort'),c=seededRandom('juhu');
    const one=Array.from({length:20},()=>a());expect(one).toEqual(Array.from({length:20},()=>b()));expect(one).not.toEqual(Array.from({length:20},()=>c()));
    const specs=[-1,1].flatMap(side=>Array.from({length:7},(_,i)=>facadeSpec(side,i)));
    expect(new Set(specs.map(s=>s.style)).size).toBe(4);expect(new Set(specs.map(s=>s.height)).size).toBeGreaterThan(4);
    expect(specs.every(s=>s.width>8&&s.width<10&&s.floorHeight>2.4&&s.height<16)).toBe(true);
  });
  it('keeps a taxi and three-wheel auto within road clearance and articulates their wheels',()=>{
    for(const kind of ['taxi','auto'] as const){const model=createTransitModel(kind);const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeLessThan(kind==='taxi'?2.25:1.8);expect(size.y).toBeGreaterThan(1.6);expect(size.y).toBeLessThan(2.1);
      const wheels=model.userData.wheels as THREE.Group[];expect(wheels).toHaveLength(kind==='taxi'?4:3);animateTransit(model,3,.2);
      expect(wheels[0].rotation.x).toBeGreaterThan(8);expect(wheels[0].rotation.y).toBeCloseTo(.2);
      expect((model.userData.wheelBatch as THREE.InstancedMesh).count).toBe(wheels.length);
    }
  });
  it('lowers quality only after sustained slow frames and bounds resolution',()=>{
    const quality=new AdaptiveQuality(false);for(let i=0;i<60;i++)quality.sample(1/60);expect(quality.scale).toBe(1);
    for(let i=0;i<900;i++)quality.sample(.1);expect(quality.low).toBe(true);expect(quality.scale).toBeCloseTo(.6);
    const before=quality.scale;expect(quality.sample(60)).toBe(false);expect(quality.sample(NaN)).toBe(false);expect(quality.scale).toBe(before);
    for(let i=0;i<3000;i++)quality.sample(1/65);expect(quality.scale).toBeGreaterThan(.8);expect(quality.scale).toBeLessThanOrEqual(1);
  });
});
