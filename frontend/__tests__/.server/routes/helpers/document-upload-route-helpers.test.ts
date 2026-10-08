import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { finishDocumentUploadState, loadDocumentUploadState, resetDocumentUploadState, startDocumentUploadState, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { DocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { Session } from '~/.server/web/session';

const uploadId = '00000000-0000-0000-0000-000000000000';
const params = { lang: 'en' };
const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', fileSize: 8, documentType: 'receipt', status: 'uploaded' as const };
const session = mock<Session>();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(session.has).mockReturnValue(true);
});

describe('document upload lifecycle', () => {
  it('starts initialized with no document metadata', () => {
    expect(startDocumentUploadState({ id: uploadId, session })).toEqual({ id: uploadId, status: 'initialized', documents: [] });
  });

  it('resets an open flow and clears pending and uploaded metadata', () => {
    vi.mocked(session.get).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [{ ...uploadedDocument, id: 'pending', status: 'pending' }, uploadedDocument] });

    const state = resetDocumentUploadState({ id: uploadId, session, params });

    expect(state).toEqual({ id: uploadId, status: 'initialized', documents: [] });
    expect(session.set).toHaveBeenCalledExactlyOnceWith(`document-upload-flow-${uploadId}`, state);
  });

  it('does not reset a finished flow', () => {
    vi.mocked(session.get).mockReturnValue({ id: uploadId, status: 'finished', documents: [uploadedDocument] });

    expect(() => resetDocumentUploadState({ id: uploadId, session, params })).toThrow();
    expect(session.set).not.toHaveBeenCalled();
  });

  it('remains initialized when the document list contains only pending files', () => {
    vi.mocked(session.get).mockReturnValue({ id: uploadId, status: 'initialized', documents: [] });
    const documents = [{ ...uploadedDocument, id: 'pending', status: 'pending' as const }];

    const state = updateDocumentUploadState({ id: uploadId, session, params, state: { documents } });

    expect(state.status).toBe('initialized');
    expect(state.documents).toEqual(documents);
  });

  it('remains partial-upload when removal leaves successful uploads and no pending files', () => {
    vi.mocked(session.get).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument] });

    const state = updateDocumentUploadState({ id: uploadId, session, params, state: { documents: [uploadedDocument] } });

    expect(state.status).toBe('partial-upload');
  });

  it('finishes only after an explicit completion event with successful uploads and no pending files', () => {
    vi.mocked(session.get).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument] });

    const state = finishDocumentUploadState({ id: uploadId, session, params });

    expect(state.status).toBe('finished');
    expect(session.set).toHaveBeenCalledWith(`document-upload-flow-${uploadId}`, expect.objectContaining({ status: 'finished', documents: [uploadedDocument] }));
  });

  it.each<DocumentUploadState>([
    { id: uploadId, status: 'initialized', documents: [] },
    { id: uploadId, status: 'partial-upload', documents: [{ ...uploadedDocument, id: 'pending', status: 'pending' }, uploadedDocument] },
  ])('rejects completion without successful uploads or while pending files remain', (state) => {
    vi.mocked(session.get).mockReturnValue(state);

    expect(() => finishDocumentUploadState({ id: uploadId, session, params })).toThrow();
    expect(session.set).not.toHaveBeenCalled();
  });

  it('loads the lifecycle status from an existing session record', () => {
    vi.mocked(session.get).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument] });

    expect(loadDocumentUploadState({ id: uploadId, session, params }).status).toBe('partial-upload');
  });
});
