import { defineConfig } from '@playwright/test';
import original from './playwright.config';

/** Linux/cloud override; keep the repository's Edge configuration available. */
export default defineConfig({
  ...original,
  // SwiftShader renders the passenger and arrival flows at about 1 fps; full taxi and moving-ride flows take up to 3.1 min with the load wait.
  timeout: 240_000,
  // The first frame and loader take 20–60 s here (measured 2026-10-19); 12 s waits failed 12 tests that pass once the world is up.
  expect: { timeout: 90_000 },
  use: {
    ...original.use,
    viewport: { width: 960, height: 640 },
    channel: undefined,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--enable-unsafe-swiftshader'],
    },
  },
});
