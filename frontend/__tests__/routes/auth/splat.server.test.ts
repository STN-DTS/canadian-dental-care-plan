// @vitest-environment node
import { RouterContextProvider } from 'react-router';

import { Option } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import type { AuthCorrelation, AuthService } from '~/.server/auth/auth-service';
import type { RaoidcService } from '~/.server/auth/raoidc-service';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { correlationIdContext } from '~/.server/context/correlation-context';
import type { Logger } from '~/.server/logging';
import * as logging from '~/.server/logging';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import type { Session } from '~/.server/web/session';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';
import { loader } from '~/routes/auth/$';

const correlation: AuthCorrelation = { state: 'synthetic-state', nonce: 'synthetic-nonce', codeVerifier: 'synthetic-verifier' };
const authUrl = new URL('https://isams.example.test/oauth2/authorize?client_id=cdcp');

function createArgs(provider: 'raoidc' | 'oidc', slug: string, search = '') {
  const serverConfig = mock<ServerConfig>({ AUTH_PROVIDER: provider });
  const authService = mock<AuthService>();
  const raoidcService = mock<RaoidcService>();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.createCounter.mockReturnValue({ add: vi.fn() } as unknown as ReturnType<InstrumentationService['createCounter']>);

  const services = new Map<unknown, unknown>([
    [TYPES.ServerConfig, serverConfig],
    [TYPES.AuthService, authService],
    [TYPES.RaoidcService, raoidcService],
    [TYPES.InstrumentationService, instrumentationService],
  ]);
  const appContainer = mock<AppContainerProvider>();
  appContainer.get.mockImplementation(((id: unknown) => services.get(id)) as AppContainerProvider['get']);

  const session = mock<Session>({ id: 'session-id' });
  session.find.mockReturnValue(Option.none());

  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session });

  const url = new URL(`https://cdcp.example.test/auth/${slug}${search}`);
  const args = { context, params: { '*': slug }, request: new Request(url), url, pattern: '/auth/*' } as Parameters<typeof loader>[0];

  return { args, authService, raoidcService, session };
}

function withCorrelation(session: Session) {
  vi.mocked(session.find).mockImplementation(((key: string) => (key === 'oidcAuthCorrelation' ? Option.some(correlation) : Option.none())) as Session['find']);
}

describe('auth loader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each([
    ['raoidc', '/auth/login/raoidc'],
    ['oidc', '/auth/login/oidc'],
  ] as const)('redirects /auth/login to the configured %s provider', async (provider, expectedPath) => {
    const { args } = createArgs(provider, 'login', '?returnto=/en/protected');

    const response = (await loader(args)) as Response;

    expect(new URL(response.headers.get('Location') ?? '').pathname).toBe(expectedPath);
  });

  it.each([
    ['oidc', 'login/raoidc'],
    ['oidc', 'callback/raoidc'],
    ['raoidc', 'login/oidc'],
    ['raoidc', 'callback/oidc'],
  ] as const)('with AUTH_PROVIDER=%s returns 404 for %s without calling either provider', async (provider, slug) => {
    const { args, authService, raoidcService } = createArgs(provider, slug);

    const response = (await loader(args)) as Response;

    expect(response.status).toBe(404);
    expect(authService.generateSigninRequest).not.toHaveBeenCalled();
    expect(authService.handleCallback).not.toHaveBeenCalled();
    expect(raoidcService.generateSigninRequest).not.toHaveBeenCalled();
    expect(raoidcService.handleCallback).not.toHaveBeenCalled();
  });

  describe('login/oidc', () => {
    it('regenerates the session, stores the correlation values and redirects to the provider', async () => {
      const { args, authService, session } = createArgs('oidc', 'login/oidc');
      authService.generateSigninRequest.mockResolvedValue({ authUrl, correlation });

      const response = (await loader(args)) as Response;

      expect(response.headers.get('Location')).toBe(authUrl.href);
      expect(session.regenerate).toHaveBeenCalledBefore(session.set);
      expect(session.set).toHaveBeenCalledExactlyOnceWith('oidcAuthCorrelation', correlation);
    });
  });

  describe('callback/oidc', () => {
    it('returns the diagnostic result without creating an authenticated session', async () => {
      const { args, authService, session } = createArgs('oidc', 'callback/oidc', '?code=synthetic-code&state=synthetic-state');
      withCorrelation(session);
      authService.handleCallback.mockResolvedValue({ outcome: 'connectivity-verified', authenticated: false, issuer: 'https://isams.example.test/oauth2' });

      const response = (await loader(args)) as Response;

      expect(authService.handleCallback).toHaveBeenCalledWith({ callbackUrl: args.url, correlation });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({ outcome: 'connectivity-verified', authenticated: false, issuer: 'https://isams.example.test/oauth2', verifiedAt: expect.any(String) });
      expect(session.unset).toHaveBeenCalledWith('oidcAuthCorrelation');
      expect(session.set).not.toHaveBeenCalled();
    });

    it('rejects a callback without a sign-in attempt in the session', async () => {
      const { args, authService, session } = createArgs('oidc', 'callback/oidc', '?code=synthetic-code&state=synthetic-state');

      const response = (await loader(args)) as Response;

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ name: 'AppError', errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID, correlationId: '' });

      expect(authService.handleCallback).not.toHaveBeenCalled();
      expect(session.set).not.toHaveBeenCalled();
    });

    it('clears the correlation values when validation fails', async () => {
      const { args, authService, session } = createArgs('oidc', 'callback/oidc', '?code=synthetic-code&state=forged');
      withCorrelation(session);
      authService.handleCallback.mockRejectedValue(new AppError('OIDC callback is invalid.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID, { httpStatusCode: HttpStatusCodes.BAD_REQUEST }));

      const response = (await loader(args)) as Response;

      expect(response.status).toBe(400);

      expect(session.unset).toHaveBeenCalledWith('oidcAuthCorrelation');
      expect(session.set).not.toHaveBeenCalled();
    });
  });

  describe('OIDC error responses', () => {
    it.each([
      [HttpStatusCodes.BAD_GATEWAY, 'error', 'warn'],
      [HttpStatusCodes.BAD_REQUEST, 'warn', 'error'],
    ] as const)('logs a %i OIDC failure at %s level', async (status, expectedLevel, otherLevel) => {
      const logger = mock<Logger>();
      vi.spyOn(logging, 'createLogger').mockReturnValue(logger);
      const { args, authService } = createArgs('oidc', 'login/oidc');
      authService.generateSigninRequest.mockRejectedValue(new AppError('OIDC request failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, { httpStatusCode: status, correlationId: 'correlation-id' }));

      await loader(args);

      expect(logger[expectedLevel]).toHaveBeenCalledWith('OIDC request failed', expect.objectContaining({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, correlationId: 'correlation-id' }));
      expect(logger[otherLevel]).not.toHaveBeenCalled();
    });

    it.each([
      ['login/oidc', ''],
      ['callback/oidc', '?code=synthetic-code&state=synthetic-state'],
    ])('returns the configured status and only public details for an AppError from %s', async (slug, search) => {
      const { args, authService, session } = createArgs('oidc', slug, search);
      withCorrelation(session);
      const failure = new AppError('OIDC token exchange failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_EXCHANGE_FAILED, { httpStatusCode: HttpStatusCodes.BAD_GATEWAY, correlationId: 'correlation-id' });
      authService.generateSigninRequest.mockRejectedValue(failure);
      authService.handleCallback.mockRejectedValue(failure);

      const response = (await loader(args)) as Response;
      const body = await response.text();

      expect(response.status).toBe(502);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(JSON.parse(body)).toEqual({ name: 'AppError', errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_EXCHANGE_FAILED, correlationId: 'correlation-id' });
      expect(body).not.toContain('token exchange failed');
    });

    it('logs the service failure reason once as the error type', async () => {
      const logger = mock<Logger>();
      vi.spyOn(logging, 'createLogger').mockReturnValue(logger);
      const { args, authService } = createArgs('oidc', 'login/oidc');
      authService.generateSigninRequest.mockRejectedValue(new AppError('OIDC discovery failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, { httpStatusCode: HttpStatusCodes.BAD_GATEWAY, meta: { reason: 'OAUTH_RESPONSE_IS_NOT_CONFORM' } }));

      await loader(args);

      expect(logger.error).toHaveBeenCalledExactlyOnceWith('OIDC request failed', expect.objectContaining({ 'error.type': 'OAUTH_RESPONSE_IS_NOT_CONFORM', errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED }));
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('includes the request correlation ID in the missing-session error response and log', async () => {
      const logger = mock<Logger>();
      vi.spyOn(logging, 'createLogger').mockReturnValue(logger);
      const { args } = createArgs('oidc', 'callback/oidc', '?code=synthetic-code&state=synthetic-state');
      args.context.set(correlationIdContext, 'request-correlation-id');

      const response = (await contextStorageMiddleware(args, async () => (await loader(args)) as Response)) as Response;

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID, correlationId: 'request-correlation-id' });
      expect(logger.warn).toHaveBeenCalledWith('OIDC request failed', expect.objectContaining({ correlationId: 'request-correlation-id', 'error.type': 'authentication_callback_session_missing' }));
    });

    it('rethrows errors that are not AppErrors', async () => {
      const { args, authService } = createArgs('oidc', 'login/oidc');
      const failure = new Error('unexpected');
      authService.generateSigninRequest.mockRejectedValue(failure);

      await expect(loader(args)).rejects.toBe(failure);
    });
  });
});
