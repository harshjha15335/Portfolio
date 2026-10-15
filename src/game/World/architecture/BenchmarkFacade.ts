import * as THREE from 'three';
import {BakedKit} from './BakedKit';
import {seededRandom,type FacadeSpec} from '../StreetArchitecture';

type Triple=[number,number,number];
export interface BenchmarkFacade {group:THREE.Group;plaque:{position:Triple;width:number};triangles:number;detail:THREE.Mesh|null;detailTriangles:number;centre:THREE.Vector3}

const WALL='#cbb28c',TRIM='#e2d5b8',BAND='#d6c6a3',CONCRETE='#a59c8c',GRILL='#2b3230',RAIL='#27302c',GRIME='#4f493d';
const LEAF=['#e0d6bd','#5b7a6e','#7b5b3c','#e0d6bd'],CURTAIN=['#8c4b3f','#c9b98e','#56707a','#9c7a4c','#6f5d7a'];

/**
 * Radio House: the quality benchmark for CST–Fort façades (above the RADIO REPAIR shop).
 * A 1930s Bombay Deco walk-up authored in code: real window openings with reveals, casements,
 * louvred shutters, box grilles, rounded balconies with railings, sunshades, bevelled bands,
 * services and roof tanks. Everything bakes into one opaque and one glass batch on the shared
 * café material, so it costs two draws, no textures and no shader programs. Local metres; +Z faces
 * the street, y=3.2 is the top of the ground-floor shop that MumbaiStreet still builds.
 */
export function createBenchmarkFacade(spec:FacadeSpec):BenchmarkFacade {
 const random=seededRandom(`${spec.seed}:benchmark`),kit=new BakedKit(random);
 const W=spec.width,half=W/2,FH=spec.floorHeight,base=3.2,top=base+spec.floors*FH;
 const pick=<T,>(list:T[])=>list[Math.floor(random()*list.length)];
 const sphere=new THREE.IcosahedronGeometry(1,0),cylinder=new THREE.CylinderGeometry(1,1,1,8),pot=new THREE.CylinderGeometry(1,.72,1,8),ring=new THREE.TorusGeometry(1,.07,4,14);
 const tank=new THREE.LatheGeometry([[0,0],[.5,0],[.56,.06],[.56,.24],[.53,.28],[.56,.32],[.56,.56],[.53,.6],[.56,.64],[.56,.92],[.46,1.04],[.18,1.1],[0,1.1]].map(([x,y])=>new THREE.Vector2(x,y)),10);
 const M=BakedKit.matrix;

 // Corner pilasters, Deco fins framing the balcony bay and the band over the shop.
 for(const s of [-1,1]){
  kit.bevel([.4,top-base+1,.18],[s*(half-.2),(top+base+1)/2,.07],TRIM,'stone',.04);
  kit.bevel([.52,.22,.26],[s*(half-.2),top+1.08,.08],TRIM,'stone',.04);
  kit.bevel([.17,top-base+2.05,.42],[s*1.56,(top+base+2.05)/2,.11],TRIM,'stone',.035);
  for(let n=0;n<3;n++)kit.box([.17-n*.035,.16,.42-n*.07],[s*1.56,top+2.13+n*.15,.11-n*.03],TRIM,'stone');
 }
 kit.bevel([W+.12,.2,.32],[0,base+.06,.12],BAND,'stone',.03);
 kit.box([W+.1,.025,.03],[0,base-.06,.27],GRIME,'solid','none');

 for(let floor=0;floor<spec.floors;floor++){
  const y0=base+floor*FH,y1=y0+FH,repaint=floor===2;
  const wall=repaint?'#c5b996':WALL;
  const windows=[{cx:-2.75,w:1.45},{cx:2.75,w:1.45}],sill=y0+.8,head=y0+2.28,door={w:1.25,top:y0+2.26};
  // Wall built around real openings: piers, spandrels and lintels, 0.3 m deep reveals.
  for(const [a,b] of [[-half+.02,-3.475],[-2.025,-.625],[.625,2.025],[3.475,half-.02]])kit.box([b-a,FH,.3],[(a+b)/2,y0+FH/2,-.15],wall,'plaster','wall');
  for(const {cx,w} of windows){kit.box([w,sill-y0,.3],[cx,(y0+sill)/2,-.15],wall,'plaster','wall');kit.box([w,y1-head,.3],[cx,(head+y1)/2,-.15],wall,'plaster','wall');}
  kit.box([door.w+.1,y1-door.top,.3],[0,(door.top+y1)/2,-.15],wall,'plaster','wall');
  // Floor band: a projecting moulding with a shadow groove, not a flat stripe.
  if(floor>0){kit.bevel([W-.7,.14,.16],[0,y0+.02,.07],BAND,'stone',.03);kit.box([W-.72,.022,.02],[0,y0-.07,.14],GRIME,'solid','none');}

  for(const [i,{cx,w}] of windows.entries()){
   const h=head-sill,variant=(floor*2+i+1)%5,frame=new THREE.Matrix4().makeTranslation(cx,sill,-.2);
   // Dim room behind the glass, sometimes a drawn curtain.
   kit.box([w+.7,h+.6,.02],[cx,sill+h/2,-.79],'#1c1f1d','solid','none');
   if(random()>.35)kit.box([w*(.35+random()*.35),h*.92,.02],[cx+(random()>.5?1:-1)*w*.22,sill+h*.48,-.55],pick(CURTAIN),'fabric','recess');
   const leaf=pick(LEAF);
   // Frame, transom, fanlight bars and glass.
   for(const s of [-1,1])kit.box([.07,h,.12],[s*(w/2-.035),h/2,0],leaf,'wood','recess',[0,0,0],frame);
   kit.box([w,.07,.12],[0,h-.035,0],leaf,'wood','recess',[0,0,0],frame);kit.box([w,.06,.12],[0,.03,0],leaf,'wood','recess',[0,0,0],frame);
   kit.box([w-.1,.05,.1],[0,h*.7,0],leaf,'wood','recess',[0,0,0],frame);
   kit.detail=true;for(const fx of [-.33,0,.33])kit.box([.024,h*.3-.08,.04],[fx*w,h*.85,0],leaf,'wood','recess',[0,0,0],frame);kit.detail=false;
   kit.box([w-.1,h*.3-.08,.01],[0,h*.85,-.01],'#9fb0ad','glass','none',[0,0,0],frame);
   // Casement sashes are near detail: from across the street the frame and glass carry the read.
   const lw=(w-.14)/2,lh=h*.7-.09,open=[0,.55,.95,0,.3][variant];kit.detail=true;
   for(const s of [-1,1]){
    const hinge=new THREE.Matrix4().makeTranslation(s*(w/2-.07),.06,0).multiply(new THREE.Matrix4().makeRotationY(s<0?open*(i?1:.6):-open*(i?.4:1)));
    const leafFrame=frame.clone().multiply(hinge),cxl=-s*lw/2;
    for(const e of [-1,1])kit.box([.045,lh,.05],[cxl+e*(lw/2-.022),lh/2,0],leaf,'wood','recess',[0,0,0],leafFrame);
    for(const y of [.022,lh-.022,lh*.36,lh*.68])kit.box([lw,y===.022||y>lh-.03?.045:.022,.04],[cxl,y,0],leaf,'wood','recess',[0,0,0],leafFrame);
    kit.box([lw-.05,lh-.05,.01],[cxl,lh/2,0],'#93a7a6','glass','none',[0,0,0],leafFrame);
   }
   kit.detail=false;
   // Moulded sill with drip groove and a sloping concrete chajja on brackets.
   kit.bevel([w+.3,.08,.33],[cx,sill-.03,.1],TRIM,'stone',.025);kit.box([w+.24,.018,.02],[cx,sill-.085,.23],GRIME,'solid','none');
   kit.box([w+.6,.085,.64],[cx,head+.22,.28],CONCRETE,'stone','part',[.1,0,0]);
   for(const s of [-1,1])kit.box([.07,.2,.42],[cx+s*(w/2+.16),head+.08,.18],CONCRETE,'stone');
   kit.streak(cx-w/2-.2,head+.16,.9+random()*.8,.16,.006,GRIME,wall,.75);kit.streak(cx+w/2+.2,head+.16,.6+random()*.9,.13,.006,GRIME,wall,.65);
   kit.streak(cx+(random()-.5)*w*.6,sill-.08,.7+random()*.7,.22,.006,GRIME,wall,.6);
   if(variant===1||variant===3){
    // Mumbai box grille with a planter shelf, pots and a tulsi.
    const z0=.02,d=.44,gy=.04,gh=h+.08;
    for(const sx of [-1,1])for(const sz of [z0,z0+d])kit.box([.03,gh,.03],[cx+sx*(w/2+.05),sill+gy+gh/2,sz],GRILL,'metal','part');
    kit.detail=true;
    for(let n=1;n<11;n++)kit.box([.014,gh,.014],[cx-w/2-.05+n*(w+.1)/11,sill+gy+gh/2,z0+d],GRILL,'metal','none');
    for(const y of [.32,.9,gh-.02])for(const sx of [-1,1]){kit.box([w+.13,.022,.022],[cx,sill+gy+y,z0+d],GRILL,'metal','none');kit.box([.022,.022,d],[cx+sx*(w/2+.05),sill+gy+y,z0+d/2],GRILL,'metal','part');}
    kit.detail=false;
    kit.box([w+.16,.035,d+.04],[cx,sill+gy,z0+d/2],GRILL,'metal','part');
    kit.box([w+.3,.03,d+.18],[cx,sill+gy+gh+.03,z0+d/2+.04],'#68706b','metal','part',[.12,0,0]);
    kit.detail=true;
    for(let n=0;n<3;n++){const px=cx-w*.32+n*w*.32+(random()-.5)*.08,r=.08+random()*.04;
     kit.add(pot,M([r,r*1.6,r],[px,sill+gy+.02+r*.8,z0+d*.55]),'#a35a3b','stone','none');
     for(let l=0;l<3;l++)kit.add(sphere,M([r*1.15,r*1.3,r*1.1],[px+(random()-.5)*r,sill+gy+r*1.9+l*r*.6,z0+d*.55+(random()-.5)*r]),l%2?'#4e6a39':'#5f7a43','foliage','none');}
    kit.detail=false;
   } else {
    // Louvred timber shutters: open against the wall, half-swung, or closed.
    const sw=w/2,sh=h*.7+.03,state=variant===4?'closed':variant===2?'swing':'open';
    for(const s of [-1,1]){
     const angle=state==='closed'?0:state==='swing'?s*-(Math.PI-1.05):s*-(Math.PI-.3);
     const hinge=new THREE.Matrix4().makeTranslation(cx+s*(w/2+.01),sill+.04,.05).multiply(new THREE.Matrix4().makeRotationY(angle));
     const cxs=-s*sw/2,shut=pick(['#5d7d71','#6b8a7c','#55706a']);
     for(const e of [-1,1])kit.box([.05,sh,.045],[cxs+e*(sw/2-.025),sh/2,0],shut,'wood','part',[0,0,0],hinge);
     for(const y of [.025,sh-.025])kit.box([sw,.05,.045],[cxs,y,0],shut,'wood','part',[0,0,0],hinge);
     kit.box([sw-.09,sh-.08,.012],[cxs,sh/2,-.012],'#3b4a44','wood','recess',[0,0,0],hinge);
     kit.detail=true;for(let n=0;n<8;n++)kit.box([sw-.08,.028,.07],[cxs,.1+n*(sh-.18)/7,0],shut,'wood','part',[.62,0,0],hinge);kit.detail=false;
    }
   }
   if((floor+i)%3===1){
    // Split AC outdoor unit on brackets, refrigerant pipe and its drip stain.
    const ay=sill-.42;kit.box([.8,.52,.28],[cx,ay,.24],'#d7d4c6','solid');
    kit.detail=true;kit.add(ring,M([.17,.17,.17],[cx-.12,ay,.385]),'#7f837d','metal','none');for(const r of [0,Math.PI/2])kit.box([.33,.016,.012],[cx-.12,ay,.385],'#7f837d','metal','none',[0,0,r+.4]);
    for(const s of [-1,1]){kit.box([.04,.04,.36],[cx+s*.3,ay-.28,.18],'#4b4f4b','metal','part');kit.box([.04,.3,.04],[cx+s*.3,ay-.15,.02],'#4b4f4b','metal','part',[.6,0,0]);}
    kit.add(cylinder,M([.012,.5,.012],[cx+.36,ay+.42,.12]),'#b07a52','metal','none');kit.detail=false;
    kit.streak(cx+.2,ay-.3,1.1+random()*.5,.12,.006,'#3e4a45',wall,.8);
   }
  }

  // Balcony door: timber frame, panelled lower leaves, one leaf open, curtain behind.
  const dh=door.top-y0-.04,frame=new THREE.Matrix4().makeTranslation(0,y0+.04,-.2),leaf=pick(LEAF);
  kit.box([door.w+.8,dh+.4,.02],[0,y0+dh/2,-.79],'#1c1f1d','solid','none');
  if(random()>.3)kit.box([door.w*.5,dh*.95,.02],[(random()>.5?.3:-.3),y0+dh*.5,-.6],pick(CURTAIN),'fabric','recess');
  for(const s of [-1,1])kit.box([.08,dh,.13],[s*(door.w/2-.04),dh/2,0],leaf,'wood','recess',[0,0,0],frame);
  kit.box([door.w,.08,.13],[0,dh-.04,0],leaf,'wood','recess',[0,0,0],frame);
  kit.box([door.w-.12,.05,.1],[0,dh*.82,0],leaf,'wood','recess',[0,0,0],frame);kit.box([door.w-.12,dh*.18-.09,.01],[0,dh*.91,-.01],'#9fb0ad','glass','none',[0,0,0],frame);
  const dlw=(door.w-.16)/2,dlh=dh*.82-.06;
  kit.detail=true;
  for(const s of [-1,1]){
   const swing=s<0?(floor%2?.85:0):(floor%2?0:.5);
   const leafFrame=frame.clone().multiply(new THREE.Matrix4().makeTranslation(s*(door.w/2-.08),.03,0).multiply(new THREE.Matrix4().makeRotationY(s<0?swing:-swing))),c=-s*dlw/2;
   for(const e of [-1,1])kit.box([.055,dlh,.055],[c+e*(dlw/2-.027),dlh/2,0],leaf,'wood','recess',[0,0,0],leafFrame);
   for(const y of [.03,dlh*.42,dlh-.03])kit.box([dlw,.06,.05],[c,y,0],leaf,'wood','recess',[0,0,0],leafFrame);
   kit.box([dlw-.08,dlh*.38,.03],[c,dlh*.22,0],leaf,'wood','recess',[0,0,0],leafFrame);
   kit.box([dlw-.06,dlh*.55,.01],[c,dlh*.71,0],'#93a7a6','glass','none',[0,0,0],leafFrame);
  }
  kit.detail=false;
  // Rounded Deco balcony: chamfered slab, three speed-line rails and posts.
  // The first floor keeps a shallow French balcony so it clears the shop board below.
  const BW=2.76,D=floor===0?.22:.95,R=floor===0?.08:.42,outline=new THREE.Shape();
  outline.moveTo(-BW/2,0);outline.lineTo(-BW/2,D-R);outline.quadraticCurveTo(-BW/2,D,-BW/2+R,D);outline.lineTo(BW/2-R,D);outline.quadraticCurveTo(BW/2,D,BW/2,D-R);outline.lineTo(BW/2,0);outline.lineTo(-BW/2,0);
  const slab=new THREE.ExtrudeGeometry(outline,{depth:.15,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1,curveSegments:5});
  kit.add(slab,new THREE.Matrix4().makeTranslation(0,y0+.02,-.02).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2)),BAND,'stone','part');slab.dispose();
  kit.box([BW-.1,.02,.02],[0,y0-.16,D-.02],GRIME,'solid','none');
  const path=new THREE.CurvePath<THREE.Vector3>(),inset=.06,points=outline.getPoints(5).filter((_,n,list)=>n<list.length-1).map(p=>{const x=THREE.MathUtils.clamp(p.x,-BW/2+inset,BW/2-inset),z=Math.min(p.y,D-inset);return new THREE.Vector3(x,0,z);});
  for(let n=0;n<points.length-1;n++)path.add(new THREE.LineCurve3(points[n],points[n+1]));
  // Top rail stays at every distance; the speed lines and posts are near detail.
  for(const [y,r] of [[1.0,.03],[.12,.016],[.45,.014],[.62,.014]] as const){kit.detail=y<1;const rail=new THREE.TubeGeometry(path,16,r,y<1?3:4,false);kit.add(rail,M([1,1,1],[0,y0+.02+y,-.02]),RAIL,'metal','none');rail.dispose();}
  for(const p of points.filter((_,n)=>n%2===0||n===points.length-1))kit.box([.03,.98,.03],[p.x,y0+.51,p.z-.02],RAIL,'metal','none');
  kit.detail=true;
  kit.streak(-BW/2+.15,y0-.12,1.2+random()*.6,.15,.006,GRIME,wall,.7);kit.streak(BW/2-.2,y0-.12,.8+random()*.6,.13,.006,GRIME,wall,.6);
  // Each household uses its balcony differently.
  if(floor===2){for(let n=0;n<3;n++){const px=-1+n*.85,r=.12+random()*.05;kit.add(pot,M([r,r*1.5,r],[px,y0+.02+r*.75,.62+random()*.1]),n%2?'#a35a3b':'#7c6f5f','stone','none');for(let l=0;l<4;l++)kit.add(sphere,M([r*1.4,r*1.2,r*1.3],[px+(random()-.5)*r*1.4,y0+r*1.9+l*r*.5,.66+(random()-.5)*r]),l%2?'#4e6a39':'#647f45','foliage','none');}}
  if(floor===0)for(const px of [-.9,.85]){const r=.09;kit.add(pot,M([r,r*1.5,r],[px,y0+.02+r*.75,.1]),'#a35a3b','stone','none');for(let l=0;l<3;l++)kit.add(sphere,M([r*1.3,r*1.2,r*1.2],[px+(random()-.5)*r,y0+r*1.9+l*r*.5,.1]),l%2?'#4e6a39':'#647f45','foliage','none');}
  if(floor===1){
   // Washing line between the fins with sagging clothes.
   const line=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.45,y0+1.95,.72),new THREE.Vector3(0,y0+1.84,.78),new THREE.Vector3(1.45,y0+1.95,.72)]);const wire=new THREE.TubeGeometry(line,10,.006,3,false);kit.add(wire,M([1,1,1],[0,0,0]),'#d8d2c0','solid','none');wire.dispose();
   for(let n=0;n<5;n++){const t=.12+n*.19,p=line.getPoint(t),cw=.28+random()*.2,ch=.45+random()*.4;kit.box([cw,ch,.012],[p.x,p.y-ch/2,p.z],pick(['#a8584a','#d9d2c0','#4f6f80','#b8924a','#6f8762']),'fabric','none',[(random()-.5)*.1,(random()-.5)*.3,(random()-.5)*.08]);}
  }
  if(floor===2){kit.bevel([1.2,.07,.34],[-.35,y0+1.06,D-.08],'#9a5a49','fabric',.03,'none');kit.bevel([1.2,.42,.06],[-.35,y0+.86,D+.07],'#9a5a49','fabric',.03,'none',[-.06,0,0]);}
  kit.detail=false;
  if(floor===3){kit.box([2.5,.04,.9],[0,y0+2.15,.48],'#3f6b4f','fabric','part',[.16,0,0]);for(const s of [-1,1])kit.add(cylinder,M([.012,.3,.012],[s*1.2,y0+2.0,.88]),RAIL,'metal','none');}
 }

 // Parapet: eyebrow coping, stepped Deco crown with a name plaque and shadow grooves.
 kit.bevel([W+.16,.12,.36],[0,top+.06,.08],BAND,'stone',.03);
 kit.box([W-.1,.95,.22],[0,top+.58,-.07],WALL,'plaster','part');
 kit.bevel([W+.1,.08,.32],[0,top+1.07,-.07],TRIM,'stone',.025);
 kit.bevel([2.95,1.15,.28],[0,top+1.6,-.03],TRIM,'plaster',.03);
 kit.bevel([2.35,.3,.3],[0,top+2.28,-.03],TRIM,'stone',.03);kit.bevel([1.5,.26,.32],[0,top+2.55,-.03],TRIM,'stone',.03);
 for(const y of [top+2.05,top+2.12,top+2.19])kit.box([2.6,.018,.02],[0,y,.115],GRIME,'solid','none');
 kit.box([2.5,.5,.03],[0,top+1.52,.11],'#bfae8c','stone','none');
 for(let n=0;n<7;n++){const x=-half+.6+n*(W-1.2)/6+(random()-.5)*.3;kit.streak(x,top+1.02,.55+random()*.4,.18+random()*.12,.045,GRIME,WALL,.7);}
 for(let n=0;n<4;n++)kit.streak(-half+1+n*2.3+(random()-.5)*.5,top-.02,1+random()*1.4,.25,.006,GRIME,WALL,.45);

 // Services: rainwater pipe with hopper, brackets and shoe; sagging cable bundle with clamps.
 const px=-half+.62;
 kit.add(cylinder,M([.048,top+.3-.35,.048],[px,(top+.3+.35)/2,.13]),'#56605b','metal','none');
 kit.box([.2,.22,.18],[px,top+.35,.13],'#56605b','metal','part');kit.add(cylinder,M([.05,.3,.05],[px,.32,.24]),'#56605b','metal','none',undefined);
 for(let y=1.2;y<top;y+=1.3)kit.box([.13,.04,.11],[px,y,.08],'#3d4441','metal','part');
 kit.detail=true;
 for(let n=0;n<3;n++){
  const y=base+.38+n*.07,sag=.18+n*.05;
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(half+.4,y+.1,.42),new THREE.Vector3(half*.4,y-sag*.8,.42),new THREE.Vector3(-half*.3,y-sag,.42),new THREE.Vector3(-half-.4,y+.05,.42)]);
  const tube=new THREE.TubeGeometry(cable,22,.011,3,false);kit.add(tube,M([1,1,1],[0,0,0]),'#191b1a','metal','none');tube.dispose();
 }
 kit.detail=false;
 for(const x of [-2.2,1.4])kit.box([.05,.16,.4],[x,base+.32,.22],'#3a3d3a','metal','part');
 kit.box([.36,.46,.16],[half-.85,base+.55,.1],'#7d847c','metal');

 // Roof: Sintex tanks on an angle-iron stand, stair head-room with a door, TV mast.
 for(const [tx,tz,s] of [[2.2,-2.6,1],[3.3,-3.9,.85]] as const){
  for(const dx of [-.42,.42])for(const dz of [-.42,.42])kit.box([.05,.6,.05],[tx+dx*s,top+.39,tz+dz*s],'#3b3e3a','metal','part');
  kit.box([.95*s,.05,.95*s],[tx,top+.69,tz],'#3b3e3a','metal','part');
  kit.add(tank,M([s,s,s],[tx,top+.72,tz]),'#1d2020','solid','none');kit.add(cylinder,M([.18*s,.08,.18*s],[tx,top+.72+1.12*s,tz]),'#2b2e2d','solid','none');
 }
 kit.box([2.3,2.45,2.5],[-2.5,top+1.3,-3.6],WALL,'plaster');kit.box([2.5,.12,2.7],[-2.5,top+2.58,-3.6],BAND,'stone');
 kit.box([.85,1.9,.04],[-2.2,top+1.05,-2.33],'#5b4632','wood','recess');kit.box([1.2,.06,.4],[-2.2,top+2.12,-2.18],CONCRETE,'stone');
 kit.streak(-3.4,top+2.5,1.4,.3,-2.34,GRIME,WALL,.6);
 kit.detail=true;
 kit.add(cylinder,M([.025,2.6,.025],[-.6,top+1.4,-2.4]),'#6d716c','metal','none');
 for(let n=0;n<4;n++)kit.box([1.1-n*.2,.02,.02],[-.6,top+2.1+n*.22,-2.4],'#6d716c','metal','none',[0,.4,0]);
 kit.detail=false;

 [sphere,cylinder,pot,ring,tank].forEach(g=>g.dispose());
 const built=kit.build('Radio House · benchmark facade',.45);
 return {...built,plaque:{position:[0,top+1.52,.13],width:2.3},centre:new THREE.Vector3(0,(base+top)/2,.3)};
}
