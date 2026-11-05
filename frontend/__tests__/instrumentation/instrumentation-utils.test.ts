import { ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, it, test, vi } from 'vitest';

import { BoundedCache, createNameMatcher, fastCaseInsensitiveEqual, withSpanAttributes } from '../../app/instrumentation/instrumentation-utils';

describe('fastCaseInsensitiveEqual', () => {
  it.each([
    ['token', 'token'],
    ['Token', 'tOKEN'],
    ['URL.Full', 'url.full'],
    ['résumé', 'RESUME'],
    ['a', 'a\u0301'],
  ])('returns true for %s and %s', (a, b) => {
    expect(fastCaseInsensitiveEqual(a, b)).toBe(true);
  });

  it.each([
    ['token', 'tokens'],
    ['token', 'toke n'],
    ['url.full', 'url_full'],
    ['', 'a'],
  ])('returns false for %s and %s', (a, b) => {
    expect(fastCaseInsensitiveEqual(a, b)).toBe(false);
  });
});

describe('BoundedCache', () => {
  test('computes a value once per key', () => {
    const cache = new BoundedCache<string, string | null>(2);
    const compute = vi.fn(() => null);

    expect(cache.getOrSet('a', compute)).toBeNull();
    expect(cache.getOrSet('a', compute)).toBeNull();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('clears itself before adding an entry beyond maxSize', () => {
    const cache = new BoundedCache<string, number>(2);

    cache.getOrSet('a', () => 1);
    cache.getOrSet('b', () => 2);
    expect(cache.size).toBe(2);

    cache.getOrSet('c', () => 3);
    expect(cache.size).toBe(1);
    expect(cache.getOrSet('a', () => 10)).toBe(10);
  });

  test('stores nothing when maxSize is 0', () => {
    const cache = new BoundedCache<string, number>(0);
    const compute = vi.fn(() => 1);

    cache.getOrSet('a', compute);
    cache.getOrSet('a', compute);
    expect(cache.size).toBe(0);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  test.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects maxSize %s', (maxSize) => {
    expect(() => new BoundedCache(maxSize)).toThrow(RangeError);
  });
});

const providers: TracerProvider[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map(async (provider) => await provider.shutdown()));
});

describe('withSpanAttributes', () => {
  test('replaces attributes and preserves real SDK span metadata through an exporter', async () => {
    const exporter = new InMemorySpanExporter();
    const exportingProcessor = new SimpleSpanProcessor({ exporter });
    let original: ReadableSpan | undefined;
    const provider = new TracerProvider({
      spanLimits: { attributeCountLimit: 2, eventCountLimit: 1, linkCountLimit: 1 },
      spanProcessors: [
        {
          onStart: () => {},
          onEnd: (span) => {
            original = span;
            exportingProcessor.onEnd(withSpanAttributes(span, { replaced: true }));
          },
          forceFlush: async () => await exportingProcessor.forceFlush(),
          shutdown: async () => await exportingProcessor.shutdown(),
        },
      ],
    });
    providers.push(provider);
    const parentSpanContext = { traceId: '11111111111111111111111111111111', spanId: '2222222222222222', traceFlags: 1 };
    const span = provider.getTracer('redaction-test', '1.0').startSpan(
      'request',
      {
        kind: SpanKind.SERVER,
        attributes: { first: 'one', second: 'two', dropped: 'extra' },
        links: [{ context: parentSpanContext }, { context: parentSpanContext }],
      },
      trace.setSpanContext(ROOT_CONTEXT, parentSpanContext),
    );
    span.addEvent('first event');
    span.addEvent('latest event');
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'failed' });
    span.end();
    await provider.forceFlush();

    const [exported] = exporter.getFinishedSpans();
    assert(exported && original);
    expect(exported.attributes).toEqual({ replaced: true });
    expect(original.attributes).toEqual({ first: 'one', second: 'two' });
    expect(exported.spanContext()).toEqual(span.spanContext());
    expect(exported).toMatchObject({
      name: 'request',
      kind: SpanKind.SERVER,
      ended: true,
      status: { code: SpanStatusCode.ERROR, message: 'failed' },
      instrumentationScope: { name: 'redaction-test', version: '1.0' },
      parentSpanContext,
      startTime: original.startTime,
      endTime: original.endTime,
      duration: original.duration,
      resource: original.resource,
      droppedAttributesCount: 1,
      droppedEventsCount: 1,
      droppedLinksCount: 1,
    });
    expect(exported.events.map((event) => event.name)).toEqual(['latest event']);
    expect(exported.links).toHaveLength(1);
  });
});

describe('createNameMatcher', () => {
  test.each([
    ['token', true],
    ['TOKEN', true],
    ['tokén', true],
    ['id_token', true],
    ['ID_TOKEN', false],
    ['tokens', false],
    ['lang', false],
  ])('matches %s: %s', (name, expected) => {
    expect(createNameMatcher(['token', /_token$/])(name)).toBe(expected);
  });

  test('ignores global and sticky regex state between calls', () => {
    const pattern = /token/gy;
    const matches = createNameMatcher([pattern]);

    expect([matches('token'), matches('token'), matches('token')]).toEqual([true, true, true]);
    expect(pattern.lastIndex).toBe(0);
  });

  test('matches nothing when empty', () => {
    expect(createNameMatcher([])('token')).toBe(false);
  });

  test('passes unmatched names to predicates', () => {
    const predicate = vi.fn((name: string) => name.startsWith('x-'));
    const matches = createNameMatcher(['token', /^id_/, predicate]);

    expect([matches('token'), matches('id_token'), matches('x-trace'), matches('lang')]).toEqual([true, true, true, false]);
    expect(predicate.mock.calls).toEqual([['x-trace'], ['lang']]);
  });
});
