import {describe,it,expect} from 'vitest';
import {NavMeshManager,navigationGeometry} from '../src/game/World/navigation/NavMeshManager';
describe('authored Recast navigation',()=>{
 it('excludes roads outside the crossing and obstacle footprints',()=>{const data=navigationGeometry([{minX:4.3,maxX:5.6,minZ:0,maxZ:2}]);expect(data.positions.length).toBeLessThan(150000);for(let i=0;i<data.positions.length;i+=12){const x=data.positions[i]+.15,z=data.positions[i+2]+.15;if(Math.abs(x)<4.2)expect(z).toBeGreaterThan(-13.2);expect(x>4.18&&x<5.72&&z>-.12&&z<2.12).toBe(false);}});
 it('plans sidewalk and crossing paths and cleans up its crowd',async()=>{const nav=await NavMeshManager.create([]);expect(nav.path({x:4.8,y:0,z:8},{x:4.8,y:0,z:-45})?.length).toBeGreaterThan(1);expect(nav.path({x:4.8,y:0,z:-12},{x:-4.8,y:0,z:-12})?.length).toBeGreaterThan(1);expect(nav.path({x:NaN,y:0,z:0},{x:0,y:0,z:0})).toBeNull();const a=nav.add({x:4.8,y:0,z:8});a.requestMoveTarget({x:4.8,y:0,z:-10});for(let i=0;i<90;i++)nav.crowd.update(1/30);expect(a.position().z).toBeLessThan(7);nav.dispose();},20000);
});
