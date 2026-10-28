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
  ],
  rules: {
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
