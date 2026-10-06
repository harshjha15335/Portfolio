import * as CANNON from 'cannon-es';

/** Rounded upright collision volume from ankle to eye height; no jump mechanic. */
export function createVisitor(x: number, z: number) {
  const body = new CANNON.Body({ mass:70, position:new CANNON.Vec3(x,.33,z), fixedRotation:true, linearDamping:0 });
  for (const y of [0,.35,.7,1]) body.addShape(new CANNON.Sphere(.32), new CANNON.Vec3(0,y,0));
  return body;
}
