import {test,expect} from '@playwright/test';
test('Fort teaching exhibit is inspectable and sourced without WebGL',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?webgl=off#/project/ffprime');
 const dialog=page.getByRole('dialog',{name:'CASE STUDY / FFprime'}),exhibit=dialog.getByRole('region',{name:'Fort open-science exhibition'});
 await expect(exhibit).toBeVisible();const readout=exhibit.locator('.research-readout'),initial=await readout.textContent();
 await exhibit.getByRole('button',{name:'Add quadrupole',exact:true}).click();await expect(readout).not.toHaveText(initial!);
 await exhibit.getByRole('button',{name:'03 · Derivative → validation',exact:true}).click();await expect(exhibit.locator('.research-explanation')).toContainText('2Qr');
 const x=exhibit.getByRole('slider',{name:'Inspect x'});await x.focus();await x.press('ArrowRight');await expect(x).not.toHaveValue('1.5');
 await expect(exhibit.locator('.research-evidence li')).toHaveCount(5);await expect(exhibit.getByRole('link',{name:'INSPECT PINNED IMPLEMENTATION'})).toHaveAttribute('href',/02ac79dcaa38b64b130999d42ea8de0033834167/);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(errors).toEqual([]);
});
test('Fort exhibition remains readable and operable on mobile fallback',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?webgl=off#/place/fort');const dialog=page.getByRole('dialog',{name:'Fort Research Institute'});await dialog.getByRole('button',{name:'SHOW ME AROUND'}).click();const exhibit=dialog.getByRole('region',{name:'Fort open-science exhibition'});await exhibit.getByRole('button',{name:'Add dipole',exact:true}).click();await expect(exhibit.getByRole('button',{name:'Add dipole',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await exhibit.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});
