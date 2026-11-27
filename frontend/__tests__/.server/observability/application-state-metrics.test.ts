import { RouterContextProvider } from 'react-router';

import type { Attributes, Counter } from '@opentelemetry/api';
import { Option } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { ATTR_CDCP_ROUTE_ID } from '~/.server/logging/log-attributes';
import { countApplicationStateOutcome } from '~/.server/observability/application-state-metrics';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import { matchRouteId } from '~/.server/utils/server-build-utils';
import type { Session } from '~/.server/web/session';
import { findContext, getUrl } from '~/middlewares/context-storage.server';

vi.mock(import('~/.server/utils/server-build-utils'), () => ({ matchRouteId: vi.fn() }));
vi.mock(import('~/middlewares/context-storage.server'), () => ({ findContext: vi.fn(), getContext: vi.fn(), getUrl: vi.fn() }));

describe('countApplicationStateOutcome', () => {
  const routeId = 'public/application/$id/full-adult/marital-status';
  const counterAdd = vi.fn();
  const instrumentationService = mock<InstrumentationService>();
  const appContainer = mock<AppContainerProvider>();
  const context = new RouterContextProvider();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchRouteId).mockReturnValue(routeId);
    instrumentationService.createCounter.mockReturnValue({ add: counterAdd } as unknown as Counter<Attributes>);
    appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
    context.set(appContext, { appContainer, session: mock<Session>() });
    vi.mocked(findContext).mockReturnValue(Option.some(context));
    vi.mocked(getUrl).mockReturnValue(new URL('https://example.test/en/application/opaque-id/full/adult/marital-status'));
  });

  it('records only the bounded route, channel, and outcome attributes', () => {
    countApplicationStateOutcome('public', 'missing');

    expect(instrumentationService.createCounter).toHaveBeenCalledExactlyOnceWith('cdcp.application.state.unavailable');
    expect(counterAdd).toHaveBeenCalledExactlyOnceWith(1, {
      [ATTR_CDCP_ROUTE_ID]: routeId,
      'cdcp.application.channel': 'public',
      'cdcp.application.state.outcome': 'missing',
    });
  });
});
