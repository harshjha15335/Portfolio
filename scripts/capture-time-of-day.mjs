import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
// Same views at several Mumbai times via the ?debug&time= override.
// Usage: node scripts/capture-time-of-day.mjs [HH:MM,...] [view,...]   env: DATE=YYYY-MM-DD, STREET_CAPTURE_DIR, W, H
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/';
const root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/time-of-day';await mkdir(root,{recursive:true});
const times=(process.argv[2]??'06:50,12:30,18:20,23:00').split(',');
const views=(process.argv[3]??'station-front,hero-wide,junction').split(',');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 for(const time of times){
  const page=await browser.newPage({viewport:{width:Number(process.env.W??1440),height:Number(process.env.H??900)}});page.setDefaultTimeout(240000);
  page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300));});
  await page.emulateMedia({reducedMotion:'reduce'});
  const date=process.env.DATE?`&date=${process.env.DATE}`:'';
  await page.goto(new URL(`?debug&review=1&benchmark=1&time=${time}${date}#world`,base).href);
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:240000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.surfaceMaps!=='loading');
  await page.addStyleTag({content:'.world-debug,.orientation-card,.proximity-prompt{visibility:hidden}'});
  await page.waitForTimeout(Number(process.env.WARM??8000));
  for(const view of views){
   await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:view})),view);
   await page.waitForTimeout(Number(process.env.SETTLE??3500));
   const info=await page.evaluate(()=>{const c=document.querySelector('canvas');return `${c.dataset.istTime} ${c.dataset.dayPhase} alt=${c.dataset.sunAltitude} lamps=${c.dataset.lamps}`;});
   const file=`${root}/${time.replace(':','')}-${view}.png`;await page.screenshot({path:file});console.log(file,info);
  }
  await page.close();
 }
}finally{await browser.close();}
