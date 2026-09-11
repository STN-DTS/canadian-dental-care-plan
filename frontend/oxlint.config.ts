import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import', 'react', 'jsx-a11y', 'vitest'],
  categories: {
    correctness: 'error',
    nursery: 'error',
    perf: 'error',
  },
  env: {
    browser: true,
    es2023: true,
    node: true,
  },
  ignorePatterns: ['.react-router/', 'build/', 'coverage/', 'playwright-report/', 'tmp/'],
  options: {
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
  },
  overrides: [
    {
      files: ['app/components/file-upload.tsx'],
      rules: {
        'jsx-a11y/role-supports-aria-props': 'off',
      },
    },
  ],
  rules: {
    'eslint/no-param-reassign': 'error',
    'eslint/no-unused-vars': ['error', { args: 'none' }],
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'import/no-duplicates': 'error',
    'jsx-a11y/no-redundant-roles': 'off',
    'jsx-a11y/prefer-tag-over-role': 'off',
    'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
    'react/no-unknown-property': ['error', { ignore: ['property', 'resource', 'typeof', 'vocab'] }],
    // Let Oxfmt sort import declarations; Oxlint only sorts named import members.
    'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreMemberSort: false }],
    'typescript/await-thenable': 'error',
    'typescript/consistent-type-exports': 'error',
    'typescript/consistent-type-imports': 'error',
    'typescript/no-base-to-string': 'off',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-spread': 'off',
    'typescript/no-redundant-type-constituents': 'off',
    'typescript/no-unnecessary-condition': 'error',
    'typescript/no-useless-default-assignment': 'off',
    'typescript/prefer-nullish-coalescing': 'error',
    'typescript/prefer-optional-chain': 'error',
    'typescript/promise-function-async': 'error',
    'typescript/require-await': 'error',
    'typescript/restrict-template-expressions': 'off',
    'typescript/return-await': ['error', 'always'],
    'typescript/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true }],
    'typescript/unbound-method': 'off',
    'unicorn/consistent-function-scoping': ['error', { checkArrowFunctions: false }],
    'unicorn/filename-case': ['error', { case: 'kebabCase', ignore: ['__tests__', '__mocks__'] }],
    'unicorn/no-useless-undefined': ['error', { checkArguments: false }],
    'vitest/require-mock-type-parameters': 'off',
    'vitest/require-to-throw-message': 'off',
  },
  settings: {
    react: {
      formComponents: ['Form'],
      linkComponents: [
        // @ts-expect-error: TypeScript may not recognize the custom link component configuration
        { name: 'Link', linkAttribute: 'to' },
        // @ts-expect-error: TypeScript may not recognize the custom link component configuration
        { name: 'NavLink', linkAttribute: 'to' },
      ],
    },
    vitest: {
      typecheck: true,
    },
  },
});
