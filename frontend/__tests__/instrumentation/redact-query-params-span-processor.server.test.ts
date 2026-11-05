import { ROOT_CONTEXT } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { QueryParamsRedactorAttributesOptions } from '../../app/instrumentation/query-params-redactor-types';
import { QueryParamsRedactor } from '../../app/instrumentation/query-params-redactor.server';
import { RedactQueryParamsSpanProcessor } from '../../app/instrumentation/redact-query-params-span-processor.server';

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
  test.each([
    ['url.full', 'https://example.test/path?token=secret&lang=en#section', 'https://example.test/path?token=%5BREDACTED%5D&lang=%5BREDACTED%5D#section'],
    ['http.url', 'https://example.test/?token=secret', 'https://example.test/?token=%5BREDACTED%5D'],
    ['http.target', '/path?token=first&token=second&empty=&flag', '/path?token=%5BREDACTED%5D&token=%5BREDACTED%5D&empty=%5BREDACTED%5D&flag=%5BREDACTED%5D'],
    ['url.query', 'token=secret&lang=en', 'token=%5BREDACTED%5D&lang=%5BREDACTED%5D'],
    ['URL.QUERY', '?token=secret', '?token=%5BREDACTED%5D'],
    ['url.full', 'not-an-absolute-url?token=secret', 'not-an-absolute-url?token=%5BREDACTED%5D'],
    ['url.full', 'https://example.test/path', 'https://example.test/path'],
    ['url.full', 'https://example.test/path?', 'https://example.test/path?'],
    ['url.full', 'https://example.test/path#section?token=fragment', 'https://example.test/path#section?token=fragment'],
    ['url.query', '', ''],
    ['other.url.full', 'https://example.test/?token=secret', 'https://example.test/?token=%5BREDACTED%5D'],
  ])('redacts %s containing %s', async (key, value, expected) => {
    const span = await exportSpan({ [key]: value });
    expect(span.attributes[key]).toBe(expected);
  });

  test('matches decoded parameter names case-insensitively and preserves repeated parameters', async () => {
    const span = await exportSpan({ 'url.full': 'https://example.test/?%74oken=first&TOKEN=second&lang=en' }, { redactRules: [{ type: 'key', match: 'exact', value: 'Token' }], replacement: 'hidden' });
    expect(span.attributes['url.full']).toBe('https://example.test/?token=hidden&TOKEN=hidden&lang=en');
  });

  test('overrides attribute keys and can disable selective redaction with empty lists', async () => {
    const attributes = {
      'custom.url': '/path?secret=value',
      'custom.query': 'secret=value',
      'url.full': '/path?secret=unchanged',
      'url.query': 'secret=unchanged',
    };
    const span = await exportSpan(attributes, {
      urlAttributeKeys: ['CUSTOM.URL'],
      queryAttributeKeys: ['custom.query'],
      replacement: 'hidden',
      scanOtherStringAttributes: false,
    });
    expect(span.attributes).toEqual({ ...attributes, 'custom.url': '/path?secret=hidden', 'custom.query': 'secret=hidden' });

    const disabled = await exportSpan(attributes, { redactRules: [] });
    expect(disabled.attributes).toEqual(attributes);
  });

  test('redacts string arrays without coercing other attribute values', async () => {
    const attributes = { 'url.full': ['/first?token=one', '/second?token=two'], 'url.query': 123, count: 10, enabled: true };
    const span = await exportSpan(attributes);
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
      spanProcessors: [new RedactQueryParamsSpanProcessor({ onStart() {}, onEnd, async forceFlush() {}, async shutdown() {} }, new QueryParamsRedactor())],
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
    const processor = new RedactQueryParamsSpanProcessor(downstream, new QueryParamsRedactor());
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
