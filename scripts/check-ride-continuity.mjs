// Rides a cab through the running game and records the meter every 250 ms: states seen (WAITING included), fare,
// distance and waiting never going backwards across the district change, and the IST clock carrying on.
// Usage (dev server, ?debug): node scripts/check-ride-continuity.mjs [auto|taxi] [destination] [HH:MM]
import {chromium} from '@playwright/test';
const base=process.env.URL??'http://127.0.0.1:5173/';
const [kind='auto',destination='fort',time='18:40']=process.argv.slice(2);
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(600000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(time==="live"?`${base}?debug#world`:`${base}?debug&time=${time}&date=2026-10-21#world`);
await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight);await page.locator('.loader').waitFor({state:'detached'});
await page.getByRole('button',{name:`HAIL ${kind.toUpperCase()}`}).click();
const samples=[];let picked=false;const started=Date.now();
while(Date.now()-started<900000){
 const s=await page.evaluate(()=>{const w=window.__world,r=w.ride,c=document.querySelector('canvas').dataset;return {phase:r.phase,meter:r.meter,fare:r.fare,distance:r.distance,waiting:r.waiting,zone:w.zone,ist:c.istTime};});
 samples.push({t:(Date.now()-started)/1000,...s});
 if(!picked&&s.phase==='choosing'||!picked&&await page.getByLabel('Ride destination').isVisible().catch(()=>false)){await page.getByLabel('Ride destination').selectOption(destination);picked=true;}
 if(s.phase==='arrived')break;
 await page.waitForTimeout(250);
}
const riding=samples.filter(s=>['riding','arrived'].includes(s.phase));
const back=(k)=>riding.some((s,i)=>i&&s[k]<riding[i-1][k]-1e-9);
const states=[...new Set(samples.map(s=>s.meter))];
const zones=[...new Set(riding.map(s=>s.zone))];
console.log(JSON.stringify({kind,destination,seconds:samples.at(-1).t,states,zones,final:samples.at(-1),fareBackwards:back('fare'),distanceBackwards:back('distance'),waitingBackwards:back('waiting'),istFirst:samples[0].ist,istLast:samples.at(-1).ist,errors},null,1));
const transitions=[];for(let i=1;i<samples.length;i++)if(samples[i].meter!==samples[i-1].meter||samples[i].zone!==samples[i-1].zone)transitions.push(samples[i]);
console.log(transitions.map(s=>`${s.t.toFixed(1)}s ${s.phase} ${s.meter} zone ${s.zone} ₹${s.fare.toFixed(2)} ${s.distance.toFixed(0)} m wait ${s.waiting.toFixed(1)} s`).join('\n'));
await browser.close();
