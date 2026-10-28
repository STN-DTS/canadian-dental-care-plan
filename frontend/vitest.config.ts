import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

/**
 * Defining Vitest Projects
 * https://vitest.dev/guide/projects
 */
export default defineProject({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'frontend',
    projects: [
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          pool: 'vmThreads',
          include: ['./__tests__/{components,hooks,routes}/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['./__tests__/**/*.test.{ts,tsx}'],
          exclude: ['./__tests__/{components,hooks,routes}/**'],
        },
      },
    ],
    setupFiles: ['./__tests__/setup-test-env.ts'],
  },
});
