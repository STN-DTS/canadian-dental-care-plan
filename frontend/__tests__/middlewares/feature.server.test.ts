import { RouterContextProvider } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { SecurityHandler } from '~/.server/routes/security';
import type { Session } from '~/.server/web/session';
import { createFeatureMiddleware } from '~/middlewares/feature.server';

describe('createFeatureMiddleware', () => {
  const session = mock<Session>();
  const securityHandler = mock<SecurityHandler>();
  const appContainer = mock<AppContainerProvider>();
  const featureMiddleware = createFeatureMiddleware('view-letters');

  beforeEach(() => {
    vi.resetAllMocks();
    appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValue(securityHandler);
  });

  function createMiddlewareArgs(): Parameters<typeof featureMiddleware>[0] {
    const context = new RouterContextProvider();
    const url = new URL('https://localhost:3000/en/protected/letters');
    context.set(appContext, { appContainer, session });

    return {
      context,
      params: {},
      request: new Request(url),
      url,
      pattern: '',
    };
  }

  it('validates the feature before continuing', async () => {
    const response = new Response(null, { status: 204 });
    const next = vi.fn().mockResolvedValue(response);

    const result = await featureMiddleware(createMiddlewareArgs(), next);

    expect(securityHandler.validateFeatureEnabled).toHaveBeenCalledWith('view-letters');
    expect(securityHandler.validateFeatureEnabled).toHaveBeenCalledBefore(next);
    expect(next).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('propagates feature validation failure without continuing', async () => {
    const error = new Response(null, { status: 404 });
    const next = vi.fn();
    securityHandler.validateFeatureEnabled.mockImplementation(() => {
      throw error;
    });

    await expect(featureMiddleware(createMiddlewareArgs(), next)).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });
});
