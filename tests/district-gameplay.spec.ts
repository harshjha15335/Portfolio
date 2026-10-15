import { expect, test, type Page } from '@playwright/test';

/** DEV-only hook (?debug) used to stand the visitor at a board without scripting a long walk. */
const standAt = (page: Page, view: { x: number; z: number; yaw: number; pitch: number }) => page.evaluate(v => (window as unknown as { __world: { frameView: (v: unknown) => void } }).__world.frameView(v), view);
const ready = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug#world');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-mode', 'first-person', { timeout: 90_000 });
  await page.waitForFunction(() => (window as unknown as { __world?: unknown }).__world);
  await page.getByRole('button', { name: 'SKIP INTRO / EXPLORE CITY' }).click();
};
/** Reading spot of a board at local (x, z) in the district whose origin is `origin`. */
const board = (origin: number, x: number, z: number) => ({ x: origin + x + (x > 0 ? -1.9 : 1.9), z, yaw: x > 0 ? -Math.PI / 2 : Math.PI / 2, pitch: -.07 });
const prompt = (page: Page) => page.locator('.proximity-prompt');

test('BKC rate-limit console fails fast sends and is solved at the refill rate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await standAt(page, board(600, 9.8, -24));
  await expect(prompt(page)).toContainText('Run the rate-limit console', { timeout: 90_000 });
  await page.keyboard.press('e');
  const panel = page.getByRole('dialog', { name: 'BKC / RATE-LIMIT CONSOLE' });
  await panel.getByRole('button', { name: 'RUN INGESTION' }).click();
  await expect(panel.locator('.rate-verdict')).toContainText('Refused requests');
  await panel.getByRole('button', { name: '2 / s' }).click();
  await panel.getByRole('button', { name: 'RUN INGESTION' }).click();
  await expect(panel.locator('.rate-verdict')).toContainText('Clean');
  await page.keyboard.press('Escape'); await page.keyboard.press('j');
  await expect(page.getByRole('dialog', { name: 'EXPLORATION JOURNAL' }).locator('.journal-achievements li.done')).toContainText('Systems Thinker');
  expect(errors).toEqual([]);
});

test('Worli evidence case asks what stands behind a claim', async ({ page }) => {
  await ready(page);
  await standAt(page, board(3000, -10.9, 3.5));
  await expect(prompt(page)).toContainText('Check the receipt', { timeout: 90_000 });
  await page.keyboard.press('e');
  const panel = page.getByRole('dialog', { name: /^WORLI \// });
  await panel.getByRole('button', { name: 'A PUBLIC RECORD' }).click();
  await expect(panel.locator('.gradient-verdict')).toContainText('Not quite');
  await panel.getByRole('button', { name: 'RÉSUMÉ REPORTED' }).click();
  await expect(panel.locator('.gradient-verdict')).toContainText('Right');
});

test('Dadar platforms step along the journey', async ({ page }) => {
  await ready(page);
  await standAt(page, board(2400, 6.5, -3));
  await expect(prompt(page)).toContainText('Platform 1', { timeout: 90_000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toContainText('PLATFORM 1 OF 6');
  await page.getByRole('button', { name: 'PLATFORM 2 →' }).click();
  await expect(page.getByRole('dialog')).toContainText('PLATFORM 2 OF 6');
  await expect(page.getByRole('dialog')).toContainText('2 OF 6 PLATFORMS READ');
});

test('Powai boards open the project, and the Film City scene board starts the film anywhere', async ({ page }) => {
  await ready(page);
  await standAt(page, board(1800, 8.9, 8));
  await expect(prompt(page)).toContainText('Open NORTHSTAR', { timeout: 90_000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog').first()).toContainText('NORTHSTAR');
  await page.keyboard.press('Escape');
  await standAt(page, board(4200, 6.3, -1));
  await expect(prompt(page)).toContainText('Read the scene board', { timeout: 90_000 });
  await page.keyboard.press('e');
  await page.getByRole('button', { name: /Open source/ }).click();
  await expect(page.getByRole('region', { name: 'Film City story theatre' })).toContainText('4 / 9');
});
