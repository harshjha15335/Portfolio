import { expect, test, type Page } from '@playwright/test';
import { DISTRICT_EXHIBITS } from '../src/data/districtExhibits';
import { cityZones } from '../src/game/World/streetLayout';

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
/** Reading spot of an exhibit, taken from the exhibit data so the test follows a board when it moves (PR #19 moved several indoors). */
const exhibit = (id: string) => { const e = DISTRICT_EXHIBITS.find(x => x.id === id)!; return board(cityZones.find(z => z.id === e.district)!.originX, e.x, e.z); };
const prompt = (page: Page) => page.locator('.proximity-prompt');

test('BKC rate-limit console fails fast sends and is solved at the refill rate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await standAt(page, exhibit('bkc-ratelimit'));
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
  await standAt(page, exhibit('worli-case-0'));
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
  await standAt(page, exhibit('dadar-stop-0'));
  await expect(prompt(page)).toContainText('Platform 1', { timeout: 90_000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toContainText('PLATFORM 1 OF 6');
  await page.getByRole('button', { name: 'PLATFORM 2 →' }).click();
  await expect(page.getByRole('dialog')).toContainText('PLATFORM 2 OF 6');
  await expect(page.getByRole('dialog')).toContainText('2 OF 6 PLATFORMS READ');
});

test('Powai boards open the project, and the Film City scene board starts the film anywhere', async ({ page }) => {
  await ready(page);
  await standAt(page, exhibit('northstar'));
  await expect(prompt(page)).toContainText('Open NORTHSTAR', { timeout: 90_000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog').first()).toContainText('NORTHSTAR');
  await page.keyboard.press('Escape');
  await standAt(page, exhibit('filmcity-scenes'));
  await expect(prompt(page)).toContainText('Read the scene board', { timeout: 90_000 });
  await page.keyboard.press('e');
  await page.getByRole('button', { name: /Open source/ }).click();
  await expect(page.getByRole('region', { name: 'Film City story theatre' })).toContainText('4 / 9');
});
