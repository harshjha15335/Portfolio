import { expect, test } from '@playwright/test';

// Short tour (1 s per stop) so it fits a software-WebGL run; real visitors use the 4 s + 12 s default.
test('visitor benchmark tours every district and offers copyable results', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/?bench&seconds=1');
  const panel = page.getByRole('region', { name: 'Performance benchmark' });
  const start = panel.getByRole('button', { name: /START BENCHMARK/ });
  await expect(start).toBeEnabled({ timeout: 120_000 });
  await start.click();
  await expect(panel.getByRole('button', { name: 'COPY RESULTS' })).toBeVisible({ timeout: 480_000 });
  const table = await panel.locator('.bench-table').textContent();
  for (const id of ['cst', 'fort', 'bkc', 'andheri', 'powai', 'dadar', 'worli', 'juhu', 'filmcity']) expect(table).toMatch(new RegExp(`\\n${id}\\s+\\d`));
  expect(table).toContain('GPU:');
});
