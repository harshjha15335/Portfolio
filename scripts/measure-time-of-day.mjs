// Renderer cost of the same views at different Mumbai times (dev server, ?debug). Usage: node scripts/measure-time-of-day.mjs [HH:MM,...] [view,...]
import {chromium} from '@playwright/test';
const base=process.env.URL??'http://127.0.0.1:5173/';
const times=(process.argv[2]??'12:30,23:00').split(','), views=(process.argv[3]??'spawn,bkc').split(',');
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
for(const time of times){const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(240000);
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`${base}?debug&review=1&benchmark=1&time=${time}&date=2026-10-21#world`);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight,{},{timeout:240000});await page.waitForTimeout(Number(process.env.WAIT??6000));
 for(const view of views){await page.evaluate(v=>window.dispatchEvent(new CustomEvent('street-review-view',{detail:v})),view);await page.waitForTimeout(5000);
  const r=await page.evaluate(()=>{const w=window.__world;const v=w.viewResources();const i=w.renderer.info;return {draws:i.render.calls,tris:i.render.triangles,images:v.imageTextures,programsInView:v.programs,programsTotal:i.programs.length};});
  console.log(time,view,JSON.stringify(r));}
 await page.close();}
await browser.close();
