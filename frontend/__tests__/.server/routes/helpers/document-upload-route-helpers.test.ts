import { createMemoryRouter } from 'react-router';

import { Option } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { finishDocumentUploadState, loadDocumentUploadState, recordDocumentUploadAttempt, resetDocumentUploadState, startDocumentUploadState, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { DocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { deleteDocumentUploadState, findDocumentUploadState, setDocumentUploadState } from '~/.server/routes/helpers/document-upload-state-storage';
import type { Session } from '~/.server/web/session';

vi.mock(import('~/.server/routes/helpers/document-upload-state-storage'));

const uploadId = '00000000-0000-0000-0000-000000000000';
const params = { lang: 'en' };
const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', fileSize: 8, documentType: 'receipt', status: 'uploaded' as const };
const session = mock<Session>({ id: 'session-a' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setDocumentUploadState).mockResolvedValue();
  vi.mocked(deleteDocumentUploadState).mockResolvedValue();
});

describe('document upload lifecycle', () => {
  it.each([
    { lang: 'en', destination: '/en/protected/documents', id: uploadId },
    { lang: 'fr', destination: '/fr/protege/documents', id: uploadId },
    { lang: 'en', destination: '/en/protected/documents', id: null },
    { lang: 'fr', destination: '/fr/protege/documents', id: null },
    { lang: 'en', destination: '/en/protected/documents', id: 'invalid-id' },
    { lang: 'fr', destination: '/fr/protege/documents', id: 'invalid-id' },
  ])('replaces an unavailable $lang upload flow ($id) with the listing without retaining the expired URL', async ({ lang, destination, id }) => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.none());
    const router = createMemoryRouter([{ path: '/before' }, { path: '/expired', loader: async () => await loadDocumentUploadState({ id, params: { lang }, session }) }, { path: destination }], { initialEntries: ['/before', '/expired'], initialIndex: 1 });

    try {
      await vi.waitFor(() => expect(router.state.location.pathname).toBe(destination));
      expect(router.state.historyAction).toBe('REPLACE');
      await router.navigate(-1);
      expect(router.state.location.pathname).toBe('/before');
    } finally {
      router.dispose();
    }
  });

  it('starts initialized with no document metadata', async () => {
    await expect(startDocumentUploadState({ id: uploadId, session })).resolves.toEqual({ id: uploadId, status: 'initialized', documents: [] });
  });

  it('resets an open flow and clears pending and uploaded metadata', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [{ ...uploadedDocument, id: 'pending', status: 'pending' }, uploadedDocument] }));

    const state = await resetDocumentUploadState({ id: uploadId, session, params });

    expect(state).toEqual({ id: uploadId, status: 'initialized', documents: [] });
    expect(setDocumentUploadState).toHaveBeenCalledExactlyOnceWith(session, uploadId, state);
  });

  it('does not reset a finished flow', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'finished', documents: [uploadedDocument] }));

    await expect(resetDocumentUploadState({ id: uploadId, session, params })).rejects.toThrow();
    expect(setDocumentUploadState).not.toHaveBeenCalled();
  });

  it('remains initialized when the document list contains only pending files', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'initialized', documents: [] }));
    const documents = [{ ...uploadedDocument, id: 'pending', status: 'pending' as const }];

    const state = await updateDocumentUploadState({ id: uploadId, session, params, state: { documents } });

    expect(state.status).toBe('initialized');
    expect(state.documents).toEqual(documents);
  });

  it('remains partial-upload when removal leaves successful uploads and no pending files', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument] }));

    const state = await updateDocumentUploadState({ id: uploadId, session, params, state: { documents: [uploadedDocument] } });

    expect(state.status).toBe('partial-upload');
  });

  it('finishes only after an explicit completion event with successful uploads and no pending files', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument] }));

    const state = await finishDocumentUploadState({ id: uploadId, session, params });

    expect(state.status).toBe('finished');
    expect(setDocumentUploadState).toHaveBeenCalledWith(session, uploadId, expect.objectContaining({ status: 'finished', documents: [uploadedDocument] }));
  });

  it.each<DocumentUploadState>([
    { id: uploadId, status: 'initialized', documents: [] },
    { id: uploadId, status: 'partial-upload', documents: [{ ...uploadedDocument, id: 'pending', status: 'pending' }, uploadedDocument] },
  ])('rejects completion without successful uploads or while pending files remain', async (state) => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some(state));

    await expect(finishDocumentUploadState({ id: uploadId, session, params })).rejects.toThrow();
    expect(setDocumentUploadState).not.toHaveBeenCalled();
  });

  it('loads the lifecycle status from an existing session record', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument] }));

    await expect(loadDocumentUploadState({ id: uploadId, session, params })).resolves.toMatchObject({ status: 'partial-upload' });
  });

  it.each([
    { previous: undefined, expected: 1 },
    { previous: 2, expected: 3 },
  ])('records upload attempt $expected after $previous earlier attempts', async ({ previous, expected }) => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument], uploadAttemptCount: previous }));

    await expect(recordDocumentUploadAttempt({ id: uploadId, session, params })).resolves.toBe(expected);
    expect(setDocumentUploadState).toHaveBeenCalledExactlyOnceWith(session, uploadId, { id: uploadId, status: 'partial-upload', documents: [uploadedDocument], uploadAttemptCount: expected });
  });

  it('does not record an attempt on a finished flow', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'finished', documents: [uploadedDocument], uploadAttemptCount: 1 }));

    await expect(recordDocumentUploadAttempt({ id: uploadId, session, params })).rejects.toThrow();
    expect(setDocumentUploadState).not.toHaveBeenCalled();
  });

  it('keeps the attempt count when the flow is reset or updated', async () => {
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument], uploadAttemptCount: 2 }));

    await expect(resetDocumentUploadState({ id: uploadId, session, params })).resolves.toMatchObject({ uploadAttemptCount: 2 });
    await expect(updateDocumentUploadState({ id: uploadId, session, params, state: { documents: [] } })).resolves.toMatchObject({ uploadAttemptCount: 2 });
  });

  it('preserves successful ISO timestamps through session serialization and completion', async () => {
    const documents = [
      { ...uploadedDocument, uploadDate: '2026-11-01T05:30:00Z' },
      { ...uploadedDocument, id: 'retry', uploadDate: '2026-11-01T06:30:00Z' },
    ];
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some({ id: uploadId, status: 'partial-upload', documents: [] }));
    const updatedState = await updateDocumentUploadState({ id: uploadId, session, params, state: { documents } });
    const serializedState = JSON.parse(JSON.stringify(updatedState)) as DocumentUploadState;
    vi.mocked(findDocumentUploadState).mockResolvedValue(Option.some(serializedState));

    await expect(loadDocumentUploadState({ id: uploadId, session, params })).resolves.toMatchObject({ documents });
    await expect(finishDocumentUploadState({ id: uploadId, session, params })).resolves.toMatchObject({ documents });
  });
});
