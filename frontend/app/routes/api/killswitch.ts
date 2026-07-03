/**
 * A dev-only API that force-enabled the application killswitch.
 */
import type { Route } from './+types/killswitch';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const log = createLogger('killswitch/loader');

  const { appContainer } = context.get(appContext);
  const serverConfig = appContainer.get(TYPES.ServerConfig);

  if (!serverConfig.ENABLED_FEATURES.includes('killswitch-api')) {
    log.warn('killswitch-api is not enabled; returning 404 response');
    throw Response.json(null, { status: HttpStatusCodes.NOT_FOUND });
  }

  const redisService = appContainer.find(TYPES.RedisService);
  const currentRemainingTime = await redisService?.ttl(KILLSWITCH_KEY);

  if (currentRemainingTime && currentRemainingTime >= 0) {
    log.debug('Killswitch already engaged; returning killswitch status');
    return { engaged: true, remainingTimeSecs: currentRemainingTime };
  }

  const searchParams = url.searchParams;
  const engage = searchParams.get('engage') !== null;

  if (engage) {
    log.info('Force-enabling killswitch via killswitch API call');

    // note: `redisService` might not be defined, so we have to check that the return value is `OK` to know if the switch has been flipped
    const killswitchEngaged = (await redisService?.set(KILLSWITCH_KEY, true, serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS)) === 'OK';

    return {
      engaged: killswitchEngaged,
      ...(killswitchEngaged && {
        remainingTimeSecs: serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS,
      }),
    };
  }

  return { engaged: false };
}
