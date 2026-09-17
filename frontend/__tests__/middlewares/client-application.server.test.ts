import { RouterContextProvider } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clientApplicationContext } from '~/.server/context/client-application-context';
import type { ClientApplicationDto } from '~/.server/domain/dtos';
import type { SecurityHandler } from '~/.server/routes/security';
import type { Session } from '~/.server/web/session';
import { clientApplicationMiddleware } from '~/middlewares/client-application.server';

describe('clientApplicationMiddleware', () => {
  const session = mock<Session>();
  const securityHandler = mock<SecurityHandler>();
  const appContainer = mock<AppContainerProvider>();

  beforeEach(() => {
    vi.resetAllMocks();
    appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValue(securityHandler);
  });

  function createMiddlewareArgs(): Parameters<typeof clientApplicationMiddleware>[0] {
    const context = new RouterContextProvider();
    const url = new URL('https://localhost:3000/en/protected/profile/contact');
    context.set(appContext, { appContainer, session });

    return {
      context,
      params: { id: 'application-123' },
      request: new Request(url),
      url,
      pattern: '',
    };
  }

  it('sets client application context before continuing', async () => {
    const clientApplication = mock<ClientApplicationDto>();
    const response = new Response(null, { status: 204 });
    const args = createMiddlewareArgs();
    securityHandler.requireClientApplication.mockResolvedValue(clientApplication);
    const next = vi.fn(async () => {
      expect(args.context.get(clientApplicationContext)).toBe(clientApplication);
      return await Promise.resolve(response);
    });

    const result = await clientApplicationMiddleware(args, next);

    expect(securityHandler.requireClientApplication).toHaveBeenCalledWith({ params: args.params, requestUrl: args.url, session });
    expect(next).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('propagates client application resolution failure without continuing', async () => {
    const error = new Response(null, { status: 404 });
    const next = vi.fn();
    securityHandler.requireClientApplication.mockRejectedValue(error);

    await expect(clientApplicationMiddleware(createMiddlewareArgs(), next)).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });
});
