import type { Option } from 'effect';

import { createSessionStorage } from '~/.server/data/session-storage';
import type { SessionStorage } from '~/.server/data/session-storage';
import type { DocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { Session } from '~/.server/web/session';

let storage: SessionStorage<DocumentUploadState> | undefined;

function getStorage(): SessionStorage<DocumentUploadState> {
  storage ??= createSessionStorage<DocumentUploadState>('document-upload');
  return storage;
}

/**
 * Reads document upload flow state from session-scoped storage.
 */
export async function findDocumentUploadState(session: Session, id: string): Promise<Option.Option<DocumentUploadState>> {
  return await getStorage().find(session.id, id);
}

/**
 * Writes document upload flow state to session-scoped storage and ensures the
 * underlying Express session is initialized so a session cookie is issued.
 */
export async function setDocumentUploadState(session: Session, id: string, state: DocumentUploadState): Promise<void> {
  session.initialize();
  await getStorage().set(session.id, id, state);
}

/**
 * Removes document upload flow state from session-scoped storage.
 */
export async function deleteDocumentUploadState(session: Session, id: string): Promise<void> {
  await getStorage().delete(session.id, id);
}
