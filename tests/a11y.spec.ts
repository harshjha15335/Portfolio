import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility acceptance for the HTML side of the portfolio (what a keyboard, screen-reader or phone visitor
 * relies on). axe checks WCAG 2.1 A/AA rules; serious and critical findings fail. The 3D canvas is excluded:
 * its accessible equivalent is the intro, the city directory, the place pages and the case studies, which are scanned here.
 */
const PAGES: Array<[string, string]> = [
  ['intro', '/?webgl=off'],
  ['case study', '/#/project/reco'],
  ['flagship lab', '/#/project/northstar'],
  ['district page', '/?webgl=off#/place/juhu'],
  ['3D unavailable', '/?webgl=off#world'],
];

async function settle(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

for (const [name, url] of PAGES) {
  test(`a11y: ${name} has no serious or critical WCAG A/AA violations`, async ({ page }) => {
    await settle(page, url);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('canvas').analyze();
    const serious = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map(v => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('a11y: keyboard focus is always visible on the intro and a case study', async ({ page }) => {
  await settle(page, '/#/project/reco');
  const missing: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null; if (!el || el === document.body) return null;
      const s = getComputedStyle(el), ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow = s.boxShadow !== 'none';
      return { label: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}"`, visible: ring || shadow };
    });
    if (info && !info.visible) missing.push(info.label);
  }
  expect([...new Set(missing)]).toEqual([]);
});

test('a11y: touch targets on a phone are at least 24 × 24 px', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await settle(page, '/?webgl=off#/place/juhu');
  // WCAG 2.2 target size (minimum): interactive controls, except links inside running text.
  const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, [role="button"]')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
    .filter(el => !(el.tagName === 'A' && el.closest('p, li') && getComputedStyle(el).display === 'inline'))
    .filter(el => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; })
    .map(el => { const r = el.getBoundingClientRect(); return `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`; }));
  expect(small).toEqual([]);
  await context.close();
});
