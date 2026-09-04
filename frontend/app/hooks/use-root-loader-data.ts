import { useRouteLoaderData } from 'react-router';

import { invariant } from '@dts-stn/invariant';

import type { loader } from '~/root';

/**
 * Retrieves data produced by the root route loader.
 *
 * @returns Root route loader data.
 * @throws When root loader data is unavailable.
 */
export function useRootLoaderData() {
  const rootLoaderData = useRouteLoaderData<typeof loader>('root');
  invariant(rootLoaderData, 'Expected rootLoaderData to be defined');
  return rootLoaderData;
}
