import express from 'express';
import { once } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRequestLoggerMiddleware } from '~/.server/express-server/middleware';
import { createLogger } from '~/.server/logging';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestLoggerMiddleware', () => {
  it.each([true, false])('logs completed requests at info and skips readiness when production is %s', async (isProduction) => {
    const app = express();
    app.use(createRequestLoggerMiddleware(isProduction));
    app.get('/request', (_request, response) => response.send('ok'));
    app.get('/api/readyz', (_request, response) => response.send('ready'));
    const result = vi.mocked(createLogger).mock.results[0];

    if (result?.type !== 'return') {
      throw new Error('Expected request middleware to create a logger');
    }

    const logger = result.value;
    const server = app.listen(0, '127.0.0.1');

    try {
      await once(server, 'listening');
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Expected a loopback TCP address');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/request`, { headers: { connection: 'close' } });
      expect(await response.text()).toBe('ok');
      expect(logger.info).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('GET /request'));

      const readiness = await fetch(`http://127.0.0.1:${address.port}/api/readyz`, { headers: { connection: 'close' } });
      expect(await readiness.text()).toBe('ready');
      expect(logger.info).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
