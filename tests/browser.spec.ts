import { expect, test, type Page } from '@playwright/test';

async function quick(page: Page) {
  await page.goto('/#quick');
  await expect(page.getByRole('heading', { name: 'Engineering, with evidence.' })).toBeVisible();
}

test('intro enters a rendered world and supports menu and directory', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('HARSH');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('MUMBAI');
  await expect(page.locator('.world-container')).toBeHidden();
  await page.screenshot({ path: 'docs/screenshots/intro-desktop.png' });
  await page.getByRole('button', { name: 'ENTER CITY' }).click();
  await expect(page.getByRole('main', { name: 'Interactive mini Mumbai portfolio city' })).toBeVisible();
  await expect(page.locator('.world-container canvas')).toBeVisible();
  await expect(page.locator('.loader')).toHaveCount(0);
  await expect(page.locator('.street-entry')).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/world-desktop.png' });
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'MUMBAI CITY DIRECTORY' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'WORLD MENU' })).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE EXPLORING' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('quick view exposes all projects, verifiable résumé and real code links', async ({ page, request }) => {
  await quick(page);
  await expect(page.locator('.project-row')).toHaveCount(6);
  await page.screenshot({ path: 'docs/screenshots/quick-desktop.png', fullPage: true });
  const resume = await request.get('/resume/Harsh-Jha-Resume.pdf');
  expect(resume.ok()).toBe(true);
  expect(resume.headers()['content-type']).toContain('application/pdf');
  expect((await resume.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByRole('link', { name: 'DOWNLOAD RÉSUMÉ' })).toHaveAttribute('href', '/resume/Harsh-Jha-Resume.pdf');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'GITHUB' })).toHaveAttribute('href', 'https://github.com/harshjha15335');
  await page.getByRole('button', { name: 'Open FFprime case study' }).click();
  const dialog = page.getByRole('dialog', { name: 'CASE STUDY / FFprime' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'VIEW CODE' })).toHaveAttribute('href', 'https://github.com/theochem/ffprime');
  await expect(dialog).toContainText('résumé reported');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open FFprime case study' })).toBeFocused();
});

test('deep links refresh, set project metadata, and close to quick view', async ({ page }) => {
  await page.goto('/#/project/reco');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / RECO' })).toBeVisible();
  await expect(page).toHaveTitle('RECO — Harsh Jha');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / RECO' })).toContainText('seeded');
  await page.getByRole('button', { name: 'Close CASE STUDY / RECO' }).click();
  await expect(page).toHaveURL(/#quick$/);
  await expect(page.getByRole('heading', { name: 'Engineering, with evidence.' })).toBeVisible();
});

test('browser back and forward restore project overlays', async ({ page }) => {
  await quick(page);
  await page.getByRole('button', { name: 'Open NORTHSTAR case study' }).click();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / NORTHSTAR' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / NORTHSTAR' })).toBeVisible();
});

test('command palette searches technologies, executes keys, and has an empty state', async ({ page }) => {
  await quick(page);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'Search commands' });
  await expect(search).toBeFocused();
  await search.fill('numpy electrostatics');
  await expect(page.locator('.command-results button')).toHaveCount(1);
  await search.press('Enter');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / FFprime' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await search.fill('nonexistent-unfindable');
  await expect(page.getByText('No matches. Try a project name or technology.')).toBeVisible();
  await search.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('keyboard skip link and native modal contain focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to portfolio content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button', { name: 'Open command palette' }).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
});

test('four local demonstrations respond to input', async ({ page }) => {
  await page.goto('/#/project/ffprime');
  await page.getByRole('button', { name: '+ Quadrupole' }).click();
  await expect(page.getByRole('img', { name: 'Monopole, dipole and quadrupole potential contour visualization' })).toBeVisible();
  await page.goto('/#/project/northstar');
  await page.locator('.pipeline button').filter({ hasText: 'Deterministic risk engine' }).click();
  await expect(page.locator('.pipeline-note strong')).toHaveText('Deterministic risk engine');
  await page.goto('/#/project/reco');
  await page.locator('.pipeline button').filter({ hasText: 'Deterministic guardrails' }).click();
  await expect(page.locator('.pipeline-note strong')).toHaveText('Deterministic guardrails');
  await page.goto('/#/project/moneymetrics');
  const income = page.getByRole('slider', { name: 'Monthly income' });
  await income.focus();
  await income.press('ArrowRight');
  await expect(page.locator('.balance > strong')).toHaveText('₹23,000');
});

test('reduced motion follows system preference and user choice persists', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.getByRole('button', { name: 'MOTION: REDUCED' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await page.getByRole('button', { name: 'REDUCE MOTION' }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'REDUCE MOTION' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
});

test('WebGL failure retains usable quick view and project navigation', async ({ page }) => {
  await page.goto('/?webgl=off#world');
  await expect(page.getByRole('status')).toContainText('3D experience unavailable');
  await expect(page.getByRole('heading', { name: 'Engineering, with evidence.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'ENTER WORLD' })).toHaveCount(0);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'Search commands' });
  await search.fill('Go to FFprime');
  await search.press('Enter');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / FFprime' })).toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/mode-quick/);
});

test('WebGL context loss switches a running world to accessible content', async ({ page }) => {
  await page.goto('/#world');
  const canvas = page.locator('.world-container canvas');
  await expect(canvas).toBeVisible();
  await canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    const context = surface.getContext('webgl2') ?? surface.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Browser does not provide WEBGL_lose_context');
    extension.loseContext();
  });
  await expect(page.getByRole('status')).toContainText('3D experience unavailable');
  await expect(page.getByRole('heading', { name: 'Engineering, with evidence.' })).toBeVisible();
  await expect(canvas).toHaveCount(0);
});

test('quick view loads without 3D and hides a missing or invalid résumé', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('**/resume/Harsh-Jha-Resume.pdf', route => route.fulfill({ status: 200, contentType: 'text/html', body: 'Missing PDF' }));
  const response = page.waitForResponse(/\/resume\/Harsh-Jha-Resume\.pdf$/);
  await quick(page);
  await response;
  await page.evaluate(() => document.fonts.ready);
  expect(requests.some(url => /fonts\.(googleapis|gstatic)\.com/.test(url))).toBe(false);
  expect(await page.evaluate(() => ['Barlow Condensed', 'DM Sans', 'IBM Plex Mono'].every(family => [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded')))).toBe(true);
  await expect(page.getByRole('link', { name: /RÉSUMÉ/ })).toHaveCount(0);
  await expect(page.locator('.world-container canvas')).toHaveCount(0);
  expect(requests.some(url => url.includes('/src/core/WorldEngine') || /\/deps\/(three|cannon-es)/.test(url))).toBe(false);
  await page.getByRole('button', { name: 'ENTER WORLD' }).click();
  await expect(page.locator('.world-container canvas')).toBeVisible();
});

test('first-person walking accelerates, stops, pauses in overlays, and resets at eye level', async ({ page }) => {
  await page.goto('/?debug#world');
  const canvas=page.locator('.world-container canvas');
  await expect(canvas).toHaveAttribute('data-camera-mode','first-person');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-eye-height'))).toBeGreaterThan(1.6);
  const origin=Number(await canvas.getAttribute('data-world-z'));
  await page.keyboard.down('w');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-world-z'))).toBeLessThan(origin-.7);
  await page.keyboard.up('w');
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog',{name:'MUMBAI CITY DIRECTORY'})).toBeVisible();
  const paused=await canvas.getAttribute('data-world-z');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700); await page.keyboard.up('ArrowUp');
  await expect(canvas).toHaveAttribute('data-world-z',paused!);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await page.keyboard.press('r');
  await expect(canvas).toHaveAttribute('data-world-z','11.500');
  await expect(page.getByRole('button',{name:'TAKE THE WHEEL'})).toHaveCount(0);
});

test.describe('mobile guided exploration', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('quick view, world, and case study fit a phone screen', async ({ page }) => {
    await quick(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'docs/screenshots/quick-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'ENTER WORLD' }).click();
    await expect(page.getByText('DRAG TO LOOK · HOLD ARROWS TO WALK')).toBeVisible();
    await expect(page.locator('.world-container canvas')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/world-mobile.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'CITY DIRECTORY' }).click();
    await page.getByRole('button', { name: 'Travel to Fort Research Institute', exact: true }).click();
    await page.getByRole('button', { name: /Talk · The research fellow/ }).click();
    await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
    await page.getByRole('button', { name: 'OPEN FFPRIME CASE STUDY' }).click();
    const dialog = page.getByRole('dialog', { name: 'CASE STUDY / FFprime' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
});
