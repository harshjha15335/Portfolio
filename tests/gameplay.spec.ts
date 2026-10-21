import { expect, test, type Page } from '@playwright/test';

/** DEV-only hook (?debug) used to stand the visitor at an exhibit without scripting a long walk. */
const standAt = (page: Page, view: { x: number; z: number; yaw: number; pitch: number }) => page.evaluate(v => (window as unknown as { __world: { frameView: (v: unknown) => void } }).__world.frameView(v), view);
const ready = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug#world');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-mode', 'first-person', { timeout: 90_000 });
  await page.waitForFunction(() => (window as unknown as { __world?: unknown }).__world);
};

test('departure board marks a destination and the waypoint leads there', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await expect(page.getByRole('complementary', { name: 'Orientation' })).toBeVisible();
  await standAt(page, { x: 4.6, z: 9.2, yaw: 0, pitch: .3 });
  await expect(page.locator('.proximity-prompt')).toContainText('Read the departure board');
  await page.keyboard.press('e');
  const board = page.getByRole('dialog', { name: 'CST / DEPARTURE BOARD' });
  await expect(board.getByRole('button', { name: /Research/ })).toBeVisible();
  await board.getByRole('button', { name: /Research/ }).click();
  await board.getByRole('button', { name: 'MARK ON MY MAP' }).click();
  await expect(page.getByRole('status', { name: 'Next stop Fort Open Source Hall' })).toContainText('ahead');
  await standAt(page, { x: -5.1, z: -35, yaw: Math.PI / 2, pitch: 0 });
  await expect(page.getByRole('status', { name: 'Next stop Fort Open Source Hall' })).toHaveCount(0);
  await page.keyboard.press('j');
  await expect(page.getByRole('dialog', { name: 'EXPLORATION JOURNAL' }).locator('.journal-achievements li.done')).toContainText('First Steps');
  expect(errors).toEqual([]);
});

test('Fort gradient check can be retried and solved, and the journal records it', async ({ page }) => {
  await ready(page);
  await standAt(page, { x: -8, z: -36.45, yaw: 0, pitch: -.2 });
  await expect(page.locator('.proximity-prompt')).toContainText('Run the gradient check');
  await page.keyboard.press('e');
  const panel = page.getByRole('dialog', { name: 'FORT / GRADIENT CHECK' });
  await panel.getByRole('button', { name: 'RUN CHECK' }).first().click();
  await expect(panel.locator('output.fail')).toContainText('FAIL');
  await panel.getByRole('button', { name: 'THIS ONE' }).first().click();
  await expect(panel.locator('.gradient-verdict')).toContainText('Not that one');
  await panel.getByRole('button', { name: 'THIS ONE' }).nth(2).click();
  await expect(panel.locator('.gradient-verdict')).toContainText('Correct');
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0);
  await page.keyboard.press('j');
  const journal = page.getByRole('dialog', { name: 'EXPLORATION JOURNAL' });
  await expect(journal.locator('.journal-achievements li.done')).toContainText('Finite Differences');
  await expect(journal).toContainText('Fort Open Source Hall');
});

test('the fellow contributor gives a skippable guided tour that frames each exhibit', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('m'); await page.getByRole('button', { name: 'Travel to Fort Open Source Hall', exact: true }).click();
  await expect(page.locator('.proximity-prompt')).toContainText('The fellow contributor');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'TAKE THE GUIDED TOUR' }).click();
  const tour = page.getByRole('region', { name: 'Guided tour: Fort Open Source Hall' });
  await expect(tour).toContainText('Open source, reviewed upstream');
  await tour.getByRole('button', { name: 'NEXT' }).click(); await tour.getByRole('button', { name: 'NEXT' }).click();
  await expect(tour).toContainText('The field table');
  await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-world-x'))).toBeLessThan(-10);
  await tour.getByRole('button', { name: 'OPEN THIS EXHIBIT' }).click();
  await expect(page.getByRole('dialog', { name: 'FORT / FIELD TABLE' })).toBeVisible();
  await page.keyboard.press('Escape');
  await tour.getByRole('button', { name: 'Leave the tour' }).click();
  await expect(tour).toHaveCount(0);
});

test('theatre can skip to the end, restart and exit by keyboard', async ({ page }) => {
  await page.goto('/?webgl=off#/place/filmcity');
  await page.getByRole('button', { name: 'TAKE A SEAT' }).click();
  const theatre = page.getByRole('region', { name: 'Film City story theatre' });
  await theatre.focus(); await page.keyboard.press('End');
  await expect(theatre.getByRole('button', { name: 'GET IN TOUCH' })).toBeVisible();
  await theatre.getByRole('button', { name: '↺ RESTART' }).click();
  await expect(theatre).toContainText('1 / 9');
  await theatre.focus(); await page.keyboard.press('ArrowRight'); await expect(theatre).toContainText('2 / 9');
  await theatre.getByRole('button', { name: 'EXIT THEATRE' }).click();
  await expect(page.getByRole('dialog', { name: 'Film City Talkies' })).toHaveCount(0);
});
