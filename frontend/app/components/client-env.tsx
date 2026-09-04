import type { ComponentPropsWithoutRef } from 'react';

import type { ClientEnv } from '~/utils/env-utils';

interface ClientEnvProps extends ComponentPropsWithoutRef<'script'> {
  env: ClientEnv;
}

/**
 * The <ClientEnv> component is used to provide the browser access to the
 * environment variables that are considered publicly safe (via `window.env`).
 */
export function ClientEnv({ env, ...props }: ClientEnvProps) {
  return <script {...props} dangerouslySetInnerHTML={{ __html: `window.env = ${JSON.stringify(env)}` }} suppressHydrationWarning />;
}
