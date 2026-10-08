import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {clothingGeometry} from './ClothingGeometry';
import {seededRandom} from '../StreetArchitecture';

interface Ring {y:number;x:number;z:number;cx?:number;cz?:number;}
export interface Human {group:THREE.Group; mesh:THREE.SkinnedMesh; bones:THREE.Bone[]; animate:(time:number,walking:boolean,seated?:boolean)=>void;}
/** Original authored silhouette profiles, skin weights and motions; no third-party models. */
export function createHuman(seed:string,shirt:string):Human {
 const random=seededRandom(seed),group=new THREE.Group(),bones:THREE.Bone[]=[];
 const bone=(name:string,p:[number,number,number],parent?:number)=>{const b=new THREE.Bone();b.name=name;b.position.set(...p);if(parent!==undefined)bones[parent].add(b);bones.push(b);return bones.length-1;};
 bone('pelvis',[0,.91,0]);bone('spine',[0,.26,0],0);bone('neck',[0,.3,0],1);bone('head',[0,.12,0],2);
 for(const side of [-1,1]){const hip=bone(`hip${side}`,[side*.095,-.01,0],0);bone(`knee${side}`,[0,-.41,0],hip);bone(`ankle${side}`,[0,-.4,0],hip+1);}
 for(const side of [-1,1]){const shoulder=bone(`shoulder${side}`,[side*.205,.22,0],1);bone(`elbow${side}`,[side*.025,-.28,0],shoulder);bone(`wrist${side}`,[0,-.25,0],shoulder+1);}
 const skin=['#a77c5e','#bd9375','#88634d','#c4a080'][Math.floor(random()*4)],pants=['#495459','#64695d','#756b60'][Math.floor(random()*3)];
 const pieces:THREE.BufferGeometry[]=[];
 const loft=(rings:Ring[],color:string,boneIndex:number,next=boneIndex)=>{
  const vertices:number[]=[],normals:number[]=[],colors:number[]=[],indices:number[]=[],weights:number[]=[],uv:number[]=[],tri:number[]=[];const tint=new THREE.Color(color),segments=12;
  for(let r=0;r<rings.length;r++){const p=rings[r];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;vertices.push((p.cx??0)+Math.cos(a)*p.x,p.y,(p.cz??0)+Math.sin(a)*p.z);normals.push(Math.cos(a),0,Math.sin(a));colors.push(tint.r,tint.g,tint.b);uv.push(i/segments,r/(rings.length-1));indices.push(boneIndex,next,0,0);const blend=next===boneIndex?0:THREE.MathUtils.smoothstep(r/(rings.length-1),.35,.7);weights.push(1-blend,blend,0,0);if(r<rings.length-1&&i<segments){const n=r*(segments+1)+i;tri.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}}}
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setAttribute('normal',new THREE.Float32BufferAttribute(normals,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3)).setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)).setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4)).setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(tri);g.computeVertexNormals();pieces.push(g);
 };
 // Profiles include hem, waist, chest, sloping shoulders and collar rather than a cylinder torso.
 const clothing=clothingGeometry().clone(),clothColor=new THREE.Color(shirt),clothColors=[];for(let i=0;i<clothing.attributes.position.count;i++)clothColors.push(clothColor.r,clothColor.g,clothColor.b);clothing.setAttribute('color',new THREE.Float32BufferAttribute(clothColors,3));pieces.push(clothing);
 loft([{y:1.44,x:.047,z:.045},{y:1.52,x:.046,z:.047}],skin,2);
 loft([{y:1.52,x:.045,z:.045},{y:1.55,x:.073,z:.07,cz:-.012},{y:1.6,x:.095,z:.083},{y:1.68,x:.098,z:.09},{y:1.74,x:.079,z:.076},{y:1.775,x:.035,z:.034},{y:1.78,x:.001,z:.001}],skin,3);
 loft([{y:1.69,x:.098,z:.092,cz:.005},{y:1.745,x:.082,z:.079,cz:.007},{y:1.782,x:.038,z:.036},{y:1.789,x:.001,z:.001}],random()>.7?'#675747':'#302e2a',3);
 for(const [i,side] of [-1,1].entries()){
  const hip=4+i*3,shoulder=10+i*3,cx=side*.095;
  loft([{y:.06,x:.035,z:.055,cx},{y:.11,x:.049,z:.065,cx},{y:.35,x:.053,z:.056,cx},{y:.51,x:.061,z:.061,cx},{y:.72,x:.081,z:.077,cx},{y:.93,x:.089,z:.089,cx},{y:.96,x:.06,z:.068,cx}],pants,hip+1,hip);
  loft([{y:.027,x:.048,z:.105,cx,cz:-.035},{y:.056,x:.065,z:.145,cx,cz:-.045},{y:.104,x:.055,z:.115,cx,cz:-.035},{y:.13,x:.038,z:.053,cx}], '#363b39',hip+2);
  loft([{y:.82,x:.031,z:.038,cx:side*.23},{y:.88,x:.031,z:.032,cx:side*.23},{y:1.01,x:.047,z:.047,cx:side*.23},{y:1.17,x:.047,z:.049,cx:side*.23}],skin,shoulder+1,shoulder);
  loft([{y:.745,x:.018,z:.02,cx:side*.23},{y:.77,x:.03,z:.023,cx:side*.23},{y:.83,x:.034,z:.028,cx:side*.23},{y:.86,x:.027,z:.026,cx:side*.23}],skin,shoulder+2);
 }
 for(const side of [-1,1])loft([{y:1.648,x:.002,z:.003,cx:side*.03,cz:-.084},{y:1.655,x:.006,z:.004,cx:side*.03,cz:-.086},{y:1.662,x:.002,z:.003,cx:side*.03,cz:-.084}], '#312d28',3);
 loft([{y:1.616,x:.008,z:.009,cz:-.095},{y:1.628,x:.012,z:.014,cz:-.096},{y:1.65,x:.006,z:.006,cz:-.088}],skin,3);
 const geometry=mergeGeometries(pieces)!;pieces.forEach(g=>g.dispose());
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86}));mesh.add(bones[0]);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);group.scale.setScalar(.94+random()*.1);
 const phase=random()*6.28;
 return {group,mesh,bones,animate(time,walking,seated=false){const gait=time*5.3+phase;for(let i=0;i<2;i++){const swing=Math.sin(gait+i*Math.PI);bones[4+i*3].rotation.x=seated?-Math.PI/2:walking?swing*.31:0;bones[5+i*3].rotation.x=seated?Math.PI/2:walking?Math.max(0,-swing)*.51:0;bones[10+i*3].rotation.x=walking?-swing*.23:Math.sin(time*.5+phase)*.04;bones[11+i*3].rotation.x=-.15;}bones[3].rotation.y=Math.sin(time*.37+phase)*.1;bones[1].rotation.z=walking?Math.sin(gait)*.015:0;}};
}
