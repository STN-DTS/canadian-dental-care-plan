import { reactRouter } from '@react-router/dev/vite';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Application build and unit test configuration.
 * See vite.server.config.ts for the server build config.
 */
export default defineConfig({
  build: {
    // Target ES2022 syntax for older browser support.
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
  plugins: [tailwindcss(), reactRouter()],
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
  ssr: {
    // Bundle `validator` for SSR instead of externalizing it. As a CommonJS module, it cannot be
    // tree-shaken as an ES module, and bundling it avoids SSR compatibility issues.
    noExternal: ['validator'],
  },
});
