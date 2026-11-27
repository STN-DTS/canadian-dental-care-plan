import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import { deleteProfileEmailAddressFlowState, findProfileEmailAddressFlowState, setProfileEmailAddressFlowState } from '~/.server/routes/data/profile-email-address-flow-storage';
import type { ProfileEmailAddressFlowState } from '~/.server/routes/data/profile-email-address-flow-storage';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('profile-email-address-flow-storage', () => {
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
    const state: ProfileEmailAddressFlowState = {
      context: 'contact',
      emailAddress: 'test@example.com',
      verificationCode: '123456',
      verificationAttempts: 0,
    };

    await setProfileEmailAddressFlowState(session, state);
    expect(session.initialize).toHaveBeenCalledOnce();
    await expect(findProfileEmailAddressFlowState(session)).resolves.toEqual(Option.some(state));

    await deleteProfileEmailAddressFlowState(session);
    await expect(findProfileEmailAddressFlowState(session)).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const state: ProfileEmailAddressFlowState = {
      context: 'communication-preferences',
      emailAddress: 'test@example.com',
      verificationCode: '123456',
      verificationAttempts: 1,
      preferredLanguage: 'en',
      preferredMethodSunLife: 'email',
      preferredMethodGovernmentOfCanada: 'email',
    };

    await setProfileEmailAddressFlowState(session, state);
    await deleteSessionStorage('session-a');

    await expect(findProfileEmailAddressFlowState(session)).resolves.toEqual(Option.none());
  });
});
