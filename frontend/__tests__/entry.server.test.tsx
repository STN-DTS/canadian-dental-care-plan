import { renderToStaticMarkup } from 'react-dom/server';

import { RouterContextProvider } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

import type { Counter } from '@opentelemetry/api';
import { createInstance } from 'i18next';
import type { TransformableInfo } from 'logform';
import { I18nextProvider } from 'react-i18next';
import { MESSAGE } from 'triple-beam';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import en from '~/.server/locales/en/gcweb';
import { createLogger } from '~/.server/logging';
import { DefaultLogger } from '~/.server/logging/logger-default';
import { defaultsConfig } from '~/.server/logging/logging-config';
import { createWinstonInstance } from '~/.server/logging/winston-factory';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import type { Session } from '~/.server/web/session';
import { CorrelationDetail } from '~/components/correlation-detail';
import { handleError } from '~/entry.server';
import { AppError } from '~/errors/app-error';

vi.unmock('react-i18next');

afterEach(() => vi.unstubAllEnvs());

describe('server error diagnostics', () => {
  it.each([
    { error: new Error('synthetic-sensitive-message'), level: 'error' },
    { error: { secret: 'synthetic-sensitive-message' }, level: 'error' },
    { error: { status: 404, statusText: 'Not Found', internal: false, data: 'synthetic-sensitive-message' }, level: 'debug' },
    { error: { status: 500, statusText: 'Internal Server Error', internal: false, data: 'synthetic-sensitive-message' }, level: 'error' },
  ] as const)('preserves safe request diagnostics at $level for $error', ({ error, level }) => {
    const log = mock<ReturnType<typeof createLogger>>();
    vi.mocked(createLogger).mockReturnValue(log);
    const instrumentationService = mock<InstrumentationService>();
    instrumentationService.createCounter.mockReturnValue(mock<Counter>());
    const appContainer = mock<AppContainerProvider>();
    appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
    const context = new RouterContextProvider();
    context.set(appContext, { appContainer, session: mock<Session>() });

    try {
      handleError(error, { ...mock<LoaderFunctionArgs>(), request: new Request('http://localhost/en?token=synthetic-sensitive-query'), context, params: {} });
      expect(log[level]).toHaveBeenCalledExactlyOnceWith('React Router request failed', {
        'error.type': 'react_router_request_failed',
        'http.request.method': 'GET',
        'url.path': '/en',
      });
      expect(instrumentationService.createCounter('http.server.requests.failed').add).toHaveBeenCalledWith(1);
    } finally {
      vi.mocked(createLogger).mockReset();
    }
  });

  it.each(['production', 'development'])('emits the displayed ID in %s diagnostics without sensitive details', async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    const winston = createWinstonInstance({ ...defaultsConfig, LOG_LEVEL: 'error', AUDIT_LOG_ENABLED: false });
    const records: string[] = [];
    const transport = winston.transports[0];

    if (!transport) {
      throw new Error('Expected console transport');
    }

    transport.on('logged', (info: TransformableInfo) => records.push(String(info[MESSAGE])));
    vi.mocked(createLogger).mockImplementation((label) => new DefaultLogger(winston, label));
    const instrumentationService = mock<InstrumentationService>();
    instrumentationService.createCounter.mockReturnValue(mock<Counter>());
    const appContainer = mock<AppContainerProvider>();
    appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
    const context = new RouterContextProvider();
    context.set(appContext, { appContainer, session: mock<Session>() });
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { gcweb: en } } });
    const error = new AppError('Synthetic SIN 900000000, person@example.test, token=synthetic-secret', undefined, { correlationId: 'AB-123456' });

    try {
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <CorrelationDetail error={JSON.parse(JSON.stringify(error))} />
        </I18nextProvider>,
      );
      handleError(error, { ...mock<LoaderFunctionArgs>(), request: new Request('http://localhost/en'), context, params: {} });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(html).toContain(error.correlationId);
      expect(records.join('')).toContain(error.correlationId);
      expect(records.join('')).not.toContain('900000000');
      expect(records.join('')).not.toContain('person@example.test');
      expect(records.join('')).not.toContain('synthetic-secret');
      expect(instrumentationService.createCounter).toHaveBeenCalledWith('http.server.requests.failed');
      expect(instrumentationService.createCounter('http.server.requests.failed').add).toHaveBeenCalledWith(1);

      const controller = new AbortController();
      controller.abort();
      records.length = 0;
      instrumentationService.createCounter.mockClear();
      handleError(error, { ...mock<LoaderFunctionArgs>(), request: new Request('http://localhost/en', { signal: controller.signal }), context, params: {} });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(records).toEqual([]);
      expect(instrumentationService.createCounter).not.toHaveBeenCalled();
    } finally {
      winston.close();
      vi.mocked(createLogger).mockReset();
    }
  });
});
