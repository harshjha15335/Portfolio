// Visits every district exhibit board, checks its prompt, and captures one wide view per district.
// Usage: CHROMIUM_PATH=... STREET_CAPTURE_URL=http://127.0.0.1:5173/ STREET_CAPTURE_DIR=out node scripts/capture-district-exhibits.mjs
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/',root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/district-exhibits';await mkdir(root,{recursive:true});
const only=(process.env.DISTRICTS??'bkc,andheri,powai,dadar,worli,juhu,filmcity').split(',');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,200));});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(new URL('?debug&review=1#world',base).href);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:180000});
 await page.waitForFunction(()=>window.__world);
 await page.addStyleTag({content:'.world-debug{visibility:hidden}.orientation-card{display:none}'});
 const {DISTRICT_EXHIBITS}=await page.evaluate(()=>import('/src/data/districtExhibits.ts').then(m=>({DISTRICT_EXHIBITS:m.DISTRICT_EXHIBITS})));
 const {cityZones}=await page.evaluate(()=>import('/src/game/World/streetLayout.ts').then(m=>({cityZones:m.cityZones})));
 const frame=v=>page.evaluate(v=>window.__world.frameView(v),v);
 for(const id of only){
  const zone=cityZones.find(z=>z.id===id),list=DISTRICT_EXHIBITS.filter(e=>e.district===id);
  await frame({x:zone.originX+zone.stop.x,z:zone.stop.z,yaw:zone.stop.yaw,pitch:0});await page.waitForTimeout(5000);
  for(const e of list){
   const nx=e.x>0?-1:1;await frame({x:zone.originX+e.x+nx*1.9,z:e.z,yaw:nx<0?-Math.PI/2:Math.PI/2,pitch:-.07});await page.waitForTimeout(900);
   const prompt=(await page.locator('.proximity-prompt').textContent().catch(()=>''))??'';
   const ok=prompt.includes(e.label);report.push({id:e.id,prompt,ok});console.log(ok?'OK  ':'MISS',e.id,'|',prompt);
  }
  // Wide: back from the first two boards, looking along them.
  const a=list[0],b=list[1]??a,nx=a.x>0?-1:1,px=a.x+nx*4.2,pz=Math.max(a.z,b.z)+4.5,cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;
  await frame({x:zone.originX+px,z:pz,yaw:Math.atan2(-(cx-px),-(cz-pz)),pitch:-.04});await page.waitForTimeout(2500);
  await page.screenshot({path:`${root}/1440-${id}-boards.png`});
  const c=list[0];await frame({x:zone.originX+c.x+nx*1.9,z:c.z,yaw:nx<0?-Math.PI/2:Math.PI/2,pitch:-.07});await page.waitForTimeout(1500);
  await page.screenshot({path:`${root}/1440-${id}-board-close.png`});
 }
}finally{await writeFile(`${root}/prompts.json`,JSON.stringify(report,null,1));await browser.close();}
