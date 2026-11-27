import { data, replace } from 'react-router';

// session.id is currently an incubating OpenTelemetry convention.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import { Option } from 'effect';
import * as z from 'zod';

import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_REDIRECT_TARGET, ATTR_CDCP_SESSION_KEY } from '~/.server/logging/log-attributes';
import { deleteDocumentUploadState, findDocumentUploadState, setDocumentUploadState } from '~/.server/routes/helpers/document-upload-state-storage';
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
export async function loadDocumentUploadState({ id, params, session }: LoadStateArgs): Promise<DocumentUploadState> {
  const log = createLogger('document-upload-route-helpers/loadDocumentUploadState');
  const documentsIndexUrl = getPathById('protected/documents/index', params);

  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    log.debug('Invalid document upload flow ID; redirecting to documents index', { [ATTR_CDCP_REDIRECT_TARGET]: documentsIndexUrl, [ATTR_SESSION_ID]: session.id });
    throw replace(documentsIndexUrl);
  }

  const sessionKey = getSessionKey(parsedId.data);
  const stateOption = await findDocumentUploadState(session, parsedId.data);

  if (Option.isNone(stateOption)) {
    log.debug('Document upload session state not found; redirecting to documents index', {
      [ATTR_CDCP_REDIRECT_TARGET]: documentsIndexUrl,
      [ATTR_CDCP_SESSION_KEY]: sessionKey,
      [ATTR_SESSION_ID]: session.id,
    });
    throw replace(documentsIndexUrl);
  }

  return stateOption.value;
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
export async function startDocumentUploadState({ id, session }: StartStateArgs): Promise<DocumentUploadState> {
  const log = createLogger('document-upload-route-helpers/startDocumentUploadState');
  const parsedId = idSchema.parse(id);

  const initialState: DocumentUploadState = {
    id: parsedId,
    status: 'initialized',
    documents: [],
  };

  const sessionKey = getSessionKey(parsedId);
  await setDocumentUploadState(session, parsedId, initialState);
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
export async function resetDocumentUploadState({ id, params, session }: ResetStateArgs): Promise<DocumentUploadState> {
  const log = createLogger('document-upload-route-helpers/resetDocumentUploadState');
  const currentState = await loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished') {
    throw data(null, { status: 409 });
  }

  const resettedState: DocumentUploadState = {
    ...currentState,
    status: 'initialized',
    documents: [],
  };

  const sessionKey = getSessionKey(currentState.id);
  await setDocumentUploadState(session, currentState.id, resettedState);
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
export async function updateDocumentUploadState({ id, session, state, params }: UpdateStateArgs): Promise<DocumentUploadState> {
  const log = createLogger('document-upload-route-helpers/updateDocumentUploadState');
  const currentState = await loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished') {
    throw data(null, { status: 409 });
  }

  const newState: DocumentUploadState = {
    ...currentState,
    status: state.documents.some((document) => document.status === 'uploaded') ? 'partial-upload' : 'initialized',
    documents: state.documents,
  };

  const sessionKey = getSessionKey(currentState.id);
  await setDocumentUploadState(session, currentState.id, newState);

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
export async function recordDocumentUploadAttempt({ id, params, session }: RecordAttemptArgs): Promise<number> {
  const currentState = await loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished') {
    throw data(null, { status: 409 });
  }

  const uploadAttemptCount = (currentState.uploadAttemptCount ?? 0) + 1;
  await setDocumentUploadState(session, currentState.id, { ...currentState, uploadAttemptCount } satisfies DocumentUploadState);
  return uploadAttemptCount;
}

export async function finishDocumentUploadState({ id, params, session }: LoadStateArgs): Promise<DocumentUploadState> {
  const currentState = await loadDocumentUploadState({ id, params, session });

  if (currentState.status === 'finished' || !currentState.documents.some((document) => document.status === 'uploaded') || currentState.documents.some((document) => document.status === 'pending')) {
    throw data(null, { status: 409 });
  }

  const finishedState: DocumentUploadState = { ...currentState, status: 'finished' };
  await setDocumentUploadState(session, currentState.id, finishedState);
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
export async function clearDocumentUploadState({ id, params, session }: ClearStateArgs): Promise<void> {
  const log = createLogger('document-upload-route-helpers/clearDocumentUploadState');
  const state = await loadDocumentUploadState({ id, params, session });
  const sessionKey = getSessionKey(state.id);
  await deleteDocumentUploadState(session, state.id);
  log.debug('Document upload session state cleared', { [ATTR_CDCP_SESSION_KEY]: sessionKey, [ATTR_SESSION_ID]: session.id });
}

export function getDocumentUploadFormUrl(id: string, params: DocumentUploadStateParams) {
  return getPathById('protected/documents/upload/upload-form', { ...params, id });
}

export function getDocumentUploadSubmittedUrl(id: string, params: DocumentUploadStateParams) {
  return getPathById('protected/documents/upload/upload-submitted', { ...params, id });
}
