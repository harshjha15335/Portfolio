import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TransitKind } from './transit';

type V = [number, number, number];
/** Lofted original bodywork. Eight-sided rings give soft shoulders without external models. */
function bodywork(rings: Array<[number, number, number, number]>) {
  const vertices:number[]=[], indices:number[]=[];
  for(const [z,w,b,t] of rings) for(const [x,y] of [[-w*.88,b],[-w,b+.07],[-w,t-.09],[-w*.82,t],[w*.82,t],[w,t-.09],[w,b+.07],[w*.88,b]]) vertices.push(x,y,z);
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=(i+1)*8+j,d=(i+1)*8+(j+1)%8;indices.push(a,c,b,b,c,d);}
  for(const row of [0,rings.length-1])for(let j=1;j<7;j++) { const a=row*8; if(row===0)indices.push(a,a+j,a+j+1);else indices.push(a,a+j+1,a+j); }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createTransitModel(kind: TransitKind) {
  const group=new THREE.Group();group.name=`${kind}-original-bodywork`;
  const rounded=new RoundedBoxGeometry(1,1,1,1,.07);
  const yellow=new THREE.MeshStandardMaterial({color:'#c9a343',roughness:.38,metalness:.18});
  const black=new THREE.MeshStandardMaterial({color:'#24292c',roughness:.43,metalness:.18});
  const rubber=new THREE.MeshStandardMaterial({color:'#1c2022',roughness:.97});
  const fabric=new THREE.MeshStandardMaterial({color:'#3e4142',roughness:.96});
  const metal=new THREE.MeshStandardMaterial({color:'#9b9d92',roughness:.38,metalness:.65});
  const glass=new THREE.MeshStandardMaterial({color:'#a5b8ae',roughness:.24,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
  const lamp=new THREE.MeshStandardMaterial({color:'#fff1c8',emissive:'#e9bc6f',emissiveIntensity:.8,roughness:.3});
  const red=new THREE.MeshStandardMaterial({color:'#a63e2d',emissive:'#90321c',emissiveIntensity:.4,roughness:.4});
  const skin=new THREE.MeshStandardMaterial({color:'#a17b5d',roughness:.95});
  const shirt=new THREE.MeshStandardMaterial({color:'#879280',roughness:.92});
  const add=(geometry:THREE.BufferGeometry,position:V,material:THREE.Material,size:V=[1,1,1])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.scale.set(...size);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
  const part=(size:V,position:V,material:THREE.Material)=>add(rounded,position,material,size);
  const bar=(a:V,b:V,r:number,material:THREE.Material)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);const m=add(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),8),av.add(bv).multiplyScalar(.5).toArray() as V,material);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());return m;};
  const pane=(points:V[])=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();return add(geo,[0,0,0],glass);};
  const auto=kind==='auto';
  if(!auto) {
    add(bodywork([[-1.88,.65,.43,.8],[-1.58,.87,.42,.96],[-.86,.89,.42,1.01],[.93,.88,.42,1],[1.65,.82,.44,.9],[1.86,.67,.46,.78]]),[0,0,0],black);
    add(bodywork([[-1.75,.64,.86,.9],[-1.48,.81,.88,1.02],[-.85,.83,.95,1.05]]),[0,0,0],yellow);
    add(bodywork([[-.49,.6,1.57,1.65],[-.35,.68,1.59,1.69],[.65,.68,1.59,1.69],[.81,.59,1.57,1.64]]),[0,0,0],yellow);
    // Cabin is open glass between a thin roof and angled structural pillars.
    part([1.39,.095,1.3],[0,1.65,.15],yellow);
    for(const side of [-1,1]) {
      const x=side*.81;
      bar([x,1,-.88],[side*.65,1.61,-.43],.035,black);bar([x,1,1.18],[side*.65,1.61,.74],.035,black);
      bar([side*.84,.97,.22],[side*.67,1.62,.22],.04,black);
      pane([[x,1.01,-.79],[side*.66,1.58,-.4],[side*.66,1.58,.15],[x,1.01,.15]]);
      pane([[x,1.01,.28],[side*.66,1.58,.28],[side*.66,1.58,.69],[x,1.01,1.08]]);
      bar([side*.895,.53,-.75],[side*.895,.95,-.75],.008,metal);bar([side*.895,.54,.2],[side*.895,.98,.2],.008,metal);
      part([.035,.04,.14],[side*.898,.91,-.48],metal);part([.035,.04,.14],[side*.898,.91,.5],metal);
      part([.22,.13,.19],[side*.98,1.15,-.7],black);bar([side*.82,1.1,-.7],[side*.97,1.13,-.7],.018,metal);
      // Arch lips follow the wheels, rather than giant rectangular wings.
      for(const z of [-1.13,1.12]) {const arc=new THREE.TorusGeometry(.38,.025,5,16,Math.PI);arc.rotateY(Math.PI/2);const m=add(arc,[side*.9,.34,z],black);m.rotation.x=-Math.PI/2;}
    }
    pane([[-.78,1.05,-.88],[.78,1.05,-.88],[.64,1.57,-.45],[-.64,1.57,-.45]]);
    pane([[-.64,1.57,.78],[.64,1.57,.78],[.75,1.04,1.21],[-.75,1.04,1.21]]);
    part([1.45,.09,.14],[0,.5,-1.86],metal);part([1.42,.09,.14],[0,.5,1.85],metal);
    part([.62,.14,.04],[0,.69,-1.885],black);for(let i=0;i<6;i++)part([.055,.11,.01],[-.25+i*.1,.69,-1.91],metal);
    for(const x of [-.58,.58]){add(new THREE.SphereGeometry(.13,12,8),[x,.79,-1.8],lamp,[1,.85,.3]);part([.18,.14,.04],[x,.77,1.84],red);}
    part([.38,.1,.2],[0,1.76,.15],lamp);
    part([.32,.11,.02],[0,.57,-1.94],yellow);
  } else {
    add(bodywork([[-1.21,.38,.35,.6],[-1.03,.54,.34,1.03],[-.64,.64,.34,1.02],[.98,.68,.34,.63],[1.18,.59,.36,.64]]),[0,0,0],black);
    add(bodywork([[-1.17,.36,.7,.93],[-.92,.56,.76,1.12],[-.64,.6,.8,1.12]]),[0,0,0],yellow);
    // Curving yellow brow and black canvas canopy; the open sides are kept clear.
    add(bodywork([[-.68,.61,1.69,1.79],[-.45,.73,1.72,1.91],[.8,.73,1.73,1.93],[1.07,.63,1.67,1.84]]),[0,0,0],fabric);
    part([1.19,.09,.14],[0,1.75,-.69],yellow);
    for(const side of [-1,1]){bar([side*.57,.93,-.78],[side*.62,1.73,-.63],.025,black);bar([side*.66,.56,1.03],[side*.65,1.76,1],.028,metal);part([.12,.07,1.25],[side*.67,.43,.38],metal);part([.18,.12,.12],[side*.78,1.28,-.75],black);bar([side*.54,1.2,-.71],[side*.75,1.27,-.75],.015,metal);}
    pane([[-.54,1.12,-.79],[.54,1.12,-.79],[.6,1.69,-.65],[-.6,1.69,-.65]]);
    part([1.21,.63,.13],[0,1.28,1.05],fabric);pane([[-.36,1.4,1.13],[.36,1.4,1.13],[.36,1.69,1.1],[-.36,1.69,1.1]]);
    part([1.24,.12,.12],[0,.41,1.16],metal);add(new THREE.SphereGeometry(.14,12,8),[0,.87,-1.22],lamp,[1,1,.25]);
    for(const x of [-.5,.5])part([.09,.17,.04],[x,.61,1.18],red);
    part([1.18,.24,.28],[0,.67,.91],yellow);
  }
  // Passenger seating and a non-block driver silhouette.
  part([auto?1.16:1.46,.13,.5],[0,.83,.59],fabric);part([auto?1.14:1.46,.38,.13],[0,1.01,.84],fabric);
  part([auto?1.06:1.48,.08,.3],[0,1.04,auto?-.62:-.69],black);
  add(new THREE.CylinderGeometry(.16,.13,.4,10),[-.3,1.09,-.17],shirt,[1,1,.65]);
  add(new THREE.SphereGeometry(.12,12,8),[-.3,1.42,-.17],skin,[1,1.2,.95]);
  for(const x of [-.47,-.14])bar([x,1.22,-.16],[x,1.01,-.49],.04,shirt);
  bar([-.48,1,-.47],[-.12,1,-.47],.022,black);
  const meter=part([.18,.12,.065],[auto?.27:.35,1.12,auto?-.61:-.68],black);meter.name='physical-meter';part([.14,.06,.004],[auto?.27:.35,1.13,auto?-.65:-.72],lamp);

  // Merge static body panels by material; wheels remain independently articulated.
  const originals=new Set<THREE.BufferGeometry>();const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();group.updateMatrixWorld(true);
  for(const child of [...group.children]){const m=child as THREE.Mesh;originals.add(m.geometry);const mat=m.material as THREE.Material;const geometries=buckets.get(mat)??[];const geometry=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);geometry.deleteAttribute('uv');geometries.push(geometry);buckets.set(mat,geometries);group.remove(m);}
  for(const [material,parts] of buckets){const mesh=new THREE.Mesh(mergeGeometries(parts)!,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);parts.forEach(p=>p.dispose());}
  originals.forEach(g=>g.dispose());
  const wheels:THREE.Group[]=[];
  const radius=auto?.255:.32;
  const tyre=new THREE.TorusGeometry(radius-.055,.055,7,16);tyre.rotateY(Math.PI/2);
  const hub=new THREE.CylinderGeometry(radius*.7,radius*.7,.13,12);hub.rotateZ(Math.PI/2);
  const centre=new THREE.CylinderGeometry(radius*.25,radius*.25,.16,8);centre.rotateZ(Math.PI/2);
  const wheelParts=[tyre,hub,centre].map((geometry,i)=>{const geo=geometry.toNonIndexed();const color=new THREE.Color(i===1?'#999a8f':'#252c2b');const colors=new Float32Array(geo.attributes.position.count*3);for(let n=0;n<geo.attributes.position.count;n++)color.toArray(colors,n*3);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));return geo;});
  const wheelGeometry=mergeGeometries(wheelParts)!;wheelParts.forEach(p=>p.dispose());[tyre,hub,centre].forEach(p=>p.dispose());
  for(const [x,z] of auto?[[0,-.94],[-.69,.78],[.69,.78]]:[[-.88,-1.13],[.88,-1.13],[-.88,1.12],[.88,1.12]]) {
    const wheel=new THREE.Group();wheel.position.set(x,radius,z);group.add(wheel);wheels.push(wheel);
  }
  const wheelBatch=new THREE.InstancedMesh(wheelGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:.25}),wheels.length);wheelBatch.castShadow=true;wheelBatch.receiveShadow=true;wheelBatch.frustumCulled=false;group.add(wheelBatch);
  wheels.forEach((wheel,i)=>{wheel.updateMatrix();wheelBatch.setMatrixAt(i,wheel.matrix);});group.userData.wheelBatch=wheelBatch;
  group.userData.wheels=wheels;group.userData.wheelRadius=auto?.255:.32;
  group.userData.lastPosition=new THREE.Vector3();group.userData.travel=0;
  return group;
}
export function animateTransit(model:THREE.Group,distance:number,steering=0) {
  const wheels=model.userData.wheels as THREE.Group[];
  for(let i=0;i<wheels.length;i++){wheels[i].rotation.x=distance/model.userData.wheelRadius;wheels[i].rotation.y=i<(wheels.length===3?1:2)?THREE.MathUtils.clamp(steering,-.35,.35):0;wheels[i].updateMatrix();(model.userData.wheelBatch as THREE.InstancedMesh).setMatrixAt(i,wheels[i].matrix);}
  (model.userData.wheelBatch as THREE.InstancedMesh).instanceMatrix.needsUpdate=true;
}
