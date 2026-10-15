import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.STREET_PROFILE_DIR??'docs/screenshots/production-overhaul';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const oldDocument=globalThis.document;
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
try{
 const [{MumbaiStreet},CANNON,THREE]=await Promise.all([server.ssrLoadModule('/src/game/World/MumbaiStreet.ts'),import('cannon-es'),import('three')]);
 const start=performance.now(),street=new MumbaiStreet(new CANNON.World());
 for(let i=0;i<100&&street.navigationStatus==='loading';i++)await new Promise(resolve=>setTimeout(resolve,10));
 if(street.navigationStatus!=='ready')throw new Error('Authored-world navigation initialization failed');
 const constructionMs=performance.now()-start,view=new THREE.Vector3(4.6,1.68,11.5),frame=[],npc=[],traffic=[];
 for(let i=0;i<900;i++){const before=performance.now();street.update(i/30,false,view);if(i>120){frame.push(performance.now()-before);npc.push(street.npcUpdateMs);traffic.push(street.trafficUpdateMs);}}
 const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:sorted[Math.floor(sorted.length*.95)],p99Ms:sorted[Math.floor(sorted.length*.99)]};};
 const result={profile:'Node CPU simulation only; no renderer/GPU or browser FPS claim',samples:frame.length,constructionMs,authoredNavigation:street.navigationStatus,streetUpdate:summary(frame),crowdUpdate:summary(npc),trafficUpdate:summary(traffic)};
 await mkdir(root,{recursive:true});await writeFile(`${root}/cpu-profile.json`,JSON.stringify(result,null,2)+'\n');console.log(result);street.dispose();
}finally{globalThis.document=oldDocument;await server.close();}
