import type { Route } from './+types/buildinfo';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';

/**
 * An API endpoint that returns the build info.
 */
export function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const buildInfo = appContainer.get(TYPES.BuildInfoService).getBuildInfo();
  const imageTag = `${buildInfo.buildVersion}-${buildInfo.buildRevision}-${buildInfo.buildId}`;

  return Response.json({ ...buildInfo, imageTag });
}
