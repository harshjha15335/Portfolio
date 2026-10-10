import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {clothingGeometry} from './ClothingGeometry';
import {seededRandom} from '../StreetArchitecture';

interface Ring {y:number;x:number;z:number;cx?:number;cz?:number;}
export interface Human {group:THREE.Group; mesh:THREE.SkinnedMesh; bones:THREE.Bone[]; setDetail:(close:boolean)=>void; animate:(time:number,walking:boolean,seated?:boolean)=>void;}
/** Original authored silhouette profiles, skin weights and motions; no third-party models. */
export function createHuman(seed:string,shirt:string,detail:'close'|'street'='close'):Human {
 const random=seededRandom(seed),group=new THREE.Group(),bones:THREE.Bone[]=[];
 const bone=(name:string,p:[number,number,number],parent?:number)=>{const b=new THREE.Bone();b.name=name;b.position.set(...p);if(parent!==undefined)bones[parent].add(b);bones.push(b);return bones.length-1;};
 bone('pelvis',[0,.91,0]);bone('spine',[0,.26,0],0);bone('neck',[0,.3,0],1);bone('head',[0,.12,0],2);
 for(const side of [-1,1]){const hip=bone(`hip${side}`,[side*.095,-.01,0],0);bone(`knee${side}`,[0,-.41,0],hip);bone(`ankle${side}`,[0,-.4,0],hip+1);}
 for(const side of [-1,1]){const shoulder=bone(`shoulder${side}`,[side*.205,.22,0],1);bone(`elbow${side}`,[side*.025,-.28,0],shoulder);bone(`wrist${side}`,[0,-.25,0],shoulder+1);}
 const skin=['#a77c5e','#bd9375','#88634d','#c4a080'][Math.floor(random()*4)],pants=['#495459','#64695d','#756b60'][Math.floor(random()*3)],longSleeves=random()>.48;
 const pieces:THREE.BufferGeometry[]=[];
 const loft=(rings:Ring[],color:string,boneIndex:number,next=boneIndex)=>{
  const vertices:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[],weights:number[]=[],uv:number[]=[],tri:number[]=[];const tint=new THREE.Color(color),segments=detail==='street'?6:boneIndex===3?20:10;
  for(let r=0;r<rings.length;r++){const p=rings[r];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;vertices.push((p.cx??0)+Math.cos(a)*p.x,p.y,(p.cz??0)+Math.sin(a)*p.z);normals.push(Math.cos(a),0,Math.sin(a));colors.push(tint.r,tint.g,tint.b);uv.push(i/segments,r/(rings.length-1));indices.push(boneIndex,next,0,0);const blend=next===boneIndex?0:THREE.MathUtils.smoothstep(r/(rings.length-1),.35,.7);weights.push(1-blend,blend,0,0);if(r<rings.length-1&&i<segments){const n=r*(segments+1)+i;tri.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}}}
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setAttribute('normal',new THREE.Float32BufferAttribute(normals,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3)).setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)).setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4)).setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(tri);g.computeVertexNormals();pieces.push(g);
 };
 // Profiles include hem, waist, chest, sloping shoulders and collar rather than a cylinder torso.
 const clothing=clothingGeometry(detail==='close'?24:12).clone(),clothColor=new THREE.Color(shirt),clothColors=[];for(let i=0;i<clothing.attributes.position.count;i++)clothColors.push(clothColor.r,clothColor.g,clothColor.b);clothing.setAttribute('color',new THREE.Float32BufferAttribute(clothColors,3));pieces.push(clothing);
 loft([{y:1.44,x:.047,z:.045},{y:1.52,x:.046,z:.047}],skin,2);
 // Jaw, cheekbones and temples are distinct profiles; the chin is closed, not a balloon.
 loft([{y:1.52,x:.015,z:.028,cz:-.013},{y:1.55,x:.056,z:.055,cz:-.014},{y:1.59,x:.079,z:.071,cz:-.006},{y:1.64,x:.094,z:.079},{y:1.69,x:.089,z:.082},{y:1.745,x:.072,z:.072},{y:1.78,x:.032,z:.034},{y:1.785,x:.001,z:.001}],skin,3);
 const hair=random()>.7?'#514337':'#292922';
 loft([{y:1.69,x:.09,z:.065,cz:.025},{y:1.73,x:.098,z:.083,cz:.013},{y:1.777,x:.075,z:.072,cz:.012},{y:1.81,x:.032,z:.034,cx:.012},{y:1.816,x:.001,z:.001,cx:.014}],hair,3);
 // Swept locks break the cap silhouette without separate draw calls.
 for(let n=0;n<(detail==='close'?5:3);n++)loft([{y:1.735,x:.021,z:.021,cx:-.065+n*.027,cz:-.045},{y:1.78,x:.025,z:.028,cx:-.055+n*.026,cz:-.025},{y:1.806,x:.013,z:.015,cx:-.039+n*.02,cz:.001},{y:1.812,x:.001,z:.001,cx:-.036+n*.019,cz:.005}],hair,3);
 // Sewn collar and placket sit on the actual garment surface.
 for(const side of [-1,1])loft([{y:1.345,x:.008,z:.003,cx:side*.04,cz:-.11},{y:1.405,x:.033,z:.008,cx:side*.044,cz:-.108},{y:1.435,x:.022,z:.006,cx:side*.04,cz:-.086}],new THREE.Color(shirt).multiplyScalar(.83).getStyle(),1);
 loft([{y:.97,x:.003,z:.002,cz:-.106},{y:1.32,x:.003,z:.002,cz:-.109}],new THREE.Color(shirt).multiplyScalar(.78).getStyle(),1);
 loft([{y:.89,x:.156,z:.087},{y:.96,x:.169,z:.097},{y:1.0,x:.154,z:.09}],pants,0);
 for(const [i,side] of [-1,1].entries()){
  const hip=4+i*3,shoulder=10+i*3,cx=side*.095;
  loft([{y:.06,x:.035,z:.055,cx},{y:.11,x:.049,z:.065,cx},{y:.35,x:.053,z:.056,cx},{y:.51,x:.061,z:.061,cx},{y:.72,x:.081,z:.077,cx},{y:.93,x:.089,z:.089,cx},{y:.96,x:.06,z:.068,cx}],pants,hip+1,hip);
  loft([{y:.027,x:.048,z:.105,cx,cz:-.035},{y:.056,x:.065,z:.145,cx,cz:-.045},{y:.104,x:.055,z:.115,cx,cz:-.035},{y:.13,x:.038,z:.053,cx}], '#363b39',hip+2);
  loft([{y:.82,x:.031,z:.038,cx:side*.23},{y:.88,x:.031,z:.032,cx:side*.23},{y:1.01,x:.047,z:.047,cx:side*.23},{y:1.17,x:.047,z:.049,cx:side*.23}],longSleeves?shirt:skin,shoulder+1,shoulder);
  loft([{y:.77,x:.024,z:.013,cx:side*.23},{y:.797,x:.029,z:.019,cx:side*.23},{y:.83,x:.025,z:.022,cx:side*.23},{y:.86,x:.023,z:.022,cx:side*.23}],skin,shoulder+2);
  for(let finger=0;finger<4;finger++){const fx=side*.23+(finger-1.5)*.013,length=[.042,.057,.052,.039][finger];loft([{y:.775-length,x:.001,z:.001,cx:fx,cz:-.002},{y:.786-length,x:.005,z:.006,cx:fx,cz:-.002},{y:.781,x:.006,z:.008,cx:fx}],skin,shoulder+2);}
  loft([{y:.766,x:.003,z:.004,cx:side*.267,cz:-.008},{y:.788,x:.008,z:.009,cx:side*.261,cz:-.006},{y:.812,x:.012,z:.01,cx:side*.25}],skin,shoulder+2);
  // A rolled sleeve edge and trouser cuff make the silhouette feel dressed.
  if(longSleeves)loft([{y:longSleeves?.835:1.135,x:longSleeves?.032:.05,z:longSleeves?.035:.05,cx:side*.227},{y:longSleeves?.855:1.155,x:longSleeves?.033:.051,z:longSleeves?.035:.05,cx:side*.227}],new THREE.Color(shirt).multiplyScalar(.75).getStyle(),longSleeves?shoulder+1:shoulder);
  loft([{y:.1,x:.05,z:.063,cx},{y:.127,x:.05,z:.061,cx}],new THREE.Color(pants).multiplyScalar(.82).getStyle(),hip+2);
 }
 for(const side of [-1,1]){
  loft([{y:1.606,x:.004,z:.006,cx:side*.091},{y:1.625,x:.014,z:.014,cx:side*.094},{y:1.66,x:.013,z:.012,cx:side*.094},{y:1.679,x:.003,z:.004,cx:side*.089}],skin,3);
  // Almond-shaped eyes, inset brown irises and quiet lids replace the floating dots.
  loft([{y:1.657,x:.005,z:.002,cx:side*.033,cz:-.074},{y:1.664,x:.014,z:.005,cx:side*.033,cz:-.077},{y:1.671,x:.007,z:.002,cx:side*.033,cz:-.074}], '#c5bda5',3);
  loft([{y:1.659,x:.002,z:.001,cx:side*.033,cz:-.082},{y:1.665,x:.004,z:.001,cx:side*.033,cz:-.084},{y:1.669,x:.002,z:.001,cx:side*.033,cz:-.082}], '#3b3428',3);
  loft([{y:1.684,x:.005,z:.002,cx:side*.032,cz:-.076},{y:1.689,x:.017,z:.002,cx:side*.033,cz:-.075},{y:1.693,x:.008,z:.002,cx:side*.036,cz:-.073}],hair,3);
 }
 loft([{y:1.61,x:.007,z:.005,cz:-.092},{y:1.617,x:.012,z:.009,cz:-.095},{y:1.638,x:.005,z:.006,cz:-.089},{y:1.66,x:.003,z:.003,cz:-.081}],skin,3);
 loft([{y:1.582,x:.006,z:.002,cz:-.076},{y:1.587,x:.022,z:.003,cz:-.077},{y:1.592,x:.009,z:.002,cz:-.076}], '#865e4b',3);
 loft([{y:1.588,x:.019,z:.001,cz:-.081},{y:1.5895,x:.018,z:.001,cz:-.081}], '#5a463b',3);
 const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,envMapIntensity:.18}));mesh.add(bones[0]);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);group.scale.setScalar(.94+random()*.1);
 const phase=random()*6.28;
 let streetGeometry=geometry;
 if(detail==='close'){const street=createHuman(seed,shirt,'street');streetGeometry=street.mesh.geometry;(street.mesh.material as THREE.Material).dispose();street.mesh.skeleton.dispose();}
 mesh.userData.lodGeometries=[geometry,streetGeometry];
 return {group,mesh,bones,setDetail(close){mesh.geometry=close?geometry:streetGeometry;},animate(time,walking,seated=false){const gait=time*4.7+phase;for(let i=0;i<2;i++){const swing=Math.sin(gait+i*Math.PI);bones[4+i*3].rotation.x=seated?Math.PI/2:walking?swing*.29:0;bones[5+i*3].rotation.x=seated?-Math.PI/2:walking?Math.max(0,-swing)*.51:0;bones[10+i*3].rotation.x=walking?-swing*.21:Math.sin(time*.5+phase)*.035;bones[11+i*3].rotation.x=.12;}bones[3].rotation.y=Math.sin(time*.37+phase)*.08;bones[1].rotation.z=walking?Math.sin(gait)*.012:0;}};
}

/** Bake an original seated driver once. No extra skeleton updates or bone textures in traffic. */
export function createSeatedDriver(seed:string,detail:'close'|'street'='close') {
 const human=createHuman(seed,'#a49576',detail);human.animate(0,false,true);
 for(const i of [10,13])human.bones[i].rotation.x=1.02;
 for(const i of [11,14])human.bones[i].rotation.x=.94;
 human.bones[10].rotation.z=.06;human.bones[13].rotation.z=-.06;
 human.group.updateMatrixWorld(true);human.mesh.skeleton.update();
 const geometry=human.mesh.geometry.clone(),p=geometry.attributes.position,n=geometry.attributes.normal,w=geometry.attributes.skinWeight,indices=geometry.attributes.skinIndex;
 const boneNormals=human.bones.map((b,i)=>new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().multiplyMatrices(b.matrixWorld,human.mesh.skeleton.boneInverses[i])));
 const inverseNormal=new THREE.Matrix3().getNormalMatrix(human.mesh.bindMatrixInverse),worldNormal=new THREE.Matrix3().getNormalMatrix(human.mesh.matrixWorld);
 const v=new THREE.Vector3(),source=new THREE.Vector3(),normal=new THREE.Vector3(),part=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);human.mesh.applyBoneTransform(i,v);v.applyMatrix4(human.mesh.matrixWorld);p.setXYZ(i,v.x,v.y,v.z);
  source.fromBufferAttribute(n,i);normal.set(0,0,0);
  for(let k=0;k<4;k++){const weight=w.getComponent(i,k);if(weight)normal.addScaledVector(part.copy(source).applyMatrix3(boneNormals[indices.getComponent(i,k)]),weight);}
  normal.applyNormalMatrix(inverseNormal).applyNormalMatrix(worldNormal);n.setXYZ(i,normal.x,normal.y,normal.z);
 }
 geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
 const result=new THREE.Mesh(geometry,human.mesh.material);result.castShadow=true;result.receiveShadow=true;
 for(const g of new Set(human.mesh.userData.lodGeometries as THREE.BufferGeometry[]))g.dispose();human.mesh.skeleton.dispose();return result;
}
