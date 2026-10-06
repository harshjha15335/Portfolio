import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`editorial home keeps its primary actions in view at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const home = page.locator('.intro');
    const title = home.getByRole('heading', { level: 1 });
    await expect(title).toContainText('HARSH');
    await expect(title).toContainText('JHA');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const composition = await home.evaluate(element => {
      let surface: Element | null = element;
      while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
      const field = surface ? getComputedStyle(surface).backgroundColor : '';
      const match = field.match(/[\d.]+/g)?.map(Number) ?? [];
      const heading = element.querySelector('h1')!;
      const text = [heading, ...heading.querySelectorAll('span')];
      return { color: match, fontSize: Math.max(...text.map(part => parseFloat(getComputedStyle(part).fontSize))) };
    });
    // Test the visible field rather than merely the named CSS token.
    expect(composition.color[2]).toBeGreaterThan(200);
    expect(composition.color[2] - composition.color[0]).toBeGreaterThan(100);
    expect(composition.color[2] - composition.color[1]).toBeGreaterThan(80);
    expect(composition.fontSize).toBeGreaterThan(viewport.width * (viewport.width < 760 ? 0.24 : 0.2));
    await expect(home.getByRole('button', { name: 'ENTER WORLD' })).toBeInViewport({ ratio: 1 });
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

test('short landscape home keeps identity and manifesto separate', async ({ page }) => {
  await page.setViewportSize({ width: 650, height: 514 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({
    titleBottom: document.querySelector('.name-jha')!.getBoundingClientRect().bottom,
    manifestoTop: document.querySelector('.home-manifesto')!.getBoundingClientRect().top,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(layout.titleBottom).toBeLessThanOrEqual(layout.manifestoTop);
  expect(layout.overflow).toBe(false);
});

test('poster directory fast travel arrives at a working research landmark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#world');
  await expect(page.locator('.world-container canvas')).toBeVisible();
  await expect(page.locator('.loader')).toHaveCount(0);
  await page.keyboard.press('m');
  const directory = page.getByRole('dialog', { name: 'CAMPUS DIRECTORY' });
  await expect(directory).toBeVisible();
  await expect(directory.locator('.map-pin')).toHaveCount(4);
  await directory.getByRole('button', { name: 'Travel to FFprime' }).click();
  await expect(directory).toHaveCount(0);
  await expect(page.locator('.proximity-prompt')).toContainText('FFprime');
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / FFprime' })).toBeVisible();
});
