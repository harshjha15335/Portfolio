import {describe,it,expect} from 'vitest';
import {sampleMultipole} from '../src/research/multipoles';
import {distribution} from '../src/core/GPUFrameProfiler';
import {walkingSimulationDelta} from '../src/core/frameTiming';
describe('Fort teaching physics',()=>{
 it('matches analytic unit charge and excludes the singular origin',()=>{expect(sampleMultipole(2,0,0)).toEqual({potential:.5,ex:.25,ey:0});expect(sampleMultipole(0,0,2)).toBeNull();});
 it.each([0,1,2])('field is minus the potential gradient for order %i',order=>{const h=1e-5;for(const [x,y] of [[1.2,.7],[-.8,1.3],[2,-.4]]){const f=sampleMultipole(x,y,order)!;const dx=(sampleMultipole(x+h,y,order)!.potential-sampleMultipole(x-h,y,order)!.potential)/(2*h),dy=(sampleMultipole(x,y+h,order)!.potential-sampleMultipole(x,y-h,order)!.potential)/(2*h);expect(f.ex).toBeCloseTo(-dx,6);expect(f.ey).toBeCloseTo(-dy,6);}});
});
describe('bounded fixed-step walking catch-up',()=>{
 it('does not slow three-Hz walking to the old 80ms visual budget',()=>{expect(walkingSimulationDelta(1/3)).toBe(.25);expect(Math.floor(walkingSimulationDelta(1/3)*60)).toBe(15);expect(walkingSimulationDelta(1/60)).toBe(1/60);});
 it('caps suspension gaps and rejects invalid timestamps',()=>{expect(walkingSimulationDelta(7)).toBe(.25);for(const n of [-1,0,NaN,Infinity])expect(walkingSimulationDelta(n)).toBe(0);});
});

it('reports nearest-rank frame-time tails without inventing missing samples',()=>{expect(distribution([])).toBeNull();const d=distribution(Array.from({length:100},(_,i)=>i+1))!;expect(d.p50).toBe(50);expect(d.p95).toBe(95);expect(d.p99).toBe(99);expect(d.mean).toBe(50.5);});
