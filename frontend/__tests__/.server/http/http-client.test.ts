import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultHttpClient } from '~/.server/http/http-client';
import type { InstrumentationService } from '~/.server/observability';
import { AppError } from '~/errors/app-error';

describe('DefaultHttpClient', () => {
  let httpClient: DefaultHttpClient;

  const mockFetch = vi.fn();
  const mockInstrumentationService = mock<InstrumentationService>();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();

    httpClient = new DefaultHttpClient(mockInstrumentationService);
    vi.spyOn(httpClient, 'getFetchFn').mockReturnValue(mockFetch);
  });

  describe('instrumentedFetch', () => {
    it('calls fetch and instrumentationService on success', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

      const res = await httpClient.instrumentedFetch('example-metric', 'https://api.example.com');

      expect(res.status).toBe(200);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledWith('example-metric', 200);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledOnce();
    });

    it('retries on matched status and body condition', async () => {
      const response = new Response('retry this', { status: 503 });
      mockFetch.mockResolvedValue(response);

      await expect(
        httpClient.instrumentedFetch('example-metric', 'https://api.example.com', {
          retryOptions: {
            retries: 1,
            backoffMs: 1,
            retryConditions: {
              503: [/retry this/],
            },
          },
        }),
      ).rejects.toThrow(AppError);

      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledWith('example-metric', 503);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledTimes(2);
    });

    it('retries on matched status and no body condition', async () => {
      const response = new Response('retry this', { status: 503 });
      mockFetch.mockResolvedValue(response);

      await expect(
        httpClient.instrumentedFetch('example-metric', 'https://api.example.com', {
          retryOptions: {
            retries: 1,
            backoffMs: 1,
            retryConditions: {
              503: [],
            },
          },
        }),
      ).rejects.toThrow(AppError);

      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledWith('example-metric', 503);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledTimes(2);
    });

    it('does not retry if body does not match', async () => {
      const response = new Response('not matching', { status: 503 });
      mockFetch.mockResolvedValue(response);

      const res = await httpClient.instrumentedFetch('example-metric', 'https://api.example.com', {
        retryOptions: {
          retries: 1,
          backoffMs: 1,
          retryConditions: {
            503: [/something else/],
          },
        },
      });

      expect(res.status).toBe(503);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledWith('example-metric', 503);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledOnce();
    });

    it('uses default retry options if none provided', async () => {
      const response = new Response(null, { status: 503 });
      mockFetch.mockResolvedValue(response);

      const res = await httpClient.instrumentedFetch('example-metric', 'https://api.example.com', {
        retryOptions: {},
      });

      expect(res.status).toBe(503);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledWith('example-metric', 503);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledOnce();
    });

    it('calls instrumentationService with 500 on unexpected error', async () => {
      mockFetch.mockRejectedValue(new Error('Network fail'));

      await expect(httpClient.instrumentedFetch('example-metric', 'https://api.example.com')).rejects.toThrow();

      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledWith('example-metric', 500);
      expect(mockInstrumentationService.countHttpStatus).toHaveBeenCalledOnce();
    });
  });
});
