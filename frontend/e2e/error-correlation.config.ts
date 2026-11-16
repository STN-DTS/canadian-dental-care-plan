import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

import base from '../playwright.config';

/**
 * Runs error-correlation.spec.ts against the production build (run `pnpm run build` first).
 * The server's JSON logs go to a file so the spec can check what was logged for a failed request.
 */

const frontendDir = resolve(import.meta.dirname, '..');
const port = 3100;
const baseServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'error-correlation.spec.ts',
  testIgnore: [],
  outputDir: resolve(frontendDir, 'test-results/error-correlation'),
  use: { ...base.use, baseURL: `http://localhost:${port}/` },
  webServer: {
    ...baseServer,
    command: 'mkdir -p test-results && pnpm run start > test-results/error-correlation-server.log 2>&1',
    cwd: frontendDir,
    url: `http://${process.env.WSL_DISTRO_NAME ? '[::1]' : 'localhost'}:${port}/`,
    reuseExistingServer: false,
    env: {
      ...baseServer?.env,
      PORT: String(port),
      // hCaptcha has no mock; the status checker skips it when the feature is off.
      ENABLED_FEATURES: 'status',
      AUDIT_LOG_ENABLED: 'false',
      OTEL_SDK_DISABLED: 'true',
    },
  },
});
