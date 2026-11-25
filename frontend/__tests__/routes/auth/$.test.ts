// @vitest-environment node

import { RouterContextProvider } from 'react-router';

import { ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
import { Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { DefaultAuditService } from '~/.server/audit/audit-service';
import type { RaoidcService } from '~/.server/auth/raoidc-service';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc-utils';
import type { Session } from '~/.server/web/session';
import { contextStorageMiddleware } from '~/middlewares/context-storage.server';
import { loader } from '~/routes/auth/$';

const idToken = { sub: 'session-user', sid: 'session-id' } as IdToken;
const userInfoToken = { sub: 'session-user', sin: '999999998' } as UserinfoToken;

function createArgs(slug: string, session: Session) {
  const url = `https://localhost/auth/${slug}`;
  const logger = mock<Logger>();
  vi.mocked(createLogger).mockReturnValue(logger);
  const auditService = new DefaultAuditService();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.createCounter.mockReturnValue({ add: vi.fn() } as unknown as ReturnType<InstrumentationService['createCounter']>);
  const raoidcService = mock<RaoidcService>();
  raoidcService.generateSignoutRequest.mockReturnValue('https://provider.invalid/logout');
  raoidcService.handleCallback.mockResolvedValue({ accessToken: 'access-token-canary', idToken, userInfoToken });

  const services = new Map<unknown, unknown>([
    [TYPES.AuditService, auditService],
    [TYPES.InstrumentationService, instrumentationService],
    [TYPES.RaoidcService, raoidcService],
    [TYPES.ServerConfig, { AUTH_RASCL_LOGOUT_URL: 'https://rascl.invalid/logout' } as ServerConfig],
  ]);
  const appContainer = mock<AppContainerProvider>();
  appContainer.get.mockImplementation(((serviceIdentifier: unknown) => services.get(serviceIdentifier)) as unknown as AppContainerProvider['get']);

  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session });

  return { args: { context, params: { '*': slug }, request: new Request(url), url: new URL(url), pattern: '/auth/*' }, logger, raoidcService };
}

async function runLoader(args: ReturnType<typeof createArgs>['args']) {
  return await contextStorageMiddleware(args, async () => await loader(args));
}

function expectSessionAudit(logger: Logger, eventId: string) {
  expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
    [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
    'cdcp.audit.event_id': eventId,
    'cdcp.user.id': idToken.sub,
  });
}

describe('auth route audit attribution', () => {
  it('attributes the session-created audit to the authenticated user', async () => {
    const session = mock<Session>();
    session.find.mockImplementation(((key: string) => (key === 'authCodeVerifier' || key === 'authState' ? Option.some('value') : Option.none())) as Session['find']);
    const { args, logger } = createArgs('callback/raoidc', session);

    await runLoader(args);

    expectSessionAudit(logger, 'auth.session-created');
    expect(session.set).toHaveBeenCalledWith('idToken', idToken);
    expect(session.set).toHaveBeenCalledWith('userInfoToken', userInfoToken);
  });

  it.each([
    ['missing SIN', { sub: 'session-user' } as UserinfoToken],
    ['mismatched subjects', { sub: 'other-user', sin: '999999998' } as UserinfoToken],
  ])('attributes login to the ID token subject when user information has %s', async (_label, incompleteUserInfo) => {
    const session = mock<Session>();
    session.find.mockImplementation(((key: string) => (key === 'authCodeVerifier' || key === 'authState' ? Option.some('value') : Option.none())) as Session['find']);
    const { args, logger, raoidcService } = createArgs('callback/raoidc', session);
    raoidcService.handleCallback.mockResolvedValue({ accessToken: 'access-token-canary', idToken, userInfoToken: incompleteUserInfo });

    await runLoader(args);

    expectSessionAudit(logger, 'auth.session-created');
    expect(session.set).toHaveBeenCalledWith('userInfoToken', incompleteUserInfo);
  });

  it('attributes the session-destroyed audit to the session user', async () => {
    const session = mock<Session>();
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(idToken);
    session.find.mockReturnValue(Option.some(userInfoToken));
    const { args, logger } = createArgs('logout', session);

    await runLoader(args);

    expectSessionAudit(logger, 'auth.session-destroyed');
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing user information', Option.none()],
    ['missing SIN', Option.some({ sub: 'session-user' } as UserinfoToken)],
    ['mismatched subjects', Option.some({ sub: 'other-user', sin: '999999998' } as UserinfoToken)],
  ])('attributes logout to the ID token subject with %s', async (_label, incompleteUserInfo) => {
    const session = mock<Session>();
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(idToken);
    session.find.mockReturnValue(incompleteUserInfo);
    const { args, logger } = createArgs('logout', session);

    await runLoader(args);

    expectSessionAudit(logger, 'auth.session-destroyed');
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it('audits logout as anonymous when the ID token has no subject', async () => {
    const session = mock<Session>();
    session.has.mockReturnValue(true);
    session.get.mockReturnValue({ sid: 'session-id' } as IdToken);
    const { args, logger } = createArgs('logout', session);

    await runLoader(args);

    expect(logger.audit).toHaveBeenCalledExactlyOnceWith('Audit event recorded', {
      [ATTR_OTEL_EVENT_NAME]: 'cdcp.audit.recorded',
      'cdcp.audit.event_id': 'auth.session-destroyed',
      'cdcp.user.id': 'anonymous',
    });
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it('does not create a logout audit without an ID token', async () => {
    const session = mock<Session>();
    session.has.mockReturnValue(false);
    const { args, logger } = createArgs('logout', session);

    await expect(runLoader(args)).rejects.toMatchObject({ status: 302 });

    expect(logger.audit).not.toHaveBeenCalled();
    expect(session.destroy).not.toHaveBeenCalled();
  });
});
