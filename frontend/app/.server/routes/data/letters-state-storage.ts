import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { LetterDto } from '~/.server/domain/dtos';
import type { Session } from '~/.server/web/session';

const STATE_KEY = 'current';

let storage: SessionStorage<ReadonlyArray<LetterDto>> | undefined;

function getStorage(): SessionStorage<ReadonlyArray<LetterDto>> {
  storage ??= createSessionStorage<ReadonlyArray<LetterDto>>('letters');
  return storage;
}

/**
 * Reads cached letters from session-scoped storage.
 */
export async function findLettersState(session: Session): Promise<Option.Option<ReadonlyArray<LetterDto>>> {
  return await getStorage().find(session.id, STATE_KEY);
}

/**
 * Caches letters in session-scoped storage and ensures the underlying
 * Express session is initialized so a session cookie is issued.
 */
export async function setLettersState(session: Session, letters: ReadonlyArray<LetterDto>): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, STATE_KEY, letters);
}

/**
 * Removes cached letters from session-scoped storage.
 */
export async function deleteLettersState(session: Session): Promise<void> {
  await getStorage().delete(session.id, STATE_KEY);
}
