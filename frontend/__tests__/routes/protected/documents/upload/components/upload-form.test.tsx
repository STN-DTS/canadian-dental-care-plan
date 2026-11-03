import { useState } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Link, createRoutesStub, redirect } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { buttonSizeStyles, buttonVariantStyles } from '~/components/buttons';
import { TooltipProvider } from '~/components/tooltip';
import { useClientEnv } from '~/hooks/use-client-env';
import { useHints } from '~/hooks/use-hints';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/components/upload-form';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { useDocumentUploadForm } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';
import { getClientEnv } from '~/utils/env-utils';

const uploadId = '00000000-0000-0000-0000-000000000000';
const clientEnv = {
  ADOBE_ANALYTICS_JQUERY_SRC: 'https://code.jquery.com/jquery-3.7.1.min.js',
  ADOBE_ANALYTICS_SRC: undefined,
  DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'],
  DOCUMENT_UPLOAD_MAX_FILE_COUNT: 10,
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 5,
};
type UploadForm = ReturnType<typeof useDocumentUploadForm>;
type UploadDocument = UploadForm['documentUploadFormState']['documents'][number];

vi.mock(import('~/hooks/use-client-env'));
vi.mock(import('~/hooks/use-hints'));
vi.mock(import('~/utils/env-utils'));
vi.mock(import('remix-utils/csrf/react'), () => ({
  AuthenticityTokenInput: () => <input type="hidden" name="_csrf" value="test-token" />,
}));
vi.mock(import('~/routes/protected/documents/upload/hooks/use-document-upload-form'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useHints).mockReturnValue({ timeZone: 'America/Toronto' });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.mocked(useClientEnv, { partial: true }).mockReturnValue(clientEnv);
  vi.mocked(getClientEnv, { partial: true }).mockReturnValue(clientEnv);
});

function setDocuments(documents: ReadonlyArray<UploadDocument>, overrides: Partial<UploadForm> = {}) {
  const form = mock<UploadForm>({ documentUploadFormState: { documents }, hasUploadAttempted: false, isValidating: false, reviewState: 'closed', ...overrides });
  vi.mocked(useDocumentUploadForm).mockReturnValue(form);
  return form;
}

function setReviewableDocuments(documents: ReadonlyArray<UploadDocument>, options?: { onConfirmSubmit?: (form: HTMLFormElement) => void; onReviewSubmit?: () => void }) {
  const confirmSubmit = vi.fn<(form: HTMLFormElement) => void>();
  vi.mocked(useDocumentUploadForm).mockImplementation(() => {
    const [reviewState, setReviewState] = useState<UploadForm['reviewState']>('closed');
    return mock<UploadForm>({
      confirmSubmit: async (form) => {
        confirmSubmit(form);
        options?.onConfirmSubmit?.(form);
        setReviewState('submitting');
        await Promise.resolve();
      },
      dismissReview: () => setReviewState('closed'),
      documentUploadFormState: { documents },
      hasUploadAttempted: false,
      isValidating: false,
      reviewState,
      submitForm: async () => {
        options?.onReviewSubmit?.();
        setReviewState('reviewing');
        await Promise.resolve();
      },
    });
  });
  return confirmSubmit;
}

function createDocument(id: string, status: UploadDocument['status']): UploadDocument {
  const document = { id, file: new File([id], `${id}.txt`, { type: 'text/plain' }), documentType: 'receipt' };
  return status === 'uploaded' ? { ...document, status, uploadDate: '2026-11-01T06:30:00Z' } : { ...document, status };
}

function renderForm(language = 'en') {
  const RoutesStub = createRoutesStub([
    {
      path: '/:lang/protected/documents/upload/:id',
      Component: () => (
        <>
          <DocumentUploadForm documentTypes={[{ id: 'receipt', name: language === 'fr' ? 'Reçu' : 'Receipt' }]} />
          <Link to="/destination">Leave upload</Link>
        </>
      ),
    },
    { path: '/destination', Component: () => <h1>Destination</h1> },
  ]);
  return {
    ...render(<RoutesStub initialEntries={[`/${language}/protected/documents/upload/${uploadId}`]} />, { wrapper: TooltipProvider }),
    RoutesStub,
  };
}

describe('DocumentUploadForm', () => {
  it.each(['back', 'close', 'escape'] as const)('opens review after prevalidation and restores focus without uploading when dismissed with %s', async (action) => {
    const user = userEvent.setup();
    const confirmSubmit = setReviewableDocuments([createDocument('pending', 'pending')]);
    renderForm();
    const submitButton = screen.getByRole('button', { name: 'upload.submit' });

    await user.click(submitButton);

    const dialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    const backButton = within(dialog).getByRole('button', { name: 'upload.review.back' });
    await waitFor(() => expect(backButton).toHaveFocus());

    if (action === 'back') {
      await user.click(backButton);
    } else if (action === 'close') {
      await user.click(within(dialog).getByRole('button', { name: 'dialog.close' }));
    } else {
      await user.keyboard('{Escape}');
    }

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(confirmSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('listitem', { name: 'pending.txt' })).toBeInTheDocument();
    await waitFor(() => expect(submitButton).toHaveFocus());
  });

  it('reviews only pending documents with localized document types and ordered small footer actions', async () => {
    const user = userEvent.setup();
    setReviewableDocuments([createDocument('uploaded', 'uploaded'), createDocument('receipt', 'pending'), { ...createDocument('proof', 'pending'), documentType: 'proof' }]);
    const RoutesStub = createRoutesStub([
      {
        path: '/:lang/protected/documents/upload/:id',
        Component: () => (
          <DocumentUploadForm
            documentTypes={[
              { id: 'receipt', name: 'Receipt' },
              { id: 'proof', name: 'Proof of coverage' },
            ]}
          />
        ),
      },
    ]);
    render(<RoutesStub initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />, { wrapper: TooltipProvider });

    await user.click(screen.getByRole('button', { name: 'upload.submitRemaining' }));

    const dialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    expect(dialog).toHaveTextContent('receipt.txt, Receipt');
    expect(dialog).toHaveTextContent('proof.txt, Proof of coverage');
    expect(dialog).not.toHaveTextContent('uploaded.txt');
    const backButton = within(dialog).getByRole('button', { name: 'upload.review.back' });
    const reviewSubmitButton = within(dialog).getByRole('button', { name: 'upload.review.submit' });
    expect(backButton.parentElement).toHaveClass('flex-wrap-reverse', 'justify-end', 'gap-2');
    expect(backButton).toHaveClass(buttonVariantStyles.secondary, buttonSizeStyles.sm);
    expect(reviewSubmitButton).toHaveClass(buttonVariantStyles.primary, buttonSizeStyles.sm);
    expect(backButton.compareDocumentPosition(reviewSubmitButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps review open and prevents duplicate uploads while confirmation is busy', async () => {
    const user = userEvent.setup();
    const confirmSubmit = setReviewableDocuments([createDocument('pending', 'pending')]);
    renderForm();

    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    const dialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    const reviewSubmitButton = within(dialog).getByRole('button', { name: 'upload.review.submit' });
    await user.click(reviewSubmitButton);

    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'true'));
    const backButton = within(dialog).getByRole('button', { name: 'upload.review.back' });
    expect(reviewSubmitButton).toBeDisabled();
    expect(backButton).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'dialog.close' })).not.toBeInTheDocument();
    expect(confirmSubmit).toHaveBeenCalledExactlyOnceWith(expect.any(HTMLFormElement));

    await user.click(reviewSubmitButton);
    await user.keyboard('{Escape}');
    fireEvent.pointerDown(document.body);

    expect(confirmSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'upload.review.title' })).toBeInTheDocument();
  });

  it('closes review after a failed confirmed submission without restoring focus to the submit trigger', async () => {
    const user = userEvent.setup();
    vi.mocked(useDocumentUploadForm).mockImplementation(() => {
      const [reviewState, setReviewState] = useState<UploadForm['reviewState']>('closed');
      return mock<UploadForm>({
        confirmSubmit: async () => {
          setReviewState('submitting');
          window.setTimeout(() => {
            setReviewState('closed');
          });
          await Promise.resolve();
        },
        dismissReview: () => setReviewState('closed'),
        documentUploadFormState: { documents: [createDocument('pending', 'pending')] },
        hasUploadAttempted: false,
        isValidating: false,
        reviewState,
        submitForm: async () => {
          setReviewState('reviewing');
          await Promise.resolve();
        },
      });
    });
    renderForm();
    const submitButton = screen.getByRole('button', { name: 'upload.submit' });

    await user.click(submitButton);
    await user.click(await screen.findByRole('button', { name: 'upload.review.submit' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submitButton).not.toHaveFocus();
  });

  it.each(['keep', 'escape', 'close'])('keeps a pending file when removal is cancelled with %s', async (action) => {
    const user = userEvent.setup();
    const form = setDocuments([createDocument('pending', 'pending')]);
    renderForm();
    const removeButton = within(screen.getByRole('listitem', { name: 'pending.txt' })).getByRole('button', { name: 'upload.remove' });

    await user.click(removeButton);

    const dialog = await screen.findByRole('dialog', { name: 'upload.removeFileConfirmation.title' });
    expect(dialog).toHaveClass('sm:max-w-md');
    expect(dialog).toHaveAccessibleDescription(/pending\.txt/);
    expect(form.handleFileChange).not.toHaveBeenCalled();
    const keepButton = within(dialog).getByRole('button', { name: 'upload.removeFileConfirmation.keep' });
    expect(keepButton).toHaveClass(buttonVariantStyles.secondary, buttonSizeStyles.sm);
    await waitFor(() => expect(keepButton).toHaveFocus());

    if (action === 'escape') {
      await user.keyboard('{Escape}');
    } else {
      await user.click(action === 'keep' ? keepButton : within(dialog).getByRole('button', { name: 'dialog.close' }));
    }

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(form.handleFileChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listitem', { name: 'pending.txt' })).toBeInTheDocument();
    await waitFor(() => expect(removeButton).toHaveFocus());
  });

  it('removes only the selected pending file after explicit confirmation', async () => {
    const user = userEvent.setup();
    const form = setDocuments([createDocument('uploaded', 'uploaded'), createDocument('pending', 'pending'), createDocument('remaining', 'pending')]);
    renderForm();

    await user.click(within(screen.getByRole('listitem', { name: 'pending.txt' })).getByRole('button', { name: 'upload.remove' }));
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'upload.removeFileConfirmation.confirm' });
    expect(confirmButton).toHaveClass(buttonVariantStyles.primary, buttonSizeStyles.sm);
    await user.click(confirmButton);

    expect(form.handleFileChange).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: 'uploaded' }), expect.objectContaining({ id: 'remaining' })]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const uploadedList = screen.getByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' });
    const uploadedItem = within(uploadedList).getByRole('listitem');
    expect(within(uploadedItem).getByText('uploaded.txt', { exact: true })).toHaveRole('definition');
    expect(within(uploadedItem).queryByRole('button', { name: 'upload.remove' })).not.toBeInTheDocument();
  });

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
          const [reviewState, setReviewState] = useState<UploadForm['reviewState']>('closed');
          vi.mocked(useDocumentUploadForm).mockReturnValue(
            mock<UploadForm>({
              confirmSubmit: async (form) => {
                setReviewState('submitting');
                await fetcher.submit(form, { method: 'post' });
              },
              dismissReview: () => setReviewState('closed'),
              documentUploadFormState: { documents },
              hasUploadAttempted: false,
              isValidating: false,
              reviewState,
              submitForm: async () => {
                setReviewState('reviewing');
                await Promise.resolve();
              },
            }),
          );
          return <DocumentUploadForm documentTypes={[{ id: 'receipt', name: 'Receipt' }]} />;
        },
        action: () => redirect('/destination'),
      },
      { path: '/destination', Component: () => <h1>Destination</h1> },
    ]);
    render(<RoutesStub initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />, { wrapper: TooltipProvider });

    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    await user.click(await screen.findByRole('button', { name: 'upload.review.submit' }));

    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('names and describes the uploaded-only region and submits finish from its confirmation button', async () => {
    const user = userEvent.setup();
    const form = setDocuments([createDocument('first', 'uploaded'), createDocument('last', 'uploaded')]);
    renderForm();

    const region = screen.getByRole('region', { name: JSON.stringify({ key: 'upload.uploadFiles.uploadedFiles', options: { count: 2 } }) });
    expect(region).toHaveAccessibleDescription('upload.uploadFiles.documentsSent upload.uploadFiles.noPendingFiles');
    expect(region).toHaveAttribute('tabindex', '-1');
    const confirmationButton = within(region).getByRole('button', { name: 'upload.viewSubmissionConfirmation' });
    expect(confirmationButton).toHaveAttribute('type', 'submit');
    expect(confirmationButton).toHaveAttribute('name', '_action');
    expect(confirmationButton).toHaveAttribute('value', 'finish');
    await user.click(confirmationButton);
    expect(form.submitForm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'upload.review.title' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'upload.submitRemaining' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'upload.addFile' })).toBeEnabled();
    const uploadedList = screen.getByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' });
    const uploadedItems = within(uploadedList).getAllByRole('listitem');
    expect(uploadedItems).toHaveLength(2);
    uploadedItems.forEach((item, index) => {
      const id = index === 0 ? 'first' : 'last';
      expect(item).toHaveAttribute('id', `file-upload-item-${id}`);
      expect(item).toHaveAccessibleName('');
      expect(within(item).getByText(`${id}.txt`, { exact: true })).toHaveRole('definition');
      expect(within(item).getByText(`${id}.txt`, { exact: true })).toHaveAttribute('id', `file-upload-item-${id}-name`);
    });
  });

  it.each([
    ['en', 'Receipt'],
    ['fr', 'Reçu'],
  ])('exposes uploaded file details in an ordered definition list without primitive labels or read-only controls in %s', (language, documentTypeName) => {
    setDocuments([createDocument('receipt', 'uploaded'), { ...createDocument('unavailable', 'uploaded'), documentType: 'unavailable' }]);
    renderForm(language);

    const uploadedList = screen.getByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' });
    const items = within(uploadedList).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    items.forEach((item, index) => {
      const id = index === 0 ? 'receipt' : 'unavailable';
      const typeName = index === 0 ? documentTypeName : 'upload.documentTypeUnavailable';
      expect(item).toHaveAttribute('id', `file-upload-item-${id}`);
      expect(item).not.toHaveAttribute('aria-label');
      expect(item).not.toHaveAttribute('aria-labelledby');
      expect(item).not.toHaveAttribute('aria-describedby');
      expect(item).toHaveAccessibleName('');
      expect(item).toHaveAccessibleDescription('');

      const details = item.querySelector('dl');
      expect(details).toBeInTheDocument();
      const terms = within(details!).getAllByRole('term');
      const definitions = within(details!).getAllByRole('definition');
      expect(terms.map((term) => term.textContent)).toEqual(['upload.fileName', 'upload.documentType: ', 'upload.uploadedOn ', 'upload.status']);
      expect(definitions.map((definition) => definition.textContent)).toEqual([`${id}.txt`, typeName, 'November 1, 2026 at 1:30 a.m. EST', 'upload.uploadedSuccessfully']);
      expect(Array.from(details!.querySelectorAll('dt, dd'))).toEqual([terms[0], definitions[0], terms[1], definitions[1], terms[2], definitions[2], terms[3], definitions[3]]);
      expect(terms[0]).toHaveClass('sr-only');
      expect(definitions[0]).toHaveAttribute('id', `file-upload-item-${id}-name`);
      expect(terms[1]).toBeVisible();
      expect(terms[1]).not.toHaveClass('sr-only');
      expect(definitions[1]).toBeVisible();
      expect(definitions[1]).not.toHaveClass('sr-only');
      expect(definitions[2]).toBeVisible();
      expect(definitions[2]!.querySelector('time')).toHaveAttribute('datetime', '2026-11-01T06:30:00Z');
      expect(definitions[3]!.parentElement).toHaveClass('sr-only');
      expect(definitions[3]).not.toHaveAttribute('id');
      expect(within(item).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(item).queryByRole('button')).not.toBeInTheDocument();
      expect(item.querySelector('input, select, textarea')).not.toBeInTheDocument();
    });
  });

  it('shows independent uploaded and remaining counts and restores submission when a pending file is added', () => {
    const uploaded = [createDocument('first', 'uploaded'), createDocument('last', 'uploaded')];
    setDocuments(uploaded);
    const { rerender, RoutesStub } = renderForm();
    expect(screen.getByRole('button', { name: 'upload.viewSubmissionConfirmation' })).toBeInTheDocument();

    setDocuments([...uploaded, createDocument('replacement', 'pending')]);
    rerender(<RoutesStub key="pending" initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />);

    expect(screen.getByRole('status').querySelectorAll('p')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.uploadedFiles', options: { count: 2 } }));
    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.pendingFiles', options: { count: 1 } }));
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('button', { name: 'upload.submitRemaining' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'upload.viewSubmissionConfirmation' })).not.toBeInTheDocument();
  });

  it('renders independent mixed-upload count keys and the retry action on the French route', () => {
    setDocuments([createDocument('first', 'uploaded'), createDocument('second', 'pending'), createDocument('third', 'pending')]);
    renderForm('fr');

    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.uploadedFiles', options: { count: 1 } }));
    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.pendingFiles', options: { count: 2 } }));
    expect(screen.getByRole('button', { name: 'upload.submitRemaining' })).toBeInTheDocument();
  });

  it.each([0, 1, 3])('announces only the selected count before any upload attempt with %i files', (count) => {
    setDocuments(Array.from({ length: count }, (_, index) => createDocument(`selected-${index}`, 'pending')));
    renderForm();

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status.querySelectorAll('p')).toHaveLength(1);
    expect(status).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.filesSelected', options: { count } }));
    expect(screen.queryByRole('heading', { name: 'upload.uploadFiles.uploadedFilesHeading' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'upload.uploadFiles.pendingFilesHeading' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('listitem', { name: /selected-\d\.txt/ })).toHaveLength(count);
  });

  it('announces zero uploaded and every pending file after an all-failed attempt', () => {
    setDocuments([createDocument('first', 'pending'), createDocument('second', 'pending')], { hasUploadAttempted: true });
    renderForm();

    const status = screen.getByRole('status');
    expect(Array.from(status.querySelectorAll('p'), (paragraph) => paragraph.textContent)).toEqual([
      JSON.stringify({ key: 'upload.uploadFiles.uploadedFiles', options: { count: 0 } }),
      JSON.stringify({ key: 'upload.uploadFiles.pendingFiles', options: { count: 2 } }),
    ]);
    const pendingList = screen.getByRole('list', { name: 'upload.uploadFiles.pendingFilesHeading' });
    expect(pendingList).toHaveAttribute('id', 'pending-files-list');
    expect(within(pendingList).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'upload.uploadFiles.uploadedFilesHeading' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'upload.viewSubmissionConfirmation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'upload.submit' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'upload.addFile' })).toBeEnabled();
  });

  it('groups interleaved successes first with stable group order, group-relative ARIA, errors, and editable pending controls', async () => {
    const user = userEvent.setup();
    const documents = [createDocument('pending-first', 'pending'), createDocument('uploaded-first', 'uploaded'), createDocument('pending-last', 'pending'), createDocument('uploaded-last', 'uploaded')];
    const form = setDocuments(documents, {
      actionData: {
        formAction: 'upload',
        source: 'server',
        responseType: 'upload-errors',
        documents: documents.map(({ id, file, documentType, status }) => ({ id, fileName: file.name, fileSize: file.size, documentType, status })),
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['Some files were not uploaded'],
              properties: {
                'pending-first': { errors: [], properties: { file: { errors: ['Security check failed'] }, documentType: { errors: [] } } },
                'pending-last': { errors: [], properties: { file: { errors: [] }, documentType: { errors: ['Choose a different document type'] } } },
              },
            },
          },
        },
      },
    });
    renderForm();

    const uploadedList = screen.getByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' });
    const pendingList = screen.getByRole('list', { name: 'upload.uploadFiles.pendingFilesHeading' });
    expect(uploadedList).toHaveAttribute('id', 'uploaded-files-list');
    expect(pendingList).toHaveAttribute('id', 'pending-files-list');
    expect(screen.getByRole('heading', { name: 'upload.uploadFiles.uploadedFilesHeading' })).toHaveAttribute('id', 'uploaded-files-heading');
    expect(screen.getByRole('heading', { name: 'upload.uploadFiles.pendingFilesHeading' })).toHaveAttribute('id', 'pending-files-heading');
    expect(uploadedList).toHaveAttribute('aria-labelledby', 'uploaded-files-heading');
    expect(pendingList).toHaveAttribute('aria-labelledby', 'pending-files-heading');
    expect(uploadedList.compareDocumentPosition(pendingList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const [list, names] of [
      [uploadedList, ['uploaded-first.txt', 'uploaded-last.txt']],
      [pendingList, ['pending-first.txt', 'pending-last.txt']],
    ] as const) {
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      items.forEach((item, index) => {
        expect(item).toHaveAccessibleName(list === pendingList ? names[index] : '');
        expect(within(item).getByText(names[index]!, { exact: true })).toHaveRole('definition');
        expect(item).not.toHaveAttribute('aria-posinset');
        expect(item).not.toHaveAttribute('aria-setsize');
      });
    }

    for (const item of within(uploadedList).getAllByRole('listitem')) {
      expect(item).toHaveAccessibleDescription('');
      expect(item).toHaveClass('border-green-700', 'p-4');
      expect(within(item).getByText('upload.uploadedSuccessfully').parentElement).toHaveClass('sr-only');
      expect(within(item).getByText('Receipt')).toBeInTheDocument();
      expect(within(item).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(item).queryByRole('button')).not.toBeInTheDocument();
      expect(item.querySelector('time')).toHaveAttribute('datetime', '2026-11-01T06:30:00Z');
    }

    const firstPending = within(pendingList).getByRole('listitem', { name: 'pending-first.txt' });
    expect(within(firstPending).getByText('Security check failed')).toHaveAttribute('role', 'alert');
    expect(firstPending).toHaveClass('border-red-500');
    const lastPending = within(pendingList).getByRole('listitem', { name: 'pending-last.txt' });
    const select = within(lastPending).getByRole('combobox', { name: 'upload.documentType' });
    expect(select).toHaveValue('receipt');
    expect(select).toHaveAttribute('aria-errormessage', 'input-document-type-pending-last-error');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(within(lastPending).getByText('Choose a different document type')).toHaveAttribute('role', 'alert');
    expect(within(lastPending).getByRole('button', { name: 'upload.remove' })).toBeEnabled();
    await user.selectOptions(select, 'receipt');
    expect(form.handleDocumentTypeChange).toHaveBeenCalledExactlyOnceWith('pending-last', 'receipt');
    expect(screen.getByRole('button', { name: 'upload.addFile' })).toHaveAccessibleDescription(/Some files were not uploaded/);
    expect(form.documentUploadFormState.documents).toEqual(documents);
  });
});
