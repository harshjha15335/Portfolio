import {init,NavMeshQuery,Crowd,type CrowdAgent,type NavMesh} from '@recast-navigation/core';
import {generateSoloNavMesh} from '@recast-navigation/generators';
import type {Vector3} from '@recast-navigation/core';
export interface Obstacle {minX:number;maxX:number;minZ:number;maxZ:number;}
export function navigationGeometry(obstacles:Obstacle[]) {
 const positions:number[]=[],indices:number[]=[];
 for(let x=-13;x<6.8;x+=.3)for(let z=-56;z<12;z+=.3){const cx=x+.15,cz=z+.15;const pavement=Math.abs(cx)>4.2&&Math.abs(cx)<6.75;const crossing=Math.abs(cx)<=4.3&&cz>-13.2&&cz<-10.8;const room=cx<-6.5&&cz>-37.5&&cz<-30.2;
  if(!(pavement||crossing||room)||obstacles.some(o=>cx>o.minX-.12&&cx<o.maxX+.12&&cz>o.minZ-.12&&cz<o.maxZ+.12))continue;
  const n=positions.length/3;positions.push(x,0,z,x,0,z+.3,x+.3,0,z+.3,x+.3,0,z);indices.push(n,n+1,n+2,n,n+2,n+3);
 }
 return {positions,indices};
}
export class NavMeshManager {
 readonly query:NavMeshQuery;readonly crowd:Crowd;
 private constructor(private mesh:NavMesh){this.query=new NavMeshQuery(mesh);this.crowd=new Crowd(mesh,{maxAgents:24,maxAgentRadius:.3});}
 static async create(obstacles:Obstacle[]) {await init();const geometry=navigationGeometry(obstacles);if(geometry.positions.length>150000||!geometry.positions.every(Number.isFinite))throw new Error('Invalid navigation input');const result=generateSoloNavMesh(geometry.positions,geometry.indices,{cs:.15,ch:.1,walkableHeight:18,walkableClimb:2,walkableRadius:2,minRegionArea:4,mergeRegionArea:8});if(!result.success)throw new Error(result.error);return new NavMeshManager(result.navMesh);}
 path(start:Vector3,end:Vector3){if(![start.x,start.y,start.z,end.x,end.y,end.z].every(Number.isFinite))return null;const result=this.query.computePath(start,end);return result.success?result.path:null;}
 add(position:Vector3):CrowdAgent {return this.crowd.addAgent(position,{radius:.24,height:1.8,maxSpeed:1,maxAcceleration:2,separationWeight:3,collisionQueryRange:2.5,pathOptimizationRange:8,updateFlags:31});}
 dispose(){this.crowd.destroy();this.query.destroy();this.mesh.destroy();}
}
