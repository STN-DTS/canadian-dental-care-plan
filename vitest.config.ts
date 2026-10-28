import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      reportsDirectory: './frontend/coverage',
      include: ['frontend/app/**/*.{ts,tsx}', '.github/actions/**/*.mjs'],
      exclude: ['**/app/mocks/**', ...configDefaults.include, ...coverageConfigDefaults.exclude],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'root',
          environment: 'node',
          include: [...configDefaults.include, '.github/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
          exclude: [...configDefaults.exclude, 'frontend/**'],
        },
      },
      './frontend/vitest.config.ts',
    ],
  },
});
