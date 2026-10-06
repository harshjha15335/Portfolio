import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`street arrival keeps its primary actions in view at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const home = page.locator('.intro');
    const title = home.getByRole('heading', { level: 1 });
    await expect(title).toContainText('HARSH');
    await expect(title).toContainText('MUMBAI');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(home).toContainText('A portfolio you walk through.');
    await expect(home.getByRole('button', { name: 'ENTER CITY' })).toBeInViewport({ ratio: 1 });
    await expect(home.getByRole('button', { name: 'QUICK VIEW' })).toBeInViewport({ ratio: 1 });
    await home.getByRole('button', { name: 'QUICK VIEW' }).click();
    await expect(page.locator('.quick-view')).toBeVisible();
    await expect(page.locator('.project-row')).toHaveCount(6);
  });
}

for (const motion of ['reduce', 'no-preference'] as const) {
test(`phone case-study spreads remain readable and restore keyboard focus with ${motion} motion`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto('/#quick');
  for (const name of ['FFprime', 'NORTHSTAR', 'RECO', 'MoneyMetrics', 'Meeting Intelligence', 'RideFlow']) {
    const trigger = page.getByRole('button', { name: `Open ${name} case study` });
    await trigger.click();
    const spread = page.getByRole('dialog', { name: `CASE STUDY / ${name}` });
    await expect(spread).toBeVisible();
    await expect.poll(() => spread.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(spread.getByRole('link', { name: 'VIEW CODE' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(spread).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
}

test('short landscape arrival keeps both ways into the portfolio reachable', async ({ page }) => {
  await page.setViewportSize({width:650,height:514}); await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'ENTER CITY'})).toBeVisible();
  await page.locator('.intro').getByRole('button',{name:'QUICK VIEW'}).click();
  await expect(page.locator('.project-row')).toHaveCount(6);
});

test('poster directory fast travel arrives at a working research landmark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#world');
  await expect(page.locator('.world-container canvas')).toBeVisible();
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.keyboard.press('m');
  const directory = page.getByRole('dialog', { name: 'MUMBAI CITY DIRECTORY' });
  await expect(directory).toBeVisible();
  await expect(directory.locator('.city-map-stop')).toHaveCount(9);
  await directory.getByRole('button', { name: 'Travel to Fort Research Institute' }).click();
  await expect(directory).toHaveCount(0);
  await expect(page.locator('.proximity-prompt')).toContainText('The research fellow');
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog', { name: 'Fort Research Institute' })).toBeVisible();
  await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
  await page.getByRole('button', { name: 'OPEN FFPRIME CASE STUDY' }).click();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / FFprime' })).toBeVisible();
});
