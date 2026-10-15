import * as THREE from 'three';
export type ShadowCost={draws:number;triangles:number;drawCpuMs:number;casters:Record<string,{draws:number;triangles:number}>};
/** Public Mesh shadow hooks bracket actual submissions, including instanced counts.
 * CPU duration covers draw callbacks only, not whole-pass setup or GPU execution.
 */
export class ShadowPassMetrics {
 private attached=new WeakSet<THREE.Mesh>();
 cost:ShadowCost={draws:0,triangles:0,drawCpuMs:0,casters:{}};
 prepare(scene:THREE.Scene){
  this.cost={draws:0,triangles:0,drawCpuMs:0,casters:{}};
  scene.traverseVisible(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||this.attached.has(mesh))return;this.attached.add(mesh);
   const before=mesh.onBeforeShadow,after=mesh.onAfterShadow;let calls=0,triangles=0,start=0;
   mesh.onBeforeShadow=(...args)=>{before.apply(mesh,args);const info=args[0].info.render;calls=info.calls;triangles=info.triangles;start=performance.now();};
   mesh.onAfterShadow=(...args)=>{const info=args[0].info.render,d=info.calls-calls,t=info.triangles-triangles;this.cost.draws+=d;this.cost.triangles+=t;this.cost.drawCpuMs+=performance.now()-start;const key=mesh.name||mesh.type;const row=this.cost.casters[key]??={draws:0,triangles:0};row.draws+=d;row.triangles+=t;after.apply(mesh,args);};
  });
 }
}
