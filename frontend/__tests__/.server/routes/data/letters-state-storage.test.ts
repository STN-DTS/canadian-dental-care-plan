import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import type { LetterDto } from '~/.server/domain/dtos';
import { deleteLettersState, findLettersState, setLettersState } from '~/.server/routes/data/letters-state-storage';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('letters-state-storage', () => {
  beforeEach(() => {
    deleteSingleton('stores');
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STATE_TTL_OFFSET_SECONDS: 10,
      }),
    );
  });

  afterEach(() => {
    deleteSingleton('stores');
  });

  it('stores, reads, and deletes letters scoped to the session', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const letters: ReadonlyArray<LetterDto> = [{ id: 'letter-1', letterTypeId: 'type-1', date: '2026-07-01' }];

    await setLettersState(session, letters);
    expect(session.initialize).toHaveBeenCalledOnce();
    await expect(findLettersState(session)).resolves.toEqual(Option.some(letters));

    await deleteLettersState(session);
    await expect(findLettersState(session)).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const letters: ReadonlyArray<LetterDto> = [{ id: 'letter-1', letterTypeId: 'type-1', date: '2026-07-01' }];

    await setLettersState(session, letters);
    await deleteSessionStorage('session-a');

    await expect(findLettersState(session)).resolves.toEqual(Option.none());
  });
});
