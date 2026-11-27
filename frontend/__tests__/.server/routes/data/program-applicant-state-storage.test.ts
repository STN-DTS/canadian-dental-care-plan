import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { deleteSessionStorage } from '~/.server/data/session-storage';
import type { ProgramApplicantDto } from '~/.server/domain/dtos';
import { deleteProgramApplicantState, findProgramApplicantState, setProgramApplicantState } from '~/.server/routes/data/program-applicant-state-storage';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('program-applicant-state-storage', () => {
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

  it('stores, reads, and deletes program applicant data scoped to the session', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const programApplicant = { clientNumber: '123456', applicantType: '775170000' } as ProgramApplicantDto;

    await setProgramApplicantState(session, programApplicant);
    expect(session.initialize).toHaveBeenCalledOnce();
    await expect(findProgramApplicantState(session)).resolves.toEqual(Option.some(programApplicant));

    await deleteProgramApplicantState(session);
    await expect(findProgramApplicantState(session)).resolves.toEqual(Option.none());
  });

  it('cleans up stored entries when session storage is deleted', async () => {
    const session = mock<Session>({ id: 'session-a' });
    const programApplicant = { clientNumber: '123456', applicantType: '775170000' } as ProgramApplicantDto;

    await setProgramApplicantState(session, programApplicant);
    await deleteSessionStorage('session-a');

    await expect(findProgramApplicantState(session)).resolves.toEqual(Option.none());
  });
});
