import { useMemo } from 'react';

import { useClientEnv } from '~/hooks/use-client-env';

/**
 * Returns a stable list of country ids that require a postal/zip code.
 *
 * The list is memoized so consumers can safely use it as a React hook dependency.
 *
 * @returns The memoized country ids (e.g. Canada, USA) for which a postal code is required.
 */
export function usePostalCodeRequiredCountryIds(): ReadonlyArray<string> {
  const { CANADA_COUNTRY_ID, USA_COUNTRY_ID } = useClientEnv();
  return useMemo(() => [CANADA_COUNTRY_ID, USA_COUNTRY_ID], [CANADA_COUNTRY_ID, USA_COUNTRY_ID]);
}
