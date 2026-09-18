import { defineConfig } from 'vitest/config';

/**
 * see: https://vitest.dev/guide/workspace
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
          include: [
            './__tests__/components/**/*.test.(ts|tsx)', //
            './__tests__/hooks/**/*.test.(ts|tsx)',
            './__tests__/routes/**/*.test.(ts|tsx)',
          ],
        },
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'node',
          environment: 'node',
          include: [
            './__tests__/**/*.test.(ts|tsx)', //
          ],
          exclude: [
            './__tests__/components/**', //
            './__tests__/hooks/**',
            './__tests__/routes/**',
          ],
        },
      },
    ],
  },
});
