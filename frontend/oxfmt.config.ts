import { defineConfig } from 'oxfmt';

import rootConfig from '../oxfmt.config.ts';

export default defineConfig({
  ...rootConfig,
  sortTailwindcss: {
    functions: ['clsx', 'cn', 'cva'],
    stylesheet: './app/tailwind.css',
  },
  overrides: [
    ...(rootConfig.overrides ?? []),
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
