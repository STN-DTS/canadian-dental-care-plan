import { Temporal as importedTemporal } from 'temporal-polyfill';
import { Temporal as implementation } from 'temporal-polyfill/implementation';
import { describe, expect, it, vi } from 'vitest';

describe('Temporal runtime', () => {
  it.runIf(process.env.TEMPORAL_EXPECT_POLYFILL === 'true')('installs the fallback namespace in the test worker', () => {
    expect(Temporal).toBe(importedTemporal);
    expect(Function.prototype.toString.call(Temporal.Instant.from)).not.toContain('[native code]');
  });

  it('uses the Vitest clock for the global Temporal API', () => {
    const now = Temporal.Instant.from('2024-01-01T00:00:00Z');
    vi.useFakeTimers({ now });

    expect(Temporal.Now.instant().equals(now)).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(Temporal.Now.instant().equals(now.add({ seconds: 60 }))).toBe(true);
    vi.setSystemTime(now.add({ hours: 24 }).epochMilliseconds);
    expect(Temporal.Now.plainDateISO('UTC').toString()).toBe('2024-01-02');
  });

  it('keeps named imports bound to the original namespace', () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2000-01-01T00:00:00Z') });

    expect(importedTemporal).not.toBe(Temporal);
    expect(importedTemporal.Now).not.toBe(Temporal.Now);
  });

  it('supports calendar dates and ISO timestamps without native Temporal', () => {
    expect(implementation.PlainDate.from('2000-02-29').until(implementation.PlainDate.from('2023-02-28'), { largestUnit: 'years' }).years).toBe(22);
    expect(() => implementation.PlainDate.from({ year: 2024, month: 2, day: 30 }, { overflow: 'reject' })).toThrow(RangeError);
    expect(implementation.Instant.from('2024-01-01T00:00:00Z').toString()).toBe('2024-01-01T00:00:00Z');
  });
});
