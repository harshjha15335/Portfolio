import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
// Review captures for the seven districts. Usage: node scripts/capture-districts.mjs [view,view,...]
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/';
const root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/city-districts';await mkdir(root,{recursive:true});
const views=(process.argv[2]??'bkc,bkc-boulevard,andheri,andheri-lane,powai,powai-lake,dadar,dadar-station,dadar-maidan,worli,worli-seawall,juhu,juhu-beach,filmcity,filmcity-lot,filmcity-shoot').split(',');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const measurements=[];
try{
 const page=await browser.newPage({viewport:{width:Number(process.env.W??1440),height:Number(process.env.H??900)}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'||m.text().startsWith('District'))console.log('CONSOLE',m.text().slice(0,300));});
 await page.emulateMedia({reducedMotion:process.env.MOTION==='1'?'no-preference':'reduce'});await page.goto(new URL('?debug&review=1&benchmark=1#world',base).href);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:180000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.surfaceMaps!=='loading');await page.addStyleTag({content:'.world-debug{visibility:hidden}'});
 // Warm up: the first district build and shader compile would otherwise land in the first shot.
 await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:view})),views[0]);await page.waitForTimeout(6000);
 for(const view of views){
  await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:view})),view);
  await page.waitForTimeout(Number(process.env.SETTLE??2500));
  const debug=await page.locator('.world-debug').textContent();
  // Main-pass cost with a cached shadow map, the same split the street budgets use.
  const cached=await page.evaluate(()=>new Promise(resolve=>{const id=String(Math.random());const on=e=>{if(e.detail.requestId===id){window.removeEventListener('street-benchmark-result',on);resolve(e.detail.result);}};window.addEventListener('street-benchmark-result',on);window.dispatchEvent(new CustomEvent('street-benchmark',{detail:{action:'cached',scenario:'district',requestId:id}}));setTimeout(()=>resolve(null),5000);}));
  const main=cached&&{draws:cached.mainAndOtherDraws,triangles:cached.mainAndOtherTriangles,textures:cached.textures,programs:cached.programs};
  console.log(view,JSON.stringify(main),debug);measurements.push({view,main,debug});
  await page.screenshot({path:`${root}/1440-${view}.png`});
 }
}finally{await writeFile(`${root}/measurements.json`,JSON.stringify(measurements,null,1));await browser.close();}
