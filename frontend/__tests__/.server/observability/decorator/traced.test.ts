import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Traced } from '~/.server/observability/decorator';

class TestService {
  @Traced()
  syncMethod() {
    return 'sync result';
  }

  @Traced()
  async asyncMethod() {
    return await Promise.resolve('async result');
  }

  @Traced('custom-span-name')
  namedSpan() {
    return 'named';
  }

  @Traced({ name: 'explicit-name', op: 'custom-op' })
  explicitNamedSpan() {
    return 'explicit';
  }

  @Traced({ op: 'database' })
  opOnlySpan() {
    return 'op only';
  }

  @Traced({ kind: SpanKind.PRODUCER })
  producerSpan() {
    return 'producer';
  }

  @Traced()
  nestedOuter() {
    return this.nestedInner();
  }

  @Traced()
  nestedInner() {
    return 'inner';
  }

  @Traced()
  syncError(): never {
    throw new Error('sync error');
  }

  @Traced()
  async asyncError(): Promise<never> {
    await Promise.resolve();
    throw new Error('async error');
  }

  @Traced()
  async getPromise() {
    return await Promise.resolve('promise result');
  }

  @Traced()
  async getErrorPromise() {
    return await Promise.reject(new Error('promise error'));
  }

  @Traced()
  *getIterable() {
    yield 1;
    yield 2;
    yield 3;
  }

  @Traced()
  *getErrorIterable(): Generator<number> {
    yield 1;
    throw new Error('iterable error');
  }

  @Traced()
  async *getAsyncIterable() {
    yield await Promise.resolve(1);
    yield await Promise.resolve(2);
    yield await Promise.resolve(3);
  }

  @Traced()
  async *getErrorAsyncIterable(): AsyncGenerator<number> {
    yield await Promise.resolve(1);
    throw new Error('async iterable error');
  }
}

describe('Traced', () => {
  let service: TestService;
  let traceExporter: InMemorySpanExporter;
  let spanProcessor: SimpleSpanProcessor;
  let provider: TracerProvider;

  beforeAll(() => {
    service = new TestService();
    traceExporter = new InMemorySpanExporter();
    spanProcessor = new SimpleSpanProcessor({ exporter: traceExporter });

    provider = new TracerProvider({
      spanProcessors: [spanProcessor],
    });

    if (!trace.setGlobalTracerProvider(provider)) {
      throw new Error('Failed to register the test tracer provider.');
    }
  });

  afterEach(async () => {
    await spanProcessor.forceFlush();
    traceExporter.reset();
  });

  afterAll(async () => {
    trace.disable();
    await provider.shutdown();
  });

  it('preserves the original method name', () => {
    expect(service.syncMethod.name).toEqual('syncMethod');
  });

  describe('sync methods', () => {
    it('creates a span with auto-generated name', () => {
      service.syncMethod();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('TestService.syncMethod');
    });

    it('returns the method result', () => {
      expect(service.syncMethod()).toEqual('sync result');
    });

    it('propagates errors', () => {
      expect(() => service.syncError()).toThrow('sync error');
    });

    it('records exception and sets error status on sync errors', () => {
      expect(() => service.syncError()).toThrow('sync error');

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status).toEqual({
        code: SpanStatusCode.ERROR,
        message: 'sync error',
      });
      expect(spans[0]?.events).toHaveLength(1);
      expect(spans[0]?.events[0]?.name).toEqual('exception');
    });
  });

  describe('async methods', () => {
    it('creates a span with auto-generated name', async () => {
      await service.asyncMethod();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('TestService.asyncMethod');
    });

    it('returns the method result', async () => {
      expect(await service.asyncMethod()).toEqual('async result');
    });

    it('propagates errors', async () => {
      await expect(service.asyncError()).rejects.toThrow('async error');
    });

    it('records exception and sets error status on async errors', async () => {
      await expect(service.asyncError()).rejects.toThrow('async error');

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status).toEqual({
        code: SpanStatusCode.ERROR,
        message: 'async error',
      });
      expect(spans[0]?.events).toHaveLength(1);
      expect(spans[0]?.events[0]?.name).toEqual('exception');
    });
  });

  describe('span naming', () => {
    it('uses string argument as span name', () => {
      service.namedSpan();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('custom-span-name');
    });

    it('uses name from options object', () => {
      service.explicitNamedSpan();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('explicit-name');
    });

    it('auto-generates name when only op is provided', () => {
      service.opOnlySpan();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('TestService.opOnlySpan');
    });
  });

  describe('span options', () => {
    it('sets op as span attribute', () => {
      service.explicitNamedSpan();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes['code.op']).toEqual('custom-op');
    });

    it('sets span kind', () => {
      service.producerSpan();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.kind).toEqual(SpanKind.PRODUCER);
    });

    it('sets code.function and code.namespace attributes', () => {
      service.syncMethod();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes['code.function']).toEqual('syncMethod');
      expect(spans[0]?.attributes['code.namespace']).toEqual('TestService');
    });
  });

  describe('nested spans', () => {
    it('creates parent and child spans', () => {
      service.nestedOuter();

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(2);
      expect(spans.map((s) => s.name)).toEqual(['TestService.nestedInner', 'TestService.nestedOuter']);
    });
  });

  describe('promise-returning methods (not async)', () => {
    it('creates span and ends on resolution', async () => {
      const result = await service.getPromise();

      expect(result).toEqual('promise result');
      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('TestService.getPromise');
    });

    it('records exception on rejection', async () => {
      await expect(service.getErrorPromise()).rejects.toThrow('promise error');

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status).toEqual({
        code: SpanStatusCode.ERROR,
        message: 'promise error',
      });
      expect(spans[0]?.events).toHaveLength(1);
      expect(spans[0]?.events[0]?.name).toEqual('exception');
    });
  });

  describe('generator methods (iterables)', () => {
    it('creates span and ends after iteration completes', () => {
      const values = [...service.getIterable()];

      expect(values).toEqual([1, 2, 3]);
      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('TestService.getIterable');
    });

    it('records exception when iteration throws', () => {
      const iter = service.getErrorIterable();
      expect(iter.next().value).toEqual(1);
      expect(() => iter.next()).toThrow('iterable error');

      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status).toEqual({
        code: SpanStatusCode.ERROR,
        message: 'iterable error',
      });
    });
  });

  describe('async generator methods (async iterables)', () => {
    it('creates span and ends after async iteration completes', async () => {
      const values: number[] = [];

      for await (const v of service.getAsyncIterable()) {
        values.push(v);
      }

      expect(values).toEqual([1, 2, 3]);
      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toEqual('TestService.getAsyncIterable');
    });

    it('records exception when async iteration throws', async () => {
      const values: number[] = [];

      try {
        for await (const v of service.getErrorAsyncIterable()) {
          values.push(v);
        }
      } catch {
        // expected
      }

      expect(values).toEqual([1]);
      const spans = traceExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status).toEqual({
        code: SpanStatusCode.ERROR,
        message: 'async iterable error',
      });
    });
  });
});
