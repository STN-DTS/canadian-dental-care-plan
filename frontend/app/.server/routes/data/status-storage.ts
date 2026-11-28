import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { StatusState } from '~/.server/routes/helpers/status-route-helpers';
import type { Session } from '~/.server/web/session';

let storage: SessionStorage<StatusState> | undefined;

function getStorage(): SessionStorage<StatusState> {
  storage ??= createSessionStorage<StatusState>('status', { slidingTtl: true });
  return storage;
}

/**
 * Reads status flow state from session-scoped storage.
 */
export async function findStatusState(session: Session, id: string): Promise<Option.Option<StatusState>> {
  return await getStorage().find(session.id, id);
}

/**
 * Writes status flow state to session-scoped storage and ensures the
 * underlying Express session is initialized so a session cookie is issued.
 */
export async function setStatusState(session: Session, id: string, state: StatusState): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, id, state);
}

/**
 * Removes status flow state from session-scoped storage.
 */
export async function deleteStatusState(session: Session, id: string): Promise<void> {
  await getStorage().delete(session.id, id);
}
