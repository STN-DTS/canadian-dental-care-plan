import { data, replace } from 'react-router';

// session.id is currently an incubating OpenTelemetry convention.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import * as z from 'zod';

import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_REDIRECT_TARGET, ATTR_CDCP_SESSION_KEY } from '~/.server/logging/log-attributes';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

export type DocumentUploadStateSessionKey = `document-upload-flow-${string}`;

export interface SubmittedDocument {
  readonly id: string;
  readonly fileName: string;
  readonly documentType: string;
  readonly fileSize: number;
  readonly status: 'pending' | 'uploaded';
  readonly uploadDate?: string;
}

export interface DocumentUploadState {
  readonly id: string;
  readonly status: 'initialized' | 'partial-upload' | 'finished';
  readonly documents: ReadonlyArray<SubmittedDocument>;
  /** Number of upload submissions recorded for this flow; absent until the first submission. */
  readonly uploadAttemptCount?: number;
}

/**
 * Schema for validating UUID.
 */
const idSchema = z.uuid();

/**
 * Gets the document upload flow session key.
 * @param id - The document upload flow ID.
 * @returns The document upload flow session key.
 */
function getSessionKey(id: string): DocumentUploadStateSessionKey {
  return `document-upload-flow-${idSchema.parse(id)}`;
}

type DocumentUploadStateParams = {
  lang: string;
};

export function getDocumentUploadStateIdFromUrl(url: string | URL) {
  const { searchParams } = new URL(url);
  return searchParams.get('id');
}

interface LoadStateArgs {
  id: string | null;
  params: DocumentUploadStateParams;
  session: Session;
}

/**
 * Loads document upload state.
 * @param args - The arguments.
 * @returns The loaded state.
 * @throws A replacement redirect to the localized documents listing if the ID or flow is unavailable.
 */
export function loadDocumentUploadState({ id, params, session }: LoadStateArgs): DocumentUploadState {
  const log = createLogger('document-upload-route-helpers/loadDocumentUploadState');
  const documentsIndexUrl = getPathById('protected/documents/index', params);

  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    log.debug('Invalid document upload flow ID; redirecting to documents index', { [ATTR_CDCP_REDIRECT_TARGET]: documentsIndexUrl, [ATTR_SESSION_ID]: session.id });
    throw replace(documentsIndexUrl);
  }

  const sessionKey = getSessionKey(parsedId.data);

  if (!session.has(sessionKey)) {
    log.debug('Document upload session state not found; redirecting to documents index', {
      [ATTR_CDCP_REDIRECT_TARGET]: documentsIndexUrl,
      [ATTR_CDCP_SESSION_KEY]: sessionKey,
      [ATTR_SESSION_ID]: session.id,
    });
    throw replace(documentsIndexUrl);
  }

  return session.get(sessionKey);
}

interface StartStateArgs {
  id: string;
  session: Session;
}

/**
 * Starts document upload state.
 * @param args - The arguments.
 * @returns The initial document upload state.
 */
export function startDocumentUploadState({ id, session }: StartStateArgs) {
  const log = createLogger('document-upload-route-helpers/startDocumentUploadState');
  const parsedId = idSchema.parse(id);

  const initialState: DocumentUploadState = {
    id: parsedId,
    status: 'initialized',
    documents: [],
  };

  const sessionKey = getSessionKey(parsedId);
  session.set(sessionKey, initialState);
  log.debug('Document upload session state started', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
  return initialState;
}

interface ResetStateArgs {
  id: string;
  params: DocumentUploadStateParams;
  session: Session;
}

/**
 * Resets document upload state.
 * @param args - The arguments.
 * @returns The reset document upload state.
 */
export function resetDocumentUploadState({ id, params, session }: ResetStateArgs) {
  const log = createLogger('document-upload-route-helpers/resetDocumentUploadState');
  const currentState = loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished') {
    throw data(null, { status: 409 });
  }

  const resettedState: DocumentUploadState = {
    ...currentState,
    status: 'initialized',
    documents: [],
  };

  const sessionKey = getSessionKey(currentState.id);
  session.set(sessionKey, resettedState);
  log.debug('Document upload session state reset', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
  return resettedState;
}

interface UpdateStateArgs {
  id: string;
  params: DocumentUploadStateParams;
  session: Session;
  state: Pick<DocumentUploadState, 'documents'>;
}

/**
 * Updates document upload state.
 * @param args - The arguments.
 * @returns The updated document upload state.
 */
export function updateDocumentUploadState({ id, session, state, params }: UpdateStateArgs) {
  const log = createLogger('document-upload-route-helpers/updateDocumentUploadState');
  const currentState = loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished') {
    throw data(null, { status: 409 });
  }

  const newState: DocumentUploadState = {
    ...currentState,
    status: state.documents.some((document) => document.status === 'uploaded') ? 'partial-upload' : 'initialized',
    documents: state.documents,
  };

  const sessionKey = getSessionKey(currentState.id);
  session.set(sessionKey, newState);

  log.debug('Document upload session state updated', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
  return newState;
}

interface RecordAttemptArgs {
  id: string;
  params: DocumentUploadStateParams;
  session: Session;
}

/**
 * Records one upload submission for the flow. Resetting the form keeps the count.
 * @param args - The arguments.
 * @returns The attempt number of this submission, starting at 1.
 * @throws If the flow has already finished.
 */
export function recordDocumentUploadAttempt({ id, params, session }: RecordAttemptArgs): number {
  const currentState = loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished') {
    throw data(null, { status: 409 });
  }

  const uploadAttemptCount = (currentState.uploadAttemptCount ?? 0) + 1;
  session.set(getSessionKey(currentState.id), { ...currentState, uploadAttemptCount } satisfies DocumentUploadState);
  return uploadAttemptCount;
}

export function finishDocumentUploadState({ id, params, session }: LoadStateArgs): DocumentUploadState {
  const currentState = loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished' || !currentState.documents.some((document) => document.status === 'uploaded') || currentState.documents.some((document) => document.status === 'pending')) {
    throw data(null, { status: 409 });
  }

  const finishedState: DocumentUploadState = { ...currentState, status: 'finished' };
  session.set(getSessionKey(currentState.id), finishedState);
  return finishedState;
}

interface ClearStateArgs {
  id: string;
  params: DocumentUploadStateParams;
  session: Session;
}

/**
 * Clears document upload state.
 * @param args - The arguments.
 */
export function clearDocumentUploadState({ id, params, session }: ClearStateArgs) {
  const log = createLogger('document-upload-route-helpers/clearDocumentUploadState');
  const state = loadDocumentUploadState({ id, params, session });
  const sessionKey = getSessionKey(state.id);
  session.unset(sessionKey);
  log.debug('Document upload session state cleared', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
}

export function getDocumentUploadFormUrl(id: string, params: DocumentUploadStateParams) {
  return getPathById('protected/documents/upload/upload-form', { ...params, id });
}

export function getDocumentUploadSubmittedUrl(id: string, params: DocumentUploadStateParams) {
  return getPathById('protected/documents/upload/upload-submitted', { ...params, id });
}
