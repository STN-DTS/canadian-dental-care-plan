import { RouterContextProvider, UNSAFE_decodeViaTurboStream, createRequestHandler, data, redirect } from 'react-router';
import type { LoaderFunction, MiddlewareFunction, RouteObject, ServerBuild } from 'react-router';

import { SpanStatusCode, context as otelContext, propagation, trace } from '@opentelemetry/api';
import type { Counter } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { ATTR_ERROR_TYPE, ATTR_HTTP_REQUEST_METHOD, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CORRELATION_ID } from '~/.server/logging/log-attributes';
import type { InstrumentationService } from '~/.server/observability/instrumentation-service';
import { createOtelInstrumentation } from '~/.server/observability/otel-instrumentation';
import { withAppErrorResponses } from '~/.server/utils/app-error-boundary';
import { deleteSingleton, setSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { handleError } from '~/entry.server';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

type Phase = 'loader' | 'action' | 'middleware' | 'middleware-after';

type Scenario = {
  /** Where the route handlers throw `error`; omit for a successful request. */
  phase?: Phase;
  error?: unknown;
  mode?: 'production' | 'development';
  basename?: string;
};

const routes: RouteObject[] = [
  {
    id: 'root',
    path: '/',
    children: [
      { id: 'routes/document', path: 'document' },
      { id: 'routes/resource', path: 'resource' },
    ],
  },
];

const publicError = {
  status: 503,
  statusText: '',
  internal: false,
  data: { name: 'AppError', errorCode: ErrorCodes.TEST_ERROR_CODE, correlationId: 'AB-123456' },
};

function createAppError(): AppError {
  const error = new AppError('synthetic-private-message', ErrorCodes.TEST_ERROR_CODE, {
    correlationId: 'AB-123456',
    httpStatusCode: HttpStatusCodes.SERVICE_UNAVAILABLE,
    cause: new Error('synthetic-private-cause'),
  });
  return Object.assign(error, { privateDetail: 'synthetic-private-custom-property' });
}

function createBuild({ phase, error, basename }: Scenario = {}): ServerBuild {
  const throwIn = (current: Phase) => {
    if (phase === current) {
      throw error;
    }
  };

  const loader: LoaderFunction = () => {
    throwIn('loader');
    return { value: 'loaded' };
  };

  loader.hydrate = true;

  const action = () => {
    throwIn('action');
    return { value: 'saved' };
  };

  const fixtureMiddleware: MiddlewareFunction<Response> = async function fixtureMiddleware(_args, next) {
    throwIn('middleware');
    const response = await next();
    throwIn('middleware-after');
    return response;
  };

  return {
    entry: {
      module: {
        // Renders the boundary errors React Router would pass to the document.
        async default(_request, status, headers, entry) {
          const handoff = await new Response(entry.serverHandoffStream).text();
          return new Response(JSON.stringify({ errors: entry.staticHandlerContext.errors, handoff }), { status, headers });
        },
        handleError,
        instrumentations: [createOtelInstrumentation()],
      },
    },
    routes: {
      root: { id: 'root', path: '/', module: { default: () => null, middleware: [fixtureMiddleware] } },
      'routes/document': { id: 'routes/document', parentId: 'root', path: 'document', module: { default: () => null, ErrorBoundary: () => null, loader, action } },
      // @ts-expect-error Resource routes have no default export, despite the ServerBuild module type.
      'routes/resource': { id: 'routes/resource', parentId: 'root', path: 'resource', module: { loader, action } },
    },
    assets: { entry: { imports: [], module: '' }, routes: {}, url: '', version: '' },
    basename,
    publicPath: '/',
    assetsBuildDirectory: 'build/client',
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: 'initial', manifestPath: '/__manifest' },
  };
}

/** Serves `scenario` through React Router's real request handler. */
function createServer(scenario: Scenario = {}) {
  const logger = mock<Logger>();
  vi.mocked(createLogger).mockReturnValue(logger);
  const counter = mock<Counter>();
  const instrumentationService = mock<InstrumentationService>();
  instrumentationService.createCounter.mockReturnValue(counter);
  instrumentationService.startActiveSpan.mockImplementation((name, options, callback, scope) => trace.getTracer(scope ?? 'test').startActiveSpan(name, options, callback));
  const appContainer = mock<AppContainerProvider>();
  appContainer.get.calledWith(TYPES.InstrumentationService).mockReturnValue(instrumentationService);
  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session: mock<Session>() });

  const build = createBuild(scenario);
  setSingleton('serverBuild', build);
  setSingleton('agnosticRoutes', routes);
  const handler = createRequestHandler(withAppErrorResponses(build, routes), scenario.mode ?? 'production');

  async function fetch(path: string, method: 'GET' | 'POST' = 'GET'): Promise<Response> {
    const init: RequestInit = method === 'POST' ? { method, headers: { origin: 'http://localhost', 'content-type': 'application/x-www-form-urlencoded' }, body: 'value=synthetic' } : { method };
    return await handler(new Request(`http://localhost${path}`, init), context);
  }

  return { fetch, logger, counter };
}

async function decodeData(response: Response): Promise<unknown> {
  if (!response.body) {
    throw new Error('Expected a React Router data stream');
  }

  const decoded = await UNSAFE_decodeViaTurboStream(response.body, globalThis);
  await decoded.done;
  return decoded.value;
}

describe('withAppErrorResponses', () => {
  const exporter = new InMemorySpanExporter();
  const processor = new SimpleSpanProcessor({ exporter });
  const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [processor], logRecordProcessors: [], metricReaders: [] });

  beforeAll(() => sdk.start());

  afterEach(async () => {
    await processor.forceFlush();
    exporter.reset();
    deleteSingleton('serverBuild');
    deleteSingleton('agnosticRoutes');
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await sdk.shutdown();
    trace.disable();
    otelContext.disable();
    propagation.disable();
  });

  async function expectErrorReported(server: ReturnType<typeof createServer>, error: Error, request: { method: string; path: string; spanName: string }) {
    expect(server.logger.error).toHaveBeenCalledExactlyOnceWith(error, {
      [ATTR_ERROR_TYPE]: 'AppError',
      [ATTR_HTTP_REQUEST_METHOD]: request.method,
      [ATTR_URL_PATH]: request.path,
      correlationId: 'AB-123456',
      errorCode: ErrorCodes.TEST_ERROR_CODE,
      'org.event.category': 'application',
    });
    expect(server.counter.add).toHaveBeenCalledExactlyOnceWith(1);

    await processor.forceFlush();
    const span = exporter.getFinishedSpans().find(({ name }) => name === request.spanName);
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.attributes[ATTR_ERROR_TYPE]).toBe('AppError');
    expect(span?.attributes[ATTR_CDCP_CORRELATION_ID]).toBe('AB-123456');
    expect(span?.events).toEqual([
      expect.objectContaining({
        name: 'exception',
        attributes: expect.objectContaining({
          'exception.type': 'AppError',
          'exception.message': 'synthetic-private-message',
          'exception.stacktrace': error.stack,
        }),
      }),
    ]);
  }

  describe.each(['production', 'development'] as const)('in %s', (mode) => {
    describe.each([
      { phase: 'loader', method: 'GET', boundary: 'routes/document', spanName: 'loader /document' },
      { phase: 'action', method: 'POST', boundary: 'routes/document', spanName: 'action /document' },
      { phase: 'middleware', method: 'GET', boundary: 'root', spanName: 'middleware fixtureMiddleware' },
      { phase: 'middleware-after', method: 'GET', boundary: 'root', spanName: 'middleware fixtureMiddleware' },
    ] as const)('when an AppError is thrown in a $phase', ({ phase, method, boundary, spanName }) => {
      it('renders the public error in the document and reports the original error', async () => {
        const error = createAppError();
        const server = createServer({ phase, error, mode });

        const response = await server.fetch('/document', method);
        const body = await response.text();

        expect(response.status).toBe(503);
        expect(JSON.parse(body).errors).toEqual({ [boundary]: publicError });
        expect(body).not.toContain('synthetic-private');
        expect(body).not.toContain(error.stack);
        await expectErrorReported(server, error, { method, path: '/document', spanName });
      });

      it('returns the public error as data and reports the original error', async () => {
        const error = createAppError();
        const server = createServer({ phase, error, mode });

        const response = await server.fetch('/document.data', method);
        const result = await decodeData(response);

        // Middleware that throws after next() still returns the data its route loaded.
        const loaded = phase === 'middleware-after' ? { 'routes/document': { data: { value: 'loaded' } } } : {};
        expect(response.status).toBe(503);
        expect(result).toEqual(method === 'POST' ? { error: publicError } : { [boundary]: { error: publicError }, ...loaded });
        expect(JSON.stringify(result)).not.toContain('synthetic-private');
        await expectErrorReported(server, error, { method, path: '/document.data', spanName });
      });
    });
  });

  it.each(['loader', 'action', 'middleware', 'middleware-after'] as const)('rethrows the original %s error for direct resource requests', async (phase) => {
    const error = createAppError();
    const server = createServer({ phase, error });

    const response = await server.fetch('/resource', phase === 'action' ? 'POST' : 'GET');

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('Unexpected Server Error');
    expect(server.logger.error).toHaveBeenCalledExactlyOnceWith(error, expect.objectContaining({ correlationId: 'AB-123456' }));
  });

  it('adapts data requests to resource routes', async () => {
    const server = createServer({ phase: 'loader', error: createAppError() });

    const response = await server.fetch('/resource.data');

    expect(response.status).toBe(503);
    expect(await decodeData(response)).toEqual({ 'routes/resource': { error: publicError } });
  });

  it('matches resource routes under the build basename', async () => {
    const server = createServer({ phase: 'loader', error: createAppError(), basename: '/base' });

    const resource = await server.fetch('/base/resource');
    const document = await server.fetch('/base/document');

    expect(resource.status).toBe(500);
    expect(await resource.text()).toBe('Unexpected Server Error');
    expect(document.status).toBe(503);
    expect(await document.text()).toContain('AB-123456');
  });

  it('passes thrown redirects through', async () => {
    const server = createServer({ phase: 'loader', error: redirect('/recovery', 302) });

    const response = await server.fetch('/document');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/recovery');
    expect(server.logger.error).not.toHaveBeenCalled();
  });

  it('passes thrown route data through', async () => {
    const server = createServer({ phase: 'loader', error: data({ reason: 'expected' }, { status: 400 }) });

    const response = await server.fetch('/document.data');

    expect(response.status).toBe(400);
    expect(await decodeData(response)).toEqual({ 'routes/document': { error: expect.objectContaining({ status: 400, data: { reason: 'expected' } }) } });
    expect(server.logger.error).not.toHaveBeenCalled();
  });

  it('passes successful loader data through', async () => {
    const server = createServer();

    const response = await server.fetch('/document.data');

    expect(await decodeData(response)).toEqual({ 'routes/document': { data: { value: 'loaded' } } });
    expect(server.logger.error).not.toHaveBeenCalled();
  });

  it('recognizes an AppError declared in another bundle', async () => {
    class IndependentlyBundledAppError extends Error {
      override name = 'AppError' as const;
      correlationId = 'AB-123456';
      errorCode = ErrorCodes.TEST_ERROR_CODE;
      httpStatusCode = HttpStatusCodes.SERVICE_UNAVAILABLE;
    }
    const error = new IndependentlyBundledAppError('synthetic-private-message');
    const server = createServer({ phase: 'loader', error });

    const response = await server.fetch('/document.data');

    expect(response.status).toBe(503);
    expect(await decodeData(response)).toEqual({ 'routes/document': { error: publicError } });
    await expectErrorReported(server, error, { method: 'GET', path: '/document.data', spanName: 'loader /document' });
  });

  it.each([
    { description: 'ordinary errors', error: new Error('synthetic-private-message') },
    { description: 'other thrown objects', error: { custom: 'unrelated' } },
    { description: 'malformed AppErrors', error: Object.assign(new Error('malformed'), { name: 'AppError' }) },
    { description: 'AppErrors with a non-error status', error: new AppError('invalid status', ErrorCodes.TEST_ERROR_CODE, { httpStatusCode: HttpStatusCodes.NO_CONTENT }) },
    ...[399, 600, 500.5, NaN].map((httpStatusCode) => ({
      description: `AppErrors with HTTP status ${httpStatusCode}`,
      error: Object.assign(new AppError('invalid status', ErrorCodes.TEST_ERROR_CODE), { httpStatusCode }),
    })),
  ])('passes $description through unchanged', async ({ error }) => {
    const server = createServer({ phase: 'loader', error });

    const response = await server.fetch('/document.data');

    expect(response.status).toBe(500);
    expect(server.logger.error).toHaveBeenCalledExactlyOnceWith(error, expect.any(Object));
  });

  it('caches the adapted build per build without modifying the original', () => {
    const build = createBuild();
    const originalRoute = build.routes['routes/document'];
    const originalLoader = originalRoute?.module.loader;
    const originalMiddleware = build.routes.root?.module.middleware?.[0];

    const adapted = withAppErrorResponses(build, routes);

    expect(withAppErrorResponses(build, routes)).toBe(adapted);
    expect(withAppErrorResponses(createBuild(), routes)).not.toBe(adapted);
    expect(build.routes['routes/document']).toBe(originalRoute);
    expect(originalRoute?.module.loader).toBe(originalLoader);
    expect(build.routes.root?.module.middleware?.[0]).toBe(originalMiddleware);
    expect(originalMiddleware?.name).toBe('fixtureMiddleware');
    expect(adapted.routes['routes/document']?.module.loader).not.toBe(originalLoader);
  });

  it('keeps the loader hydrate flag', () => {
    const adapted = withAppErrorResponses(createBuild(), routes);

    expect(adapted.routes['routes/document']?.module.loader?.hydrate).toBe(true);
  });
});
