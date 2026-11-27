import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { ProgramApplicantDto } from '~/.server/domain/dtos';
import type { Session } from '~/.server/web/session';

const STATE_KEY = 'current';

let storage: SessionStorage<ProgramApplicantDto> | undefined;

function getStorage(): SessionStorage<ProgramApplicantDto> {
  storage ??= createSessionStorage<ProgramApplicantDto>('program-applicant');
  return storage;
}

/**
 * Reads cached program applicant data from session-scoped storage.
 */
export async function findProgramApplicantState(session: Session): Promise<Option.Option<ProgramApplicantDto>> {
  return await getStorage().find(session.id, STATE_KEY);
}

/**
 * Caches program applicant data in session-scoped storage and ensures the underlying
 * Express session is initialized so a session cookie is issued.
 */
export async function setProgramApplicantState(session: Session, programApplicant: ProgramApplicantDto): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, STATE_KEY, programApplicant);
}

/**
 * Removes cached program applicant data from session-scoped storage.
 */
export async function deleteProgramApplicantState(session: Session): Promise<void> {
  await getStorage().delete(session.id, STATE_KEY);
}
