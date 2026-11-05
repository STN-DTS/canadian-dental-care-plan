import type { AnyValue, Attributes } from '@opentelemetry/api';
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import assert from 'node:assert/strict';
import { afterEach, describe, expect, test } from 'vitest';

import { AttributeRedactor } from '../../app/instrumentation/attribute-redactor';
import type { AttributeRedactorAttributesOptions } from '../../app/instrumentation/attribute-redactor-types';
import { RedactAttributesLogRecordProcessor } from '../../app/instrumentation/redact-attributes-log-record-processor';

const providers: LoggerProvider[] = [];

afterEach(async () => {
  await Promise.all(providers.splice(0).map(async (provider) => await provider.shutdown()));
});

async function exportLogRecord(record: { body?: AnyValue; attributes?: Attributes }, options?: AttributeRedactorAttributesOptions) {
  const exporter = new InMemoryLogRecordExporter();
  const provider = new LoggerProvider({
    processors: [new RedactAttributesLogRecordProcessor(new AttributeRedactor(options)), new SimpleLogRecordProcessor({ exporter })],
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

describe('RedactAttributesLogRecordProcessor', () => {
  test('redacts listed attributes before later processors export the record', async () => {
    const record = await exportLogRecord({
      body: 'login',
      attributes: {
        'user.password': 'log-attribute-secret',
        'user.email': 'person@example.test',
        'http.request.header.authorization': 'Bearer abc.def',
        message: 'contact person@example.test',
        status: 200,
      },
    });

    expect(record.attributes).toEqual({
      'user.password': '[REDACTED]',
      'user.email': '[REDACTED]',
      'http.request.header.authorization': '[REDACTED]',
      message: 'contact person@example.test',
      status: 200,
    });
  });

  test('leaves a string body unchanged', async () => {
    const body = 'Authorization: Bearer abc for person@example.test';
    const record = await exportLogRecord({ body });

    expect(record.body).toBe(body);
  });

  test('redacts listed keys in a map body', async () => {
    const record = await exportLogRecord({ body: { token: 'log-body-secret', note: 'from person@example.test', count: 2 } });

    expect(record.body).toEqual({ token: '[REDACTED]', note: 'from person@example.test', count: 2 });
  });

  test('leaves records without sensitive data unchanged', async () => {
    const record = await exportLogRecord({ body: 'request completed', attributes: { 'http.response.status_code': 200, route: '/apply' } });

    expect(record.body).toBe('request completed');
    expect(record.attributes).toEqual({ 'http.response.status_code': 200, route: '/apply' });
  });

  test('applies option overrides', async () => {
    const record = await exportLogRecord(
      { body: 'person@example.test', attributes: { 'customer.id': 'C-1', 'payment.credit_card': 'log-card-canary', password: 'kept' } },
      { attributeKeys: ['customer.id', /credit_card/], replacement: ({ key }) => `[${key}]` },
    );

    expect(record.body).toBe('person@example.test');
    expect(record.attributes).toEqual({ 'customer.id': '[customer.id]', 'payment.credit_card': '[payment.credit_card]', password: 'kept' });
  });
});
