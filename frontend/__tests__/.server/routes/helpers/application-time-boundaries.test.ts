import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { countApplicationStateOutcome } from '~/.server/observability/application-state-metrics';
import { getProtectedApplicationState, isWithinRenewalPeriod as isProtectedRenewalPeriod, saveProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getPublicApplicationState, isWithinRenewalPeriod as isPublicRenewalPeriod, savePublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import type { PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/observability/application-state-metrics'), () => ({ countApplicationStateOutcome: vi.fn() }));
vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));
vi.mock(import('~/.server/utils/url-utils'), () => ({ getCdcpWebsiteApplyUrl: vi.fn(() => 'https://example.com/apply') }));

beforeEach(() => {
  vi.mocked(countApplicationStateOutcome).mockClear();
  vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T12:00:00Z') });
  vi.mocked(getEnv).mockReturnValue(
    mock<ServerEnv>({
      RENEWAL_PERIOD_START_DATE: '2026-06-01T00:00:00.000Z',
      RENEWAL_PERIOD_END_DATE: '2026-06-30T23:59:59.999Z',
      SESSION_EXPIRES_SECONDS: 1200,
    }),
  );
});

describe.each([
  {
    channel: 'public' as const,
    loadState: getPublicApplicationState,
    isRenewalPeriod: isPublicRenewalPeriod,
    state: mock<PublicApplicationState>({ id: 'flow', channelCode: 'public', lastUpdatedOn: '2026-07-01T11:40:00.000Z' }),
  },
  {
    channel: 'protected' as const,
    loadState: getProtectedApplicationState,
    isRenewalPeriod: isProtectedRenewalPeriod,
    state: mock<ProtectedApplicationState>({ id: 'flow', channelCode: 'protected', lastUpdatedOn: '2026-07-01T11:40:00.000Z' }),
  },
])('$channel application time boundaries', ({ channel, loadState, isRenewalPeriod, state }) => {
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
      }),
    );

    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-01T00:00:00.000Z'))).toBe(true);
    expect(isRenewalPeriod(Temporal.Instant.from('2026-06-30T23:59:59.999999999Z'))).toBe(true);
  });

  it('retains the session before twenty minutes and expires it exactly at twenty minutes', () => {
    const session = mock<Session>({ id: 'session' });
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(state);
    const args = { params: { id: 'flow', lang: 'en' }, session };
    vi.setSystemTime(Temporal.Instant.from('2026-07-01T11:59:59.999Z').epochMilliseconds);

    expect(loadState(args).lastUpdatedOn).toBe(state.lastUpdatedOn);
    expect(session.unset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(() => loadState(args)).toThrow();
    expect(session.unset).toHaveBeenCalledWith(`${channel}-application-flow-flow`);
    expect(countApplicationStateOutcome).toHaveBeenCalledExactlyOnceWith(channel, 'expired');
  });

  it('counts state missing from the session', () => {
    const session = mock<Session>({ id: 'session' });
    session.has.mockReturnValue(false);

    expect(() => loadState({ params: { id: 'flow', lang: 'en' }, session })).toThrow();
    expect(countApplicationStateOutcome).toHaveBeenCalledExactlyOnceWith(channel, 'missing');
  });

  it('does not expire fractional session timestamps before twenty minutes have elapsed', () => {
    const session = mock<Session>({ id: 'session' });
    const fractionalState = { ...state, lastUpdatedOn: '2026-07-01T11:40:00.123456789Z' };
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(fractionalState);
    const args = { params: { id: 'flow', lang: 'en' }, session };
    const now = vi.spyOn(Temporal.Now, 'instant');

    try {
      now.mockReturnValue(Temporal.Instant.from('2026-07-01T12:00:00.123456788Z'));
      expect(loadState(args).lastUpdatedOn).toBe(fractionalState.lastUpdatedOn);
      expect(session.unset).not.toHaveBeenCalled();

      now.mockReturnValue(Temporal.Instant.from('2026-07-01T12:00:00.123456789Z'));
      expect(() => loadState(args)).toThrow();
      expect(session.unset).toHaveBeenCalledWith(`${channel}-application-flow-flow`);
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

  it('saves public submission information when the external submission crosses the expiry boundary', () => {
    const state = mock<PublicApplicationState>({ id: 'flow', channelCode: 'public', lastUpdatedOn: '2026-07-01T11:40:00.000Z' });
    const session = mock<Session>({ id: 'session' });
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(state);

    const result = savePublicApplicationState({ params: { id: 'flow', lang: 'en' }, session, state: { submissionInfo } });

    expect(result.submissionInfo).toEqual(submissionInfo);
    expect(session.set).toHaveBeenCalledWith('public-application-flow-flow', expect.objectContaining({ submissionInfo }));
    expect(session.unset).not.toHaveBeenCalled();
  });

  it('saves protected submission information when the external submission crosses the expiry boundary', () => {
    const state = mock<ProtectedApplicationState>({ id: 'flow', channelCode: 'protected', lastUpdatedOn: '2026-07-01T11:40:00.000Z' });
    const session = mock<Session>({ id: 'session' });
    session.has.mockReturnValue(true);
    session.get.mockReturnValue(state);

    const result = saveProtectedApplicationState({ params: { id: 'flow', lang: 'en' }, session, state: { submissionInfo } });

    expect(result.submissionInfo).toEqual(submissionInfo);
    expect(session.set).toHaveBeenCalledWith('protected-application-flow-flow', expect.objectContaining({ submissionInfo }));
    expect(session.unset).not.toHaveBeenCalled();
  });
});
