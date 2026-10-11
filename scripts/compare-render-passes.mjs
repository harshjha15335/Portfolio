import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.RENDER_REVIEW_DIR??'docs/screenshots/rendering-sprint-2-1/before';await mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--enable-unsafe-swiftshader']});
const animationTime=Number(process.env.RENDER_ANIMATION_TIME??8);if(!Number.isFinite(animationTime)||animationTime<0||animationTime>30)throw Error('Invalid animation time');
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(new URL('?debug&review=1&benchmark=1&fixedQuality=1#world',process.env.RENDER_REVIEW_URL??'http://127.0.0.1:5173/').href);
 await page.waitForFunction(()=>{const d=document.querySelector('canvas')?.dataset;return d?.navigation==='ready'&&d.surfaceMaps==='verified';});
 await page.addStyleTag({content:'.world-container{position:fixed!important;inset:0!important;width:1920px!important;height:1080px!important}.world-debug{visibility:hidden}'});
 const command=(action)=>page.evaluate(({action,animationTime})=>new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();const timer=setTimeout(()=>reject(Error('Comparison response timeout')),120000);const handler=e=>{if(e.detail.requestId!==requestId)return;clearTimeout(timer);window.removeEventListener('street-benchmark-result',handler);e.detail.error?reject(Error(e.detail.error)):resolve(e.detail.result);};window.addEventListener('street-benchmark-result',handler);window.dispatchEvent(new CustomEvent('street-benchmark',{detail:{action,requestId,animationTime}}));}),{action,animationTime});
 await command('freeze');
 for(const view of (process.env.RENDER_REVIEW_VIEWS??'spawn,station,junction,hero-wide,npc,fort-room,return,taxi,auto').split(',')){
  await page.evaluate(view=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:['taxi','auto'].includes(view)?'fort':view})),view);
  if(['taxi','auto'].includes(view)){await page.getByRole('button',{name:`HAIL ${view.toUpperCase()}`}).click();await page.getByLabel('Ride destination').waitFor();}
  await command('refresh'); // prime the same frozen animation state before the cached comparison
  const cached=await command('cached');await page.screenshot({path:`${root}/${view}-cached.png`});
  const refresh=await command('refresh');await page.screenshot({path:`${root}/${view}-refresh.png`});
  results.push({view,cached,refresh});await writeFile(`${root}/measurements.json`,JSON.stringify({method:'Public Mesh shadow hooks and controlled cached/forced rendering at one frozen normally-animated state. Requested animation time at60Hz, no simulation steps between compared passes. MainAndOther = total minus measured shadow submissions; High includes normal/postprocessing passes.',browser:browser.version(),viewport:{width:1920,height:1080},errors,results},null,2)+'\n');console.log(view,cached.total,refresh.total,'shadow',refresh.shadowDraws,refresh.shadowTriangles);
  if(['taxi','auto'].includes(view))await page.getByRole('button',{name:'Exit ride',exact:true}).click();
 }
 if(errors.length)throw Error('Render errors: '+errors.join('; '));
}finally{await browser.close();}
