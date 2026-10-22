import { expect, test, type Page } from '@playwright/test';

/** Open a project's case study from the command palette, the way a visitor without the world finds it. */
async function search(page: Page, query: string) {
  await page.keyboard.press('Control+k');
  const box = page.getByRole('textbox', { name: 'Search commands' });
  await box.fill(query);
  await box.press('Enter');
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

test('case studies expose every project, a verifiable résumé and real code links', async ({ page, request }) => {
  await page.goto('/?webgl=off');
  await page.keyboard.press('Control+k');
  for (const name of ['FFprime', 'NORTHSTAR', 'RECO', 'MoneyMetrics', 'RepoLens', 'Compiler Lab']) {
    await page.getByRole('textbox', { name: 'Search commands' }).fill(name);
    await expect(page.locator('.command-results button').first()).toContainText(name);
  }
  await page.keyboard.press('Escape');
  // The palette closes after its exit animation; Ctrl+K toggles, so wait before opening it again.
  await expect(page.getByRole('textbox', { name: 'Search commands' })).toHaveCount(0);
  const resume = await request.get('/resume/Harsh-Jha-Resume.pdf');
  expect(resume.ok()).toBe(true);
  expect(resume.headers()['content-type']).toContain('application/pdf');
  expect((await resume.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'RÉSUMÉ' })).toHaveAttribute('href', '/resume/Harsh-Jha-Resume.pdf');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'GITHUB' })).toHaveAttribute('href', 'https://github.com/harshjha15335');
  await search(page, 'FFprime');
  const dialog = page.getByRole('dialog', { name: 'CASE STUDY / FFprime' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'VIEW CODE' })).toHaveAttribute('href', 'https://github.com/theochem/ffprime');
  await expect(dialog).toContainText('résumé reported');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('deep links refresh, set project metadata, and close into the city', async ({ page }) => {
  await page.goto('/#/project/reco');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / RECO' })).toBeVisible();
  await expect(page).toHaveTitle('RECO — Harsh Jha');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / RECO' })).toContainText('seeded');
  await page.getByRole('button', { name: 'Close CASE STUDY / RECO' }).click();
  await expect(page).toHaveURL(/#world$/);
  // Closing the shared case study starts the city: a canvas where the browser has WebGL, the stated fallback where it has none.
  await expect(page.locator('.world-container canvas').or(page.getByRole('status').filter({ hasText: '3D experience unavailable' }))).toBeVisible();
});

test('browser back and forward restore project overlays', async ({ page }) => {
  await page.goto('/?webgl=off');
  await search(page, 'NORTHSTAR');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / NORTHSTAR' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / NORTHSTAR' })).toBeVisible();
});

test('command palette searches technologies, executes keys, and has an empty state', async ({ page }) => {
  await page.goto('/?webgl=off');
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

test('local demonstrations respond to input', async ({ page }) => {
  await page.goto('/#/project/ffprime');
  await page.getByRole('button', { name: '+ Quadrupole' }).click();
  await expect(page.getByRole('img', { name: 'Monopole, dipole and quadrupole potential contour visualization' })).toBeVisible();
  await page.goto('/#/project/reco');
  await page.locator('.pipeline button').filter({ hasText: 'Deterministic guardrails' }).click();
  await expect(page.locator('.pipeline-note strong')).toHaveText('Deterministic guardrails');
});

test('Fort coordinate workstation converts, agrees and refuses a non-traceless tensor', async ({ page }) => {
  await page.goto('/#/project/ffprime');
  const station = page.getByRole('region', { name: 'Coordinate workstation: Cartesian to spherical multipoles' });
  await expect(station.locator('tbody tr').first()).toContainText('0.7000');
  await expect(station).toContainText('max |Θ − Θ′|');
  await station.getByLabel('Let me set Θzz (break tracelessness)').check();
  await expect(station.getByRole('alert')).toHaveText(/quadrupole tensor must be traceless, got trace = 3.000000e-01/);
});

test('Powai flagship labs run their ported project logic', async ({ page }) => {
  await page.goto('/#/project/northstar');
  const verdict = page.locator('.lab-verdict');
  await expect(verdict).toHaveText(/All 29 checks pass/);
  await page.getByLabel('Kill switch engaged').check();
  await expect(verdict).toHaveText('1 of 29 checks fail: kill_switch.');
  await expect(page.getByRole('button', { name: 'SEND TO PAPER BROKER →' })).toBeDisabled();
  await page.getByLabel('Kill switch engaged').uncheck();
  await page.getByRole('button', { name: 'SEND TO PAPER BROKER →' }).click();
  await expect(page.locator('.lab-note[role=status]')).toHaveText('BUY 1 ITC @ ₹420 filled by the paper broker.');
  await page.goto('/#/project/moneymetrics');
  await expect(page.locator('.lab-table tr.flagged')).toContainText('Food & Drinks');
  await page.getByLabel('Make this week unusual for').selectOption('');
  await expect(page.locator('.lab-table tr.flagged')).toHaveCount(0);
  await page.getByRole('button', { name: 'PARSE SMS' }).click();
  await expect(page.locator('output.lab-note')).toContainText('Expense · ₹1,250 · 2026-10-05 · HDFC Transaction');
  await page.goto('/#/project/compilerlab');
  await expect(page.getByRole('region', { name: 'Compiler Lab Workshop working demo' })).toContainText('DFA · 4 STATES');
  await page.getByLabel('Test string').fill('abba');
  await expect(page.locator('.lab-verdict')).toContainText('REJECT');
  await page.getByLabel('Regular expression').fill('(ab');
  await expect(page.locator('.lab-verdict')).toContainText('no closing');
  await page.goto('/#/project/repolens');
  await page.getByRole('button', { name: 'where is divide defined' }).click();
  await expect(page.locator('.lab-columns > div').nth(2).locator('li').first()).toContainText('Calculator.divide');
  await expect(page.locator('.code-chunk pre')).toContainText('Cannot divide by zero');
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

test('WebGL failure keeps the city directory, districts and project navigation', async ({ page }) => {
  await page.goto('/?webgl=off#world');
  await expect(page.getByRole('status').filter({ hasText: '3D experience unavailable' })).toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/mode-intro/);
  await page.getByRole('button', { name: 'OPEN THE CITY DIRECTORY' }).click();
  const directory = page.getByRole('dialog', { name: 'MUMBAI CITY DIRECTORY' });
  await expect(directory.locator('.city-map-stop')).toHaveCount(9);
  await directory.getByRole('button', { name: 'Travel to Juhu Studio', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Juhu Studio', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await search(page, 'Go to FFprime');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / FFprime' })).toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/mode-intro/);
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
  await expect(page.getByRole('status').filter({ hasText: '3D experience unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'OPEN THE CITY DIRECTORY' })).toBeVisible();
  await expect(canvas).toHaveCount(0);
});

test('a shared case study loads without 3D and hides a missing or invalid résumé', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('**/resume/Harsh-Jha-Resume.pdf', route => route.fulfill({ status: 200, contentType: 'text/html', body: 'Missing PDF' }));
  const response = page.waitForResponse(/\/resume\/Harsh-Jha-Resume\.pdf$/);
  await page.goto('/#/project/reco');
  await expect(page.getByRole('dialog', { name: 'CASE STUDY / RECO' })).toBeVisible();
  await response;
  await page.evaluate(() => document.fonts.ready);
  expect(requests.some(url => /fonts\.(googleapis|gstatic)\.com/.test(url))).toBe(false);
  expect(await page.evaluate(() => ['Barlow Condensed', 'DM Sans', 'IBM Plex Mono'].every(family => [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded')))).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: /RÉSUMÉ/ })).toHaveCount(0);
  await expect(page.locator('.world-container canvas')).toHaveCount(0);
  expect(requests.some(url => url.includes('/src/core/WorldEngine') || /\/deps\/(three|cannon-es)/.test(url))).toBe(false);
  await page.getByRole('button', { name: 'Close CASE STUDY / RECO' }).click();
  // The world loads once the case study closes: a canvas where the browser has WebGL, the stated fallback where it has none (headless Firefox on CI).
  await expect(page.locator('.world-container canvas').or(page.getByRole('status').filter({ hasText: '3D experience unavailable' }))).toBeVisible();
  expect(requests.some(url => url.includes('/src/core/WorldEngine'))).toBe(true);
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
  test('intro, world, and case study fit a phone screen', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'ENTER CITY' }).click();
    await expect(page.getByText('DRAG TO LOOK · HOLD ARROWS TO WALK')).toBeVisible();
    await expect(page.locator('.world-container canvas')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/world-mobile.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'CITY DIRECTORY' }).click();
    await page.getByRole('button', { name: 'Travel to Fort Open Source Hall', exact: true }).click();
    await page.getByRole('button', { name: /Talk · The fellow contributor/ }).click();
    await page.getByRole('button', { name: 'SHOW ME AROUND' }).click();
    await page.getByRole('button', { name: 'OPEN FFPRIME CASE STUDY' }).click();
    const dialog = page.getByRole('dialog', { name: 'CASE STUDY / FFprime' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
});
