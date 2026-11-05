import type { AnyValue, Attributes } from '@opentelemetry/api';
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, test } from 'vitest';

import { QueryParamsRedactor } from '../../app/instrumentation/query-params-redactor';
import type { QueryParamsRedactorAttributesOptions } from '../../app/instrumentation/query-params-redactor-types';
import { RedactQueryParamsLogRecordProcessor } from '../../app/instrumentation/redact-query-params-log-record-processor';

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
  const tokenOptions = { parameterNames: ['token', 'code'] } satisfies QueryParamsRedactorAttributesOptions;

  test('redacts configured URL and query attributes', async () => {
    const record = await exportLogRecord(
      {
        body: 'request completed',
        attributes: { 'url.full': 'https://example.test/apply?token=secret&lang=en', 'url.query': 'code=secret', route: '/apply?token=1' },
      },
      tokenOptions,
    );

    expect(record.attributes).toEqual({
      'url.full': 'https://example.test/apply?token=%5BREDACTED%5D&lang=en',
      'url.query': 'code=%5BREDACTED%5D',
      route: '/apply?token=1',
    });
  });

  test('redacts configured keys in a map body', async () => {
    const record = await exportLogRecord({ body: { 'http.url': 'https://example.test/?token=secret', referer: '/login?token=secret', count: 1 } }, tokenOptions);

    expect(record.body).toEqual({ 'http.url': 'https://example.test/?token=%5BREDACTED%5D', referer: '/login?token=secret', count: 1 });
  });

  test('leaves string bodies unchanged', async () => {
    const record = await exportLogRecord({ body: 'request: [/en/apply?token=secret]' }, tokenOptions);

    expect(record.body).toBe('request: [/en/apply?token=secret]');
  });

  test('applies option overrides', async () => {
    const record = await exportLogRecord({ attributes: { 'custom.url': '/cb?code=abc&lang=en' } }, { attributeKeys: [/^custom\./], parameterNames: [/^(code|state)$/], replacement: '***' });

    expect(record.attributes).toEqual({ 'custom.url': '/cb?code=***&lang=en' });
  });
});
