import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 256,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  ignorePatterns: ['**/node_modules/', '**/.react-router/', '**/build/', '**/coverage/', '**/playwright-report/', '**/test-results/', '**/public/theme/', '**/tmp/', '**/.terraform/', '**/.terragrunt-cache/', 'pnpm-lock.yaml'],
});
