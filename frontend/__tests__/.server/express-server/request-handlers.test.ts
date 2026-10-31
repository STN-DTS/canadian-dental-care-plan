import express from 'express';
import type { Request, Response } from 'express';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { createGlobalErrorHandler } from '~/.server/express-server/request-handlers';

describe('globalErrorHandler', () => {
  it.each([
    { existingStatus: 200, expectedStatus: 500, page: '500.html' },
    { existingStatus: 302, expectedStatus: 500, page: '500.html' },
    { existingStatus: 399, expectedStatus: 500, page: '500.html' },
    { existingStatus: 400, expectedStatus: 400, page: '500.html' },
    { existingStatus: 403, expectedStatus: 403, page: '403.html' },
    { existingStatus: 500, expectedStatus: 500, page: '500.html' },
    { existingStatus: 503, expectedStatus: 503, page: '500.html' },
  ])('returns $expectedStatus and $page when the existing status is $existingStatus', async ({ existingStatus, expectedStatus, page }) => {
    const expectedPage = await readFile(new URL(`../../../app/.server/express-server/assets/${page}`, import.meta.url), 'utf8');
    const app = express();
    app.get('/error', (request, response, next) => {
      const sendFile = response.sendFile.bind(response);
      // Source assets live under .server; deployed assets do not have a dot-directory parent.
      vi.spyOn(response, 'sendFile').mockImplementation((filePath, options: Parameters<Response['sendFile']>[1] | ((error?: Error) => void), callback) => {
        sendFile(filePath, { dotfiles: 'allow' }, typeof options === 'function' ? options : callback);
      });
      response.status(existingStatus);
      next(new Error('Unexpected request failure'));
    });
    app.use(createGlobalErrorHandler());

    const server = app.listen(0, '127.0.0.1');

    try {
      await once(server, 'listening');
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Expected a loopback TCP address');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/error`, {
        redirect: 'manual',
        headers: { connection: 'close' },
      });
      const body = await response.text();

      expect(response.status).toBe(expectedStatus);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(body).toBe(expectedPage);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('delegates the original error without writing when headers have already been sent', () => {
    const error = new Error('Failure after headers');
    const response = mock<Response>({ headersSent: true });
    const next = vi.fn();

    createGlobalErrorHandler()(error, mock<Request>(), response, next);

    expect(next).toHaveBeenCalledExactlyOnceWith(error);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.sendFile).not.toHaveBeenCalled();
    expect(response.send).not.toHaveBeenCalled();
  });

  it('returns the fallback message with status 500 when sending the error page fails', () => {
    const response = mock<Response>({ headersSent: false, statusCode: 503 });
    response.status.mockReturnValue(response);
    response.sendFile.mockImplementation((filePath, options: Parameters<Response['sendFile']>[1] | ((error?: Error) => void), callback) => {
      const error = new Error('Error page unavailable');

      if (typeof options === 'function') {
        options(error);
      } else {
        callback?.(error);
      }
    });

    createGlobalErrorHandler()(new Error('Unexpected request failure'), mock<Request>(), response, vi.fn());

    expect(response.status).toHaveBeenLastCalledWith(500);
    expect(response.send).toHaveBeenCalledExactlyOnceWith('Internal Server Error');
  });
});
