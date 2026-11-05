import type { AnyValue, Attributes } from '@opentelemetry/api';
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, test } from 'vitest';

import type { QueryParamsRedactorAttributesOptions } from '../../app/instrumentation/query-params-redactor-types';
import { QueryParamsRedactor } from '../../app/instrumentation/query-params-redactor.server';
import { RedactQueryParamsLogRecordProcessor } from '../../app/instrumentation/redact-query-params-log-record-processor.server';

const providers: LoggerProvider[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map(async (provider) => await provider.shutdown()));
});

async function exportLogRecord(record: { body?: AnyValue; attributes?: Attributes }, options?: QueryParamsRedactorAttributesOptions) {
  const exporter = new InMemoryLogRecordExporter();
  const provider = new LoggerProvider({
    processors: [new RedactQueryParamsLogRecordProcessor(new QueryParamsRedactor(options)), new SimpleLogRecordProcessor({ exporter })],
  });
  providers.push(provider);
  provider.getLogger('redaction-test').emit(record);
  await provider.forceFlush();
  const records = exporter.getFinishedLogRecords();
  expect(records).toHaveLength(1);
  const [exported] = records;
  assert(exported);
  return exported;
}

describe('RedactQueryParamsLogRecordProcessor', () => {
  test('redacts query parameters of URLs embedded in a string body', async () => {
    const record = await exportLogRecord({ body: 'Redirecting protected apply. request: [/en/apply?token=log-query-secret], redirectUrl: [/en/apply/start]' });

    expect(record.body).toBe('Redirecting protected apply. request: [/en/apply?token=%5BREDACTED%5D], redirectUrl: [/en/apply/start]');
  });

  test('redacts URL and query attributes', async () => {
    const record = await exportLogRecord({
      body: 'request completed',
      attributes: { 'url.full': 'https://example.test/apply?token=secret', 'url.query': 'code=secret', route: '/apply?x=1' },
    });

    expect(record.attributes).toEqual({
      'url.full': 'https://example.test/apply?token=%5BREDACTED%5D',
      'url.query': 'code=%5BREDACTED%5D',
      route: '/apply?x=%5BREDACTED%5D',
    });
  });

  test('redacts URL keys in a map body', async () => {
    const record = await exportLogRecord({
      body: {
        'http.url': 'https://example.test/?q=secret',
        referer: 'Referer: /login?state=secret',
        count: 1,
      },
    });

    expect(record.body).toEqual({
      'http.url': 'https://example.test/?q=%5BREDACTED%5D',
      referer: 'Referer: /login?state=%5BREDACTED%5D',
      count: 1,
    });
  });

  test('leaves records without query parameters unchanged', async () => {
    const record = await exportLogRecord({ body: 'Locale [en] detected in URL; pathname: [/en/apply]', attributes: { 'url.full': 'https://example.test/apply' } });

    expect(record.body).toBe('Locale [en] detected in URL; pathname: [/en/apply]');
    expect(record.attributes).toEqual({ 'url.full': 'https://example.test/apply' });
  });

  test('applies option overrides', async () => {
    const record = await exportLogRecord({ body: 'callback /cb?code=abc&lang=en' }, { redactRules: [{ type: 'key', match: 'pattern', value: /^(code|state)$/ }], replacement: '***' });

    expect(record.body).toBe('callback /cb?code=***&lang=en');
  });
});
