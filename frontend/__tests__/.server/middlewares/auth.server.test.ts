import { RouterContextProvider } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { SecurityHandler } from '~/.server/routes/security';
import type { Session } from '~/.server/web/session';
import { authMiddleware } from '~/middlewares/auth.server';

describe('authMiddleware', () => {
  const session = mock<Session>();
  const securityHandler = mock<SecurityHandler>();
  const appContainer = mock<AppContainerProvider>();

  beforeEach(() => {
    vi.resetAllMocks();
    appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValue(securityHandler);
  });

  function createMiddlewareArgs(url: URL, method = 'GET'): Parameters<typeof authMiddleware>[0] {
    const context = new RouterContextProvider();
    context.set(appContext, { appContainer, session });

    return {
      context,
      params: {},
      request: new Request(url, { method }),
      url,
      pattern: '',
    };
  }

  it('validates session and continues to next middleware', async () => {
    const url = new URL('https://localhost:3000/fr/protege/documents?ref=header');
    const response = new Response(null, { status: 204 });
    const next = vi.fn().mockResolvedValue(response);

    const result = await authMiddleware(createMiddlewareArgs(url), next);

    expect(securityHandler.validateAuthSession).toHaveBeenCalledOnce();
    expect(securityHandler.validateAuthSession).toHaveBeenCalledWith({ requestUrl: url, session });
    expect(next).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('propagates authentication failure without continuing', async () => {
    const url = new URL('https://localhost:3000/en/protected/profile?return=documents');
    const error = new Response(null, { status: 302 });
    const next = vi.fn();
    securityHandler.validateAuthSession.mockRejectedValue(error);

    await expect(authMiddleware(createMiddlewareArgs(url), next)).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });

  it('validates session for action requests', async () => {
    const url = new URL('https://localhost:3000/en/protected/profile/contact');
    const next = vi.fn().mockResolvedValue(undefined);

    await authMiddleware(createMiddlewareArgs(url, 'POST'), next);

    expect(securityHandler.validateAuthSession).toHaveBeenCalledWith({ requestUrl: url, session });
    expect(next).toHaveBeenCalledOnce();
  });
});
