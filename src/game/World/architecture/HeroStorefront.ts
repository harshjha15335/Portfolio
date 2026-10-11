import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {StreetMaterials, Surface} from '../StreetMaterials';

/** Original authored Irani café frontage; local metres, +Z faces the pavement.
 * Bake individual prop transforms into surface batches, retaining their shapes/UVs.
 * Decoration stays behind the original collision plane. No new traversable shop.
 */
export function createHeroStorefront(_surfaces:StreetMaterials){
 const atlas=surfaceAtlas();
 const group=new THREE.Group();group.name='Irani Chai · hero storefront';
 const batches=new Map<Surface,THREE.BufferGeometry[]>();
 const box=new THREE.BoxGeometry(1,1,1), sphere=new THREE.SphereGeometry(1,16,10);
 const cylinder=new THREE.CylinderGeometry(1,1,1,32);
 const cup=new THREE.LatheGeometry([new THREE.Vector2(.033,0),new THREE.Vector2(.037,.006),new THREE.Vector2(.041,.065),new THREE.Vector2(.039,.07),new THREE.Vector2(.033,.064),new THREE.Vector2(.029,.013)],16);
 const kettle=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.11,0),new THREE.Vector2(.15,.055),new THREE.Vector2(.17,.14),new THREE.Vector2(.145,.24),new THREE.Vector2(.10,.285),new THREE.Vector2(.09,.29)],20);
 const jar=new THREE.LatheGeometry([new THREE.Vector2(.07,0),new THREE.Vector2(.087,.02),new THREE.Vector2(.09,.18),new THREE.Vector2(.08,.23),new THREE.Vector2(.065,.25)],20);
 const torus=new THREE.TorusGeometry(1,.08,6,24);
 const loaf=new THREE.SphereGeometry(1,14,7);
 const paint=new THREE.Shape();paint.moveTo(-3.91,.10);paint.lineTo(-3.82,.45);paint.lineTo(-3.68,.62);paint.lineTo(-3.84,.73);paint.lineTo(-3.70,1.13);paint.lineTo(-3.89,1.27);paint.lineTo(-3.92,1.65);paint.lineTo(-4.02,1.60);paint.lineTo(-4.02,.1);
 const flake=new THREE.ShapeGeometry(paint);
 const add=(geo:THREE.BufferGeometry,size:[number,number,number],pos:[number,number,number],color:string,surface:Surface='solid',rotation:[number,number,number]=[0,0,0])=>{
  const g=geo.clone(),m=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...size));g.applyMatrix4(m);
  const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));const finish={solid:[.83,0],wood:[.78,0],stone:[.85,0],plaster:[.96,0],fabric:[.98,0],metal:[.43,.48],glass:[.18,0],asphalt:[.98,0],paving:[.9,0],glow:[1,0],foliage:[.87,0]}[surface];const f=new Float32Array(g.attributes.position.count*2);for(let i=0;i<f.length;i+=2){f[i]=finish[0];f[i+1]=finish[1];}g.setAttribute('heroFinish',new THREE.BufferAttribute(f,2));if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  const region=surface==='wood'?0:surface==='fabric'?1:surface==='metal'?2:surface==='glass'?3:surface==='plaster'?4:5;const uvs=g.attributes.uv;for(let i=0;i<uvs.count;i++)uvs.setXY(i,((region%3)+.04+uvs.getX(i)*.92)/3,1-(Math.floor(region/3)+.04+uvs.getY(i)*.92)/2);
  const list=batches.get(surface)??[];list.push(g);batches.set(surface,list);
 };
 const b=(size:[number,number,number],pos:[number,number,number],color:string,surface:Surface='solid',rot:[number,number,number]=[0,0,0])=>add(box,size,pos,color,surface,rot);
 // Four-metre-deep view, a blackened kitchen portal and tiled counter, rather than identical shelves.
 b([8.2,.06,2.18],[0,.04,-1.05],'#beb4a0','stone');
 b([8.1,2.36,.09],[0,1.22,-2.20],'#c9c0a6','plaster');
 b([1.25,2.15,.018],[.5,1.16,-2.145],'#394440','wood');
 b([8.1,.68,.08],[0,.4,-2.11],'#546b61','wood');
 for(const x of [-4.05,-.3,4.05]){b([.15,2.45,.68],[x,1.24,-.27],'#6c7664','wood');b([.23,.11,.81],[x,2.49,-.24],'#b9ab87','stone');}
 b([7.9,.19,.70],[0,2.59,-.22],'#adab8d','stone');
 add(flake,[1,1,1],[0,0,.11],'#d7c8a7','plaster');
 // Recessed, skewed chalkboard and layered painted timber board with real depth.
 b([3.64,.52,.12],[-1.87,2.90,.03],'#304d45','wood',[0,0,-.012]);
 b([3.74,.04,.16],[-1.87,3.16,.06],'#a39571','wood',[0,0,-.012]);
 b([3.7,.04,.16],[-1.87,2.65,.06],'#a39571','wood',[0,0,-.012]);
 b([.75,.95,.07],[-3.75,1.60,-.15],'#b09d77','wood',[0,.1,-.06]);
 b([.65,.85,.012],[-3.75,1.6,-.10],'#31433c','solid',[0,.1,-.06]);
 // Uneven cloth canopy: ten sagging spans, dark underside, individual valance curve.
 const points: number[]=[],uv:number[]=[],indices:number[]=[];
 for(let i=0;i<=16;i++)for(let j=0;j<=5;j++){const x=-4+i*.5,t=j/5;points.push(x,2.49-t*.23-Math.sin(t*Math.PI)*(.08+.025*Math.sin(i*1.7)),.13+t*1.0);uv.push(i/4,t);}
 for(let i=0;i<16;i++)for(let j=0;j<5;j++){const n=i*6+j;indices.push(n,n+6,n+1,n+6,n+7,n+1);}
 const canopy=new THREE.BufferGeometry();canopy.setAttribute('position',new THREE.Float32BufferAttribute(points,3));canopy.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));canopy.setIndex(indices);canopy.computeVertexNormals();add(canopy,[1,1,1],[0,0,0],'#b8aa86','fabric');
 b([.026,.026,8.05],[0,2.26,1.14],'#536157','metal',[0,Math.PI/2,0]);
 for(const x of [-3.85,3.85])b([.035,.035,1.16],[x,2.48,.58],'#576155','metal',[-.19,0,0]);
 // One display, an exposed preparation area and a seated customer bay.
 b([2.0,.78,.62],[2.40,.43,-.36],'#e0d4b4','stone');
 b([2.15,.06,.79],[2.4,.85,-.28],'#b9a985','stone');
 b([2.14,.045,.63],[2.4,1.18,-.34],'#867b60','metal');
 b([2.04,.28,.018],[2.4,1.02,.02],'#a0ada2','glass');
 for(const x of [1.35,3.43])b([.025,.35,.55],[x,1.02,-.28],'#58675c','metal');
 // Individually placed buns with scored tops: differing scales, orientations and spacing.
 const buns=[[1.58,.89,-.29,.11,.14,.14],[1.96,.89,-.35,.14,.14,-.18],[2.29,.89,-.32,.10,.12,.07],[2.62,.89,-.31,.13,.14,-.22],[3.06,.89,-.35,.12,.16,.12],[2.84,.89,-.57,.09,.11,-.3]];
 for(const [x,y,z,rx,rz,angle] of buns){add(loaf,[rx,.062,rz],[x,y+.058,z],'#b48c51','wood',[0,angle,0]);for(const dx of [-.028,.025])b([.008,.004,rz*1.1],[x+dx,y+.119,z],'#dac29a','wood',[0,angle,0]);}
 // Kettle, spout, bent handle, cups, saucers and half-used biscuit jars.
 b([2.1,.065,.64],[-.4,.88,-1.4],'#a39576','wood');
 add(kettle,[1,1,1],[-.65,.92,-1.39],'#9b9a83','metal');
 add(cylinder,[.017,.22,.017],[-.46,1.08,-1.39],'#a7a28a','metal',[0,0,-.85]);
 add(torus,[.145,.145,.145],[-.81,1.09,-1.39],'#42564c','metal',[0,Math.PI/2,0]);
 add(cylinder,[.105,.022,.105],[-.65,1.22,-1.39],'#a19c84','metal');
 add(sphere,[.027,.018,.027],[-.65,1.25,-1.39],'#43514a','solid');
 for(const [x,z,angle] of [[-.02,-1.32,.13],[.18,-1.4,-.2],[-.26,-1.52,.3]]){add(cylinder,[.065,.006,.065],[x,.918,z],'#ded2b4','stone');add(cup,[1,1,1],[x,.926,z],'#d8cdb0','stone');add(torus,[.022,.025,.022],[x+.043,.96,z],'#d8cdb0','stone',[0,Math.PI/2+angle,0]);add(cylinder,[.031,.004,.031],[x,.981,z],'#956d40','wood');}
 for(const [x,z] of [[1.53,-1.45],[1.78,-1.49],[2.11,-1.44]]){add(jar,[1,1,1],[x,.92,z],'#b3aa88','glass');add(cylinder,[.079,.02,.079],[x,1.18,z],'#879280','metal');for(let i=0;i<3;i++)add(loaf,[.06,.022,.057],[x,.96+i*.048,z],'#b59b69','wood');}
 // Wall menu, conduit with switch, worn stools, mismatched café table.
 b([1.47,.85,.06],[-2.3,1.72,-2.05],'#aa9774','wood');
 b([1.35,.74,.014],[-2.3,1.72,-2.012],'#354b42','solid');
 for(const [x,z,r] of [[-2.65,-.45,.05],[-1.35,-1.24,-.12]]){add(cylinder,[.31,.048,.31],[x,.74,z],'#8e7755','wood');for(let n=0;n<4;n++){const a=n*Math.PI/2+r;b([.045,.7,.045],[x+Math.cos(a)*.19,.35,z+Math.sin(a)*.19],'#657267','metal',[.06*Math.cos(a),0,.06*Math.sin(a)]);}add(torus,[.20,.20,.20],[x,.24,z],'#596d60','metal',[Math.PI/2,0,0]);}
 b([1.13,.054,.70],[-2.18,.86,-1.26],'#b4a17b','wood',[0,.08,0]);
 for(const dx of [-.42,.42])for(const dz of [-.23,.23])b([.055,.84,.055],[-2.18+dx,.42,-1.26+dz],'#687566','metal');
 b([.1,1.65,.07],[3.87,1.43,-.18],'#8d9683','metal');b([.18,.23,.045],[3.87,1.14,-.12],'#d0c7ad','stone');
 // Drain channel and irregular threshold scuff strips; no pavement obstruction.
 b([7.95,.023,.18],[0,.087,.36],'#67756b','metal');
 for(let n=0;n<18;n++)b([.022,.002,.12],[-3.65+n*.42,.10,.36],'#283d39','solid');
 const glass=batches.get('glass')??[];batches.delete('glass');
 const list=[...batches.values()].flat(),geometry=mergeGeometries(list)!;
 const material=new THREE.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:1,metalness:1,side:THREE.DoubleSide});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec2 heroFinish; varying vec2 vHeroFinish;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHeroFinish = heroFinish;');
  shader.fragmentShader='varying vec2 vHeroFinish;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = vHeroFinish.x;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = vHeroFinish.y;');
 };
 material.customProgramCacheKey=()=> 'hero-finish-v1';
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);list.forEach(g=>g.dispose());
 if(glass.length){const glassGeometry=mergeGeometries(glass)!;const glassMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.14,metalness:0,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});const pane=new THREE.Mesh(glassGeometry,glassMaterial);pane.receiveShadow=true;group.add(pane);glass.forEach(g=>g.dispose());}
 [box,sphere,cylinder,cup,kettle,jar,torus,loaf,flake,canopy].forEach(g=>g.dispose());
 return group;
}

/** Original small surface atlas: region-specific wear, no third-party images. */
function surfaceAtlas(){
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;const c=canvas.getContext('2d')!;
 c.fillStyle='#f5f2e8';c.fillRect(0,0,384,256);
 let state=94623;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 for(let region=0;region<6;region++){const x=region%3*128,y=Math.floor(region/3)*128;
  for(let i=0;i<1300;i++){const alpha=region===3?0:region===0?.11:region===4?.06:.04;c.fillStyle=`rgba(87,82,67,${random()*alpha})`;c.fillRect(x+random()*128,y+random()*128,1+random()*2,region===0?9+random()*25:1+random()*3);}
  if(region===1){c.strokeStyle='#8d897a10';for(let j=0;j<128;j+=3){c.beginPath();c.moveTo(x+j,y);c.lineTo(x+j,y+128);c.moveTo(x,y+j);c.lineTo(x+128,y+j);c.stroke();}}
  if(region===2){c.strokeStyle='#928b761b';for(let j=0;j<18;j++){const yy=y+random()*128;c.beginPath();c.moveTo(x+random()*70,yy);c.lineTo(x+80+random()*40,yy+random()*2);c.stroke();}}
  if(region===4){for(let i=0;i<6;i++){c.fillStyle='#93836314';c.beginPath();c.ellipse(x+random()*128,y+random()*128,6+random()*14,12+random()*23,random(),0,Math.PI*2);c.fill();}}
 }
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
