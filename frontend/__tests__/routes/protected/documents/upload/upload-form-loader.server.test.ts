import { RouterContextProvider } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockFn } from 'vitest-mock-extended';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { getUser } from '~/.server/context/user-context';
import { loadDocumentUploadState, resetDocumentUploadState, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { DocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { loader } from '~/routes/protected/documents/upload/upload-form-loader.server';

vi.mock(import('~/.server/context/user-context'));
vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'));
vi.mock(import('~/.server/utils/locale-utils'));

const uploadId = '00000000-0000-0000-0000-000000000000';
const session = mock<Session>();
const appContainer = mock<AppContext['appContainer']>();
const state: DocumentUploadState = {
  id: uploadId,
  status: 'partial-upload',
  pendingDocuments: [{ id: 'pending' }],
  uploadedDocuments: [{ id: 'uploaded', fileName: 'uploaded.txt', documentType: 'receipt', fileSize: 8 }],
};
const emptyState: DocumentUploadState = { id: uploadId, status: 'initialized', pendingDocuments: [], uploadedDocuments: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadDocumentUploadState).mockReturnValue(state);
  vi.mocked(updateDocumentUploadState).mockReturnValue(emptyState);
  vi.mocked(resetDocumentUploadState).mockReturnValue(emptyState);
  vi.mocked(getLocale).mockReturnValue('en');
  vi.mocked(getFixedT).mockResolvedValue(mockFn<Awaited<ReturnType<typeof getFixedT>>>().mockReturnValue('Upload documents'));
  vi.mocked(getUser).mockReturnValue(mock<ReturnType<typeof getUser>>({ id: 'user' }));
  appContainer.get.calledWith(TYPES.EvidentiaryDocumentTypeService).mockReturnValue({ listLocalizedEvidentiaryDocumentTypesByStatus: vi.fn().mockResolvedValue([]) });
  appContainer.get.calledWith(TYPES.ClientConfig).mockReturnValue({ SCCH_BASE_URI: 'http://localhost/dashboard' });
  appContainer.get.calledWith(TYPES.AuditService).mockReturnValue({ createAudit: vi.fn() });
});

function createArgs(destination: string): Parameters<typeof loader>[0] {
  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session });
  const url = new URL(`http://localhost/en/protected/documents/upload/${uploadId}`);
  return { context, params: { id: uploadId, lang: 'en' }, url, request: new Request(url, { headers: { 'Sec-Fetch-Dest': destination } }), pattern: '/:lang/protected/documents/upload/:id' };
}

describe('upload form loader reset handling', () => {
  it('clears pending and uploaded metadata when the document is refreshed', async () => {
    const args = createArgs('document');

    const result = await loader(args);

    expect(resetDocumentUploadState).toHaveBeenCalledWith({ id: uploadId, session, params: args.params });
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(result.documentUploadState).toEqual(emptyState);
  });

  it('also clears flow metadata on data requests and returns initialized state', async () => {
    const args = createArgs('empty');
    const result = await loader(args);

    expect(resetDocumentUploadState).toHaveBeenCalledWith({ id: uploadId, session, params: args.params });
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(result.documentUploadState).toEqual(emptyState);
    expect(loadDocumentUploadState).not.toHaveBeenCalled();
  });
});
