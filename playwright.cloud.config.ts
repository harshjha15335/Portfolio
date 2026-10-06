import { defineConfig } from '@playwright/test';
import original from './playwright.config';

/** Linux/cloud override; keep the repository's Edge configuration available. */
export default defineConfig({
  ...original,
  timeout: 90_000,
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
