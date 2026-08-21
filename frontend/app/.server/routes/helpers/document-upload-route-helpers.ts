import { redirectDocument } from 'react-router';

import * as z from 'zod';

import { createLogger } from '~/.server/logging';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

export type DocumentUploadStateSessionKey = `document-upload-flow-${string}`;

export interface SubmittedDocument {
  readonly fileName: string;
  readonly documentType: string;
  readonly fileSize: number;
}

export interface DocumentUploadState {
  readonly id: string;
  readonly submittedDocuments: ReadonlyArray<SubmittedDocument>;
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
 */
export function loadDocumentUploadState({ id, params, session }: LoadStateArgs): DocumentUploadState {
  const log = createLogger('document-upload-route-helpers/loadDocumentUploadState');
  const documentsIndexUrl = getPathById('protected/documents/index', params);

  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    log.warn('Invalid "id" query string format; redirecting to [%s]; id: [%s], sessionId: [%s]', documentsIndexUrl, id, session.id);
    throw redirectDocument(documentsIndexUrl);
  }

  const sessionKey = getSessionKey(parsedId.data);

  if (!session.has(sessionKey)) {
    log.warn('Document upload session state has not been found; redirecting to [%s]; sessionKey: [%s], sessionId: [%s]', documentsIndexUrl, sessionKey, session.id);
    throw redirectDocument(documentsIndexUrl);
  }

  return session.get(sessionKey);
}

interface StartStateArgs {
  id: string;
  session: Session;
  submittedDocuments: ReadonlyArray<SubmittedDocument>;
}

/**
 * Starts document upload state.
 * @param args - The arguments.
 * @returns The initial document upload state.
 */
export function startDocumentUploadState({ id, session, submittedDocuments }: StartStateArgs) {
  const log = createLogger('document-upload-route-helpers/startDocumentUploadState');
  const parsedId = idSchema.parse(id);

  const initialState: DocumentUploadState = {
    id: parsedId,
    submittedDocuments,
  };

  const sessionKey = getSessionKey(parsedId);
  session.set(sessionKey, initialState);
  log.info('Document upload session state started; sessionKey: [%s], sessionId: [%s]', sessionKey, session.id);
  return initialState;
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
  log.info('Document upload session state cleared; sessionKey: [%s], sessionId: [%s]', sessionKey, session.id);
}

interface GetDocumentUploadSubmittedUrlArgs {
  id: string;
  params: DocumentUploadStateParams;
}

export function getDocumentUploadSubmittedUrl({ id, params }: GetDocumentUploadSubmittedUrlArgs) {
  return getPathById('protected/documents/submitted', params) + `?id=${id}`;
}
