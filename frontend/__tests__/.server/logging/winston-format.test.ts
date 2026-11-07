import type { Format, TransformableInfo } from 'logform';
import { LEVEL, MESSAGE } from 'triple-beam';
import { describe, expect, it } from 'vitest';

import { formatPrintf, formatUrlPaths } from '~/.server/logging/winston-format';

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
