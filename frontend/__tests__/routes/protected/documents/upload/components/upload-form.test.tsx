import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Link, createRoutesStub, redirect } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { useClientEnv } from '~/hooks/use-client-env';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/components/upload-form';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
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
      Component: () => (
        <>
          <DocumentUploadForm documentTypes={[{ id: 'receipt', name: 'Receipt' }]} />
          <Link to="/destination">Leave upload</Link>
        </>
      ),
    },
    { path: '/destination', Component: () => <h1>Destination</h1> },
  ]);
  return {
    ...render(<RoutesStub initialEntries={[`/${language}/protected/documents/upload/${uploadId}`]} />),
    RoutesStub,
  };
}

describe('DocumentUploadForm', () => {
  it('keeps pending files when the user cancels navigation and restores focus', async () => {
    const user = userEvent.setup();
    setDocuments([createDocument('uploaded', 'uploaded'), createDocument('pending', 'pending')]);
    renderForm();
    const leaveLink = screen.getByRole('link', { name: 'Leave upload' });

    await user.click(leaveLink);

    const dialog = await screen.findByRole('dialog', { name: 'upload.unsavedChanges.title' });
    expect(dialog).toHaveAccessibleDescription('upload.unsavedChanges.description');
    const stayButton = within(dialog).getByRole('button', { name: 'upload.unsavedChanges.stay' });
    await waitFor(() => expect(stayButton).toHaveFocus());
    await user.click(stayButton);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Destination' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'pending.txt' })).toBeInTheDocument();
    await waitFor(() => expect(leaveLink).toHaveFocus());
  });

  it('cancels navigation when the dialog is dismissed with Escape', async () => {
    const user = userEvent.setup();
    setDocuments([createDocument('pending', 'pending')]);
    renderForm();

    await user.click(screen.getByRole('link', { name: 'Leave upload' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Destination' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'pending.txt' })).toBeInTheDocument();
  });

  it('keeps pending files when the dialog close button is used', async () => {
    const user = userEvent.setup();
    setDocuments([createDocument('pending', 'pending')]);
    renderForm();

    await user.click(screen.getByRole('link', { name: 'Leave upload' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'dialog.close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('listitem', { name: 'pending.txt' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Destination' })).not.toBeInTheDocument();
  });

  it('proceeds to the blocked destination only after explicit confirmation', async () => {
    const user = userEvent.setup();
    setDocuments([createDocument('pending', 'pending')]);
    renderForm();

    await user.click(screen.getByRole('link', { name: 'Leave upload' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'upload.unsavedChanges.leave' }));

    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument();
  });

  it.each(['empty', 'uploaded-only'])('allows navigation without a dialog when the form is %s', async (caseName) => {
    const user = userEvent.setup();
    setDocuments(caseName === 'empty' ? [] : [createDocument('uploaded', 'uploaded')]);
    renderForm();

    await user.click(screen.getByRole('link', { name: 'Leave upload' }));

    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['empty', 'uploaded-only', 'pending'])('guards browser unloads only when documents are pending: %s', (caseName) => {
    setDocuments(caseName === 'empty' ? [] : [createDocument('document', caseName === 'pending' ? 'pending' : 'uploaded')]);
    renderForm();
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(caseName === 'pending');
  });

  it('does not block the confirmation redirect after a successful upload submission', async () => {
    const user = userEvent.setup();
    const documents = [createDocument('pending', 'pending')];
    const RoutesStub = createRoutesStub([
      {
        path: '/:lang/protected/documents/upload/:id',
        Component: function UploadRoute() {
          const fetcher = useDocumentUploadFetcher();
          vi.mocked(useDocumentUploadForm).mockReturnValue(
            mock<UploadForm>({
              documentUploadFormState: { documents },
              submitForm: (form) => {
                void fetcher.submit(form, { method: 'post' });
              },
            }),
          );
          return <DocumentUploadForm documentTypes={[{ id: 'receipt', name: 'Receipt' }]} />;
        },
        action: () => redirect('/destination'),
      },
      { path: '/destination', Component: () => <h1>Destination</h1> },
    ]);
    render(<RoutesStub initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />);

    await user.click(screen.getByRole('button', { name: 'upload.submit' }));

    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

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
