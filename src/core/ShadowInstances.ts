import * as THREE from 'three';
/** Pack casting instances first. Keep one main-pass batch/material and draw only
 * its caster prefix for PCF shadow submissions using public Mesh callbacks.
 * The whole-batch bounds remain conservative for either pass.
 */
export function casterPrefix(meshes:THREE.Mesh[]){const casting=meshes.filter(m=>m.castShadow);return {meshes:[...casting,...meshes.filter(m=>!m.castShadow)],count:casting.length};}
export function restrictInstanceShadows(instance:THREE.InstancedMesh,count:number){
 instance.castShadow=count>0;
 instance.onBeforeShadow=()=>{instance.userData.mainInstanceCount=instance.count;instance.count=Math.min(instance.count,count);};
 instance.onAfterShadow=()=>{instance.count=instance.userData.mainInstanceCount;};
 instance.userData.shadowCasterCount=count;
}
