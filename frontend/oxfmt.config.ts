import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 256,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  sortImports: {
    customGroups: [
      { groupName: 'react', elementNamePattern: ['react', 'react-dom', 'react-dom/**'] },
      { groupName: 'testing-library', elementNamePattern: ['@testing-library/**'] },
      { groupName: 'react-router', elementNamePattern: ['react-router', 'react-router/**', '@react-router/**'] },
    ],
    groups: ['react', 'testing-library', 'react-router', 'type-import', ['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'unknown', 'style'],
  },
  sortTailwindcss: {
    functions: ['clsx', 'cn', 'cva'],
  },
  ignorePatterns: ['**/public/build/', '**/public/theme/', '**/tmp/'],
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
