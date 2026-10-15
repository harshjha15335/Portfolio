// Captures the gameplay layer (departure board, Fort exhibits, tour, journal) from a running dev server.
// Usage: CHROMIUM_PATH=... STREET_CAPTURE_URL=http://127.0.0.1:5173/ STREET_CAPTURE_DIR=out node scripts/capture-gameplay.mjs
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const base=process.env.STREET_CAPTURE_URL??'http://127.0.0.1:5173/',root=process.env.STREET_CAPTURE_DIR??'docs/screenshots/gameplay';await mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const views=(process.env.GAMEPLAY_VIEWS??'spawn,board-close,fort-room,fort-wide,fort-kiosk,fort-pins').split(',');
const poses={spawn:{x:4.6,z:11.5,yaw:.14,pitch:-.015},'board-close':{x:4.6,z:9.2,yaw:0,pitch:.3},'fort-room':{x:-7.6,z:-34,yaw:Math.PI/2,pitch:.04},'fort-wide':{x:-7.8,z:-37.0,yaw:2.33,pitch:.02},'fort-kiosk':{x:-8,z:-36.45,yaw:0,pitch:-.2},'fort-pins':{x:-9.2,z:-32,yaw:Math.PI,pitch:0}};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,200));});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(new URL('?debug&review=1#world',base).href);
 await page.waitForFunction(()=>window.__world&&document.querySelector('canvas')?.dataset.eyeHeight);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.streetAssets!=='loading');
 await page.addStyleTag({content:'.world-debug{visibility:hidden}'});
 for(const view of views){await page.evaluate(v=>window.__world.frameView(v),poses[view]);await page.waitForTimeout(2500);console.log(view,await page.locator('.world-debug').textContent(),'| prompt:',await page.locator('.proximity-prompt').textContent().catch(()=>'-'));await page.screenshot({path:`${root}/1440-${view}.png`});}
 if(process.env.GAMEPLAY_PANELS!=='0'){
  await page.evaluate(v=>window.__world.frameView(v),poses['board-close']);await page.waitForTimeout(1500);await page.keyboard.press('e');
  await page.getByRole('dialog',{name:'CST / DEPARTURE BOARD'}).waitFor();await page.getByRole('button',{name:/Research/}).click();await page.screenshot({path:`${root}/1440-panel-departures.png`});
  await page.getByRole('button',{name:'MARK ON MY MAP'}).click();await page.waitForTimeout(800);await page.screenshot({path:`${root}/1440-waypoint.png`});
  await page.evaluate(v=>window.__world.frameView(v),poses['fort-kiosk']);await page.waitForTimeout(1500);await page.keyboard.press('e');
  await page.getByRole('dialog',{name:'FORT / GRADIENT CHECK'}).waitFor();for(const n of [0,1,2])await page.getByRole('button',{name:/RUN CHECK/}).first().click();
  await page.getByRole('button',{name:'THIS ONE'}).nth(2).click();await page.waitForTimeout(400);await page.screenshot({path:`${root}/1440-panel-gradient.png`});await page.keyboard.press('Escape');await page.waitForTimeout(400);
  await page.keyboard.press('j');await page.getByRole('dialog',{name:'EXPLORATION JOURNAL'}).waitFor();await page.screenshot({path:`${root}/1440-journal.png`});await page.keyboard.press('Escape');await page.waitForTimeout(400);
  await page.evaluate(()=>window.__world.reset());await page.waitForTimeout(800);await page.keyboard.press('e');await page.getByRole('dialog',{name:'Fort Research Institute'}).waitFor({timeout:3000}).catch(()=>{});
 }
 await page.close();
}finally{await browser.close();}
