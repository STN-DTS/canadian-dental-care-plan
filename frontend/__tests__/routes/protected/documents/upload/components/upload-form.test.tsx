import { useState } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Link, createRoutesStub, redirect } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { buttonSizeStyles, buttonVariantStyles } from '~/components/buttons';
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
  const form = mock<UploadForm>({ documentUploadFormState: { documents }, isValidating: false, reviewState: 'closed' });
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
    render(<RoutesStub initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />);

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
    expect(within(screen.getByRole('listitem', { name: 'uploaded.txt' })).queryByRole('button', { name: 'upload.remove' })).not.toBeInTheDocument();
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
    render(<RoutesStub initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />);

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

    const region = screen.getByRole('region', { name: /upload.uploadFiles.uploadedFiles/ });
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
    expect(screen.getAllByRole('listitem', { name: /\.txt$/ }).map((item) => item.getAttribute('aria-labelledby'))).toEqual(['file-upload-item-first-name', 'file-upload-item-last-name']);
  });

  it('shows independent uploaded and remaining counts and restores submission when a pending file is added', () => {
    const uploaded = [createDocument('first', 'uploaded'), createDocument('last', 'uploaded')];
    setDocuments(uploaded);
    const { rerender, RoutesStub } = renderForm();
    expect(screen.getByRole('button', { name: 'upload.viewSubmissionConfirmation' })).toBeInTheDocument();

    setDocuments([...uploaded, createDocument('replacement', 'pending')]);
    rerender(<RoutesStub key="pending" initialEntries={[`/en/protected/documents/upload/${uploadId}`]} />);

    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.uploadProgress', options: { maximum: 10, selected: 3, uploaded: 2, pending: 1 } }));
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('button', { name: 'upload.submitRemaining' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'upload.viewSubmissionConfirmation' })).not.toBeInTheDocument();
  });

  it('localizes mixed-upload counts and the retry action in French', () => {
    setDocuments([createDocument('first', 'uploaded'), createDocument('second', 'pending'), createDocument('third', 'pending')]);
    renderForm('fr');

    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify({ key: 'upload.uploadFiles.uploadProgress', options: { maximum: 10, selected: 3, uploaded: 1, pending: 2 } }));
    expect(screen.getByRole('button', { name: 'upload.submitRemaining' })).toBeInTheDocument();
  });
});
