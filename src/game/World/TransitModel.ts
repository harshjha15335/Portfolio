import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TransitKind } from './transit';
import { createSeatedDriver } from './npc/NPCFactory';

type V = [number, number, number];
let upholsteryMap:THREE.CanvasTexture|undefined;
function upholsteryTexture(){
  // Geometry/physics tools can construct vehicles without a browser canvas.
  if(typeof document==='undefined')return null;
  if(upholsteryMap)return upholsteryMap;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#b8b4a9';ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const shade=135+((x*17+y*31)%47);ctx.fillStyle=`rgba(${shade},${shade},${shade-8},.24)`;ctx.fillRect(x,y,1,2);}
  for(let x=0;x<128;x+=32){ctx.fillStyle='#615e4c28';ctx.fillRect(x,0,1,128);ctx.fillStyle='#e4dfca35';ctx.fillRect(x+2,0,1,128);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);upholsteryMap=texture;return texture;
}
/** Lofted original bodywork. Eight-sided rings give soft shoulders without external models. */
function bodywork(rings: Array<[number, number, number, number]>) {
  const vertices:number[]=[], indices:number[]=[];
  for(const [z,w,b,t] of rings) for(const [x,y] of [[-w*.88,b],[-w,b+.07],[-w,t-.09],[-w*.82,t],[w*.82,t],[w,t-.09],[w,b+.07],[w*.88,b]]) vertices.push(x,y,z);
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=(i+1)*8+j,d=(i+1)*8+(j+1)%8;indices.push(a,c,b,b,c,d);}
  for(const row of [0,rings.length-1])for(let j=1;j<7;j++) { const a=row*8; if(row===0)indices.push(a,a+j,a+j+1);else indices.push(a,a+j+1,a+j); }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createTransitModel(kind: TransitKind,cabinDetail:'close'|'street'='street') {
  const group=new THREE.Group();group.name=`${kind}-original-bodywork`;
  const rounded=new RoundedBoxGeometry(1,1,1,1,.07);
  const yellow=new THREE.MeshStandardMaterial({color:'#c9a343',roughness:.38,metalness:.18});
  const black=new THREE.MeshStandardMaterial({color:'#24292c',roughness:.43,metalness:.18});
  const rubber=new THREE.MeshStandardMaterial({color:'#1c2022',roughness:.97});
  const fabric=new THREE.MeshStandardMaterial({color:'#676c65',map:upholsteryTexture(),roughness:.96});
  const thread=new THREE.MeshStandardMaterial({color:'#8c8979',roughness:.95});
  const metal=new THREE.MeshStandardMaterial({color:'#9b9d92',roughness:.38,metalness:.65});
  const glass=new THREE.MeshStandardMaterial({color:'#a5b8ae',roughness:.24,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
  const lamp=new THREE.MeshStandardMaterial({color:'#fff1c8',emissive:'#e9bc6f',emissiveIntensity:.8,roughness:.3});
  const red=new THREE.MeshStandardMaterial({color:'#a63e2d',emissive:'#90321c',emissiveIntensity:.4,roughness:.4});
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
  // Passenger cabin: stitched bench, bucket seats, instruments and working driving posture.
  part([auto?1.16:1.46,.13,.5],[0,.83,.59],fabric);part([auto?1.14:1.46,.38,.13],[0,1.01,.84],fabric);
  part([auto?1.06:1.48,.08,.3],[0,1.04,auto?-.62:-.69],black);
  const driverX=auto?0:.34;
  const driver=createSeatedDriver(`${kind}:driver`,cabinDetail);driver.position.set(driverX,-.29,auto?-.24:-.03);group.add(driver);
  for(const x of auto?[0]:[-.36,.36]){
    part([auto?.48:.49,.11,.44],[x,.59,auto?-.25:-.04],fabric);
    const back=part([auto?.48:.49,.52,.10],[x,.9,auto?-.02:.19],fabric);back.rotation.x=-.12;
    if(!auto)part([.23,.15,.11],[x,1.23,.22],fabric);
    if(cabinDetail==='close'){
      for(const side of [-1,1])bar([x+side*.20,.70,auto?.04:.26],[x+side*.17,1.11,auto?.05:.27],.0025,thread);
      part([.28,.115,.019],[x,.84,auto?.054:.28],fabric);
      bar([x-.13,.895,auto?.067:.292],[x+.13,.895,auto?.067:.292],.0025,thread);
    }
  }
  if(cabinDetail==='close'){
  // Upholstery seams and rear headrests are readable from the passenger camera.
  for(const x of [-.43,0,.43]){
    part([.008,.24,.008],[x,1.02,.765],metal);
    if(!auto)part([.24,.15,.10],[x,1.29,.855],fabric);
  }
  for(const side of [-1,1]){
    part([.035,.30,auto?.72:1.02],[side*(auto?.62:.82),.93,.46],fabric);
    part([.055,.06,.24],[side*(auto?.60:.79),1.03,.46],black);
    part([.015,.025,.09],[side*(auto?.59:.775),1.12,.44],metal);
  }
  if(auto){
    bar([-.23,1.06,-.75],[.23,1.06,-.75],.016,metal);
    for(const side of [-1,1])part([.13,.035,.035],[side*.23,1.06,-.75],rubber);
    bar([0,.48,-.92],[0,1.06,-.75],.022,metal);
  }else{
    part([1.25,.018,1.08],[0,1.582,.13],fabric);
    part([.15,.017,.065],[0,1.565,.42],lamp);
    const wheel=add(new THREE.TorusGeometry(.195,.014,8,24),[driverX,1.07,-.53],black);wheel.rotation.x=-.36;
    bar([driverX,.70,-.67],[driverX,1.07,-.53],.023,black);
    for(const dx of [-.17,.17])bar([driverX,1.07,-.53],[driverX+dx,1.07,-.53],.009,metal);
    part([.39,.14,.06],[driverX,1.12,-.70],fabric);
    for(const dx of [-.105,.105]){
      const dial=add(new THREE.CircleGeometry(.043,20),[driverX+dx,1.145,-.66],rubber);
      const needle=part([.002,.057,.003],[driverX+dx+.008,1.148,-.655],metal);needle.rotation.z=.6;
      for(const sy of [-.029,.029])part([.018,.003,.003],[driverX+dx,1.145+sy,-.655],metal);
      dial.rotation.x=-.1;
    }
    for(const x of [-.57,-.11])for(let n=0;n<4;n++)part([.12,.009,.008],[x,1.105+n*.018,-.53],metal);
    bar([-.04,.53,-.14],[-.04,.79,-.23],.015,metal);add(new THREE.SphereGeometry(.03,10,8),[-.04,.79,-.23],black);
    part([.21,.075,.026],[0,1.5,-.50],black);part([.18,.05,.006],[0,1.5,-.48],metal);
    bar([0,1.54,-.49],[0,1.61,-.48],.009,metal);
    for(const side of [-1,1])bar([side*.18,1.065,-.91],[side*.38,1.19,-.82],.008,rubber);
  }
  }
  const meter=part([.18,.12,.065],[auto?.27:.35,1.12,auto?-.61:-.68],black);meter.name='physical-meter';part([.14,.06,.004],[auto?.27:.35,1.13,auto?-.65:-.72],lamp);

  // Merge static body panels by material; wheels remain independently articulated.
  const originals=new Set<THREE.BufferGeometry>();const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();group.updateMatrixWorld(true);
  for(const child of [...group.children]){const m=child as THREE.Mesh;originals.add(m.geometry);const mat=m.material as THREE.Material;const geometries=buckets.get(mat)??[];const geometry=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);
    if((mat as THREE.MeshStandardMaterial).map){
      if(!geometry.hasAttribute('uv')){const uv=[],p=geometry.attributes.position;for(let i=0;i<p.count;i++)uv.push(p.getX(i),p.getZ(i));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}
    }else geometry.deleteAttribute('uv');
    geometries.push(geometry);buckets.set(mat,geometries);group.remove(m);}
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
  group.userData.cabinDetail=cabinDetail;
  return group;
}
export function animateTransit(model:THREE.Group,distance:number,steering=0) {
  const wheels=model.userData.wheels as THREE.Group[];
  for(let i=0;i<wheels.length;i++){wheels[i].rotation.x=distance/model.userData.wheelRadius;wheels[i].rotation.y=i<(wheels.length===3?1:2)?THREE.MathUtils.clamp(steering,-.35,.35):0;wheels[i].updateMatrix();(model.userData.wheelBatch as THREE.InstancedMesh).setMatrixAt(i,wheels[i].matrix);}
  (model.userData.wheelBatch as THREE.InstancedMesh).instanceMatrix.needsUpdate=true;
}
