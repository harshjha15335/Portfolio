import { defineConfig } from '@playwright/test';
import original from './playwright.config';

/**
 * GitHub Actions smoke run: Playwright's bundled Chromium on a GPU-less runner.
 * Only the HTML-side flows run here (quick view, case studies, labs, fallback); world-rendering
 * specs take minutes each under software WebGL and stay in the local cloud suite.
 */
export default defineConfig({
  ...original,
  grep: /quick view exposes|deep links|back and forward|command palette|skip link|local demonstrations|coordinate workstation|flagship labs|WebGL failure|loads without 3D/,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { ...original.use, channel: undefined },
});
