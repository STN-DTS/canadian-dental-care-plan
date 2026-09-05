# TypeScript 7 migration notes

The project uses TypeScript 7 (the Go-based "Project Corsa" compiler,
[announced by the TypeScript team](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)).
This is a rewrite of the compiler in Go rather than a language redesign: type
checking semantics are intentionally kept compatible with TypeScript 6, but
6.0's deprecated options become hard errors and a handful of defaults change.

## What changed in this repository

- `typescript` was bumped from `^6.0.3` to `^7.0.2` in `frontend/package.json`.
- No `tsconfig.json` changes were required. `frontend/tsconfig.json` already
  avoided every option TypeScript 7 removes:
  - no `baseUrl` (`paths` are already relative to the tsconfig directory)
  - `moduleResolution: "bundler"` (not the removed `"node"`/`"node10"`/`"classic"`)
  - `target`/`module` already set to `"ES2022"` (not `"es5"` or a removed
    `module` value such as `"amd"`/`"umd"`/`"system"`/`"none"`)
  - `esModuleInterop` and `allowSyntheticDefaultImports` are not explicitly set
    to `false`
  - `types` is already an explicit list (`["node", "vite/client",
"@testing-library/jest-dom"]`), which matches TypeScript 7's new default of
    `[]` (no auto-discovery from `node_modules/@types`)
  - `strict` is already `true`
  - `noEmit: true`, so the new requirement to set `rootDir` explicitly when
    emitting output does not apply
- No Vite configuration changes were required. `vite.config.ts` and
  `vite.server.config.ts` already resolve TypeScript path aliases through
  Vite's built-in `resolve.tsconfigPaths` option rather than the
  `vite-tsconfig-paths` plugin or the TypeScript compiler API, so they do not
  depend on the (currently unstable) TypeScript 7 programmatic API.
- `pnpm run typecheck`, `pnpm run lint:oxlint`, `pnpm run build`, and the unit
  test suite were run against TypeScript 7 with no code changes required.

## Breaking changes to be aware of

TypeScript 7 turns the following TypeScript 6 deprecations into hard errors.
None of these apply to this repository today, but keep them in mind before
adding new configuration:

| Option                                                           | Status in TypeScript 7                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `target: "es5"`                                                  | Removed; use `"es2022"` or later                                 |
| `moduleResolution: "node"` / `"node10"` / `"classic"`            | Removed; use `"nodenext"` or `"bundler"`                         |
| `module: "amd" \| "umd" \| "system" \| "none"`                   | Removed; use `"esnext"`/`"nodenext"`/`"preserve"`                |
| `baseUrl`                                                        | Removed; make `paths` entries relative to the tsconfig directory |
| `esModuleInterop: false` / `allowSyntheticDefaultImports: false` | Removed; interop is always enabled                               |
| `ignoreDeprecations: "6.0"`                                      | No longer has any effect                                         |

Other defaults changed silently rather than becoming errors:

- `strict` now defaults to `true`.
- `types` now defaults to `[]` instead of auto-discovering every
  `@types/*` package. Set the `types` array explicitly if a project relies on
  global ambient types.
- `rootDir` now defaults to the directory containing `tsconfig.json` instead
  of being inferred from the input files. This only matters for projects that
  emit output (`noEmit: false`); it does not affect this repository.

## Known compatibility risk

TypeScript 7.0 does not yet ship a stable JavaScript compiler API (the
`import * as ts from "typescript"` surface used by tools such as
`typescript-eslint`, `ts-morph`, or custom AST transformers). A stable API is
expected in a later 7.x release. This repository does not depend on the
TypeScript compiler API directly:

- Linting uses Oxlint with `oxlint-tsgolint`, a standalone Go-based type-aware
  linter that does not import the `typescript` npm package.
- `tsx` (used for `pnpm run dev`/`pnpm run dbg`) transpiles with esbuild, not
  the TypeScript compiler.
- Vite/Vitest transpile TypeScript through esbuild/Rolldown, and TypeScript
  path aliases are resolved through Vite's built-in `resolve.tsconfigPaths`
  option, not the TypeScript compiler API or the `vite-tsconfig-paths` plugin.

If a future dependency needs the TypeScript 6 compiler API, Microsoft
publishes a compatibility package that can be installed alongside TypeScript 7
without a binary name collision:

```jsonc
// package.json (only if a dependency requires the TypeScript 6 API)
{
  "devDependencies": {
    "@typescript/typescript6": "^6.0.2",
  },
}
```
