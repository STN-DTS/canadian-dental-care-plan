import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import type { Session } from '~/.server/web/session';

let storage: SessionStorage<PublicApplicationState> | undefined;

function getStorage(): SessionStorage<PublicApplicationState> {
  storage ??= createSessionStorage<PublicApplicationState>('public-application');
  return storage;
}

/**
 * Reads public application state from session-scoped storage.
 */
export async function findPublicApplicationState(session: Session, id: string): Promise<Option.Option<PublicApplicationState>> {
  return await getStorage().find(session.id, id);
}

/**
 * Writes public application state to session-scoped storage and ensures the
 * underlying Express session is initialized so a session cookie is issued.
 */
export async function setPublicApplicationState(session: Session, id: string, state: PublicApplicationState): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, id, state);
}

/**
 * Removes public application state from session-scoped storage.
 */
export async function deletePublicApplicationState(session: Session, id: string): Promise<void> {
  await getStorage().delete(session.id, id);
}
