import {chromium} from '@playwright/test';
// Rides across districts in a real browser: hail → choose → leg cut → arrival → step out, then a map jump and a district-to-district ride.
const out=process.env.OUT??'/tmp/claude-0/ride';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(180000);
page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300));});
await page.goto('http://127.0.0.1:5173/?debug&review=1#world');
await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.eyeHeight);
await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.surfaceMaps!=='loading');await page.addStyleTag({content:'.world-debug{visibility:hidden}'});
const hud=async()=>(await page.locator('body').innerText()).match(/(CST \/ FORT ROAD|BKC · G BLOCK|ANDHERI[^\n]*|POWAI[^\n]*|DADAR · [^\n]*|WORLI SEA FACE|JUHU TARA ROAD|FILM CITY · GOREGAON)/)?.[0];
const close=async()=>{for(let i=0;i<3&&await page.locator('dialog[open]').count();i++){await page.keyboard.press('Escape');await page.waitForTimeout(600);}};
const ride=async(kind,dest,tag)=>{
  await page.getByRole('button',{name:new RegExp(`HAIL ${kind}`,'i')}).first().click();
  await page.getByLabel('Ride destination').waitFor();await page.getByLabel('Ride destination').selectOption(dest);
  await page.waitForTimeout(9000);await page.screenshot({path:`${out}/${tag}-1-riding.png`});
  console.log(tag,'riding, hud =',await hud(),'meter =',await page.locator('.meter-readings').innerText().catch(()=>'-'));
  const skip=page.getByRole('button',{name:/SKIP TO ARRIVAL/});if(await skip.isVisible())await skip.click();
  await page.getByText('Arrived. Your story continues here.').waitFor({timeout:60000});
  await page.waitForTimeout(1500);await page.screenshot({path:`${out}/${tag}-2-arrived.png`});
  console.log(tag,'arrived, hud =',await hud(),'meter =',(await page.locator('.meter-readings').innerText()).replace(/\n/g,' '));
  await page.getByRole('button',{name:/STEP OUT/}).click();await page.waitForTimeout(2500);
  await page.screenshot({path:`${out}/${tag}-3-stepped-out.png`});console.log(tag,'stepped out, hud =',await hud());
  await close();
};
try{
  await ride('taxi','bkc','cst-to-bkc');
  await ride('auto','andheri','bkc-to-andheri');
  await page.keyboard.press('m');await page.waitForTimeout(800);
  await page.getByRole('button',{name:/Travel to Worli/}).click();await page.waitForTimeout(4000);
  await close();
  await page.screenshot({path:`${out}/map-go-worli.png`});console.log('map GO worli, hud =',await hud());
  await ride('auto','juhu','worli-to-juhu');
  await ride('taxi','fort','juhu-to-fort');
}finally{await browser.close();}
