import { RouterContextProvider, createStaticHandler, data } from 'react-router';
import type { InstrumentationHandlerResult, ServerBuild } from 'react-router';

import { ROOT_CONTEXT, SpanStatusCode, context as otelContext, trace } from '@opentelemetry/api';
import type { Context, Span } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import { enrichRequestSpan, instrumentAppErrors, otelSpan, recordError, withAppErrorCapture } from '~/.server/utils/otel-instrumentation-utils';
import type { Session } from '~/.server/web/session';
import { AppError } from '~/errors/app-error';
import { getAppError, getCorrelationId } from '~/errors/error-predicates';

const sensitiveCanaries = ['900000000', 'person@example.test', 'token=synthetic-secret'];

describe('React Router AppError capture', () => {
  beforeEach(() => {
    const storage = new AsyncLocalStorage<Context>();
    vi.spyOn(otelContext, 'active').mockImplementation(() => storage.getStore() ?? ROOT_CONTEXT);
    vi.spyOn(otelContext, 'with').mockImplementation((ctx, callback, thisArg, ...args) => storage.run(ctx, () => callback.apply(thisArg, args)));
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    { phase: 'loader', wrapped: false, status: 500 },
    { phase: 'action', wrapped: false, status: 500 },
    { phase: 'loader', wrapped: true, status: 500 },
    { phase: 'action', wrapped: true, status: 500 },
    { phase: 'loader', wrapped: true, status: 404 },
    { phase: 'action', wrapped: true, status: 404 },
  ] as const)('records the unchanged $phase AppError with wrapped=$wrapped and status=$status despite React Router filtering result.error', async ({ phase, wrapped, status }) => {
    const error = Object.assign(new AppError(sensitiveCanaries.join(', '), undefined, { correlationId: 'AB-123456' }), { stack: `Synthetic stack: ${sensitiveCanaries.join(', ')}` });
    const thrown = wrapped ? data(error, { status }) : error;
    const build = mock<ServerBuild>();
    build.routes = {
      test: {
        id: 'test',
        path: '/',
        module: {
          default: () => null,
          [phase]: () => {
            throw thrown;
          },
        },
      },
    };
    const route = instrumentAppErrors(build).routes.test;
    const handler = route?.module[phase];

    if (!route || !handler) {
      throw new Error('Expected test route');
    }

    await expect(handler({ request: new Request('http://localhost/'), params: {}, context: new RouterContextProvider(), url: new URL('http://localhost/'), pattern: '/' })).rejects.toBe(thrown);

    const handlerSpan = mock<Span>();
    const requestSpan = mock<Span>();
    const results: InstrumentationHandlerResult[] = [];
    const router = createStaticHandler([{ id: 'test', path: '/', loader: route.module.loader, action: route.module.action }], {
      instrumentations: [
        {
          route({ instrument }) {
            instrument({
              [phase]: async (handler: () => Promise<InstrumentationHandlerResult>) => {
                await otelContext.with(trace.setSpan(otelContext.active(), handlerSpan), async () => {
                  const result = await handler();
                  results.push(result);
                  recordError(handlerSpan, result.error);
                });
              },
            });
          },
        },
      ],
    });

    await withAppErrorCapture(async () => {
      const result = await router.query(new Request('http://localhost/', { method: phase === 'action' ? 'POST' : 'GET' }));

      if (result instanceof Response) {
        throw new Error('Expected static context');
      }

      expect(getAppError(result.errors?.test)).toBe(error);
      expect(result.statusCode).toBe(status);
      expect(getCorrelationId(JSON.parse(JSON.stringify(result.errors?.test)))).toBe(error.correlationId);
      enrichRequestSpan(requestSpan, 'GET', { status: 'success', error: undefined, statusCode: result.statusCode, meta: undefined });
    });

    expect(results).toEqual([{ status: 'success', error: undefined }]);

    for (const { span, failed } of [
      { span: handlerSpan, failed: true },
      { span: requestSpan, failed: status >= 500 },
    ]) {
      expect(span.setAttribute).toHaveBeenCalledWith('correlationId', error.correlationId);
      expect(span.recordException.mock.calls).toEqual(failed ? [[{ name: 'AppError', code: error.errorCode }]] : []);
      expect(span.setStatus.mock.calls).toEqual(failed ? [[{ code: SpanStatusCode.ERROR, message: 'internal_error' }]] : []);
      expect(span.setAttribute.mock.calls.filter(([key]) => key === 'error.type')).toEqual(failed ? [['error.type', 'AppError']] : []);
      const recorded = JSON.stringify([span.recordException.mock.calls, span.setAttribute.mock.calls, span.setAttributes.mock.calls, span.setStatus.mock.calls]);

      for (const canary of sensitiveCanaries) {
        expect(recorded).not.toContain(canary);
      }
    }
  });

  it('preserves wrappers, middleware names and loader hydration metadata across registration', () => {
    const loader = Object.assign(
      vi.fn(() => null),
      { hydrate: true },
    );
    const middleware = vi.fn(function syntheticMiddleware() {
      return new Response();
    });
    const build = mock<ServerBuild>();
    build.routes = { test: { id: 'test', path: '/', module: { default: () => null, loader, middleware: [middleware] } } };
    instrumentAppErrors(build);
    const wrapped = build.routes.test?.module.loader;
    expect(wrapped?.hydrate).toBe(true);
    expect(build.routes.test?.module.middleware?.[0]?.name).toBe(middleware.name);
    expect(instrumentAppErrors(build)).toBe(build);
    expect(build.routes.test?.module.loader).toBe(wrapped);
  });

  it.each([false, true])('suppresses captured AppErrors after the original request is aborted with wrapped=%s', async (wrapped) => {
    const controller = new AbortController();
    const error = new AppError('Synthetic cancellation');
    const thrown = wrapped ? data(error, { status: 500 }) : error;
    const build = mock<ServerBuild>();
    build.routes = {
      test: {
        id: 'test',
        path: '/',
        module: {
          default: () => null,
          loader: () => {
            controller.abort();
            throw thrown;
          },
        },
      },
    };
    const span = mock<Span>();
    const loader = instrumentAppErrors(build).routes.test?.module.loader;

    if (!loader) {
      throw new Error('Expected test loader');
    }

    await withAppErrorCapture(async () => {
      await otelContext.with(trace.setSpan(otelContext.active(), span), async () => {
        await expect(loader({ request: new Request('http://localhost/', { signal: controller.signal }), params: {}, context: new RouterContextProvider(), url: new URL('http://localhost/'), pattern: '/' })).rejects.toBe(thrown);
      });
      enrichRequestSpan(span, 'GET', { status: 'success', error: undefined, statusCode: 500, meta: undefined });
    });
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.setAttribute).not.toHaveBeenCalledWith('correlationId', expect.anything());
  });

  it.each([302, 400])('rethrows intentional Response status %s without capturing an AppError', async (status) => {
    const response = new Response(null, { status, headers: { Location: '/next' } });
    const build = mock<ServerBuild>();
    build.routes = {
      test: {
        id: 'test',
        path: '/',
        module: {
          default: () => null,
          loader: () => {
            throw response;
          },
        },
      },
    };
    const loader = instrumentAppErrors(build).routes.test?.module.loader;
    const span = mock<Span>();

    if (!loader) {
      throw new Error('Expected test loader');
    }

    await withAppErrorCapture(async () => {
      await otelContext.with(trace.setSpan(otelContext.active(), span), async () => {
        await expect(loader({ request: new Request('http://localhost/'), params: {}, context: new RouterContextProvider(), url: new URL('http://localhost/'), pattern: '/' })).rejects.toBe(response);
      });
      enrichRequestSpan(span, 'GET', { status: 'success', error: undefined, statusCode: status, meta: undefined });
    });
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.setStatus).not.toHaveBeenCalled();
    expect(span.setAttribute).not.toHaveBeenCalledWith('correlationId', expect.anything());
  });
});

describe('span error correlation', () => {
  it.each([400, 404, 499])('preserves the request correlation ID without failure details for status %s', (statusCode) => {
    const span = mock<Span>();
    const error = data(new AppError('Synthetic failure', undefined, { correlationId: 'AB-123456' }), { status: statusCode });
    enrichRequestSpan(span, 'GET', { status: 'error', statusCode, meta: undefined, error: error as unknown as Error });
    expect(span.setAttribute).toHaveBeenCalledWith('http.response.status_code', statusCode);
    expect(span.setAttribute).toHaveBeenCalledWith('correlationId', 'AB-123456');
    expect(span.setAttribute).not.toHaveBeenCalledWith('error.type', expect.anything());
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.setStatus).not.toHaveBeenCalled();
  });

  it.each([undefined, new Error('Synthetic failure'), { name: 'AppError', correlationId: '' }, { name: 'AppError', correlationId: '   ' }])('does not add placeholder IDs or failure details to 4xx requests without a valid ID: %j', (error) => {
    const span = mock<Span>();
    enrichRequestSpan(span, 'GET', error === undefined ? { status: 'success', statusCode: 404, meta: undefined, error: undefined } : { status: 'error', statusCode: 404, meta: undefined, error: error as Error });
    expect(span.setAttribute).not.toHaveBeenCalledWith('correlationId', expect.anything());
    expect(span.setAttribute).not.toHaveBeenCalledWith('error.type', expect.anything());
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.setStatus).not.toHaveBeenCalled();
  });

  it.each(['direct', 'data', 'response'] as const)('records only safe AppError exception fields on request and handler spans for %s errors', async (shape) => {
    const { context, span } = createSpanContext();
    const error = Object.assign(new AppError(sensitiveCanaries.join(', '), undefined, { correlationId: 'AB-123456' }), { stack: `Synthetic stack: ${sensitiveCanaries.join(', ')}` });
    const errors = { direct: error, data: data(error, { status: 500 }), response: { status: 500, statusText: 'Internal Server Error', internal: false, data: error } };
    const wrappedError = errors[shape];
    await otelSpan(context, 'loader', {}, vi.fn().mockResolvedValue({ status: 'error', error: wrappedError }));
    expect(span.setAttribute).toHaveBeenCalledWith('correlationId', error.correlationId);
    expect(span.recordException).toHaveBeenCalledExactlyOnceWith({ name: 'AppError', code: error.errorCode });

    enrichRequestSpan(span, 'GET', { status: 'error', statusCode: 500, meta: undefined, error: wrappedError as unknown as Error });
    expect(span.recordException).toHaveBeenCalledTimes(2);
    expect(span.recordException).toHaveBeenLastCalledWith({ name: 'AppError', code: error.errorCode });
    const recorded = JSON.stringify([span.recordException.mock.calls, span.setAttribute.mock.calls, span.setAttributes.mock.calls, span.setStatus.mock.calls]);

    for (const canary of sensitiveCanaries) {
      expect(recorded).not.toContain(canary);
    }
  });

  it('uses N/A for ordinary errors', () => {
    const span = mock<Span>();
    const error = new Error('Synthetic failure');
    recordError(span, error);
    expect(span.setAttribute).toHaveBeenCalledWith('correlationId', 'N/A');
    expect(span.recordException).toHaveBeenCalledWith(error);
  });

  it.each([undefined, null, new Response(null, { status: 302 }), new Response(null, { status: 400 })])('does not tag intentional responses or no error', (error) => {
    const span = mock<Span>();
    recordError(span, error);
    expect(span.setAttribute).not.toHaveBeenCalled();
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.setStatus).not.toHaveBeenCalled();
  });

  it.each([404, 500])('does not tag aborted requests or failing handlers for status %s', async (statusCode) => {
    const { context, span } = createSpanContext();
    const controller = new AbortController();
    controller.abort();
    const error = new AppError('Synthetic failure');
    recordError(span, error, controller.signal);
    await otelSpan(context, 'loader', {}, vi.fn().mockResolvedValue({ status: 'error', error }), undefined, controller.signal);
    enrichRequestSpan(span, 'GET', { status: 'error', statusCode, meta: undefined, error: error as unknown as Error }, controller.signal);
    expect(span.setAttribute).not.toHaveBeenCalledWith('correlationId', expect.anything());
    expect(span.recordException).not.toHaveBeenCalled();
    expect(span.end).toHaveBeenCalledOnce();
  });
});

function createSpanContext() {
  const span = mock<Span>();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.startActiveSpan.mockImplementation((name, options, callback) => callback(span));
  const appContainer = mock<AppContainerProvider>();
  appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session: mock<Session>() });

  return { context, span };
}

describe('otelSpan', () => {
  it('ends the span and preserves an enrichment failure', async () => {
    const { context, span } = createSpanContext();
    const error = new Error('enrichment failed');
    const handler = vi.fn().mockResolvedValue({ status: 'success', error: undefined });
    const onResult = vi.fn(() => {
      throw error;
    });

    await expect(otelSpan(context, 'request', {}, handler, onResult)).rejects.toBe(error);

    expect(span.end).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledOnce();
  });

  it('ends the span and preserves a rejected handler error', async () => {
    const { context, span } = createSpanContext();
    const error = new Error('handler failed');
    const onResult = vi.fn();

    await expect(otelSpan(context, 'loader', {}, vi.fn().mockRejectedValue(error), onResult)).rejects.toBe(error);

    expect(span.end).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('records an error result and ends the span', async () => {
    const { context, span } = createSpanContext();
    const error = new Error('loader failed');

    await otelSpan(context, 'loader', {}, vi.fn().mockResolvedValue({ status: 'error', error }));

    expect(span.recordException).toHaveBeenCalledWith(error);
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message: 'internal_error' });
    expect(span.end).toHaveBeenCalledOnce();
    expect(span.recordException).toHaveBeenCalledBefore(span.end);
  });

  it('enriches a successful result before ending the span', async () => {
    const { context, span } = createSpanContext();
    const result = { status: 'success' as const, error: undefined };
    const onResult = vi.fn();

    await otelSpan(context, 'request', {}, vi.fn().mockResolvedValue(result), onResult);

    expect(onResult).toHaveBeenCalledWith(span, result);
    expect(onResult).toHaveBeenCalledBefore(span.end);
    expect(span.end).toHaveBeenCalledOnce();
    expect(span.recordException).not.toHaveBeenCalled();
  });
});
