import { createContext } from 'react';
import type { JSX, ReactNode } from 'react';

import type { ClientEnv } from '~/utils/env-utils';

/**
 * Public client configuration supplied above the router during server rendering and hydration.
 * Defaults to `undefined` so consumers can detect a missing provider.
 */
export const ClientEnvContext = createContext<ClientEnv | undefined>(undefined);

interface ClientEnvProviderProps {
  children?: ReactNode;
  env: ClientEnv;
}

/**
 * Provides validated public client configuration to the React tree.
 *
 * @param props Provider properties.
 * @returns Client environment context provider.
 */
export function ClientEnvProvider({ children, env }: ClientEnvProviderProps): JSX.Element {
  return <ClientEnvContext value={env}>{children}</ClientEnvContext>;
}
