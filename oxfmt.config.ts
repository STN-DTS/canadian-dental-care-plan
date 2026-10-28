import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 256,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  ignorePatterns: ['**/node_modules/', '**/.react-router/', '**/build/', '**/coverage/', '**/playwright-report/', '**/test-results/', '**/public/theme/', '**/tmp/', '**/.terraform/', '**/.terragrunt-cache/', 'pnpm-lock.yaml'],
  sortImports: {
    customGroups: [
      { groupName: 'react', elementNamePattern: ['react', 'react-dom', 'react-dom/**'] },
      { groupName: 'testing-library', elementNamePattern: ['@testing-library/**'] },
      { groupName: 'react-router', elementNamePattern: ['react-router', 'react-router/**', '@react-router/**'] },
    ],
    groups: ['react', 'testing-library', 'react-router', 'type-import', ['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'unknown', 'style'],
  },
  sortPackageJson: true,
});
