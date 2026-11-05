import { ROOT_CONTEXT, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, it, test } from 'vitest';

import { fastCaseInsensitiveEqual, withSpanAttributes } from '../../app/instrumentation/instrumentation-utils.server';

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
