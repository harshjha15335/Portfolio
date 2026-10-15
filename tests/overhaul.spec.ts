import {test,expect} from '@playwright/test';

test('authored navigation loads and all street detail presets render without errors',async({page})=>{
 test.setTimeout(180_000);
 await page.setViewportSize({width:960,height:480});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug&review=1#world');const canvas=page.locator('.world-container canvas');await expect(canvas).toHaveAttribute('data-navigation','ready',{timeout:60000});
 for(const preset of ['low','medium','high']){
  await page.keyboard.press('Escape');await page.getByLabel('Street detail').selectOption(preset);await page.getByRole('button',{name:'CONTINUE EXPLORING →'}).click();await expect(canvas).toHaveAttribute('data-render-preset',preset,{timeout:60000});await expect(page.getByRole('status').filter({hasText:'3D experience unavailable'})).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
