import { ATTR_ERROR_TYPE, ATTR_HTTP_REQUEST_METHOD, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_OTEL_EVENT_NAME, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import express from 'express';
import { once } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { createRequestLoggerMiddleware } from '~/.server/express-server/middleware';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestLoggerMiddleware', () => {
  it.each([true, false])('uses status-based severity and skips readiness when production is %s', async (isProduction) => {
    const app = express();
    const logger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValue(logger);
    app.use(createRequestLoggerMiddleware(isProduction));
    app.get('/request', (_request, response) => response.send('ok'));
    app.get('/status/:status', (request, response) => response.status(Number(request.params.status)).end());
    app.get('/abort', (_request, response) => response.destroy());
    app.get('/api/readyz', (_request, response) => response.send('ready'));
    const server = app.listen(0, '127.0.0.1');

    try {
      await once(server, 'listening');
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Expected a loopback TCP address');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/request?sin=999999998&email=canary%40example.invalid&token=synthetic-secret`, { headers: { connection: 'close' } });
      expect(await response.text()).toBe('ok');
      expect(logger.http).toHaveBeenCalledExactlyOnceWith('HTTP request completed', {
        [ATTR_OTEL_EVENT_NAME]: 'cdcp.http.request.completed',
        [ATTR_HTTP_REQUEST_METHOD]: 'GET',
        [ATTR_URL_PATH]: '/request',
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: 200,
        'cdcp.http.response_time_ms': expect.any(Number),
        'cdcp.http.response_content_length_bytes': 2,
      });

      await Promise.all(
        [302, 399, 400, 404, 429, 500, 503].map(async (status) => {
          const result = await fetch(`http://127.0.0.1:${address.port}/status/${status}`, {
            redirect: 'manual',
            headers: { connection: 'close' },
          });
          await result.text();
          const method = status >= 500 ? logger.error : status >= 400 ? logger.warn : logger.http;
          expect(method).toHaveBeenCalledWith(
            'HTTP request completed',
            expect.objectContaining({
              [ATTR_OTEL_EVENT_NAME]: 'cdcp.http.request.completed',
              [ATTR_HTTP_REQUEST_METHOD]: 'GET',
              [ATTR_URL_PATH]: `/status/${status}`,
              [ATTR_HTTP_RESPONSE_STATUS_CODE]: status,
              ...(status >= 400 && { [ATTR_ERROR_TYPE]: String(status) }),
            }),
          );
        }),
      );

      expect(logger.http).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(2);

      await expect(fetch(`http://127.0.0.1:${address.port}/abort`, { headers: { connection: 'close' } })).rejects.toThrow();
      await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(3));
      expect(logger.error).toHaveBeenLastCalledWith('HTTP request completed', {
        [ATTR_OTEL_EVENT_NAME]: 'cdcp.http.request.completed',
        [ATTR_HTTP_REQUEST_METHOD]: 'GET',
        [ATTR_URL_PATH]: '/abort',
        [ATTR_ERROR_TYPE]: 'http_response_incomplete',
      });

      const readiness = await fetch(`http://127.0.0.1:${address.port}/api/readyz`, { headers: { connection: 'close' } });
      expect(await readiness.text()).toBe('ready');
      expect(logger.http).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(3);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
