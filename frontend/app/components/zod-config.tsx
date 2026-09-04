import type { ComponentProps, JSX } from 'react';

import type { $ZodConfig } from 'zod/v4/core';

/**
 * The key under which Zod reads its global configuration from `globalThis`.
 *
 * Zod intentionally exposes this key so the config can be pre-populated before
 * Zod loads (e.g. via an inline script) and shared across CJS, ESM, and
 * multiple-bundle instances in a monorepo.
 *
 * @see https://github.com/colinhacks/zod/blob/e58ea4d91b1dfe8194b73508203213cbc7e9c936/packages/zod/src/v4/core/core.ts#L144
 */
const ZOD_GLOBAL_CONFIG_KEY = '__zod_globalConfig';

/**
 * Zod configuration applied globally via an inline script before Zod loads.
 *
 * `jitless` disables JIT (just-in-time) schema compilation. Zod's JIT mode
 * relies on `eval`, which is blocked by strict Content Security Policies (CSP)
 * commonly enforced in production environments. Disabling JIT improves security
 * and CSP compliance without affecting validation correctness.
 */
const ZOD_CONFIG: $ZodConfig = {
  jitless: true,
};

/** Props for `<ZodConfig>`, forwarded directly to the underlying `<script>` element. */
type ZodConfigProps = OmitStrict<ComponentProps<'script'>, 'dangerouslySetInnerHTML'>;

/**
 * Injects an inline `<script>` that pre-populates Zod's global configuration
 * before Zod loads.
 *
 * Zod reads its configuration from `globalThis.__zod_globalConfig` on first
 * access. By writing the config via an inline script we guarantee it is set
 * before any module code executes — even when Zod is loaded asynchronously or
 * split across multiple bundles.
 *
 * Place this component in the application root (e.g. `root.tsx`) so the config
 * is applied globally, including across mixed CJS/ESM module instances in a
 * monorepo.
 *
 * @returns A `<script>` element that sets the global Zod config.
 */
export function ZodConfig(props: ZodConfigProps): JSX.Element {
  return (
    <script
      {...props}
      dangerouslySetInnerHTML={{
        __html: `globalThis.${ZOD_GLOBAL_CONFIG_KEY} = Object.assign(globalThis.${ZOD_GLOBAL_CONFIG_KEY} ?? {}, ${JSON.stringify(ZOD_CONFIG)});`,
      }}
    />
  );
}
