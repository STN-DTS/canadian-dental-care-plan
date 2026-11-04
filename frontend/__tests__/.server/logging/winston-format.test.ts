import type { Format, TransformableInfo } from 'logform';
import { LEVEL, MESSAGE } from 'triple-beam';
import { describe, expect, it } from 'vitest';

import { formatPrintf } from '~/.server/logging/winston-format';

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
    ).toBe("2026-07-29T14:32:10.123Z INFO [102981abcd2901,abcdef1010] [Service] : Request completed --- { requestId: 'request-123' }");
  });
});
