import { useRootLoaderData } from '~/hooks/use-root-loader-data';

/**
 * Retrieves client hints produced by the root route loader.
 *
 * @returns Client hints detected for the current request.
 * @throws When root loader data is unavailable.
 */
export function useHints() {
  return useRootLoaderData().hints;
}
