import { reactRouter } from '@react-router/dev/vite';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';

/**
 * Application build and unit test configuration.
 * See vite.server.config.ts for the server build config.
 */
export default defineConfig({
  build: {
    target: 'es2022',
  },
  envDir: false,
  environments: {
    ssr: {
      build: {
        rolldownOptions: {
          input: ['./app/.server/express-server/app.ts'],
        },
      },
    },
  },
  optimizeDeps: {
    entries: ['./app/entry.client.tsx', './app/root.tsx', './app/routes/**/*.tsx'],
    // exclude the otlp-exporter-base package because it causes
    // issues with vite's dependency optimization
    // see: https://github.com/open-telemetry/opentelemetry-js/issues/4794
    exclude: ['@opentelemetry/otlp-exporter-base'],
  },
  plugins: [tailwindcss(), framework()],
  resolve: {
    // Ensures that Vite can resolve TypeScript path aliases defined in `tsconfig.json`.
    // This is crucial for maintaining clean and manageable import paths in the server code.
    tsconfigPaths: true,
  },
  server: {
    hmr: {
      // Configures the Hot Module Replacement (HMR) port.
      // Typically this would be set by the React Router server, but because
      // we use a custom express server, we have to manage this ourselves.
      // Leaving this blank equates to `random` which makes CSP more difficult.
      port: 3001,
    },
  },
  //
  // Vitest config. For more test configuration, see vitest.workspace.ts
  // see: https://vitest.dev/config/
  //
  test: {
    coverage: {
      include: ['**/app/**/*.{ts,tsx}'],
      exclude: [
        '!**/app/[.]client/**', //
        '!**/app/[.]server/**',
        '**/app/mocks/**',
        ...coverageConfigDefaults.exclude,
      ],
    },
    setupFiles: ['./__tests__/setup-test-env.ts'],
  },
});

/**
 * Determines which framework plugin to use.
 * Uses `@react-router/dev/vite` for development, and
 * @vitejs/plugin-react` for testing or other environments.
 *
 * see https://github.com/remix-run/remix/issues/9871
 */
function framework() {
  return process.env.NODE_ENV === 'test' ? react() : reactRouter();
}
