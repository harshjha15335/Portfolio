import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
// Usage: node scripts/film/comp.mjs <work> [fromFrame toFrame]. Reads <work>/shots-out, writes <work>/comp-out/0000.png ….
import { resolve } from 'node:path';

const dir = new URL('.', import.meta.url).pathname, work = resolve(process.argv[2] ?? '.'), out = `${work}/comp-out`; await mkdir(out, { recursive: true });
const [from = 0, to = 1008, step = 1] = process.argv.slice(3).map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 544 } });
page.on('pageerror', e => console.log('ERROR', e.message));
await page.goto(`file://${dir}comp.html?work=${encodeURIComponent(work)}`); await page.waitForFunction(() => window.renderAt);
for (let i = from; i < to; i += step) {
  await page.evaluate(([t, i]) => window.renderAt(t, i), [i / 24, i]);
  await page.screenshot({ path: `${out}/${String(i).padStart(4, '0')}.png` });
}
await browser.close();
