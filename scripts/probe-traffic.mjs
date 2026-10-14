import {chromium} from '@playwright/test';
// Traffic path review: simulate each zone's traffic and report vehicles that leave the carriageway (their
// footprint over a kerb, pavement or anything standing on the ground), overlap another vehicle, or jump.
// Usage: node scripts/probe-traffic.mjs [zone,zone,...]   (cst, bkc, andheri, powai, dadar, worli, juhu, filmcity)
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/';
const zones=(process.argv[2]??'cst,bkc,andheri,powai,dadar,worli,juhu,filmcity').split(',');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
let failed=false;
try{
 const page=await browser.newPage({viewport:{width:640,height:400}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.text().startsWith('probe'))console.log(m.text());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(new URL('?debug&review=1#world',base).href);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:180000});
 await page.waitForFunction(()=>window.__world?.fortTraffic?.agents?.[0]?.mesh?.userData?.lodGeometries,{},{timeout:60000});await page.waitForTimeout(4000);
 for(const zone of zones){
  const report=await page.evaluate(async zone=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const w=window.__world,zones=['cst','bkc','andheri','powai','dadar','worli','juhu','filmcity'],index=zones.indexOf(zone);
   const origin=index?w.city.get?.(index)?.origin:null;
   // Enter the zone (builds the district).
   window.dispatchEvent(new CustomEvent('street-review-view',{detail:index?zone:'spawn'}));await new Promise(r=>setTimeout(r,index?2500:500));
   const district=index?w.city.get(index):null,ox=district?district.origin.x:0;
   const traffic=district?district.traffic:w.fortTraffic,root=district?district.group:w.street.group;
   const skip=new Set();traffic.group.traverse(o=>skip.add(o));
   if(district)district.crowd.group.traverse(o=>skip.add(o));else{for(const v of [...w.street.trafficVehicles,...w.street.parkedVehicles])v.traverse(o=>skip.add(o));}
   const targets=[];root.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&!skip.has(o)&&o.visible!==false&&!o.material?.transparent)targets.push(o);});
   root.updateMatrixWorld(true);console.log('probe',zone,'targets',targets.length);
   const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);ray.far=4.6;
   const WIDTH={bus:2.5,truck:2.4,tempo:1.9,sedan:1.75,hatch:1.7,suv:1.85,taxi:1.6,auto:1.4,bike:.75,cycle:.6,cart:1.3,scooter:.7};
   const footprint=(x,z,yaw,length,width)=>{const f=[-Math.sin(yaw),-Math.cos(yaw)],r=[-f[1],f[0]],pts=[];for(const a of [-.5,0,.5])for(const b of [-.5,0,.5])pts.push([x+f[0]*a*length+r[0]*b*width,z+f[1]*a*length+r[1]*b*width]);return pts;};
   const blocked=(x,z)=>{ray.set(new THREE.Vector3(x,4.5,z),down);const hit=ray.intersectObjects(targets,false)[0];return hit&&hit.point.y>.1?{y:+hit.point.y.toFixed(2),name:hit.object.name||hit.object.parent?.name||'?'}:null;};
   const issues={offroad:new Map(),overlap:new Map(),jump:0,samples:0};
   const view=new THREE.Vector3(ox+40,1.6,200);// the visitor stays out of the way
   
   const loop=district?null:w.street.trafficSystem;
   const pose=()=>{const out=[];for(const a of traffic.agents)if(a.mesh.visible&&a.active!==false)out.push({id:a.seed,kind:a.kind,x:a.mesh.position.x+(district?ox:0),z:a.mesh.position.z,yaw:a.mesh.rotation.y,length:a.length,width:WIDTH[a.kind]??1.8});
    if(loop)for(let i=0;i<loop.active;i++){const p=loop.pose(i);out.push({id:`loop:${i}`,kind:i===1||i===4?'auto':'taxi',x:p.x,z:p.z,yaw:p.heading,length:i===1||i===4?2.9:4.0,width:i===1||i===4?1.4:1.6});}return out;};
   let previous=new Map(),time=100;const dt=1/30;
   const STEPS=30*Number(globalThis.PROBE_SECONDS??60);for(let step=0;step<STEPS;step++){
    time+=dt;const local=view.clone();if(district)local.x-=ox;
    traffic.update(time,dt,[local]);
    if(loop)loop.step(dt,time,[{x:view.x,z:view.z}],traffic.onLane(0));
    const now=pose(),by=new Map(now.map(v=>[v.id,v]));
    for(const v of now){const p=previous.get(v.id);if(p&&Math.hypot(v.x-p.x,v.z-p.z)>1.2)issues.jump++;}
    previous=by;
    if(step%15)continue;issues.samples++;
    for(const v of now){
     // Only the stretch a visitor can see matters: the walkable street and its ends.
     if(v.z>40||v.z<-120)continue;
     for(const [x,z] of footprint(v.x,v.z,v.yaw,v.length*.92,v.width*.92)){const b=blocked(x,z);if(b){const key=`${v.kind} at z≈${Math.round(v.z/5)*5} x≈${(v.x-ox).toFixed(1)} over ${b.name} (y ${b.y})`;issues.offroad.set(key,(issues.offroad.get(key)??0)+1);break;}}
    }
    for(let i=0;i<now.length;i++)for(let j=i+1;j<now.length;j++){const a=now[i],b=now[j];if(Math.hypot(a.x-b.x,a.z-b.z)>(a.length+b.length)/2)continue;
     // Separating-axis test on the two footprints.
     const axes=[a.yaw,a.yaw+Math.PI/2,b.yaw,b.yaw+Math.PI/2].map(t=>[-Math.sin(t),-Math.cos(t)]);
     const corners=v=>footprint(v.x,v.z,v.yaw,v.length*.95,v.width*.95).filter((_,k)=>[0,2,6,8].includes(k));
     const ca=corners(a),cb=corners(b);
     const separated=axes.some(([u,v])=>{const pa=ca.map(([x,z])=>x*u+z*v),pb=cb.map(([x,z])=>x*u+z*v);return Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa);});
     if(!separated){const key=`${a.kind}/${b.kind} at z≈${Math.round((a.z+b.z)/10)*5}`;issues.overlap.set(key,(issues.overlap.get(key)??0)+1);}
    }
   }
   return {zone,vehicles:traffic.agents.length,samples:issues.samples,jumps:issues.jump,offroad:[...issues.offroad].sort((a,b)=>b[1]-a[1]).slice(0,25),overlap:[...issues.overlap].sort((a,b)=>b[1]-a[1]).slice(0,15)};
  },zone);
  console.log(JSON.stringify(report,null,1));
  if(report.offroad.length||report.overlap.length)failed=true;
 }
}finally{await browser.close();}
process.exitCode=failed?1:0;
