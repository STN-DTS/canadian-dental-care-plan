import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import { deleteStatusState, findStatusState, setStatusState } from '~/.server/routes/data/status-state-storage';
import type { StatusState } from '~/.server/routes/helpers/status-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('status-state-storage', () => {
  beforeEach(() => {
    deleteSingleton('stores');
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 10,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );
  });

  afterEach(() => {
    deleteSingleton('stores');
  });

  it('stores, reads, and deletes state scoped to the session', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state: StatusState = { id: 'flow-1', statusCheckResult: { statusId: 'status-1' } };

    await setStatusState(session, 'flow-1', state);
    expect(session.initialize).toHaveBeenCalledOnce();
    await expect(findStatusState(session, 'flow-1')).resolves.toEqual(Option.some(state));

    await deleteStatusState(session, 'flow-1');
    await expect(findStatusState(session, 'flow-1')).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state: StatusState = { id: 'flow-1', statusCheckResult: { statusId: 'status-1' } };

    await setStatusState(session, 'flow-1', state);
    await deleteSessionStorage('session-a');

    await expect(findStatusState(session, 'flow-1')).resolves.toEqual(Option.none());
  });
});
