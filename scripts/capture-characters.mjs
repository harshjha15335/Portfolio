import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
// Matched character review captures (set STREET_CAPTURE_NOCAST=1 for a baseline without the licensed cast): host, walkers, chai vendor, seated student, station, spawn, and both drivers from the passenger seat.
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/',query=process.env.STREET_CAPTURE_QUERY??'';
const root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/street-cast/after';await mkdir(root,{recursive:true});
const views=(process.env.STREET_CAPTURE_VIEWS??'npc,walkers,chai,bench,station,spawn,taxi,auto').split(',');
const motion=process.env.STREET_CAPTURE_MOTION==='1';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});const measurements=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(180000);page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('CONSOLE',m.text().slice(0,300));});
 if(!motion)await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(new URL(`?debug&review=1${query?'&'+query:''}#world`,base).href);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:180000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.surfaceMaps!=='loading');await page.addStyleTag({content:'.world-debug{visibility:hidden}'});
 if(process.env.STREET_CAPTURE_NOCAST!=='1')await page.waitForFunction(()=>/^(loaded|partial)/.test(document.querySelector('canvas')?.dataset.cast??''),{},{timeout:180000});
 for(const view of views){
  if(view==='taxi'||view==='auto'){await page.evaluate(()=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:'fort'})));await page.waitForTimeout(800);const kind=view.toUpperCase();await page.getByRole('button',{name:`HAIL ${kind}`}).click();await page.getByLabel('Ride destination').waitFor({timeout:90000});await page.waitForTimeout(motion?2500:900);}
  else{await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:view})),view);await page.waitForTimeout(motion?2500:900);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.navigation!=='loading',{},{timeout:120000});}
  const profile=await page.locator('.world-debug').textContent();measurements.push({view,profile,cast:await page.locator('canvas').getAttribute('data-cast')});console.log(view,profile);
  await page.screenshot({path:`${root}/1440-${view}.png`});
  if(view==='taxi'||view==='auto')await page.getByRole('button',{name:'Exit ride',exact:true}).click();
 }
 await writeFile(`${root}/measurements.json`,JSON.stringify(measurements,null,2)+'\n');
}finally{await browser.close();}
