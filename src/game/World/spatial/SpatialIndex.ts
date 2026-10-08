import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Only authored static colliders are admitted; no uploaded or remote geometry. */
export class SpatialIndex {
  private geometry: THREE.BufferGeometry;
  private tree: MeshBVH;
  private disposed = false;
  constructor(geometries: THREE.BufferGeometry[]) {
    let vertices = 0;
    for (const geometry of geometries) {
      const position=geometry.getAttribute('position');
      if (!position || position.itemSize!==3 || position.count<3) throw new Error('Invalid spatial geometry');
      vertices+=position.count;
      if(vertices>250000) throw new Error('Spatial vertex budget exceeded');
      if(!Number.isInteger(position.count))throw new Error('Invalid spatial vertex count');
      const count=geometry.index?.count??position.count;if(count%3||count>300000)throw new Error('Invalid spatial triangle count');
      if(geometry.index)for(let i=0;i<geometry.index.count;i++){const index=geometry.index.getX(i);if(!Number.isInteger(index)||index<0||index>=position.count)throw new Error('Invalid spatial index');}
      for(let i=0;i<position.array.length;i++) if(!Number.isFinite(position.array[i])) throw new Error('Non-finite spatial coordinates');
    }
    if(!geometries.length) throw new Error('No spatial geometry');
    const sources=geometries.map(g=>{const copy=g.index?g.toNonIndexed():g.clone();for(const key of Object.keys(copy.attributes))if(key!=='position')copy.deleteAttribute(key);return copy;});
    this.geometry=mergeGeometries(sources)!; sources.forEach(g=>g.dispose());
    this.tree=new MeshBVH(this.geometry,{targetLeafSize:8});
  }
  hit(origin:THREE.Vector3,direction:THREE.Vector3,maxDistance:number) {
    if(this.disposed) throw new Error('Spatial index disposed');
    if(!Number.isFinite(maxDistance)||maxDistance<=0||!origin.toArray().every(Number.isFinite)||!direction.toArray().every(Number.isFinite)||direction.lengthSq()<.00001) return null;
    return this.tree.raycastFirst(new THREE.Ray(origin,direction.clone().normalize()),THREE.DoubleSide,0,maxDistance);
  }
  visible(origin:THREE.Vector3,target:THREE.Vector3) {if(![...origin.toArray(),...target.toArray()].every(Number.isFinite))return false;const direction=target.clone().sub(origin),distance=direction.length();return distance<.01||!this.hit(origin,direction,Math.max(.001,distance-.1));}
  ground(origin:THREE.Vector3,maxDistance=3) {return this.hit(origin,new THREE.Vector3(0,-1,0),maxDistance);}
  dispose() {if(this.disposed)return;this.disposed=true;this.geometry.dispose();}
}
