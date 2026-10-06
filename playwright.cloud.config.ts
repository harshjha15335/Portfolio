import { defineConfig } from '@playwright/test';
import original from './playwright.config';

/** Linux/cloud override; keep the repository's Edge configuration available. */
export default defineConfig({
  ...original,
  use: {
    ...original.use,
    channel: undefined,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--enable-unsafe-swiftshader'],
    },
  },
});
