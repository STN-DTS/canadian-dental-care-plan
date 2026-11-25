import { defineConfig } from 'oxlint';

import baseConfig from '../oxlint.config.ts';

export default defineConfig({
  extends: [baseConfig],
  plugins: ['react', 'jsx-a11y'],
  categories: baseConfig.categories,
  env: {
    ...baseConfig.env,
    browser: true,
  },
  ignorePatterns: ['.react-router/', 'build/', 'coverage/', 'playwright-report/', 'tmp/'],
  overrides: [
    {
      files: ['app/components/file-upload.tsx'],
      rules: {
        'jsx-a11y/role-supports-aria-props': 'off',
      },
    },
    {
      // The helper wraps micro-memoize, and tests may mock the library it wraps.
      files: ['app/.server/utils/memoize-utils.ts', '__mocks__/micro-memoize.ts', '__tests__/**'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'micro-memoize',
            message: 'Use createMemoized from ~/.server/utils/memoize-utils so every cache is bounded and keyed by value.',
          },
        ],
      },
    ],
    'jsx-a11y/no-redundant-roles': 'off',
    'jsx-a11y/prefer-tag-over-role': 'off',
    'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
    'react/no-unknown-property': ['error', { ignore: ['property', 'resource', 'typeof', 'vocab'] }],
  },
  settings: {
    ...baseConfig.settings,
    react: {
      formComponents: ['Form'],
      linkComponents: [
        { name: 'Link', attribute: 'to' },
        { name: 'NavLink', attribute: 'to' },
      ],
    },
  },
});
