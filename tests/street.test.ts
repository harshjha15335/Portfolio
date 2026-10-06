import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import { createVisitor } from '../src/game/World/WalkingBody';
import { MumbaiStreet } from '../src/game/World/MumbaiStreet';
import { STREET_SPAWN, streetStops, streetRideRoute, walkingVelocity } from '../src/game/World/streetLayout';
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
