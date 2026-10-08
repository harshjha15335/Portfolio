import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/';
const captureUrl=new URL('?debug&review=1#world',base).href;
const root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/visual-rebuild';await mkdir(root,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.platform==='linux'?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});const measurements=[];
try {
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080}]){
  const page=await browser.newPage({viewport});page.setDefaultTimeout(120000);page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,240));});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(captureUrl);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:120000});
  await page.addStyleTag({content:'.world-debug{visibility:hidden}'});
  for(const view of process.env.STREET_CAPTURE_DETAILS==='1'?['spawn','station','shops','fort','return','npc','shop','vegetation','junction','institute']:['spawn','station','shops','fort','return']){
   await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:view})),view);await page.waitForFunction(view=>{const points={npc:[5.6,6.8],shop:[-5.7,-15],vegetation:[-4.8,-15],junction:[4.8,-8],institute:[-4.6,-30],spawn:[4.6,11.5],station:[4.6,-4],shops:[-4.8,-9],fort:[-5.1,-35],return:[4.7,-44]};const p=points[view],d=document.querySelector('canvas')?.dataset;return d&&Math.abs(Number(d.worldX)-p[0])<.15&&Math.abs(Number(d.worldZ)-p[1])<.15;},view,{timeout:120000});await page.waitForTimeout(500);
   console.log(view,viewport.width,await page.locator('.world-debug').textContent());
   measurements.push({view,width:viewport.width,profile:await page.locator('.world-debug').textContent(),position:await page.locator('canvas').evaluate(el=>({...el.dataset}))});
   await writeFile(`${root}/measurements.json`,JSON.stringify(measurements,null,2)+'\n');await page.screenshot({path:`${root}/${viewport.width}-${view}.png`});
  }
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:'fort'})));await page.keyboard.down('w');await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.worldX)<-9.7,{},{timeout:120000});await page.keyboard.up('w');await page.screenshot({path:`${root}/${viewport.width}-research.png`});
  for(const kind of ['TAXI','AUTO']){await page.getByRole('button',{name:`HAIL ${kind}`}).click();await page.getByLabel('Ride destination').waitFor({timeout:60000});await page.waitForTimeout(600);await page.screenshot({path:`${root}/${viewport.width}-${kind.toLowerCase()}.png`});await page.getByRole('button',{name:'Exit ride',exact:true}).click();}
  await page.close();
 }
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.emulateMedia({reducedMotion:'reduce'});await mobile.goto(captureUrl);await mobile.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:120000});await mobile.waitForTimeout(600);await mobile.addStyleTag({content:'.world-debug{visibility:hidden}'});
 await mobile.screenshot({path:`${root}/390-mobile.png`});measurements.push({view:'mobile',width:390,profile:await mobile.locator('.world-debug').textContent()});await mobile.close();
 const fallback=await browser.newPage({viewport:{width:390,height:844}});await fallback.goto(new URL('?webgl=off#/place/filmcity',base).href);await fallback.getByRole('button',{name:'TAKE A SEAT'}).click();await fallback.screenshot({path:`${root}/390-fallback-theatre.png`});await fallback.close();
 await writeFile(`${root}/measurements.json`,JSON.stringify(measurements,null,2)+'\n');
}finally{await browser.close();}
