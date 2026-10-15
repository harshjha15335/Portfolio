import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/';
const captureUrl=new URL('?debug&review=1#world',base).href;
const root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/art-production-sprint-1/after';await mkdir(root,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.platform==='linux'?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});const measurements=[];
try {
 for(const viewport of [{width:1440,height:900}]){
  const page=await browser.newPage({viewport});page.setDefaultTimeout(120000);page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,240));});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(captureUrl);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:120000});
  await page.addStyleTag({content:'.world-debug{visibility:hidden}'});
  for(const view of (process.env.STREET_CAPTURE_BOUNDARY_ONLY==='1'?['north-limit','south-look','side-gap']:['spawn','station','junction','shops','npc','fort','return','north-limit','south-look','side-gap'])){
   await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:view})),view);await page.waitForFunction(view=>{const points={'north-limit':[1.8,-59],'south-look':[14.5,15],'side-gap':[5.4,-.7],npc:[5.6,6.8],shop:[-5.7,-15],vegetation:[-4.8,-15],junction:[4.8,-8],institute:[-4.6,-30],spawn:[4.6,11.5],station:[4.6,-4],shops:[-4.8,-9],fort:[-5.1,-35],return:[4.7,-44]};const p=points[view],d=document.querySelector('canvas')?.dataset;return d&&Math.abs(Number(d.worldX)-p[0])<.15&&Math.abs(Number(d.worldZ)-p[1])<.15;},view,{timeout:120000});await page.waitForTimeout(500);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.navigation!=='loading',{},{timeout:120000});
   console.log(view,viewport.width,await page.locator('.world-debug').textContent());
   measurements.push({view,width:viewport.width,profile:await page.locator('.world-debug').textContent(),position:await page.locator('canvas').evaluate(el=>({...el.dataset}))});
   await writeFile(`${root}/${process.env.STREET_CAPTURE_BOUNDARY_ONLY==='1'?'boundary-measurements':'measurements'}.json`,JSON.stringify(measurements,null,2)+'\n');await page.screenshot({path:`${root}/${viewport.width}-${view}.png`});
  }
  if(process.env.STREET_CAPTURE_BOUNDARY_ONLY!=='1'){await page.evaluate(()=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:'fort'})));
  for(const kind of ['TAXI','AUTO']){await page.getByRole('button',{name:`HAIL ${kind}`}).click();await page.getByLabel('Ride destination').waitFor({timeout:60000});await page.waitForTimeout(600);await page.screenshot({path:`${root}/${viewport.width}-${kind.toLowerCase()}.png`});await page.getByRole('button',{name:'Exit ride',exact:true}).click();}
  }await page.close();
 }
 if(process.env.STREET_CAPTURE_BOUNDARY_ONLY==='1')process.exitCode=0;else {
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.emulateMedia({reducedMotion:'reduce'});await mobile.goto(captureUrl);await mobile.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:120000});await mobile.waitForTimeout(600);await mobile.addStyleTag({content:'.world-debug{visibility:hidden}'});
 await mobile.screenshot({path:`${root}/390-mobile.png`});measurements.push({view:'mobile',width:390,profile:await mobile.locator('.world-debug').textContent()});await mobile.close();
 const fallback=await browser.newPage({viewport:{width:390,height:844}});await fallback.goto(new URL('?webgl=off#/place/filmcity',base).href);await fallback.getByRole('button',{name:'TAKE A SEAT'}).click();await fallback.screenshot({path:`${root}/390-fallback-theatre.png`});await fallback.close();
 await writeFile(`${root}/${process.env.STREET_CAPTURE_BOUNDARY_ONLY==='1'?'boundary-measurements':'measurements'}.json`,JSON.stringify(measurements,null,2)+'\n');}
}finally{await browser.close();}
