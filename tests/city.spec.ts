import { expect, test } from '@playwright/test';
import { districts } from '../src/data/city';

for (const kind of ['TAXI', 'AUTO']) {
  test(`${kind.toLowerCase()} can be boarded, metered, routed and exited at its destination`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#world');
    await expect(page.locator('.world-container canvas')).toBeVisible();
    await expect(page.locator('.loader')).toHaveCount(0);
    await page.getByRole('button', { name: `HAIL ${kind}` }).click();
    const meter = page.getByRole('region', { name: 'Portfolio Meter' });
    await expect(meter).toContainText(kind === 'TAXI' ? 'KAALI-PEELI' : 'AUTO RICKSHAW');
    await expect(page.getByLabel('Ride destination')).toBeVisible();
    const initial = await page.getByTestId('ride-fare').textContent();
    await page.getByLabel('Ride destination').selectOption(kind === 'TAXI' ? 'fort' : 'cst');
    await expect.poll(() => page.getByTestId('ride-fare').textContent()).not.toBe(initial);
    if (kind === 'TAXI') await page.getByRole('button', { name: 'SKIP TO ARRIVAL' }).click();
    await expect(meter.getByRole('status')).toContainText('Arrived', { timeout: 30_000 });
    await page.getByRole('button', { name: 'STEP OUT & MEET THE GUIDE' }).click();
    await expect(page.getByRole('dialog', { name: kind === 'TAXI' ? 'Fort Research Institute' : 'CST Arrival Terminus' })).toBeVisible();
    await expect(meter).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('every stop has an accessible guide and meaningful sourced content', async ({ page }) => {
  await page.goto('/#quick');
  for (const district of districts) {
    await page.keyboard.press('Control+k');
    await page.getByRole('textbox', { name: 'Search commands' }).fill(district.title);
    await page.getByRole('textbox', { name: 'Search commands' }).press('Enter');
    const dialog = page.getByRole('dialog', { name: district.title, exact: true });
    await expect(dialog).toContainText(district.greeting);
    await dialog.getByRole('button', { name: district.id === 'filmcity' ? 'TAKE A SEAT' : 'SHOW ME AROUND' }).click();
    await expect(dialog.locator('.district-content')).toBeVisible();
    if (district.id === 'bkc') await expect(dialog).toContainText('OAuth2');
    if (district.id === 'fort') await expect(dialog).toContainText('résumé reported');
    if (district.id === 'powai') await expect(dialog.locator('.district-projects article')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('skill evidence opens the existing case study and theatre supports scene controls', async ({ page }) => {
  await page.goto('/#/place/andheri');
  await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
  await page.getByRole('button', { name: 'React', exact: true }).click();
  await page.locator('.bazaar-evidence').getByRole('button', { name: /NORTHSTAR/ }).click();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / NORTHSTAR' })).toBeVisible();
  await page.goto('/#/place/filmcity');
  await page.getByRole('button', { name: 'TAKE A SEAT' }).click();
  const theatre = page.getByRole('region', { name: 'Film City story theatre' });
  await expect(theatre).toContainText('Harsh Jha. Builder, in motion.');
  await theatre.getByRole('button', { name: 'NEXT →', exact: true }).click();
  await expect(theatre).toContainText('VIT. A place to start.');
  await theatre.getByRole('button', { name: '← PREVIOUS', exact: true }).click();
  await expect(theatre).toContainText('Harsh Jha. Builder, in motion.');
  await theatre.getByRole('button', { name: 'Scene 9: Until next time' }).click();
  await expect(theatre).toContainText('Let’s build something.');
  await theatre.getByRole('button', { name: 'GET IN TOUCH' }).click();
  await expect(page.getByRole('dialog', { name: 'CONTACT', exact: true })).toBeVisible();
});

test('reduced-motion transport arrives directly and can be reboarded', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#world');
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.getByRole('button', { name: 'HAIL AUTO' }).click();
  await page.getByLabel('Ride destination').selectOption('fort');
  await expect(page.getByRole('status')).toContainText('Arrived');
  await page.getByRole('button', { name: 'Exit ride', exact: true }).click();
  await page.getByRole('button', { name: 'HAIL TAXI' }).click();
  await page.getByLabel('Ride destination').selectOption('cst');
  await expect(page.getByRole('status')).toContainText('Arrived');
});

test('city content survives WebGL fallback on a phone and map labels fit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?webgl=off#/place/filmcity');
  await expect(page.getByRole('status')).toContainText('3D experience unavailable');
  await page.getByRole('button', { name: 'TAKE A SEAT' }).click();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByRole('region', { name: 'Film City story theatre' })).toBeVisible();
  await page.goto('/#world');
  await page.getByRole('button', { name: 'CITY DIRECTORY' }).click();
  await expect(page.locator('.city-map-stop')).toHaveCount(9);
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('keyboard look changes walking direction and nearby E opens a guide', async ({ page }) => {
  await page.goto('/?debug#world');
  const canvas=page.locator('canvas'); await expect(canvas).toHaveAttribute('data-camera-mode','first-person');
  const yaw=Number(await canvas.getAttribute('data-look-yaw'));
  await page.keyboard.down(','); await expect.poll(async()=>Number(await canvas.getAttribute('data-look-yaw'))).toBeGreaterThan(yaw+.2); await page.keyboard.up(',');
  await page.keyboard.press('r'); await page.keyboard.press('e');
  await expect(page.getByRole('dialog',{name:'CST Arrival Terminus'})).toBeVisible();
});

test('a moving ride can be exited and the next vehicle can be boarded', async ({ page }) => {
  await page.goto('/#world');
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.getByRole('button', { name: 'HAIL TAXI' }).click();
  await page.getByLabel('Ride destination').selectOption('fort');
  await expect.poll(() => page.getByTestId('ride-fare').textContent()).not.toBe('₹28.00');
  await page.getByRole('button', { name: 'Exit ride', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Portfolio Meter' })).toHaveCount(0);
  await page.getByRole('button', { name: 'HAIL AUTO' }).click();
  await expect(page.getByLabel('Ride destination')).toBeVisible();
  await expect(page.getByTestId('ride-fare')).toHaveText('₹23.00');
});

test('theatre autoplay advances and pause holds the current scene', async ({ page }) => {
  await page.goto('/?webgl=off#/place/filmcity');
  await page.getByRole('button', { name: 'TAKE A SEAT' }).click();
  await page.clock.install();
  const theatre = page.getByRole('region', { name: 'Film City story theatre' });
  await theatre.getByRole('button', { name: 'AUTOPLAY', exact: true }).click();
  await page.clock.fastForward(7100);
  await expect(theatre).toContainText('VIT. A place to start.');
  await theatre.getByRole('button', { name: 'PAUSE', exact: true }).click();
  await page.clock.fastForward(15000);
  await expect(theatre).toContainText('VIT. A place to start.');
});

test('drag-to-look remains usable when pointer lock is denied', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('Pointer lock denied')); });
  await page.goto('/?debug#world');
  const canvas=page.locator('.world-container canvas'); await expect(canvas).toHaveAttribute('data-camera-mode','first-person');
  const before=Number(await canvas.getAttribute('data-look-yaw'));
  await page.mouse.move(480,300); await page.mouse.down(); await page.mouse.move(350,280,{steps:4}); await page.mouse.up();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-look-yaw'))).toBeGreaterThan(before+.2);
  await page.keyboard.press('m'); await expect(page.getByRole('dialog',{name:'MUMBAI CITY DIRECTORY'})).toBeVisible();
});

test('phone directional controls move the first-person visitor', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/?debug#world');
  const canvas=page.locator('canvas'); await expect(canvas).toHaveAttribute('data-camera-mode','first-person');
  const before=Number(await canvas.getAttribute('data-world-z'));
  const forward=page.getByRole('button',{name:'Walk forward',exact:true}), box=await forward.boundingBox();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2); await page.mouse.down();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-world-z'))).toBeLessThan(before-.5);
  await page.mouse.up();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('visitor walks through the research doorway and opens the physical FFprime terminal', async ({ page }) => {
  await page.goto('/?debug#world');
  const canvas=page.locator('canvas'); await expect(canvas).toHaveAttribute('data-camera-mode','first-person');
  await page.keyboard.press('m'); await page.getByRole('button',{name:'Travel to Fort Research Institute',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-world-z','-35.000');
  await page.keyboard.down('w'); await expect.poll(async()=>Number(await canvas.getAttribute('data-world-x'))).toBeLessThan(-9.7); await page.keyboard.up('w');
  await expect(page.locator('.proximity-prompt')).toContainText('Read the FFprime research');
  await page.keyboard.press('e'); await expect(page.getByRole('dialog',{name:'CASE STUDY / FFprime'})).toBeVisible();
});
