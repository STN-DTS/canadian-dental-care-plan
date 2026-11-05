import { ROOT_CONTEXT } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { AttributeRedactorAttributesOptions } from '../../app/instrumentation/attribute-redactor-types';
import { AttributeRedactor } from '../../app/instrumentation/attribute-redactor.server';
import { RedactAttributesSpanProcessor } from '../../app/instrumentation/redact-attributes-span-processor.server';

const providers: TracerProvider[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map(async (provider) => await provider.shutdown()));
});

async function exportSpan(attributes: Attributes, options?: AttributeRedactorAttributesOptions) {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new RedactAttributesSpanProcessor(new SimpleSpanProcessor({ exporter }), new AttributeRedactor(options))],
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

describe('RedactAttributesSpanProcessor', () => {
  test('redacts default exact keys and case-insensitive sensitive substrings regardless of value type', async () => {
    const span = await exportSpan({
      'DB.STATEMENT': 'select sensitive',
      'http.request.body': 'sensitive body',
      'user.email': 'person@example.test',
      'user.PASSWORD': 123,
      'http.request.header.Authorization': 'Basic secret',
      'session.cookie': ['session=secret'],
      credit_card: true,
      enabled: true,
      count: 42,
      scores: [1, 2],
      flags: [true, false],
      route: '/home',
    });
    expect(span.attributes).toEqual({
      'DB.STATEMENT': '[REDACTED]',
      'http.request.body': '[REDACTED]',
      'user.email': '[REDACTED]',
      'user.PASSWORD': '[REDACTED]',
      'http.request.header.Authorization': '[REDACTED]',
      'session.cookie': '[REDACTED]',
      credit_card: '[REDACTED]',
      enabled: true,
      count: 42,
      scores: [1, 2],
      flags: [true, false],
      route: '/home',
    });
  });

  test('applies default value patterns to strings and string arrays', async () => {
    const span = await exportSpan({
      message: 'person@example.test 4111-1111-1111-1111 Bearer abc.def.ghi AKIA1234567890ABCDEF',
      contacts: ['one@example.test', 'two@example.test'],
    });
    expect(span.attributes).toEqual({
      message: '[EMAIL] [CARD] [BEARER_TOKEN] [AWS_KEY]',
      contacts: ['[EMAIL]', '[EMAIL]'],
    });
  });

  test('replaces defaults per option and allows empty lists', async () => {
    const span = await exportSpan(
      { custom: 1, 'internal.private': true, 'payment.credit_card': 'span-card-canary', password: 'kept', message: 'code=123 person@example.test' },
      {
        redactRules: [
          { type: 'key', match: 'exact', value: 'CUSTOM' },
          { type: 'key', match: 'substring', value: 'PRIVATE' },
          { type: 'key', match: 'pattern', value: /.*credit_card.*/g, replacement: '[CARD]' },
          { type: 'value', pattern: /code=\d+/g, replacement: 'code=hidden' },
        ],
        replacement: 'hidden',
      },
    );
    expect(span.attributes).toEqual({ custom: 'hidden', 'internal.private': 'hidden', 'payment.credit_card': '[CARD]', password: 'kept', message: 'code=hidden person@example.test' });

    const attributes = { password: 'kept', message: 'person@example.test' };
    const disabled = await exportSpan(attributes, { redactRules: [] });
    expect(disabled.attributes).toEqual(attributes);
  });

  test('does not share stateful regular expressions with the caller or between values', async () => {
    const pattern = /secret/y;
    pattern.lastIndex = 3;
    const span = await exportSpan({ first: 'secret', second: 'secret', values: ['secret', 'secret'] }, { redactRules: [{ type: 'value', pattern, replacement: 'hidden' }] });
    expect(span.attributes).toEqual({ first: 'hidden', second: 'hidden', values: ['hidden', 'hidden'] });
    expect(pattern.lastIndex).toBe(3);
  });

  test('passes the original span downstream when nothing is redacted', () => {
    const onEnd = vi.fn<SpanProcessor['onEnd']>();
    const provider = new TracerProvider({ spanProcessors: [new RedactAttributesSpanProcessor({ onStart() {}, onEnd, async forceFlush() {}, async shutdown() {} }, new AttributeRedactor())] });
    providers.push(provider);
    const span = provider.getTracer('passthrough-test').startSpan('request', { attributes: { route: '/path', values: ['one', 'two'] } });
    span.end();
    const [endCall] = onEnd.mock.calls;
    assert(endCall);
    expect(endCall[0]).toBe(span);
  });

  test('keeps getter-backed span fields on redacted spans', () => {
    const onEnd = vi.fn<SpanProcessor['onEnd']>();
    const provider = new TracerProvider({
      spanLimits: { attributeCountLimit: 1, eventCountLimit: 1, linkCountLimit: 1 },
      spanProcessors: [new RedactAttributesSpanProcessor({ onStart() {}, onEnd, async forceFlush() {}, async shutdown() {} }, new AttributeRedactor())],
    });
    providers.push(provider);
    const linkContext = { traceId: '11111111111111111111111111111111', spanId: '2222222222222222', traceFlags: 1 };
    const span = provider.getTracer('getter-test').startSpan('request', { attributes: { password: 'secret', extra: 'dropped' }, links: [{ context: linkContext }, { context: linkContext }] });
    span.addEvent('first');
    span.addEvent('second');
    span.end();
    const [endCall] = onEnd.mock.calls;
    assert(endCall);
    const [exported] = endCall;
    expect(exported).not.toBe(span);
    expect(exported.attributes).toEqual({ password: '[REDACTED]' });
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
    const processor = new RedactAttributesSpanProcessor(downstream, new AttributeRedactor());
    const provider = new TracerProvider({ spanProcessors: [processor] });
    providers.push(provider);
    const attributes = { password: 'secret' };
    const span = provider.getTracer('lifecycle-test').startSpan('request', { attributes }, ROOT_CONTEXT);
    span.end();
    const [startCall] = downstream.onStart.mock.calls;
    const [endCall] = downstream.onEnd.mock.calls;
    assert(startCall && endCall);
    expect(downstream.onStart).toHaveBeenCalledExactlyOnceWith(span, ROOT_CONTEXT);
    expect(downstream.onEnding).toHaveBeenCalledExactlyOnceWith(span);
    expect(downstream.onEnd).toHaveBeenCalledOnce();
    expect(startCall[0].attributes).toEqual(attributes);
    expect(endCall[0].attributes).toEqual({ password: '[REDACTED]' });
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
    const processor = new RedactAttributesSpanProcessor(downstream, new AttributeRedactor());
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
