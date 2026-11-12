import { createRequestHandler } from '@react-router/express';
import { RouterContextProvider } from 'react-router';
import type { ServerBuild } from 'react-router';

import type { Counter } from '@opentelemetry/api';
import { ATTR_ERROR_TYPE, ATTR_HTTP_REQUEST_METHOD, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_OTEL_EVENT_NAME, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import express from 'express';
import { once } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createRequestLoggerMiddleware } from '~/.server/express-server/middleware';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import type { Session } from '~/.server/web/session';
import { handleError } from '~/entry.server';

function createErrorContext() {
  const logger = mock<Logger>();
  vi.mocked(createLogger).mockReturnValue(logger);
  const counter = mock<Counter>();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.createCounter.mockReturnValue(counter);
  const appContainer = mock<AppContainerProvider>();
  appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session: mock<Session>() });
  return { logger, counter, instrumentationService, context };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleError', () => {
  it.each([400, 404, 405, 429, 499])('keeps a %s route rejection at DEBUG without changing its metric', (status) => {
    const { logger, counter, instrumentationService, context } = createErrorContext();
    const request = new Request('http://localhost/index.php?token=synthetic-secret', { method: 'POST' });

    handleError({ status, statusText: 'Client rejection', internal: true, data: 'synthetic-secret' }, { request, context, params: {} });

    expect(logger.debug).toHaveBeenCalledExactlyOnceWith('React Router request failed', {
      [ATTR_ERROR_TYPE]: 'react_router_request_failed',
      [ATTR_HTTP_REQUEST_METHOD]: 'POST',
      [ATTR_URL_PATH]: '/index.php',
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(instrumentationService.createCounter).toHaveBeenCalledExactlyOnceWith('http.server.requests.failed');
    expect(counter.add).toHaveBeenCalledExactlyOnceWith(1);
  });

  it.each([
    new Error('synthetic-secret'),
    new Error('Downstream request failed. Status: 400'),
    new Error('Failed to retrieve OAuth token. Status: 401'),
    { status: 405 },
    ...[500, 503, 599].map((status) => ({ status, statusText: 'Server failure', internal: true, data: 'synthetic-secret' })),
  ])('retains server and unclassified errors at ERROR for %j', (error) => {
    const { logger, counter, context } = createErrorContext();
    const request = new Request('http://localhost/');

    handleError(error, { request, context, params: {} });

    expect(logger.error).toHaveBeenCalledExactlyOnceWith('React Router request failed', {
      [ATTR_ERROR_TYPE]: 'react_router_request_failed',
      [ATTR_HTTP_REQUEST_METHOD]: 'GET',
      [ATTR_URL_PATH]: '/',
    });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(counter.add).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('still ignores aborted requests', () => {
    const { logger, counter, context } = createErrorContext();
    const request = new Request('http://localhost/', { signal: AbortSignal.abort() });

    handleError(new Error('Request aborted'), { request, context, params: {} });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(counter.add).not.toHaveBeenCalled();
  });

  it('keeps missing-action document and data POSTs at 405 with one WARN completion and no ERROR diagnostic', async () => {
    const { logger, counter, context } = createErrorContext();
    const build: ServerBuild = {
      entry: { module: { default: (_request, status, headers) => new Response(null, { status, headers }), handleError } },
      routes: {
        root: { id: 'root', path: '', module: { default: () => null } },
        'routes/failure': {
          id: 'routes/failure',
          parentId: 'root',
          path: 'failure',
          module: {
            loader: () => {
              throw new Error('synthetic-secret');
            },
            default: () => null,
          },
        },
        'routes/catchall': { id: 'routes/catchall', parentId: 'root', path: '*', module: { default: () => null } },
      },
      assets: { entry: { imports: [], module: '' }, routes: {}, url: '', version: '' },
      publicPath: '/',
      assetsBuildDirectory: 'build/client',
      future: {},
      ssr: true,
      isSpaMode: false,
      prerender: [],
      routeDiscovery: { mode: 'initial', manifestPath: '/__manifest' },
    };
    const app = express();
    app.use(createRequestLoggerMiddleware(true));
    app.use(createRequestHandler({ build, getLoadContext: () => context, mode: 'production' }));
    const server = app.listen(0, '127.0.0.1');

    try {
      await once(server, 'listening');
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Expected a loopback TCP address');
      }

      await Promise.all(
        ['/', '/index.php', '/wp-json/batch/v1', '/_root.data', '/index.php.data', '/wp-json/batch/v1.data'].map(async (path) => {
          const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { connection: 'close' } });
          await response.text();
          expect(response.status).toBe(405);
          expect(logger.http).toHaveBeenCalledWith(
            'HTTP request completed',
            expect.objectContaining({
              [ATTR_OTEL_EVENT_NAME]: 'cdcp.http.request.completed',
              [ATTR_HTTP_REQUEST_METHOD]: 'POST',
              [ATTR_URL_PATH]: path,
              [ATTR_HTTP_RESPONSE_STATUS_CODE]: 405,
              [ATTR_ERROR_TYPE]: '405',
            }),
          );
        }),
      );

      expect(logger.http).toHaveBeenCalledTimes(6);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledTimes(6);
      expect(logger.error).not.toHaveBeenCalled();
      expect(counter.add).toHaveBeenCalledTimes(6);

      await Promise.all(
        ['/failure', '/failure.data'].map(async (path) => {
          const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { connection: 'close' } });
          await response.text();
          expect(response.status).toBe(500);
          expect(logger.error).toHaveBeenCalledWith('React Router request failed', {
            [ATTR_HTTP_REQUEST_METHOD]: 'GET',
            [ATTR_URL_PATH]: path,
            [ATTR_ERROR_TYPE]: 'react_router_request_failed',
          });
          expect(logger.error).toHaveBeenCalledWith('HTTP request completed', expect.objectContaining({ [ATTR_URL_PATH]: path, [ATTR_HTTP_RESPONSE_STATUS_CODE]: 500, [ATTR_ERROR_TYPE]: '500' }));
        }),
      );

      expect(logger.error).toHaveBeenCalledTimes(4);
      expect(logger.http).toHaveBeenCalledTimes(6);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledTimes(6);
      expect(counter.add).toHaveBeenCalledTimes(8);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
