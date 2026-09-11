import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 256,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  sortImports: {
    customGroups: [
      {
        groupName: 'react',
        elementNamePattern: ['react', 'react-dom', 'react-dom/**'],
      },
      {
        groupName: 'testing-library',
        elementNamePattern: ['@testing-library/**'],
      },
      {
        groupName: 'react-router',
        elementNamePattern: ['react-router', 'react-router/**', '@react-router/**'],
      },
      {
        groupName: 'tilde',
        elementNamePattern: ['~/**'],
      },
    ],
    groups: [
      'react',
      { newlinesBetween: true },
      'testing-library',
      { newlinesBetween: true },
      'react-router',
      { newlinesBetween: true },
      ['builtin', 'external'],
      { newlinesBetween: true },
      ['parent', 'sibling', 'index'],
      { newlinesBetween: true },
      'tilde',
      'unknown',
    ],
  },
  sortTailwindcss: {
    functions: ['clsx', 'cn', 'cva'],
  },
  ignorePatterns: ['**/public/build/', '**/public/theme/', '**/tmp/', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'],
  overrides: [
    {
      files: ['app/.server/locales/**/*.ts'],
      options: {
        singleQuote: false,
        // Oxfmt caps printWidth at 320, so the desired no-wrap value remains disabled.
        // See https://github.com/oxc-project/oxc/issues/19734
        // printWidth: 65_535,
      },
    },
  ],
});
