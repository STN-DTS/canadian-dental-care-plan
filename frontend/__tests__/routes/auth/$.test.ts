// @vitest-environment node

import { RouterContextProvider } from 'react-router';

import { Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import type { RaoidcService } from '~/.server/auth/raoidc-service';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { userContext } from '~/.server/context/user-context';
import type { AuditService } from '~/.server/domain/services/audit-service';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc-utils';
import type { Session } from '~/.server/web/session';
import { loader } from '~/routes/auth/$';

const idToken = { sub: 'session-user', sid: 'session-id' } as IdToken;
const userInfoToken = { sub: 'session-user', sin: '999999998' } as UserinfoToken;

function createArgs(slug: string, session: Session) {
  const url = `https://localhost/auth/${slug}`;
  const auditedActors: unknown[] = [];
  const auditService = mock<AuditService>();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.createCounter.mockReturnValue({ add: vi.fn() } as unknown as ReturnType<InstrumentationService['createCounter']>);
  const raoidcService = mock<RaoidcService>();
  raoidcService.generateSignoutRequest.mockReturnValue('https://provider.invalid/logout');
  raoidcService.handleCallback.mockResolvedValue({ idToken, userInfoToken } as Awaited<ReturnType<RaoidcService['handleCallback']>>);

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
  auditService.createAudit.mockImplementation(() => {
    auditedActors.push(context.get(userContext)?.id);
  });

  return { args: { context, params: { '*': slug }, request: new Request(url), url: new URL(url), pattern: '/auth/*' }, auditService, auditedActors };
}

describe('auth route audit attribution', () => {
  it('attributes the session-created audit to the authenticated user', async () => {
    const session = mock<Session>();
    session.find.mockImplementation(((key: string) => (key === 'authCodeVerifier' || key === 'authState' ? Option.some('value') : Option.none())) as Session['find']);
    const { args, auditService, auditedActors } = createArgs('callback/raoidc', session);

    await loader(args);

    expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('auth.session-created');
    expect(auditedActors).toEqual(['session-user']);
  });

  it('attributes the session-destroyed audit to the session user', async () => {
    const session = mock<Session>();
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(idToken);
    session.find.mockReturnValue(Option.some(userInfoToken));
    const { args, auditService, auditedActors } = createArgs('logout', session);

    await loader(args);

    expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('auth.session-destroyed');
    expect(auditedActors).toEqual(['session-user']);
    expect(session.destroy).toHaveBeenCalledOnce();
  });

  it('audits logout without a user when the session has no valid userinfo', async () => {
    const session = mock<Session>();
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(idToken);
    session.find.mockReturnValue(Option.none());
    const { args, auditedActors } = createArgs('logout', session);

    await loader(args);

    expect(auditedActors).toEqual([undefined]);
    expect(session.destroy).toHaveBeenCalledOnce();
  });
});
