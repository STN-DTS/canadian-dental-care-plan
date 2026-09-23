import { defineConfig } from 'vitest/config';

/**
 * Defining Vitest Projects
 * https://vitest.dev/guide/projects
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          pool: 'vmThreads',
          include: ['./__tests__/{components,hooks,routes}/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'node',
          environment: 'node',
          include: ['./__tests__/**/*.test.{ts,tsx}'],
          exclude: ['./__tests__/{components,hooks,routes}/**'],
        },
      },
    ],
  },
});
