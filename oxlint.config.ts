import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest'],
  jsPlugins: [
    {
      name: '@stylistic',
      specifier: '@stylistic/eslint-plugin',
    },
  ],
  categories: {
    correctness: 'error',
    nursery: 'error',
    perf: 'error',
  },
  ignorePatterns: ['frontend/'],
  env: {
    es2023: true,
    node: true,
  },
  options: {
    reportUnusedDisableDirectives: 'error',
    respectEslintDisableDirectives: true,
    typeAware: true,
  },
  rules: {
    curly: 'error',
    'eslint/no-param-reassign': 'error',
    'eslint/no-unused-vars': ['error', { args: 'none' }],
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'import/no-duplicates': 'error',
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
    '@stylistic/padding-line-between-statements': [
      'error',
      // Require blank lines before and after block-like statements.
      { blankLine: 'always', prev: '*', next: 'block-like' },
      { blankLine: 'always', prev: 'block-like', next: '*' },
      // Preserve spacing between switch labels, including shared scopes.
      { blankLine: 'any', prev: ['case', 'default'], next: ['case', 'default'] },
    ],
  },
  settings: {
    vitest: {
      typecheck: true,
    },
  },
});
