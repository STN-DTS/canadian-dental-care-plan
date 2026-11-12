import { SeverityNumber } from '@opentelemetry/api';
import type { Format, TransformableInfo } from 'logform';
import { LEVEL, MESSAGE } from 'triple-beam';
import { describe, expect, it } from 'vitest';

import { addDynatraceLogLevel, addOtelSeverity, formatPrintf, formatUrlPaths } from '~/.server/logging/winston-format';

const expectedLevelMappings = [
  { level: 'trace', severityNumber: SeverityNumber.TRACE, logLevel: 'TRACE' },
  { level: 'debug', severityNumber: SeverityNumber.DEBUG, logLevel: 'DEBUG' },
  { level: 'http', severityNumber: SeverityNumber.DEBUG4, logLevel: 'DEBUG' },
  { level: 'info', severityNumber: SeverityNumber.INFO, logLevel: 'INFO' },
  { level: 'audit', severityNumber: SeverityNumber.INFO, logLevel: 'INFO' },
  { level: 'warn', severityNumber: SeverityNumber.WARN, logLevel: 'WARN' },
  { level: 'error', severityNumber: SeverityNumber.ERROR, logLevel: 'ERROR' },
];

function createInfo(values: Partial<TransformableInfo> = {}): TransformableInfo {
  const info: TransformableInfo = {
    [LEVEL]: 'debug',
    level: 'debug',
    message: undefined,
    ...values,
  };

  info[LEVEL] = info.level;
  return info;
}

function transformInfo(formatter: Format, info: TransformableInfo): TransformableInfo {
  const transformed = formatter.transform(info);

  if (typeof transformed === 'boolean') {
    throw new TypeError('Expected formatter to return log info.');
  }

  return transformed;
}

function print(info: Partial<TransformableInfo>): string {
  const output = transformInfo(formatPrintf(), createInfo(info));
  const ansiEscapePattern = new RegExp(`${String.fromCodePoint(27)}${String.raw`\[[0-?]*[ -/]*[@-~]`}`, 'g');
  return String(output[MESSAGE]).replaceAll(ansiEscapePattern, '');
}

describe('addOtelSeverity', () => {
  it.each(expectedLevelMappings)('maps $level using the canonical level', ({ level, severityNumber }) => {
    const info = createInfo({ level, message: 'Test message', severityNumber: SeverityNumber.UNSPECIFIED, label: 'Test' });
    info.level = 'FORMATTED';

    expect(transformInfo(addOtelSeverity(), info)).toBe(info);
    expect(info).toEqual({
      [LEVEL]: level,
      level: 'FORMATTED',
      message: 'Test message',
      severityNumber,
      label: 'Test',
    });
  });

  it.each([undefined, ''])('preserves the record when the canonical level is %s', (level) => {
    const info = createInfo({ level: 'info', severityNumber: SeverityNumber.ERROR });

    if (level === undefined) {
      delete info[LEVEL];
    } else {
      info[LEVEL] = level;
    }

    const original = { ...info };

    expect(transformInfo(addOtelSeverity(), info)).toBe(info);
    expect(info).toEqual(original);
  });

  it.each(['unknown', 'toString'])('preserves the record for the unsupported level %s', (level) => {
    const info = createInfo({ level, severityNumber: SeverityNumber.ERROR });
    const original = { ...info };

    expect(transformInfo(addOtelSeverity(), info)).toBe(info);
    expect(info).toEqual(original);
  });

  it.each(['unknown', 'toString'])('does not add severityNumber for the unsupported level %s', (level) => {
    const info = createInfo({ level });

    expect(transformInfo(addOtelSeverity(), info)).not.toHaveProperty('severityNumber');
  });
});

describe('addDynatraceLogLevel', () => {
  it.each(expectedLevelMappings)('maps $level without changing OpenTelemetry severity', ({ level, logLevel }) => {
    const info = createInfo({ level, message: 'Test message', logLevel: 'existing', severityNumber: SeverityNumber.ERROR, label: 'Test' });
    info.level = 'FORMATTED';

    expect(transformInfo(addDynatraceLogLevel(), info)).toBe(info);
    expect(info).toEqual({
      [LEVEL]: level,
      level: 'FORMATTED',
      message: 'Test message',
      logLevel,
      severityNumber: SeverityNumber.ERROR,
      label: 'Test',
    });
  });

  it.each([undefined, ''])('preserves the record when the canonical level is %s', (level) => {
    const info = createInfo({ level: 'info', logLevel: 'existing', severityNumber: SeverityNumber.ERROR });

    if (level === undefined) {
      delete info[LEVEL];
    } else {
      info[LEVEL] = level;
    }

    const original = { ...info };

    expect(transformInfo(addDynatraceLogLevel(), info)).toBe(info);
    expect(info).toEqual(original);
  });

  it.each(['unknown', 'toString'])('preserves the record for the unsupported level %s', (level) => {
    const info = createInfo({ level, logLevel: 'existing', severityNumber: SeverityNumber.ERROR });
    const original = { ...info };

    expect(transformInfo(addDynatraceLogLevel(), info)).toBe(info);
    expect(info).toEqual(original);
  });

  it.each(['unknown', 'toString'])('does not add logLevel for the unsupported level %s', (level) => {
    const info = createInfo({ level });

    expect(transformInfo(addDynatraceLogLevel(), info)).not.toHaveProperty('logLevel');
  });
});

describe('formatUrlPaths', () => {
  it('preserves application paths and redacts backend client identifiers', () => {
    const metadata = Object.freeze({
      'http.response.status_code': 200,
      'url.full': "https://backend.example.test/dental-care/doc-metadata/pp/v1/esdc_clients('client-canary')",
      'url.path': '/en/application/confirmation',
    });
    const info = transformInfo(formatUrlPaths(), createInfo(metadata));

    expect(info['url.path']).toBe('/en/application/confirmation');
    expect(info['url.full']).toBe('https://backend.example.test/dental-care/doc-metadata/pp/v1/esdc_clients([REDACTED])');
    expect(info['http.response.status_code']).toBe(200);
    expect(metadata['url.full']).toContain('client-canary');
    expect(metadata['url.path']).toBe('/en/application/confirmation');
  });

  it('preserves string arrays and unsupported path values', () => {
    const info = transformInfo(formatUrlPaths(), createInfo({ 'url.path': ['/en/apply', '/fr/demande'], http: 123 }));

    expect(info['url.path']).toEqual(['/en/apply', '/fr/demande']);
    expect(info.http).toBe(123);
  });

  it('does not add absent URL attributes', () => {
    const info = transformInfo(formatUrlPaths(), createInfo());

    expect(info).not.toHaveProperty('url.path');
  });
});

describe('formatPrintf', () => {
  it('renders correlation fields after the log level', () => {
    expect(
      print({
        label: '[Service]',
        level: 'INFO',
        message: 'Request completed',
        span_id: 'abcdef1010',
        timestamp: '2026-07-29T14:32:10.123Z',
        trace_flags: '01',
        trace_id: '102981abcd2901',
      }),
    ).toBe('2026-07-29T14:32:10.123Z INFO [102981abcd2901,abcdef1010] [Service] : Request completed');
  });

  it('renders only correlation fields that exist', () => {
    expect(
      print({
        label: '[Service]',
        level: 'INFO',
        message: 'Request completed',
        timestamp: '2026-07-29T14:32:10.123Z',
        trace_id: '102981abcd2901',
      }),
    ).toBe('2026-07-29T14:32:10.123Z INFO [102981abcd2901] [Service] : Request completed');
  });

  it('does not render an empty OpenTelemetry block', () => {
    expect(
      print({
        label: '[Service]',
        level: 'INFO',
        message: 'Request completed',
        timestamp: '2026-07-29T14:32:10.123Z',
      }),
    ).toBe('2026-07-29T14:32:10.123Z INFO [Service] : Request completed');
  });

  it('keeps regular metadata separate from correlation fields', () => {
    expect(
      print({
        label: '[Service]',
        level: 'INFO',
        message: 'Request completed',
        requestId: 'request-123',
        span_id: 'abcdef1010',
        timestamp: '2026-07-29T14:32:10.123Z',
        trace_id: '102981abcd2901',
      }),
    ).toBe("2026-07-29T14:32:10.123Z INFO [102981abcd2901,abcdef1010] [Service] : Request completed { requestId: 'request-123' }");
  });

  it('keeps long metadata on a single console line', () => {
    const requestId = 'request-123'.repeat(12);

    expect(
      print({
        label: '[Service]',
        level: 'INFO',
        message: 'Request completed',
        requestId,
        timestamp: '2026-07-29T14:32:10.123Z',
      }),
    ).toBe(`2026-07-29T14:32:10.123Z INFO [Service] : Request completed { requestId: '${requestId}' }`);
  });
});
