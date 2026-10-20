import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://portfolio-beta-murex-52.vercel.app/';
const text = (path: string) => new TextDecoder().decode(readFileSync(path));

describe('production metadata', () => {
  const html = text('index.html');
  it('declares the deployed canonical origin, og:url and a social image', () => {
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}" />`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}" />`);
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}og-image.jpg" />`);
    expect(readFileSync('public/og-image.jpg').length).toBeGreaterThan(10_000);
  });
  it('leaves no placeholder domain or old campus wording', () => {
    for (const file of ['index.html', 'public/sitemap.xml', 'public/robots.txt']) expect(text(file)).not.toMatch(/YOUR-DOMAIN|example\//);
    expect(html).not.toMatch(/campus/i);
  });
  it('lists the canonical origin in the sitemap and points robots at it', () => {
    expect(text('public/sitemap.xml')).toContain(`<loc>${ORIGIN}</loc>`);
    expect(text('public/robots.txt')).toContain(`Sitemap: ${ORIGIN}sitemap.xml`);
  });
});
