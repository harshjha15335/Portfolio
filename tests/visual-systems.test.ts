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
  it('budgets ambient vehicle geometry while preserving the boarded vehicle silhouette',()=>{
    const triangles=(model:THREE.Group)=>{let count=0;model.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)count+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*((mesh as THREE.InstancedMesh).isInstancedMesh?(mesh as THREE.InstancedMesh).count:1);});return count;};
    for(const kind of ['taxi','auto'] as const){const street=createTransitModel(kind,'street'),close=createTransitModel(kind,'close');expect(triangles(street)).toBeLessThan(triangles(close)*.65);const a=new THREE.Box3().setFromObject(street),b=new THREE.Box3().setFromObject(close);expect(a.min.distanceTo(b.min)).toBeLessThan(.01);expect(a.max.distanceTo(b.max)).toBeLessThan(.01);}
  });
  it('lowers quality only after sustained slow frames and bounds resolution',()=>{
    const quality=new AdaptiveQuality(false);for(let i=0;i<60;i++)quality.sample(1/60);expect(quality.scale).toBe(1);
    for(let i=0;i<900;i++)quality.sample(.1);expect(quality.low).toBe(true);expect(quality.scale).toBeCloseTo(.6);
    const before=quality.scale;expect(quality.sample(60)).toBe(false);expect(quality.sample(NaN)).toBe(false);expect(quality.scale).toBe(before);
    for(let i=0;i<3000;i++)quality.sample(1/65);expect(quality.scale).toBeGreaterThan(.8);expect(quality.scale).toBeLessThanOrEqual(1);
    // The low tier never flips back on its own: that switch recompiles shaders mid-walk.
    expect(quality.low).toBe(true);
  });
  it('keeps the cab and auto drivers\' hands on the wheel and handlebar as they turn',()=>{
    for(const kind of ['taxi','auto'] as const)for(const detail of ['street','close'] as const){
      const model=createTransitModel(kind,detail),driver=model.userData.driver as THREE.Mesh,turns=detail==='close'?[-.35,0,.35]:[0];
      expect((driver.userData.poses as THREE.BufferGeometry[]).length).toBe(detail==='close'?5:1);
      for(const turn of turns){
        animateTransit(model,0,turn);model.updateMatrixWorld(true);
        // The controls: the boarded cabin's turning group, or the parts folded into the street body around them.
        const controls:THREE.Vector3[]=[],steering=model.userData.steering as THREE.Group;
        const centre=kind==='taxi'?new THREE.Vector3(.34,1.07,-.53):new THREE.Vector3(0,1.06,-.75);
        if(detail==='close')steering.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)controls.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld));}});
        else for(let i=0;i<64;i++){const a=i/64*Math.PI*2;controls.push(kind==='taxi'?new THREE.Vector3(Math.cos(a)*.195,Math.sin(a)*.195,0).applyAxisAngle(new THREE.Vector3(1,0,0),-.36).add(centre):new THREE.Vector3((i/63-.5)*.6,0,0).add(centre));}
        const p=driver.geometry.attributes.position,hands=[Infinity,Infinity],v=new THREE.Vector3();
        for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(driver.matrixWorld);if(v.y<.85)continue;const side=v.x<centre.x?0:1;for(const c of controls)hands[side]=Math.min(hands[side],v.distanceTo(c));}
        expect(hands[0],`${kind} ${detail} ${turn} left`).toBeLessThan(.03);expect(hands[1],`${kind} ${detail} ${turn} right`).toBeLessThan(.03);
      }
    }
  });
});
