import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { isTracingSuppressed } from '@opentelemetry/core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { Headers, Request, Response } from 'undici';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultHttpClient } from '~/.server/http/http-client';
import type { InstrumentationService } from '~/.server/observability';
import { AppError } from '~/errors/app-error';

vi.unmock(import('~/.server/observability/decorator'));

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

  describe('HTTP dependency tracing', () => {
    const exporter = new InMemorySpanExporter();
    const processor = new SimpleSpanProcessor({ exporter });
    const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [processor], logRecordProcessors: [], metricReaders: [] });

    beforeAll(() => sdk.start());
    afterEach(() => exporter.reset());
    afterAll(async () => {
      await sdk.shutdown();
      trace.disable();
      context.disable();
      propagation.disable();
    });

    it.each([200, 302, 400, 401, 403, 404, 429, 503])('records only safe HTTP attributes for status %i by default', async (status) => {
      const response = new Response('response-body-canary', { status });
      const client = new DefaultHttpClient(mock<InstrumentationService>());
      vi.spyOn(client, 'getFetchFn').mockReturnValue(async () => {
        expect(isTracingSuppressed(context.active())).toBe(true);
        return await Promise.resolve(response);
      });

      await trace.getTracer('http-client-test').startActiveSpan('test.request', async (parent) => {
        try {
          await expect(client.instrumentedFetch('http.client.test.posts', 'https://private.example.test/path-canary?token=query-canary', { method: 'post', headers: { authorization: 'Bearer header-canary' }, body: 'request-body-canary' })).resolves.toBe(
            response,
          );
          expect(trace.getActiveSpan()).toBe(parent);
          expect(isTracingSuppressed(context.active())).toBe(false);
        } finally {
          parent.end();
        }
      });

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(2);
      const dependency = spans.find((span) => span.kind === SpanKind.CLIENT);
      const parent = spans.find((span) => span.name === 'test.request');
      expect(dependency?.name).toBe('http.client.test.posts');
      expect(dependency?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
      expect(dependency?.attributes).toEqual({ 'http.request.method': 'POST', 'http.response.status_code': status, ...(status >= 400 ? { 'error.type': String(status) } : {}) });
      expect(dependency?.status.code).toBe(status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET);
      expect(dependency?.events).toEqual([]);
      expect(JSON.stringify(spans.map(({ name, attributes, events, status }) => ({ name, attributes, events, status })))).not.toContain('canary');
      expect(response.bodyUsed).toBe(false);
    });

    it('classifies a transport failure without recording the raw error or inventing an HTTP status', async () => {
      const error = new TypeError('999999997 person-canary@example.test token-canary', { cause: Object.assign(new Error('nested-canary'), { code: 'ECONNRESET' }) });
      const instrumentation = mock<InstrumentationService>();
      const client = new DefaultHttpClient(instrumentation);
      vi.spyOn(client, 'getFetchFn').mockReturnValue(vi.fn().mockRejectedValue(error));

      await expect(client.instrumentedFetch('http.client.test.gets', 'https://example.test')).rejects.toBe(error);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes).toEqual({ 'http.request.method': 'GET', 'error.type': 'ECONNRESET' });
      expect(spans[0]?.status).toEqual({ code: SpanStatusCode.ERROR, message: 'HTTP request did not complete.' });
      expect(spans[0]?.events).toEqual([]);
      expect(JSON.stringify(spans.map(({ attributes, events, status }) => ({ attributes, events, status })))).not.toMatch(/canary|999999997/);
      expect(instrumentation.countHttpStatus).toHaveBeenCalledExactlyOnceWith('http.client.test.gets', 500);
    });

    it('uses the Request method and preserves its headers and body while propagating the dependency span', async () => {
      const request = new Request('https://example.test', { method: 'POST', headers: { authorization: 'Bearer header-canary' }, body: 'request-body-canary' });
      const client = new DefaultHttpClient(mock<InstrumentationService>());
      const transport = vi.fn<ReturnType<DefaultHttpClient['getFetchFn']>>().mockResolvedValue(new Response(null));
      vi.spyOn(client, 'getFetchFn').mockReturnValue(transport);

      await client.instrumentedFetch('http.client.test.posts', request);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes).toEqual({ 'http.request.method': 'POST', 'http.response.status_code': 200 });
      expect(transport).toHaveBeenCalledOnce();
      expect(transport.mock.calls[0]?.[0]).toBe(request);
      const outgoingHeaders = new Headers(transport.mock.calls[0]?.[1]?.headers);
      const spanContext = spans[0]?.spanContext();
      expect(outgoingHeaders.get('authorization')).toBe('Bearer header-canary');
      expect(outgoingHeaders.get('traceparent')).toBe(`00-${spanContext?.traceId}-${spanContext?.spanId}-01`);
      expect(request.headers.has('traceparent')).toBe(false);
      expect(request.bodyUsed).toBe(false);
      expect(await request.text()).toBe('request-body-canary');
    });

    it.each(['delete', 'custom-method-canary'])('bounds method attributes without altering the supplied method %s', async (method) => {
      const client = new DefaultHttpClient(mock<InstrumentationService>());
      const transport = vi.fn<ReturnType<DefaultHttpClient['getFetchFn']>>().mockResolvedValue(new Response(null));
      vi.spyOn(client, 'getFetchFn').mockReturnValue(transport);
      const request = new Request('https://example.test', { method: 'POST' });
      const options = { method, headers: { authorization: 'Bearer header-canary' } };

      await client.instrumentedFetch('http.client.test', request, options);

      expect(exporter.getFinishedSpans()[0]?.attributes['http.request.method']).toBe(method === 'delete' ? 'DELETE' : '_OTHER');
      expect(transport.mock.calls[0]?.[1]?.method).toBe(method);
      expect(new Headers(transport.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer header-canary');
      expect(options).toEqual({ method, headers: { authorization: 'Bearer header-canary' } });
    });

    it('keeps retries and status metrics inside one dependency span', async () => {
      const instrumentation = mock<InstrumentationService>();
      const client = new DefaultHttpClient(instrumentation);
      const response = new Response('accepted');
      const transport = vi
        .fn<ReturnType<DefaultHttpClient['getFetchFn']>>()
        .mockResolvedValueOnce(new Response('retry-body-canary', { status: 503 }))
        .mockResolvedValueOnce(response);
      vi.spyOn(client, 'getFetchFn').mockReturnValue(transport);

      await expect(client.instrumentedFetch('http.client.test.gets', 'https://example.test', { retryOptions: { retries: 1, backoffMs: 0, retryConditions: { 503: [] } } })).resolves.toBe(response);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes).toEqual({ 'http.request.method': 'GET', 'http.response.status_code': 200 });
      expect(spans[0]?.status.code).toBe(SpanStatusCode.UNSET);
      expect(transport).toHaveBeenCalledTimes(2);
      expect(instrumentation.countHttpStatus.mock.calls).toEqual([
        ['http.client.test.gets', 503],
        ['http.client.test.gets', 200],
      ]);
    });

    it('does not invent a response status when retryable HTTP responses exhaust the retry policy', async () => {
      const instrumentation = mock<InstrumentationService>();
      const client = new DefaultHttpClient(instrumentation);
      vi.spyOn(client, 'getFetchFn').mockReturnValue(vi.fn().mockResolvedValue(new Response('retry-body-canary', { status: 503 })));

      await expect(client.instrumentedFetch('http.client.test.gets', 'https://example.test', { retryOptions: { retries: 1, backoffMs: 0, retryConditions: { 503: [] } } })).rejects.toBeInstanceOf(AppError);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes).toEqual({ 'http.request.method': 'GET', 'error.type': 'http_request_failed' });
      expect(spans[0]?.events).toEqual([]);
      expect(instrumentation.countHttpStatus.mock.calls).toEqual([
        ['http.client.test.gets', 503],
        ['http.client.test.gets', 503],
      ]);
    });

    it('isolates concurrent requests and never records unrecognized error details', async () => {
      const error = Object.assign(new Error('error-token-canary'), { code: 'untrusted-code-canary' });
      const client = new DefaultHttpClient(mock<InstrumentationService>());
      vi.spyOn(client, 'getFetchFn').mockReturnValue(async () => {
        await Promise.resolve();
        throw error;
      });

      await Promise.all(
        ['first.request', 'second.request'].map(async (name) => {
          await trace.getTracer('http-client-test').startActiveSpan(name, async (parent) => {
            try {
              await expect(client.instrumentedFetch('http.client.test.gets', 'https://example.test')).rejects.toBe(error);
              expect(trace.getActiveSpan()).toBe(parent);
            } finally {
              parent.end();
            }
          });
        }),
      );

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(4);
      const dependencies = spans.filter((span) => span.kind === SpanKind.CLIENT);
      expect(new Set(dependencies.map((span) => span.spanContext().traceId)).size).toBe(2);

      for (const dependency of dependencies) {
        const parent = spans.find((span) => span.spanContext().spanId === dependency.parentSpanContext?.spanId);
        expect(parent?.name).toMatch(/^(first|second)\.request$/);
        expect(parent?.spanContext().traceId).toBe(dependency.spanContext().traceId);
        expect(dependency.attributes).toEqual({ 'http.request.method': 'GET', 'error.type': 'http_request_failed' });
        expect(dependency.events).toEqual([]);
      }
    });
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
