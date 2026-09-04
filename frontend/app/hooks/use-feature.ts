import { useClientEnv } from '~/hooks/use-client-env';
import type { FeatureName } from '~/utils/env-utils';

/**
 * Checks whether a feature is enabled in the client configuration.
 *
 * @param feature The feature to check.
 * @returns `true` when the feature is enabled.
 */
export function useFeature(feature: FeatureName): boolean {
  return useClientEnv().ENABLED_FEATURES.includes(feature);
}
