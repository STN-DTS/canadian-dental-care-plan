import { defineConfig } from '@playwright/test';

import base from '../playwright.config';

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'error-correlation.spec.ts',
  testIgnore: [],
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: { ...base.use, baseURL: 'http://localhost:3011' },
  webServer: undefined,
});
