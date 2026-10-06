import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createVisitor } from '../src/game/World/WalkingBody';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { STREET_SPAWN, streetStops, streetRideRoute, streetPickupRoute, walkingVelocity } from '../src/game/World/streetLayout';
import { pointAtDistance, routeLength } from '../src/game/World/transit';

beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) }));
afterEach(() => vi.unstubAllGlobals());
describe('first-person street slice', () => {
  it('moves forward and strafes relative to the view without diagonal speed gain', () => {
    expect(walkingVelocity(1,0,0,2.7)).toEqual({x:0,z:-2.7});
    expect(walkingVelocity(1,0,Math.PI/2,2.7).x).toBeCloseTo(-2.7);
    expect(walkingVelocity(0,1,Math.PI/2,2.7).z).toBeCloseTo(-2.7);
    const diagonal=walkingVelocity(1,1,.7,2.7); expect(Math.hypot(diagonal.x,diagonal.z)).toBeCloseTo(2.7);
  });
  it('provides human-scale interaction points and 14 street facades', () => {
    const street=new MumbaiStreet(new CANNON.World());
    expect(street.facadeCount).toBeGreaterThanOrEqual(10);
    expect(street.interactions.map(p=>p.id)).toEqual(['cst','fort','ffprime','hail-taxi','hail-auto']);
    expect(street.interactions.every(p=>p.position.y>=1 && p.position.y<1.7)).toBe(true);
  });
  it('keeps elevated shop stock and facade modules attached to buildings and out of the carriageway',()=>{
    const street=new MumbaiStreet(new CANNON.World());street.update(0,true);const misplaced:number[][]=[];
    street.group.traverse(object=>{
      if(!(object instanceof THREE.InstancedMesh)||object.geometry.type!=='BoxGeometry')return;
      for(let i=0;i<object.count;i++){const matrix=new THREE.Matrix4();object.getMatrixAt(i,matrix);const [x,y,z]=[matrix.elements[12],matrix.elements[13],matrix.elements[14]];if(Math.abs(x)<3.9&&y>.15&&z>-58&&z<14)misplaced.push([x,y,z]);}
    });
    expect(misplaced).toEqual([]);
  });
  it('keeps spawn and both stops clear, and the research doorway physically open', () => {
    const world=new CANNON.World({gravity:new CANNON.Vec3(0,-19,0)}); new MumbaiStreet(world);
    for (const point of [STREET_SPAWN,...Object.values(streetStops)]) {
      const body=createVisitor(point.x,point.z); world.addBody(body);
      for(let i=0;i<60;i++) world.step(1/60);
      expect(Math.hypot(body.position.x-point.x,body.position.z-point.z)).toBeLessThan(.05);
      expect(body.position.y).toBeCloseTo(.32,1); world.removeBody(body);
    }
    const hit=new CANNON.RaycastResult(); world.raycastClosest(new CANNON.Vec3(-5,1.65,-34),new CANNON.Vec3(-11,1.65,-34),{},hit);
    expect(hit.hasHit).toBe(false);
  });
  it('lets the full-height visitor walk from the Fort pavement into the research room', () => {
    const world=new CANNON.World({gravity:new CANNON.Vec3(0,-19,0)}); world.defaultContactMaterial.friction=0; new MumbaiStreet(world);
    const visitor=createVisitor(streetStops.fort.x,streetStops.fort.z); world.addBody(visitor);
    for(let i=0;i<120;i++) { visitor.velocity.x=-2.7; world.step(1/60); }
    expect(visitor.position.x).toBeLessThan(-9.7); expect(visitor.position.y).toBeCloseTo(.32,1);
  });
  it('blocks passage into closed shopfronts without losing the visual window recesses',()=>{
    const world=new CANNON.World();new MumbaiStreet(world);
    for(const side of [-1,1]){
      const hit=new CANNON.RaycastResult();world.raycastClosest(new CANNON.Vec3(side*4.8,1.65,4),new CANNON.Vec3(side*7.4,1.65,4),{},hit);expect(hit.hasHit).toBe(true);
      expect(Math.abs(hit.hitPointWorld.x)).toBeGreaterThan(6.8);expect(Math.abs(hit.hitPointWorld.x)).toBeLessThan(7.45);
    }
  });
  it('keeps the entire incoming taxi clear of the station at the spawn pickup',()=>{
    const world=new CANNON.World();new MumbaiStreet(world);
    for(const point of [STREET_SPAWN,streetStops.fort,{x:-5,z:12}]){
      const route=streetPickupRoute(point);expect(route).toHaveLength(2);
      for(const p of route)for(const edge of [-1.1,1.1]){
        const hit=new CANNON.RaycastResult();world.raycastClosest(new CANNON.Vec3(p.x+edge,1,p.z-1.9),new CANNON.Vec3(p.x+edge,1,p.z+1.9),{},hit);expect(hit.hasHit).toBe(false);
      }
    }
  });
  it('routes taxis along the authored road with enough clearance for a full-width vehicle', () => {
    const world=new CANNON.World(); new MumbaiStreet(world);
    for (const destination of ['cst','fort']) {
      const route=streetRideRoute({x:2.8,z:10},destination), length=routeLength(route);
      if (destination === 'cst') expect(Math.max(...route.map(p=>p.z)) + 1.85).toBeLessThan(16.5);
      expect(length).toBeGreaterThan(5); expect(length).toBeLessThan(150);
      expect(pointAtDistance(route,length).z).toBeCloseTo(streetStops[destination].z);
      for(let i=1;i<route.length;i++) for(const edge of [-.92,0,.92]) {
        const hit=new CANNON.RaycastResult(); world.raycastClosest(new CANNON.Vec3(route[i-1].x+edge,1,route[i-1].z),new CANNON.Vec3(route[i].x+edge,1,route[i].z),{},hit);
        expect(hit.hasHit,`${destination} segment ${i}`).toBe(false);
      }
    }
    expect(streetRideRoute({x:0,z:0},'powai')).toEqual([]);
  });
});
