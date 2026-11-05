import { ROOT_CONTEXT } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { QueryParamsRedactor } from '../../app/instrumentation/query-params-redactor';
import type { QueryParamsRedactorAttributesOptions } from '../../app/instrumentation/query-params-redactor-types';
import { RedactQueryParamsSpanProcessor } from '../../app/instrumentation/redact-query-params-span-processor';

const providers: TracerProvider[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map(async (provider) => await provider.shutdown()));
});

async function exportSpan(attributes: Attributes, options?: QueryParamsRedactorAttributesOptions) {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new RedactQueryParamsSpanProcessor(new SimpleSpanProcessor({ exporter }), new QueryParamsRedactor(options))],
  });
  providers.push(provider);
  provider.getTracer('redaction-test').startSpan('request', { attributes }).end();
  await provider.forceFlush();
  const spans = exporter.getFinishedSpans();
  expect(spans).toHaveLength(1);
  const [exported] = spans;
  assert(exported);
  return exported;
}

describe('RedactQueryParamsSpanProcessor', () => {
  const tokenOptions = { parameterNames: ['token'] } satisfies QueryParamsRedactorAttributesOptions;

  test.each([
    ['url.full', 'https://example.test/path?token=secret&lang=en#section', 'https://example.test/path?token=%5BREDACTED%5D&lang=en#section'],
    ['http.url', 'https://example.test/?token=secret', 'https://example.test/?token=%5BREDACTED%5D'],
    ['http.target', '/path?token=first&token=second&lang=en', '/path?token=%5BREDACTED%5D&token=%5BREDACTED%5D&lang=en'],
    ['url.query', 'token=secret&lang=en', 'token=%5BREDACTED%5D&lang=en'],
    ['URL.QUERY', '?token=secret', '?token=%5BREDACTED%5D'],
    ['route', '/path?token=secret', '/path?token=secret'],
  ])('redacts %s containing %s', async (key, value, expected) => {
    const span = await exportSpan({ [key]: value }, tokenOptions);
    expect(span.attributes[key]).toBe(expected);
  });

  test('redacts unsafe parameters with the default options', async () => {
    const span = await exportSpan({ 'url.full': 'https://example.test/?token=secret&lang=en' });
    expect(span.attributes).toEqual({ 'url.full': 'https://example.test/?token=%5BREDACTED%5D&lang=en' });
  });

  test('redacts nothing with an empty parameter name list', async () => {
    const attributes = { 'url.full': 'https://example.test/?token=secret' };
    const span = await exportSpan(attributes, { parameterNames: [] });
    expect(span.attributes).toEqual(attributes);
  });

  test('redacts string arrays without coercing other attribute values', async () => {
    const attributes = { 'url.full': ['/first?token=one', '/second?token=two'], 'url.query': 123, count: 10, enabled: true };
    const span = await exportSpan(attributes, tokenOptions);
    expect(span.attributes).toEqual({
      ...attributes,
      'url.full': ['/first?token=%5BREDACTED%5D', '/second?token=%5BREDACTED%5D'],
    });
    expect(attributes['url.full']).toEqual(['/first?token=one', '/second?token=two']);
  });

  test('passes the original span downstream when nothing is redacted', () => {
    const onEnd = vi.fn<SpanProcessor['onEnd']>();
    const provider = new TracerProvider({ spanProcessors: [new RedactQueryParamsSpanProcessor({ onStart() {}, onEnd, async forceFlush() {}, async shutdown() {} }, new QueryParamsRedactor())] });
    providers.push(provider);
    const span = provider.getTracer('passthrough-test').startSpan('request', { attributes: { 'url.full': '/path', route: '/path' } });
    span.end();
    const [endCall] = onEnd.mock.calls;
    assert(endCall);
    expect(endCall[0]).toBe(span);
  });

  test('keeps getter-backed span fields on redacted spans', () => {
    const onEnd = vi.fn<SpanProcessor['onEnd']>();
    const provider = new TracerProvider({
      spanLimits: { attributeCountLimit: 1, eventCountLimit: 1, linkCountLimit: 1 },
      spanProcessors: [new RedactQueryParamsSpanProcessor({ onStart() {}, onEnd, async forceFlush() {}, async shutdown() {} }, new QueryParamsRedactor(tokenOptions))],
    });
    providers.push(provider);
    const linkContext = { traceId: '11111111111111111111111111111111', spanId: '2222222222222222', traceFlags: 1 };
    const span = provider.getTracer('getter-test').startSpan('request', { attributes: { 'url.full': '/path?token=secret', extra: 'dropped' }, links: [{ context: linkContext }, { context: linkContext }] });
    span.addEvent('first');
    span.addEvent('second');
    span.end();
    const [endCall] = onEnd.mock.calls;
    assert(endCall);
    const [exported] = endCall;
    expect(exported).not.toBe(span);
    expect(exported.attributes).toEqual({ 'url.full': '/path?token=%5BREDACTED%5D' });
    expect(exported.spanContext()).toEqual(span.spanContext());
    expect(exported).toMatchObject({ ended: true, droppedAttributesCount: 1, droppedEventsCount: 1, droppedLinksCount: 1 });
    expect(exported.duration).toHaveLength(2);
  });

  test('forwards start, ending, end, flush and shutdown and preserves the original span', async () => {
    const downstream = {
      onStart: vi.fn<SpanProcessor['onStart']>(),
      onEnding: vi.fn<NonNullable<SpanProcessor['onEnding']>>(),
      onEnd: vi.fn<SpanProcessor['onEnd']>(),
      forceFlush: vi.fn<SpanProcessor['forceFlush']>().mockResolvedValue(),
      shutdown: vi.fn<SpanProcessor['shutdown']>().mockResolvedValue(),
    };
    const processor = new RedactQueryParamsSpanProcessor(downstream, new QueryParamsRedactor(tokenOptions));
    const provider = new TracerProvider({ spanProcessors: [processor] });
    providers.push(provider);
    const attributes = { 'url.full': '/path?token=secret' };
    const span = provider.getTracer('lifecycle-test').startSpan('request', { attributes }, ROOT_CONTEXT);
    span.end();
    const [startCall] = downstream.onStart.mock.calls;
    const [endCall] = downstream.onEnd.mock.calls;
    assert(startCall && endCall);
    expect(downstream.onStart).toHaveBeenCalledExactlyOnceWith(span, ROOT_CONTEXT);
    expect(downstream.onEnding).toHaveBeenCalledExactlyOnceWith(span);
    expect(downstream.onEnd).toHaveBeenCalledOnce();
    expect(startCall[0].attributes).toEqual(attributes);
    expect(endCall[0].attributes).toEqual({ 'url.full': '/path?token=%5BREDACTED%5D' });
    await processor.forceFlush();
    expect(downstream.forceFlush).toHaveBeenCalledOnce();
    await processor.shutdown();
    expect(downstream.shutdown).toHaveBeenCalledOnce();
    providers.splice(providers.indexOf(provider), 1);
  });

  test('propagates downstream errors and tolerates a missing optional ending hook', async () => {
    const error = new Error('export failed');
    const downstream = {
      onStart: vi.fn<SpanProcessor['onStart']>(),
      onEnd: vi.fn<SpanProcessor['onEnd']>().mockImplementation(() => {
        throw error;
      }),
      forceFlush: vi.fn<SpanProcessor['forceFlush']>().mockRejectedValue(error),
      shutdown: vi.fn<SpanProcessor['shutdown']>().mockRejectedValue(error),
    };
    const processor = new RedactQueryParamsSpanProcessor(downstream, new QueryParamsRedactor());
    const provider = new TracerProvider({
      spanProcessors: [{ ...downstream, onEnd() {}, async forceFlush() {}, async shutdown() {} }],
    });
    providers.push(provider);
    const span = provider.getTracer('lifecycle-test').startSpan('request');
    const [startCall] = downstream.onStart.mock.calls;
    assert(startCall);
    const [readableSpan] = startCall;
    expect(() => processor.onEnding(readableSpan)).not.toThrow();
    expect(() => processor.onEnd(readableSpan)).toThrow(error);
    await expect(processor.forceFlush()).rejects.toThrow(error);
    await expect(processor.shutdown()).rejects.toThrow(error);
    span.end();
  });
});
