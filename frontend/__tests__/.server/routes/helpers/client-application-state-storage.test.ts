import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import type { ClientApplicationDto } from '~/.server/domain/dtos';
import { deleteClientApplicationState, findClientApplicationState, setClientApplicationState } from '~/.server/routes/helpers/client-application-state-storage';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('client-application-state-storage', () => {
  const clientApplication = { applicantInformation: { clientId: 'client-1', clientNumber: '123456' } } as ClientApplicationDto;

  beforeEach(() => {
    deleteSingleton('stores');
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 1200,
        SESSION_STATE_TTL_OFFSET_SECONDS: 300,
        CLIENT_APPLICATION_CACHE_TTL_SECONDS: 300,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    deleteSingleton('stores');
  });

  it('stores, reads, and deletes client applications keyed by optional applicationYearId', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const yearSpecific = { applicantInformation: { clientId: 'client-2', clientNumber: '654321' } } as ClientApplicationDto;

    await setClientApplicationState(session, clientApplication);
    await setClientApplicationState(session, yearSpecific, 'year-2026');

    expect(session.initialize).toHaveBeenCalledTimes(2);
    await expect(findClientApplicationState(session)).resolves.toEqual(Option.some(clientApplication));
    await expect(findClientApplicationState(session, 'year-2026')).resolves.toEqual(Option.some(yearSpecific));

    await deleteClientApplicationState(session);
    await expect(findClientApplicationState(session)).resolves.toEqual(Option.none());
    await expect(findClientApplicationState(session, 'year-2026')).resolves.toEqual(Option.some(yearSpecific));
  });

  it('expires cached client applications after CLIENT_APPLICATION_CACHE_TTL_SECONDS', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    const session = mock<Session>({ id: 'session-a' });

    await setClientApplicationState(session, clientApplication);
    vi.advanceTimersByTime(299_999);
    await expect(findClientApplicationState(session)).resolves.toEqual(Option.some(clientApplication));

    vi.advanceTimersByTime(2);
    await expect(findClientApplicationState(session)).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });

    await setClientApplicationState(session, clientApplication);
    await deleteSessionStorage('session-a');

    await expect(findClientApplicationState(session)).resolves.toEqual(Option.none());
  });
});
