import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { Session } from '~/.server/web/session';

let storage: SessionStorage<ProtectedApplicationState> | undefined;

function getStorage(): SessionStorage<ProtectedApplicationState> {
  storage ??= createSessionStorage<ProtectedApplicationState>('protected-application');
  return storage;
}

/**
 * Reads protected application state from session-scoped storage.
 */
export async function findProtectedApplicationState(session: Session, id: string): Promise<Option.Option<ProtectedApplicationState>> {
  return await getStorage().find(session.id, id);
}

/**
 * Writes protected application state to session-scoped storage and ensures the
 * underlying Express session is initialized so a session cookie is issued.
 */
export async function setProtectedApplicationState(session: Session, id: string, state: ProtectedApplicationState): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, id, state);
}

/**
 * Removes protected application state from session-scoped storage.
 */
export async function deleteProtectedApplicationState(session: Session, id: string): Promise<void> {
  await getStorage().delete(session.id, id);
}
