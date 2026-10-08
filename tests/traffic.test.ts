import {describe,it,expect} from 'vitest';
import {RoadTraffic,pedestrianGreen} from '../src/game/World/traffic/RoadTraffic';
describe('lane traffic',()=>{
 it('uses curved turns inside the carriageway',()=>{const road=new RoadTraffic();for(let i=0;i<1000;i++){road.agents[0].distance=road.length*i/1000;const p=road.pose(0);expect(Math.abs(p.x)).toBeLessThan(2.3);expect(p.z).toBeGreaterThan(-55);expect(p.z).toBeLessThan(16);}});
 it('accelerates smoothly, keeps spacing and yields to a pedestrian',()=>{const road=new RoadTraffic();for(let i=0;i<100;i++)road.step(1/30,0);expect(road.agents[0].speed).toBeGreaterThan(2);road.agents[1].distance=road.agents[0].distance+5;for(let i=0;i<60;i++)road.step(1/30,0);expect(road.agents[0].speed).toBeLessThan(road.agents[1].speed);const p=road.pose(0);for(let i=0;i<60;i++)road.step(1/30,0,{x:p.x,z:p.z-3});expect(road.agents[0].speed).toBeLessThan(.1);});
 it('keeps yielding to a crossing pedestrian after the scheduled green phase',()=>{const road=new RoadTraffic();for(let i=0;i<60;i++)road.step(1/30,0);const p=road.pose(0);for(let i=0;i<90;i++)road.step(1/30,28,[{x:p.x,z:p.z-3}]);expect(road.agents[0].speed).toBeLessThan(.1);});
 it('opens a bounded crossing phase',()=>{expect(pedestrianGreen(19)).toBe(false);expect(pedestrianGreen(21)).toBe(true);expect(pedestrianGreen(28)).toBe(false);});
});
