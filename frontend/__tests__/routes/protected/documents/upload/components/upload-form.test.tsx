import { render, screen, within } from '@testing-library/react';

import { createRoutesStub } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { useClientEnv } from '~/hooks/use-client-env';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/components/upload-form';
import { useDocumentUploadForm } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';

const uploadId = '00000000-0000-0000-0000-000000000000';
type UploadForm = ReturnType<typeof useDocumentUploadForm>;
type UploadDocument = UploadForm['documentUploadFormState']['documents'][number];

vi.mock(import('~/hooks/use-client-env'));
vi.mock(import('remix-utils/csrf/react'), () => ({
  AuthenticityTokenInput: () => <input type="hidden" name="_csrf" value="test-token" />,
}));
vi.mock(import('~/routes/protected/documents/upload/hooks/use-document-upload-form'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useClientEnv, { partial: true }).mockReturnValue({ DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'], DOCUMENT_UPLOAD_MAX_FILE_COUNT: 10, DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 5 });
});

function setDocuments(documents: ReadonlyArray<UploadDocument>) {
  vi.mocked(useDocumentUploadForm).mockReturnValue(mock<UploadForm>({ documentUploadFormState: { documents } }));
}

function createDocument(id: string, status: UploadDocument['status']): UploadDocument {
  return { id, file: new File([id], `${id}.txt`, { type: 'text/plain' }), documentType: 'receipt', status };
}

function renderForm(language = 'en') {
  const RoutesStub = createRoutesStub([
    {
      path: '/:lang/protected/documents/upload/:id',
      Component: () => <DocumentUploadForm documentTypes={[{ id: 'receipt', name: 'Receipt' }]} />,
    },
  ]);
  return {
    ...render(<RoutesStub initialEntries={[`/${language}/protected/documents/upload/${uploadId}`]} />),
    RoutesStub,
  };
}

describe('DocumentUploadForm', () => {
  it('names and describes the uploaded-only region and places confirmation inside it', () => {
    setDocuments([createDocument('first', 'uploaded'), createDocument('last', 'uploaded')]);
    renderForm();

    const region = screen.getByRole('region', { name: /upload.uploadFiles.uploadedFiles/ });
    expect(region).toHaveAccessibleDescription('upload.uploadFiles.documentsSent upload.uploadFiles.noPendingFiles');
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(within(region).getByRole('link', { name: 'upload.viewSubmissionConfirmation' })).toHaveAttribute('href', `/en/protected/documents/upload/${uploadId}/submitted`);
    expect(screen.queryByRole('button', { name: 'upload.submitRemaining' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'upload.addFile' })).toBeEnabled();
    expect(screen.getAllByRole('listitem', { name: /\.txt$/ }).map((item) => item.getAttribute('aria-labelledby'))).toEqual(['file-upload-item-first-name', 'file-upload-item-last-name']);
  });

  it('shows independent uploaded and remaining counts and restores submission when a pending file is added', () => {
    const uploaded = [createDocument('first', 'uploaded'), createDocument('last', 'uploaded')];
    setDocuments(uploaded);
    const { rerender, RoutesStub } = renderForm();
    expect(screen.getByRole('link', { name: 'upload.viewSubmissionConfirmation' })).toBeInTheDocument();

    setDocuments([...uploaded, createDocument('replacement', 'pending')]);
    rerender(<RoutesStub key="pending" initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />);

    expect(screen.getByRole('status')).toHaveTextContent(/upload.uploadFiles.filesSelected.*\..*upload.uploadFiles.uploadedFiles.*\..*upload.uploadFiles.pendingFiles/);
    expect(screen.getByRole('button', { name: 'upload.submitRemaining' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'upload.viewSubmissionConfirmation' })).not.toBeInTheDocument();
  });

  it('localizes mixed-upload counts and the retry action in French', () => {
    setDocuments([createDocument('first', 'uploaded'), createDocument('second', 'pending'), createDocument('third', 'pending')]);
    renderForm('fr');

    expect(screen.getByRole('status')).toHaveTextContent(/upload.uploadFiles.filesSelected.*\..*upload.uploadFiles.uploadedFiles.*\..*upload.uploadFiles.pendingFiles/);
    expect(screen.getByRole('button', { name: 'upload.submitRemaining' })).toBeInTheDocument();
  });
});
