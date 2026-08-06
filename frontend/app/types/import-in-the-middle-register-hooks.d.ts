/**
 * Ambient module declaration for `import-in-the-middle/register-hooks.mjs`.
 *
 * The package ships `register-hooks.d.ts`, not `.d.mts`, so TS's node16/nodenext
 * resolution can't match it to the `.mjs` file. Re-exporting from the real
 * declaration keeps this in sync with upstream instead of hand-copying types.
 *
 * TODO: After https://github.com/open-telemetry/opentelemetry-js/pull/6922 is
 * merged and released, check whether the project can use
 * `@opentelemetry/instrumentation/register.mjs` instead. If so, remove this
 * shim and update the OpenTelemetry preload entrypoint.
 *
 * @see https://github.com/pagopa/dx/blob/5dd06bf87a5b37b0c1515b8c4891b53445f723c7/apps/cli/src/adapters/azure-monitor/import-in-the-middle-register-hooks.d.ts
 */

declare module 'import-in-the-middle/register-hooks.mjs' {
  export * from 'import-in-the-middle/register-hooks.d.ts';
}
