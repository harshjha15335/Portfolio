import { defineConfig, devices } from '@playwright/test';
import original from './playwright.config';

/**
 * GitHub Actions smoke run on GPU-less runners, in Chromium, Firefox and WebKit, plus phone-sized Chrome and
 * Safari. Only the HTML-side flows and the accessibility checks run here (intro, case studies, labs,
 * fallback); world-rendering specs take minutes each under software WebGL and stay in the local cloud suite.
 */
export default defineConfig({
  ...original,
  grep: /case studies expose|deep links|back and forward|command palette|skip link|local demonstrations|coordinate workstation|flagship labs|WebGL failure|loads without 3D|a11y:/,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { ...original.use, channel: undefined },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: original.use?.viewport } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: original.use?.viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: original.use?.viewport } },
    // Phones: the same flows at phone size with touch (the desktop navigation checks stay on the desktop projects).
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, grep: /deep links|local demonstrations|loads without 3D|a11y:/ },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] }, grep: /deep links|local demonstrations|loads without 3D|a11y:/ },
  ],
});
