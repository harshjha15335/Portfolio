import {describe,it,expect} from 'vitest';
import {RoadTraffic,pedestrianGreen} from '../src/game/World/traffic/RoadTraffic';
describe('lane traffic',()=>{
 it('uses curved turns inside the carriageway',()=>{const road=new RoadTraffic();for(let i=0;i<1000;i++){road.agents[0].distance=road.length*i/1000;const p=road.pose(0);expect(Math.abs(p.x)).toBeLessThan(2.3);expect(p.z).toBeGreaterThan(-55);expect(p.z).toBeLessThan(16);}});
 it('accelerates smoothly, keeps spacing and yields to a pedestrian',()=>{const road=new RoadTraffic();for(let i=0;i<100;i++)road.step(1/30,0);expect(road.agents[0].speed).toBeGreaterThan(2);road.agents[1].distance=road.agents[0].distance+5;for(let i=0;i<60;i++)road.step(1/30,0);expect(road.agents[0].speed).toBeLessThan(road.agents[1].speed);const p=road.pose(0);for(let i=0;i<60;i++)road.step(1/30,0,{x:p.x,z:p.z-3});expect(road.agents[0].speed).toBeLessThan(.1);});
 it('keeps yielding to a crossing pedestrian after the scheduled green phase',()=>{const road=new RoadTraffic();for(let i=0;i<60;i++)road.step(1/30,0);const p=road.pose(0);for(let i=0;i<90;i++)road.step(1/30,28,[{x:p.x,z:p.z-3}]);expect(road.agents[0].speed).toBeLessThan(.1);});
 it('opens a bounded crossing phase',()=>{expect(pedestrianGreen(19)).toBe(false);expect(pedestrianGreen(21)).toBe(true);expect(pedestrianGreen(28)).toBe(false);});
});
describe('dense traffic',()=>{
 it('parks extra cars until a denser preset turns them on, then spaces them between the others',()=>{
  const road=new RoadTraffic(3,3);expect(road.agents).toHaveLength(6);expect(road.active).toBe(3);
  const parked=road.agents[3].distance;for(let i=0;i<60;i++)road.step(1/30,0);expect(road.agents[3].distance).toBe(parked);
  road.active=6;const sorted=road.agents.map(a=>a.distance).sort((a,b)=>a-b);
  for(let i=0;i<sorted.length;i++)expect(((sorted[(i+1)%6]-sorted[i]+road.length)%road.length)).toBeGreaterThan(12);
  for(let i=0;i<300;i++)road.step(1/30,0);expect(road.agents[3].distance).not.toBe(parked);
 });
});
describe('Fort Road traffic sharing the loop',()=>{
 it('keeps the taxis, autos and private cars bumper to bumper, never inside each other, and off the station',async()=>{
  const {createFortRoadTraffic,FORT_LOOP_LANE}=await import('../src/game/World/districts/FortRoadTraffic');
  const THREE=await import('three');
  const road=new RoadTraffic(3,3);road.active=6;
  const fort=createFortRoadTraffic(()=>road.agents.slice(0,road.active).map((a,i)=>({s:a.distance,length:RoadTraffic.lengthOf(i)})));
  const away=new THREE.Vector3(60,1.6,200);let time=100,minGap=Infinity,travelled=0,last=fort.onLane(FORT_LOOP_LANE).map(v=>v.s);
  for(let step=0;step<30*120;step++){
   time+=1/30;fort.update(time,1/30,[away]);road.step(1/30,time,[{x:away.x,z:away.z}],fort.onLane(FORT_LOOP_LANE));
   const all=[...road.agents.slice(0,road.active).map((a,i)=>({s:a.distance,length:RoadTraffic.lengthOf(i)})),...fort.onLane(FORT_LOOP_LANE)].sort((a,b)=>a.s-b.s);
   const now=fort.onLane(FORT_LOOP_LANE).map(v=>v.s);travelled+=now.reduce((t,s,i)=>t+((s-last[i]+road.length)%road.length),0);last=now;
   for(let i=0;i<all.length;i++){const a=all[i],b=all[(i+1)%all.length];minGap=Math.min(minGap,((b.s-a.s+road.length)%road.length)-(a.length+b.length)/2);}
   // Nothing on Fort Road's through traffic reaches the station (z > 17) or the buildings beyond the cross street.
   for(const p of fort.positions)expect(p.z<17&&(Math.abs(p.x)<3.9||Math.abs(p.z+62)<4.6)).toBe(true);
  }
  expect(minGap).toBeGreaterThan(.5);
  // And it flows: each car covers several laps' worth of road in two minutes, not a jam.
  expect(travelled/last.length).toBeGreaterThan(200);
  expect(road.agents.every(a=>a.distance>0)).toBe(true);
 });
});
