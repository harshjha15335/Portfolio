import { expect, test } from '@playwright/test';
import { districts } from '../src/data/city';

for (const kind of ['TAXI', 'AUTO']) {
  test(`${kind.toLowerCase()} can be boarded, metered, routed and exited at its destination`, async ({ page }) => {
    // The hailed cab drives in from up the road with the traffic, which takes minutes of wall time under software rendering.
    test.setTimeout(900_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#world');
    await expect(page.locator('.world-container canvas')).toBeVisible();
    await expect(page.locator('.loader')).toHaveCount(0);
    await page.getByRole('button', { name: `HAIL ${kind}` }).click();
    const meter = page.getByRole('region', { name: 'Portfolio Meter' });
    await expect(meter).toContainText(kind === 'TAXI' ? /kaali-peeli/i : /auto rickshaw/i);
    await expect(page.getByLabel('Ride destination')).toBeVisible({ timeout: 300_000 });
    await expect(page.getByTestId('ride-fare')).toHaveText(kind === 'TAXI' ? '₹28.00' : '₹23.00');
    await page.getByLabel('Ride destination').selectOption(kind === 'TAXI' ? 'fort' : 'cst');
    // The base fare covers the first 1.5 km, so the meter shows the ride by its distance first.
    await expect.poll(() => page.getByTestId('ride-distance').textContent(), { timeout: 120_000 }).not.toBe('0.0 km');
    if (kind === 'TAXI') await page.getByRole('button', { name: 'SKIP TO ARRIVAL' }).click();
    // The auto drives the whole way (round the street's U-turns); the taxi skips.
    await expect(meter.getByRole('status')).toContainText('Arrived', { timeout: kind === 'TAXI' ? 30_000 : 420_000 });
    await page.getByRole('button', { name: 'STEP OUT & MEET THE GUIDE' }).click();
    await expect(page.getByRole('dialog', { name: kind === 'TAXI' ? 'Fort Open Source Hall' : 'CST Arrival Terminus' })).toBeVisible();
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
    if (district.id === 'powai') await expect(dialog.locator('.district-projects article')).toHaveCount(6);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('skill evidence opens the existing case study and theatre supports scene controls', async ({ page }) => {
  await page.goto('/#/place/andheri');
  await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
  await page.getByRole('navigation', { name: 'Shops' }).getByRole('button', { name: /Frontend Studio/ }).click();
  await page.getByRole('button', { name: 'React', exact: true }).click();
  await page.getByRole('article', { name: 'React evidence' }).getByRole('button', { name: /NORTHSTAR/ }).click();
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

test('Andheri shops show evidence and run each bench', async ({ page }) => {
  await page.goto('/#/place/andheri');
  await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
  const shops = page.getByRole('region', { name: 'Andheri Tech Bazaar shops' });
  const sign = (name: RegExp) => shops.getByRole('navigation', { name: 'Shops' }).getByRole('button', { name });
  // Language Lane: résumé-only skills say so; the Python bench refuses a non-traceless tensor.
  await shops.getByRole('button', { name: 'Java RÉSUMÉ ONLY' }).click();
  await expect(shops.getByRole('article', { name: 'Java evidence' })).toContainText('No public repository uses it');
  await shops.getByLabel('Θzz').fill('0.9');
  await expect(shops.getByRole('alert')).toContainText('must be traceless');
  // Frontend Studio: the real RideMeter fires its callbacks.
  await sign(/Frontend Studio/).click();
  await shops.getByRole('button', { name: 'SKIP TO ARRIVAL' }).click();
  await expect(shops.getByRole('list', { name: 'Callbacks fired' })).toContainText('onSkip()');
  // Backend Workshop: a missing token stops at authenticate with the service's real message.
  await sign(/Backend Workshop/).click();
  await shops.locator('label', { hasText: /^Authorization/ }).locator('select').selectOption('missing');
  await expect(shops.getByRole('status')).toContainText('HTTP 401');
  await expect(shops.locator('.hop-list li.stop')).toContainText('authenticate');
  // DevOps Garage: failing a backend step blocks RootCause's gated deploy.
  await sign(/DevOps Garage/).click();
  await shops.getByRole('button', { name: /backend: pytest -q \(pass\)/ }).click();
  await expect(shops.getByRole('status')).toContainText('Deploy Azure does not run');
  // AI Integration Lab: an invented field is rejected by the schema.
  await sign(/AI Integration Lab/).click();
  await expect(shops.getByRole('status')).toContainText('Rejected by the schema');
  await expect(shops.locator('.lab-table')).toContainText('target_price');
  await shops.locator('label', { hasText: /^Model reply preset/ }).locator('select').selectOption('buy');
  await expect(shops.getByRole('status')).toContainText('Accepted as a BUY proposal');
});

test('Powai ASTFLOW lab replays the fusion experiment', async ({ page }) => {
  await page.goto('/#/place/powai');
  await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
  const lab = page.getByRole('region', { name: 'ASTFLOW Engineering Lab' });
  await expect(lab).toContainText('team ByteCoders');
  await expect(lab.locator('.astflow-stats')).toContainText('0.5509');
  await expect(lab.locator('.astflow-ledger')).toHaveCount(2);
  // BM25 ranks this answer #73; the baseline 1:1 fusion pushes it to #169, BM25-only weights bring it back.
  await expect(lab.getByRole('status')).toHaveText('169');
  await lab.locator('label', { hasText: /^Weights/ }).locator('select').selectOption('1:0 (BM25 only)');
  await expect(lab.getByRole('status')).toContainText('73 (▲ 96)');
  await expect(lab).toContainText('E001: REJECT');
  await expect(lab).toContainText('E002: REJECT');
});

test('reduced-motion transport arrives directly and can be reboarded', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#world');
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.getByRole('button', { name: 'HAIL AUTO' }).click();
  await page.getByLabel('Ride destination').selectOption('fort');
  await expect(page.getByRole('region', { name: 'Portfolio Meter' }).getByRole('status')).toContainText('Arrived');
  await page.getByRole('button', { name: 'Exit ride', exact: true }).click();
  await page.getByRole('button', { name: 'HAIL TAXI' }).click();
  await page.getByLabel('Ride destination').selectOption('cst');
  await expect(page.getByRole('region', { name: 'Portfolio Meter' }).getByRole('status')).toContainText('Arrived');
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
  test.slow();
  await page.goto('/#world');
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.getByRole('button', { name: 'HAIL TAXI' }).click();
  await expect(page.getByLabel('Ride destination')).toBeVisible({ timeout: 300_000 });
  await page.getByLabel('Ride destination').selectOption('fort');
  await expect.poll(() => page.getByTestId('ride-distance').textContent(), { timeout: 120_000 }).not.toBe('0.0 km');
  await page.getByRole('button', { name: 'Exit ride', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Portfolio Meter' })).toHaveCount(0);
  await page.getByRole('button', { name: 'HAIL AUTO' }).click();
  await expect(page.getByLabel('Ride destination')).toBeVisible({ timeout: 300_000 });
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
  await page.keyboard.press('m'); await page.getByRole('button',{name:'Travel to Fort Open Source Hall',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-world-z','-35.000');
  await page.keyboard.down('w'); await expect.poll(async()=>Number(await canvas.getAttribute('data-world-x'))).toBeLessThan(-9.7); await page.keyboard.up('w');
  await expect(page.locator('.proximity-prompt')).toContainText('Read the FFprime work');
  await page.keyboard.press('e'); await expect(page.getByRole('dialog',{name:'CASE STUDY / FFprime'})).toBeVisible();
});
