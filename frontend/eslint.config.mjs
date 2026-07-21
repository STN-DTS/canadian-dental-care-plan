import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import * as tsResolver from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import importZod from 'eslint-plugin-import-zod';
import jsxA11yX from 'eslint-plugin-jsx-a11y-x';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '**/.react-router/', //
      '**/build/',
      '**/coverage/',
      '**/playwright-report/',
      '**/tmp/',
    ],
  },
  js.configs.recommended,
  {
    //
    // base config
    //
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2023,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        // type linting: https://typescript-eslint.io/getting-started/typed-linting/
        projectService: true,
        tsconfigRootDir: import.meta.name,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    //
    // non-typescript
    //
    files: ['**/*.{js,cjs,mjs}'],
    extends: [js.configs.recommended],
  },
  {
    //
    // typescript
    //
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended, //
      importX.flatConfigs.recommended,
      importZod.configs.recommended,
      tseslint.configs.strict,
    ],
    rules: {
      'no-param-reassign': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      // Rule: @typescript-eslint/no-unused-vars
      // Note: you must disable the base rule as it can report incorrect errors
      // https://typescript-eslint.io/rules/no-unused-vars/#how-to-use
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      // Rule: @typescript-eslint/require-await
      // Note: you must disable the base rule as it can report incorrect errors
      // https://typescript-eslint.io/rules/require-await/#how-to-use
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      // Rule: @typescript-eslint/return-await
      // Note: you must disable the base rule as it can report incorrect errors
      // https://typescript-eslint.io/rules/return-await#how-to-use
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true }],
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    },
    settings: {
      'import-x/resolver': {
        name: 'tsResolver',
        resolver: tsResolver,
      },
    },
  },
  {
    //
    // react
    //
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/.server/**'],
    extends: [
      jsxA11yX.configs.recommended, //
      eslintReact.configs['recommended-typescript'],
    ],
    rules: {
      '@eslint-react/dom-no-unknown-property': ['error', { ignore: ['property', 'resource', 'typeof', 'vocab'] }],
      '@eslint-react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      // TODO: enable this rule once eslint upgrade to v10
      '@eslint-react/static-components': 'off',
    },
    settings: {
      formComponents: ['Form'],
      linkComponents: [
        { name: 'Link', linkAttribute: 'to' },
        { name: 'NavLink', linkAttribute: 'to' },
      ],
      react: {
        version: 'detect',
      },
    },
  },
  //
  // unicorn plugin
  // https://github.com/sindresorhus/eslint-plugin-unicorn
  //
  unicorn.configs.recommended,
  {
    rules: {
      'unicorn/consistent-function-scoping': ['error', { checkArrowFunctions: false }],
      'unicorn/filename-case': ['error', { case: 'kebabCase', ignore: ['__tests__', '__mocks__'] }],
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-promise-resolve-reject': 'off',
      'unicorn/no-useless-undefined': ['error', { checkArguments: false }],
      'unicorn/prefer-global-this': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/prefer-structured-clone': 'off',
      'unicorn/prevent-abbreviations': 'off',
      // TODO: revisit and fix these rules if it makes sense to enable them
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/max-nested-calls': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/consistent-class-member-order': 'off', // errors  23
      'unicorn/consistent-conditional-object-spread': 'off', // errors  29
      'unicorn/new-for-builtins': 'off', // errors   1
      'unicorn/no-computed-property-existence-check': 'off', // errors   2
      'unicorn/no-declarations-before-early-exit': 'off', // errors  21
      'unicorn/no-duplicate-loops': 'off', // errors   1
      'unicorn/no-global-object-property-assignment': 'off', // errors  11
      'unicorn/no-negated-array-predicate': 'off', // errors   1
      'unicorn/no-non-function-verb-prefix': 'off', // errors  11
      'unicorn/no-nonstandard-builtin-properties': 'off', // errors   1
      'unicorn/no-top-level-assignment-in-function': 'off', // errors   1
      'unicorn/no-top-level-side-effects': 'off', // errors   2
      'unicorn/no-unnecessary-boolean-comparison': 'off', // errors  63
      'unicorn/no-unnecessary-fetch-options': 'off', // errors   2
      'unicorn/no-unnecessary-global-this': 'off', // errors   2
      'unicorn/no-unreadable-for-of-expression': 'off', // errors   1
      'unicorn/no-unreadable-object-destructuring': 'off', // errors   1
      'unicorn/no-unsafe-string-replacement': 'off', // errors   1
      'unicorn/no-useless-coercion': 'off', // errors  13
      'unicorn/no-useless-else': 'off', // errors   1
      'unicorn/no-useless-template-literals': 'off', // errors   3
      'unicorn/prefer-add-event-listener-options': 'off', // errors   3
      'unicorn/prefer-array-from-map': 'off', // errors   1
      'unicorn/prefer-await': 'off', // errors   6
      'unicorn/prefer-continue': 'off', // errors   1
      'unicorn/prefer-direct-iteration': 'off', // errors   1
      'unicorn/prefer-early-return': 'off', // errors  12
      'unicorn/prefer-global-number-constants': 'off', // errors   1
      'unicorn/prefer-has-check': 'off', // errors   1
      'unicorn/prefer-hoisting-branch-code': 'off', // errors   3
      'unicorn/prefer-iterator-to-array': 'off', // errors   4
      'unicorn/prefer-minimal-ternary': 'off', // errors 155
      'unicorn/prefer-number-coercion': 'off', // errors   1
      'unicorn/prefer-ternary': 'off', // errors   2
      'unicorn/prefer-unicode-code-point-escapes': 'off', // errors 219
    },
  },
  //
  // vitest plugin
  // https://github.com/vitest-dev/eslint-plugin-vitest
  //
  {
    files: ['__tests__/**'],
    plugins: {
      vitest: vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/prefer-called-exactly-once-with': 'off',
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },
);
