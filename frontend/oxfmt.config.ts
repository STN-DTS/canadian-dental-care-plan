import { defineConfig } from 'oxfmt';

import rootConfig from '../oxfmt.config.ts';

export default defineConfig({
  ...rootConfig,
  overrides: [
    {
      files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
      options: {
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
      },
    },
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
