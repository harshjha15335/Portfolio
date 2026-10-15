import * as THREE from 'three';
import {BakedKit} from './BakedKit';

/**
 * Street dressing that belongs to the place: parked two-wheelers, pasted posters, cable coils,
 * rubbish and roof tanks. All parts are baked into one batch on the shared baked material
 * (one draw, no textures, no programs). World metres unless a frame is given.
 */
type Triple=[number,number,number];
const M=BakedKit.matrix;
const tyre=new THREE.TorusGeometry(1,.3,3,9),hub=new THREE.CylinderGeometry(1,1,1,6),drum=new THREE.CylinderGeometry(1,1,1,8),bag=new THREE.IcosahedronGeometry(1,1),coil=new THREE.TorusGeometry(1,.1,3,12);
const plane=new THREE.PlaneGeometry(1,1);
const tank=new THREE.LatheGeometry([[0,0],[.5,0],[.56,.06],[.56,.3],[.53,.34],[.56,.38],[.56,.7],[.53,.74],[.56,.78],[.56,.94],[.42,1.05],[0,1.1]].map(([x,y])=>new THREE.Vector2(x,y)),9);

export type TwoWheeler='scooter'|'motorcycle';
/** Activa-style scooter or commuter motorcycle on its stand, about 450 triangles. */
export function twoWheeler(kit:BakedKit,x:number,z:number,yaw:number,kind:TwoWheeler,body:string){
 const frame=new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,.06)),new THREE.Vector3(1,1,1));
 const part=(size:Triple,p:Triple,color:string,surface:'metal'|'solid'|'fabric'='solid',rot:Triple=[0,0,0])=>kit.box(size,p,color,surface,'none',rot,frame);
 // Only the main body shell is chamfered; small parts stay plain boxes to keep the prop cheap.
 const round=(size:Triple,p:Triple,color:string,r:number,surface:'metal'|'solid'='solid',rot:Triple=[0,0,0],chamfer=false)=>chamfer?kit.bevel(size,p,color,surface,r,'none',rot,frame):kit.box(size,p,color,surface,'none',rot,frame);
 const r=kind==='scooter'?.2:.25,wz=kind==='scooter'?.6:.66,wy=r+.06;
 for(const s of [-1,1]){
  kit.add(tyre,M([r,r,r*1.15],[0,wy,s*wz],[0,Math.PI/2,0]),'#1b1d1e','solid','none',frame);
  kit.add(hub,M([r*.55,.08,r*.55],[0,wy,s*wz],[0,0,Math.PI/2]),'#8d8f8a','metal','none',frame);
 }
 const mirror=(y:number,zz:number)=>{for(const s of [-1,1]){part([.012,.2,.012],[s*.25,y+.1,zz],'#2a2b2c','metal',[0,0,-s*.3]);part([.09,.06,.02],[s*.3,y+.2,zz],'#2a2b2c','metal');}};
 if(kind==='scooter'){
  round([.4,.42,.74],[0,.56,-.3],body,.12,'metal',[0,0,0],true);
  round([.44,.66,.11],[0,.64,.44],body,.05,'metal',[-.22,0,0]);
  part([.16,.13,.42],[0,.43,.6],body,'metal',[.25,0,0]);
  part([.36,.06,.5],[0,.31,.1],'#2a2c2c');
  round([.3,.1,.62],[0,.81,-.26],'#1e1f1f',.04);
  part([.05,.46,.05],[0,.82,.47],'#3a3c3c','metal',[-.3,0,0]);
  round([.26,.14,.15],[0,1.03,.44],body,.04,'metal');part([.13,.06,.02],[0,1.03,.52],'#e9e3c9');
  part([.64,.034,.034],[0,1.07,.4],'#262728','metal');mirror(1.07,.38);
  part([.18,.05,.03],[0,.66,-.68],'#9b2a22');part([.18,.1,.012],[0,.5,-.68],'#e9e4d2');
 } else {
  round([.3,.21,.46],[0,.84,.16],body,.08,'metal',[0,0,0],true);
  for(const s of [-1,1])part([.07,.18,.26],[s*.13,.66,-.12],body,'metal');
  part([.24,.25,.3],[0,.43,.1],'#3b3d3e','metal');for(let n=0;n<3;n++)part([.27,.018,.2],[0,.37+n*.06,.16],'#56595a','metal');
  kit.add(drum,M([.04,.8,.04],[.17,.33,-.27],[Math.PI/2-.08,0,0]),'#a3a39b','metal','none',frame);
  round([.26,.09,.62],[0,.9,-.33],'#1d1d1d',.035);
  part([.05,.05,.8],[0,.72,.06],'#2b2b2b','metal',[.25,0,0]);
  for(const s of [-1,1])part([.035,.62,.035],[s*.08,.63,.55],'#9a9b96','metal',[-.42,0,0]);
  kit.add(drum,M([.085,.1,.085],[0,1.0,.67],[Math.PI/2,0,0]),'#9a9b96','metal','none',frame);part([.12,.12,.012],[0,1.0,.725],'#e9e3c9');
  part([.7,.03,.03],[0,1.12,.5],'#262728','metal');mirror(1.12,.48);
  part([.24,.025,.3],[0,.93,-.66],'#2b2b2b','metal');part([.12,.04,.42],[0,.62,-.62],body,'metal',[.5,0,0]);
  part([.06,.06,.5],[-.12,.36,-.32],'#2b2b2b','metal');part([.16,.05,.03],[0,.78,-.86],'#9b2a22');part([.18,.1,.012],[0,.64,-.86],'#e9e4d2');
 }
 part([.03,.3,.03],[.16,.16,-.12],'#2b2b2b','metal',[0,0,.38]);
}

/** Layered, partly torn posters pasted on a flat surface; `frame` faces +Z at the surface. */
export function posters(kit:BakedKit,frame:THREE.Matrix4,width:number,height:number,random:()=>number){
 const palettes=[['#d9c9a0','#b23a2e','#2c2b2a'],['#e2d8c2','#2f5d7c','#d39a2f'],['#c6b48e','#5f7d3c','#8e2f2f'],['#efe6cf','#1f1f1f','#c9452f'],['#d6a33e','#3a2d2a','#efe3c8']];
 let x=-width/2,layer=0;
 while(x<width/2-.12){
  const w=Math.min(.3+random()*.18,width/2-x),h=Math.min(height,.36+random()*.22),y=(random()-.5)*(height-h)*.6,[base,band,ink]=palettes[Math.floor(random()*palettes.length)],z=.002+layer%3*.002;
  kit.add(plane,M([w,h,1],[x+w/2,y,z]),base,'fabric','none',frame,.08);
  kit.add(plane,M([w*.86,h*.24,1],[x+w/2,y+h*.22,z+.0008]),band,'fabric','none',frame,.08);
  kit.add(plane,M([w*.6,h*.09,1],[x+w/2,y-h*.18,z+.0008]),ink,'fabric','none',frame,.05);
  // Torn lower corner shows the layer beneath.
  if(random()>.5)kit.add(plane,M([w*.32,h*.22,1],[x+w*.82,y-h*.36,z+.0012],[0,0,.5]),'#8f8a7c','fabric','none',frame,.1);
  x+=w*(.72+random()*.2);layer++;
 }
}

/** Coiled spare cable hung on a pole: the classic Mumbai junction tangle. */
export function cableCoil(kit:BakedKit,x:number,y:number,z:number,outward:number){
 for(let n=0;n<2;n++)kit.add(coil,M([.22-n*.04,.3-n*.05,.22-n*.04],[x+outward*(.12+n*.03),y-n*.12,z],[0,Math.PI/2,.2*n]),'#151617','metal','none');
}

/** Tied refuse bags and a flattened carton beside street furniture. */
export function rubbish(kit:BakedKit,x:number,z:number,random:()=>number){
 for(let n=0;n<3;n++){const r=.17+random()*.06;kit.add(bag,M([r,r*.78,r*1.1],[x+(random()-.5)*.35,r*.7,z+(n-1)*.28],[0,random()*3,0]),n===1?'#2f4a39':'#1d2021','solid','none');}
 kit.box([.42,.03,.32],[x-.05,.03,z+.5],'#9e815a','solid','none',[0,.5,0]);
}

/** Black Sintex tank on an angle-iron stand; `frame` sits on the roof slab. */
export function roofTank(kit:BakedKit,frame:THREE.Matrix4,scale=1){
 for(const dx of [-.4,.4])for(const dz of [-.4,.4])kit.box([.05,.55,.05],[dx*scale,.28,dz*scale],'#3b3e3a','metal','part',[0,0,0],frame);
 kit.box([.92*scale,.05,.92*scale],[0,.57,0],'#3b3e3a','metal','part',[0,0,0],frame);
 kit.add(tank,M([scale,scale,scale],[0,.6,0]),'#1d2020','solid','none',frame);
}
