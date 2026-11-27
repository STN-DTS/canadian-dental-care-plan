import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

import base from '../playwright.config';

const frontendDir = resolve(import.meta.dirname, '..');
const port = process.env.PORT ?? '3101';
const baseServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

if (!baseServer) {
  throw new Error('Expected the base Playwright web server configuration');
}

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'session-storage.spec.ts',
  testIgnore: [],
  outputDir: resolve(frontendDir, 'test-results/session-storage'),
  use: { ...base.use, baseURL: `http://localhost:${port}/` },
  webServer: {
    ...baseServer,
    cwd: frontendDir,
    url: `http://${process.env.WSL_DISTRO_NAME ? '[::1]' : 'localhost'}:${port}/`,
    reuseExistingServer: false,
    env: {
      ...baseServer.env,
      PORT: port,
      AUTH_LOGOUT_REDIRECT_URL: `http://localhost:${port}/`,
      AUTH_RAOIDC_BASE_URL: `http://localhost:${port}/oidc`,
      AUTH_RASCL_LOGOUT_URL: `http://localhost:${port}/`,
      ENABLED_FEATURES: 'view-letters,status,show-prototype-banner,doc-upload',
      MOCK_AUTH_ALLOWED_REDIRECTS: `http://localhost:${port}/auth/callback/raoidc`,
      SESSION_STORAGE_TYPE: 'memory',
      SESSION_EXPIRES_SECONDS: '15',
      SESSION_STORAGE_TTL_OFFSET_SECONDS: '0',
      AUDIT_LOG_ENABLED: 'false',
      OTEL_SDK_DISABLED: 'true',
    },
  },
});
