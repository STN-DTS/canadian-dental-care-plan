import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { ApplicantDto } from '~/.server/domain/dtos';
import type { Session } from '~/.server/web/session';

const STATE_KEY = 'current';

let storage: SessionStorage<ApplicantDto> | undefined;

function getStorage(): SessionStorage<ApplicantDto> {
  storage ??= createSessionStorage<ApplicantDto>('applicant');
  return storage;
}

/**
 * Reads cached applicant data from session-scoped storage.
 */
export async function findApplicantState(session: Session): Promise<Option.Option<ApplicantDto>> {
  return await getStorage().find(session.id, STATE_KEY);
}

/**
 * Caches applicant data in session-scoped storage and ensures the underlying
 * Express session is initialized so a session cookie is issued.
 */
export async function setApplicantState(session: Session, applicant: ApplicantDto): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, STATE_KEY, applicant);
}

/**
 * Removes cached applicant data from session-scoped storage.
 */
export async function deleteApplicantState(session: Session): Promise<void> {
  await getStorage().delete(session.id, STATE_KEY);
}
