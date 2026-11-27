import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { countApplicationStateOutcome } from '~/.server/observability/application-state-metrics';
import { findProtectedApplicationState, setProtectedApplicationState } from '~/.server/routes/data/protected-application-storage';
import { findPublicApplicationState, setPublicApplicationState } from '~/.server/routes/data/public-application-storage';
import { getProtectedApplicationState, isWithinRenewalPeriod as isProtectedRenewalPeriod, saveProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getPublicApplicationState, isWithinRenewalPeriod as isPublicRenewalPeriod, savePublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import type { PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/observability/application-state-metrics'), () => ({ countApplicationStateOutcome: vi.fn() }));
vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));
vi.mock(import('~/.server/utils/url-utils'), () => ({ getCdcpWebsiteApplyUrl: vi.fn(() => 'https://example.com/apply') }));

beforeEach(() => {
  deleteSingleton('stores');
  vi.mocked(countApplicationStateOutcome).mockClear();
  vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T12:00:00Z') });
  vi.mocked(getEnv).mockReturnValue(
    mock<ServerEnv>({
      RENEWAL_PERIOD_START_DATE: '2026-06-01T00:00:00.000Z',
      RENEWAL_PERIOD_END_DATE: '2026-06-30T23:59:59.999Z',
      SESSION_EXPIRES_SECONDS: 1200,
      SESSION_KEY_PREFIX: 'SESSION:',
      SESSION_STORAGE_TTL_OFFSET_SECONDS: 60,
      SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      SESSION_STORAGE_TYPE: 'memory',
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  deleteSingleton('stores');
});

describe.each([
  { channel: 'public' as const, isRenewalPeriod: isPublicRenewalPeriod },
  { channel: 'protected' as const, isRenewalPeriod: isProtectedRenewalPeriod },
])('$channel renewal period boundaries', ({ isRenewalPeriod }) => {
  it('includes both renewal endpoints but not the adjacent millisecond', () => {
    expect(isRenewalPeriod(Temporal.Instant.from('2026-05-31T23:59:59.999Z'))).toBe(false);
    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-01T00:00:00.000Z'))).toBe(true);
    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-30T23:59:59.999Z'))).toBe(true);
    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-30T23:59:59.999999999Z'))).toBe(true);
    expect(isRenewalPeriod(Temporal.Instant.from('2026-07-01T00:00:00.000Z'))).toBe(false);
  });

  it('accepts renewal configuration with nanosecond precision', () => {
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        RENEWAL_PERIOD_START_DATE: '2026-06-01T00:00:00.000000000Z',
        RENEWAL_PERIOD_END_DATE: '2026-06-30T23:59:59.999111111Z',
        SESSION_EXPIRES_SECONDS: 1200,
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 60,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
        SESSION_STORAGE_TYPE: 'memory',
      }),
    );

    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-01T00:00:00.000Z'))).toBe(true);
    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-30T23:59:59.999999999Z'))).toBe(true);
  });
});

describe('public application time boundaries', () => {
  const baseState = {
    id: 'flow',
    channelCode: 'public',
    context: 'intake',
    lastUpdatedOn: '2026-07-01T11:40:00.000Z',
    applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
    children: [],
  } as PublicApplicationState;

  it('retains the state before twenty minutes and expires it exactly at twenty minutes', async () => {
    const session = mock<Session>({ id: 'session' });
    await setPublicApplicationState(session, 'flow', baseState);
    const args = { params: { id: 'flow', lang: 'en' }, session };
    vi.setSystemTime(Temporal.Instant.from('2026-07-01T11:59:59.999Z').epochMilliseconds);

    await expect(getPublicApplicationState(args)).resolves.toMatchObject({ lastUpdatedOn: baseState.lastUpdatedOn });
    expect(Option.isSome(await findPublicApplicationState(session, 'flow'))).toBe(true);

    vi.advanceTimersByTime(1);
    await expect(getPublicApplicationState(args)).rejects.toThrow();
    await expect(findPublicApplicationState(session, 'flow')).resolves.toEqual(Option.none());
    expect(countApplicationStateOutcome).toHaveBeenCalledExactlyOnceWith('public', 'expired');
  });

  it('counts state missing from storage', async () => {
    const session = mock<Session>({ id: 'session' });

    await expect(getPublicApplicationState({ params: { id: 'flow', lang: 'en' }, session })).rejects.toThrow();
    expect(countApplicationStateOutcome).toHaveBeenCalledExactlyOnceWith('public', 'missing');
  });

  it('does not expire fractional timestamps before twenty minutes have elapsed', async () => {
    const session = mock<Session>({ id: 'session' });
    const fractionalState = { ...baseState, lastUpdatedOn: '2026-07-01T11:40:00.123456789Z' } as PublicApplicationState;
    await setPublicApplicationState(session, 'flow', fractionalState);
    const args = { params: { id: 'flow', lang: 'en' }, session };
    const now = vi.spyOn(Temporal.Now, 'instant');

    try {
      now.mockReturnValue(Temporal.Instant.from('2026-07-01T12:00:00.123456788Z'));
      await expect(getPublicApplicationState(args)).resolves.toMatchObject({ lastUpdatedOn: fractionalState.lastUpdatedOn });
      expect(Option.isSome(await findPublicApplicationState(session, 'flow'))).toBe(true);

      now.mockReturnValue(Temporal.Instant.from('2026-07-01T12:00:00.123456789Z'));
      await expect(getPublicApplicationState(args)).rejects.toThrow();
      await expect(findPublicApplicationState(session, 'flow')).resolves.toEqual(Option.none());
    } finally {
      now.mockRestore();
    }
  });
});

describe('protected application time boundaries', () => {
  const baseState = {
    id: 'flow',
    channelCode: 'protected',
    context: 'intake',
    lastUpdatedOn: '2026-07-01T11:40:00.000Z',
    applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
    children: [],
  } as ProtectedApplicationState;

  it('retains the state before twenty minutes and expires it exactly at twenty minutes', async () => {
    const session = mock<Session>({ id: 'session' });
    await setProtectedApplicationState(session, 'flow', baseState);
    const args = { params: { id: 'flow', lang: 'en' }, session };
    vi.setSystemTime(Temporal.Instant.from('2026-07-01T11:59:59.999Z').epochMilliseconds);

    await expect(getProtectedApplicationState(args)).resolves.toMatchObject({ lastUpdatedOn: baseState.lastUpdatedOn });
    expect(Option.isSome(await findProtectedApplicationState(session, 'flow'))).toBe(true);

    vi.advanceTimersByTime(1);
    await expect(getProtectedApplicationState(args)).rejects.toThrow();
    await expect(findProtectedApplicationState(session, 'flow')).resolves.toEqual(Option.none());
    expect(countApplicationStateOutcome).toHaveBeenCalledExactlyOnceWith('protected', 'expired');
  });

  it('counts state missing from storage', async () => {
    const session = mock<Session>({ id: 'session' });

    await expect(getProtectedApplicationState({ params: { id: 'flow', lang: 'en' }, session })).rejects.toThrow();
    expect(countApplicationStateOutcome).toHaveBeenCalledExactlyOnceWith('protected', 'missing');
  });

  it('does not expire fractional timestamps before twenty minutes have elapsed', async () => {
    const session = mock<Session>({ id: 'session' });
    const fractionalState = { ...baseState, lastUpdatedOn: '2026-07-01T11:40:00.123456789Z' } as ProtectedApplicationState;
    await setProtectedApplicationState(session, 'flow', fractionalState);
    const args = { params: { id: 'flow', lang: 'en' }, session };
    const now = vi.spyOn(Temporal.Now, 'instant');

    try {
      now.mockReturnValue(Temporal.Instant.from('2026-07-01T12:00:00.123456788Z'));
      await expect(getProtectedApplicationState(args)).resolves.toMatchObject({ lastUpdatedOn: fractionalState.lastUpdatedOn });
      expect(Option.isSome(await findProtectedApplicationState(session, 'flow'))).toBe(true);

      now.mockReturnValue(Temporal.Instant.from('2026-07-01T12:00:00.123456789Z'));
      await expect(getProtectedApplicationState(args)).rejects.toThrow();
      await expect(findProtectedApplicationState(session, 'flow')).resolves.toEqual(Option.none());
    } finally {
      now.mockRestore();
    }
  });
});

describe('successful submission persistence at expiry', () => {
  const submissionInfo = {
    confirmationCode: 'confirmation-code',
    submittedOn: '2026-07-01T12:00:00Z',
  };

  it('saves public submission information when the external submission crosses the expiry boundary', async () => {
    const state = {
      id: 'flow',
      channelCode: 'public',
      context: 'intake',
      lastUpdatedOn: '2026-07-01T11:40:00.000Z',
      applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
      children: [],
    } as PublicApplicationState;
    const session = mock<Session>({ id: 'session' });
    await setPublicApplicationState(session, 'flow', state);

    const result = await savePublicApplicationState({ params: { id: 'flow', lang: 'en' }, session, state: { submissionInfo } });

    expect(result.submissionInfo).toEqual(submissionInfo);
    expect(Option.getOrUndefined(await findPublicApplicationState(session, 'flow'))).toMatchObject({ submissionInfo });
  });

  it('saves protected submission information when the external submission crosses the expiry boundary', async () => {
    const state = {
      id: 'flow',
      channelCode: 'protected',
      context: 'intake',
      lastUpdatedOn: '2026-07-01T11:40:00.000Z',
      applicationYear: { applicationYearId: '1', taxYear: '2025', dependentEligibilityEndDate: '2026-06-30' },
      children: [],
    } as ProtectedApplicationState;
    const session = mock<Session>({ id: 'session' });
    await setProtectedApplicationState(session, 'flow', state);

    const result = await saveProtectedApplicationState({ params: { id: 'flow', lang: 'en' }, session, state: { submissionInfo } });

    expect(result.submissionInfo).toEqual(submissionInfo);
    expect(Option.getOrUndefined(await findProtectedApplicationState(session, 'flow'))).toMatchObject({ submissionInfo });
  });
});
