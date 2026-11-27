import { render } from '@testing-library/react';

import { RouterContextProvider, useMatches, useNavigate } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import type { AppContext } from '~/.server/context/app-context';
import { touchSessionStorage } from '~/.server/data/session-storage';
import type { SecurityHandler } from '~/.server/routes/security/security-handler';
import type { Session } from '~/.server/web/session';
import type { SessionTimeoutProps } from '~/components/session-timeout';
import { useClientEnv, useCurrentLanguage } from '~/hooks';
import { action as apiSessionAction } from '~/routes/api/session';
import ProtectedLayoutRoute from '~/routes/protected/layout';
import PublicLayoutRoute from '~/routes/public/layout';
import { useApiSession } from '~/utils/api-session-utils';

let capturedTimeoutProps: SessionTimeoutProps | undefined;

vi.mock(import('react-router'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Outlet: () => null,
    useMatches: vi.fn(),
    useNavigate: vi.fn(),
  };
});

vi.mock(import('~/components/layouts/protected-layout'), () => ({
  NotFoundError: () => <div />,
  ProtectedLayout: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ServerError: () => <div />,
}));

vi.mock(import('~/components/session-timeout'), () => ({
  default: (props: SessionTimeoutProps) => {
    capturedTimeoutProps = props;
    return <div />;
  },
}));

vi.mock(import('~/hooks'), () => ({
  useClientEnv: vi.fn(),
  useCurrentLanguage: vi.fn(),
}));

vi.mock(import('~/utils/api-session-utils'), () => ({ useApiSession: vi.fn() }));
vi.mock(import('~/.server/data/session-storage'));

describe('layout session timeout dispatch', () => {
  const submitSession = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    capturedTimeoutProps = undefined;
    vi.mocked(useClientEnv).mockReturnValue({ SESSION_TIMEOUT_PROMPT_SECONDS: 300, SESSION_TIMEOUT_SECONDS: 1140 } as ReturnType<typeof useClientEnv>);
    vi.mocked(useCurrentLanguage).mockReturnValue({ currentLanguage: 'fr', altLanguage: 'en' });
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useApiSession).mockReturnValue({ submit: submitSession });
  });

  it('extends via /api/session and ends with context-specific redirects across public routes', async () => {
    vi.mocked(useMatches).mockReturnValue([{ id: 'public/application/$id/terms-conditions-fr', params: { id: 'flow-1', lang: 'fr' }, pathname: '/fr/demande/flow-1/conditions', loaderData: undefined, handle: undefined }]);

    const { rerender } = render(<PublicLayoutRoute />);
    await capturedTimeoutProps!.onSessionExtend();
    await capturedTimeoutProps!.onSessionEnd();

    expect(submitSession).toHaveBeenNthCalledWith(1, { action: 'extend' });
    expect(submitSession).toHaveBeenNthCalledWith(2, { action: 'end', locale: 'fr', redirectTo: 'cdcp-website-apply' });

    submitSession.mockClear();
    vi.mocked(useMatches).mockReturnValue([{ id: 'public/status/myself-fr', params: { lang: 'fr' }, pathname: '/fr/etat/moi-meme', loaderData: undefined, handle: undefined }]);

    rerender(<PublicLayoutRoute />);
    await capturedTimeoutProps!.onSessionEnd();
    expect(submitSession).toHaveBeenCalledExactlyOnceWith({ action: 'end', locale: 'fr', redirectTo: 'cdcp-website-status' });

    submitSession.mockClear();
    vi.mocked(useMatches).mockReturnValue([{ id: 'public/unable-to-process-request-fr', params: { lang: 'fr' }, pathname: '/fr/incapable-traiter-demande', loaderData: undefined, handle: undefined }]);

    rerender(<PublicLayoutRoute />);
    await capturedTimeoutProps!.onSessionEnd();
    expect(submitSession).toHaveBeenCalledExactlyOnceWith({ action: 'end', locale: 'fr', redirectTo: 'cdcp-website' });
  });

  it('extends via /api/session and logs out with current locale across protected routes', async () => {
    render(<ProtectedLayoutRoute />);
    await capturedTimeoutProps!.onSessionExtend();
    await capturedTimeoutProps!.onSessionEnd();

    expect(submitSession).toHaveBeenCalledExactlyOnceWith({ action: 'extend' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/auth/logout?locale=fr');
  });
});

describe('/api/session extend action', () => {
  const session = mock<Session>({ id: 'session-a' });
  const securityHandler = mock<SecurityHandler>();
  const appContainer = mock<AppContext['appContainer']>();

  beforeEach(() => {
    vi.clearAllMocks();
    appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValue(securityHandler);
  });

  it('touches session storage when extending the session', async () => {
    const context = new RouterContextProvider();
    context.set(appContext, { appContainer, session });
    const url = new URL('https://example.test/api/session');
    const request = new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'extend' }) });

    const response = await apiSessionAction({ context, request, url, params: {}, pattern: '/api/session' });

    expect(response.status).toBe(200);
    expect(touchSessionStorage).toHaveBeenCalledExactlyOnceWith('session-a');
  });
});
