import { RouterContextProvider } from 'react-router';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import type { ServerConfig } from '~/.server/configs';
import { appContext } from '~/.server/context';
import type { RedisService } from '~/.server/data/redis-service';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import type { Logger } from '~/.server/logging';
import * as logging from '~/.server/logging';
import type { Session } from '~/.server/web/session';
import { loader } from '~/routes/api/killswitch';

function createArgs(enabled: boolean, redisService: RedisService | undefined, search = ''): Parameters<typeof loader>[0] {
  const serverConfig = mock<ServerConfig>();
  serverConfig.ENABLED_FEATURES = enabled ? ['killswitch-api'] : [];
  serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS = 300;

  const appContainer = mock<AppContainerProvider>();
  appContainer.find.mockReturnValue(redisService);
  appContainer.get.mockReturnValue(serverConfig);

  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session: mock<Session>() });

  return {
    context,
    params: {},
    request: new Request(`http://localhost/api/killswitch${search}`),
    url: new URL(`http://localhost/api/killswitch${search}`),
    pattern: '/api/killswitch',
  };
}

describe('killswitch API loader logging', () => {
  const logger = mock<Logger>();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('leaves the expected disabled-feature 404 warning to request completion logging', async () => {
    vi.spyOn(logging, 'createLogger').mockReturnValue(logger);

    await expect(loader(createArgs(false, undefined))).rejects.toMatchObject({ status: 404 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not log a premature success before enabling the killswitch', async () => {
    const calls: string[] = [];
    const redisService = mock<RedisService>();
    redisService.ttl.mockResolvedValue(-1);
    redisService.set.mockImplementation(async () => {
      calls.push('set');
      await Promise.resolve();
      return 'OK';
    });
    vi.spyOn(logging, 'createLogger').mockReturnValue(logger);

    await expect(loader(createArgs(true, redisService, '?engage'))).resolves.toEqual({ engaged: true, remainingTimeSecs: 300 });
    expect(calls).toEqual(['set']);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('warns when the killswitch cannot be enabled', async () => {
    vi.spyOn(logging, 'createLogger').mockReturnValue(logger);

    await expect(loader(createArgs(true, undefined, '?engage'))).resolves.toEqual({ engaged: false });
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Failed to enable killswitch via killswitch API');
  });

  it('uses the killswitch Redis key', async () => {
    const redisService = mock<RedisService>();
    redisService.ttl.mockResolvedValue(-1);
    redisService.set.mockResolvedValue('OK');
    vi.spyOn(logging, 'createLogger').mockReturnValue(logger);

    await loader(createArgs(true, redisService, '?engage'));

    expect(redisService.set).toHaveBeenCalledWith(KILLSWITCH_KEY, true, 300);
  });
});
