import { use } from 'react';

import { invariant } from '@dts-stn/invariant';

import { ClientEnvContext } from '~/components/client-env-context';
import type { ClientEnv } from '~/utils/env-utils';

/**
 * Retrieves public client configuration from the nearest client environment provider.
 *
 * @returns The validated client configuration.
 * @throws When no client environment provider is mounted.
 */
export function useClientEnv(): ClientEnv {
  const env = use(ClientEnvContext);
  invariant(env, 'Expected ClientEnvProvider to be defined');
  return env;
}
