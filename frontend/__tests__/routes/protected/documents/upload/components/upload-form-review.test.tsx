import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createRoutesStub, redirect } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientEnv } from '~/hooks/use-client-env';
import { getFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/components/upload-form';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { getClientEnv } from '~/utils/env-utils';

const uploadId = '00000000-0000-0000-0000-000000000000';
const clientEnv = {
  ADOBE_ANALYTICS_JQUERY_SRC: 'https://code.jquery.com/jquery-3.7.1.min.js',
  ADOBE_ANALYTICS_SRC: undefined,
  DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'],
  DOCUMENT_UPLOAD_MAX_FILE_COUNT: 10,
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 5,
};

vi.mock(import('~/hooks/use-client-env'));
vi.mock(import('~/utils/env-utils'));
vi.mock(import('remix-utils/csrf/react'), () => ({
  AuthenticityTokenInput: () => <input type="hidden" name="_csrf" value="test-token" />,
}));
vi.mock(import('~/route-helpers/protected-documents-upload-helpers'), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    getFiles: vi.fn(async (formData: FormData) => {
      const ids = formData.getAll('file_id') as string[];
      const files = formData.getAll('file_object') as File[];
      const documentTypes = formData.getAll('file_document_type') as string[];
      return await Promise.resolve(new Map(ids.map((id, index) => [id, { file: files[index]!, fileBuffer: new ArrayBuffer(1), fileHash: `hash-${id}`, documentType: documentTypes[index] ?? '' }])));
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.mocked(useClientEnv, { partial: true }).mockReturnValue(clientEnv);
  vi.mocked(getClientEnv, { partial: true }).mockReturnValue(clientEnv);
});

function renderForm(action: (args: { request: Request }) => Promise<unknown> | unknown, language = 'en') {
  const RoutesStub = createRoutesStub([
    {
      path: '/:lang/protected/documents/upload/:id',
      Component: () => <DocumentUploadForm documentTypes={[{ id: 'receipt', name: language === 'fr' ? 'Reçu' : 'Receipt' }]} />,
      action,
    },
    { path: '/confirmation', Component: () => <h1>Submission confirmation</h1> },
  ]);

  return render(<RoutesStub initialEntries={[`/${language}/protected/documents/upload/${uploadId}`]} />);
}

async function addFile(user: ReturnType<typeof userEvent.setup>, name = 'receipt.txt') {
  const file = new File(['receipt'], name, { type: 'text/plain' });
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');

  if (!input) {
    throw new Error('Expected the upload input');
  }

  // The dialog can close on response data before the fetcher finishes and re-enables selection.
  await waitFor(() => expect(input).toBeEnabled());
  await user.upload(input, file);
  await screen.findByRole('listitem', { name });
  return file;
}

async function selectReceiptType(user: ReturnType<typeof userEvent.setup>) {
  const select = screen.getByRole('combobox', { name: 'upload.documentType' });
  await user.selectOptions(select, 'receipt');
}

function getErrorSummary() {
  const summary = document.querySelector<HTMLElement>('[data-error-summary-id]');

  if (!summary) {
    throw new Error('Expected the error summary');
  }

  return summary;
}

function addFilesSuccessAction() {
  return async ({ request }: { request: Request }) => {
    const formData = await request.formData();
    const formAction = formData.get('_action');

    if (formAction === FORM_ACTION.addFiles) {
      return { formAction, source: 'client', responseType: 'success', validationId: String(formData.get('_validation_id')), errors: undefined };
    }

    throw new Error(`Unexpected action: ${String(formAction)}`);
  };
}

function expectSelectedCount(count: number) {
  const status = screen.getByRole('status');
  expect(Array.from(status.querySelectorAll('p'), (paragraph) => paragraph.textContent)).toEqual([JSON.stringify({ key: 'upload.uploadFiles.filesSelected', options: { count } })]);
  expect(screen.queryByRole('heading', { name: 'upload.uploadFiles.pendingFilesHeading' })).not.toBeInTheDocument();
}

function expectResultCounts(uploaded: number, pending: number, includeHidden = false) {
  const status = screen.getByRole('status', { hidden: includeHidden });
  expect(Array.from(status.querySelectorAll('p'), (paragraph) => paragraph.textContent)).toEqual([
    JSON.stringify({ key: 'upload.uploadFiles.uploadedFiles', options: { count: uploaded } }),
    JSON.stringify({ key: 'upload.uploadFiles.pendingFiles', options: { count: pending } }),
  ]);
}

describe('DocumentUploadForm review integration', () => {
  it('shows missing document type errors inline and in the summary without uploading', async () => {
    const user = userEvent.setup();
    const action = vi.fn(addFilesSuccessAction());
    renderForm(action);

    await addFile(user);
    await user.click(screen.getByRole('button', { name: 'upload.submit' }));

    await waitFor(() => expect(getErrorSummary()).toHaveTextContent('upload.errorMessage.documentTypeRequired'));
    expect(screen.getByRole('alert')).toHaveTextContent('upload.errorMessage.documentTypeRequired');
    expect(screen.queryByRole('dialog', { name: 'upload.review.title' })).not.toBeInTheDocument();
    expect(action).toHaveBeenCalledOnce();
    expect(getFiles).toHaveBeenCalledOnce();
    expectSelectedCount(1);
  });

  it.each([
    ['en', 'Receipt'],
    ['fr', 'Reçu'],
  ])('cancels review without upload, retains selections, and restores trigger focus in %s', async (language, documentTypeName) => {
    const user = userEvent.setup();
    const action = vi.fn(addFilesSuccessAction());
    renderForm(action, language);

    await addFile(user);
    await selectReceiptType(user);
    const submitButton = screen.getByRole('button', { name: 'upload.submit' });
    await user.click(submitButton);

    const dialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    expect(dialog).toHaveTextContent(`receipt.txt, ${documentTypeName}`);
    await user.click(within(dialog).getByRole('button', { name: 'upload.review.back' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('listitem', { name: 'receipt.txt' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'upload.documentType' })).toHaveValue('receipt');
    await waitFor(() => expect(submitButton).toHaveFocus());
    expect(action).toHaveBeenCalledOnce();
    expectSelectedCount(1);
  });

  it('keeps the review busy and blocks escape until the real route action resolves', async () => {
    const user = userEvent.setup();

    let resolveUpload: (value: unknown) => void = () => {};

    const uploadResponse = new Promise<unknown>((resolve) => {
      resolveUpload = resolve;
    });
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const formData = await request.formData();
      const formAction = formData.get('_action');

      if (formAction === FORM_ACTION.addFiles) {
        return { formAction, source: 'client', responseType: 'success', validationId: String(formData.get('_validation_id')), errors: undefined };
      }

      return await uploadResponse;
    });
    renderForm(action);

    await addFile(user);
    await selectReceiptType(user);
    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    const dialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    const confirmButton = within(dialog).getByRole('button', { name: 'upload.review.submit' });
    await user.click(confirmButton);

    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'true'));
    expectResultCounts(0, 1, true);
    expect(confirmButton).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'upload.review.back' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'upload.review.title' })).toBeInTheDocument();

    resolveUpload({ formAction: FORM_ACTION.upload, source: 'server', responseType: 'success' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes on upload errors, focuses the real error summary, preserves selections, and reviews only the pending retry after partial success', async () => {
    const user = userEvent.setup();
    let uploadCount = 0;
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const formData = await request.formData();
      const formAction = formData.get('_action');

      if (formAction === FORM_ACTION.addFiles) {
        return { formAction, source: 'client', responseType: 'success', validationId: String(formData.get('_validation_id')), errors: undefined };
      }

      uploadCount++;
      const ids = formData.getAll('file_id') as string[];
      const files = formData.getAll('file_object') as File[];
      const types = formData.getAll('file_document_type') as string[];
      return {
        formAction: FORM_ACTION.upload,
        source: 'server',
        responseType: 'upload-errors',
        errors: { errors: [], properties: { files: { errors: ['upload failed'] } } },
        documents: ids.map((id, index) => ({ id, fileName: files[index]!.name, fileSize: files[index]!.size, documentType: types[index]!, status: index === 0 ? 'uploaded' : 'pending' })),
      };
    });
    renderForm(action);

    await addFile(user, 'first.txt');
    await addFile(user, 'second.txt');
    const selects = screen.getAllByRole('combobox', { name: 'upload.documentType' });
    await user.selectOptions(selects[0]!, 'receipt');
    await user.selectOptions(selects[1]!, 'receipt');
    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    const dialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    await user.click(within(dialog).getByRole('button', { name: 'upload.review.submit' }));

    await waitFor(() => expect(document.querySelector('[data-error-summary-id]')).toBeInTheDocument());
    const summary = getErrorSummary();
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'upload.review.title' })).not.toBeInTheDocument();
    const uploadedList = screen.getByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' });
    const uploadedItem = within(uploadedList).getByRole('listitem');
    expect(within(uploadedItem).getByText('first.txt', { exact: true })).toHaveRole('definition');
    expect(screen.getByRole('listitem', { name: 'second.txt' })).toBeInTheDocument();
    expect(uploadCount).toBe(1);
    expectResultCounts(1, 1);

    const retryButton = screen.getByRole('button', { name: 'upload.submitRemaining' });
    await waitFor(() => expect(retryButton).toBeEnabled());
    await user.click(retryButton);
    const retryDialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    expect(retryDialog).toHaveTextContent('second.txt, Receipt');
    expect(retryDialog).not.toHaveTextContent('first.txt, Receipt');
    expect(uploadCount).toBe(1);
  });

  it('keeps all-failed result counts after adding a file, failed prevalidation, and cancelling a later review', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const formData = await request.formData();
      const formAction = formData.get('_action');

      if (formAction === FORM_ACTION.addFiles) {
        return { formAction, source: 'client', responseType: 'success', validationId: String(formData.get('_validation_id')), errors: undefined };
      }

      const ids = formData.getAll('file_id') as string[];
      const files = formData.getAll('file_object') as File[];
      return {
        formAction: FORM_ACTION.upload,
        source: 'server',
        responseType: 'upload-errors',
        errors: { errors: [], properties: { files: { errors: ['Upload failed'], properties: { [ids[0]!]: { errors: [], properties: { file: { errors: ['Try this file again'] } } } } } } },
        documents: ids.map((id, index) => ({ id, fileName: files[index]!.name, fileSize: files[index]!.size, documentType: 'receipt', status: 'pending' })),
      };
    });
    renderForm(action);
    expectSelectedCount(0);

    await addFile(user, 'failed.txt');
    await selectReceiptType(user);
    expectSelectedCount(1);
    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    const firstReview = await screen.findByRole('dialog', { name: 'upload.review.title' });
    await user.click(within(firstReview).getByRole('button', { name: 'upload.review.back' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectSelectedCount(1);
    expect(action).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    await user.click(await screen.findByRole('button', { name: 'upload.review.submit' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectResultCounts(0, 1);
    expect(screen.getByRole('list', { name: 'upload.uploadFiles.pendingFilesHeading' })).toHaveAttribute('id', 'pending-files-list');
    expect(screen.queryByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'failed.txt' })).getByRole('alert')).toHaveTextContent('Try this file again');
    expect(action).toHaveBeenCalledTimes(2);

    await addFile(user, 'added.txt');
    expectResultCounts(0, 2);
    expect(screen.getAllByRole('combobox', { name: 'upload.documentType' }).map((select) => (select as HTMLSelectElement).value)).toEqual(['receipt', '']);
    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    await waitFor(() => expect(getErrorSummary()).toHaveTextContent('upload.errorMessage.documentTypeRequired'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expectResultCounts(0, 2);
    expect(action).toHaveBeenCalledTimes(3);

    await user.selectOptions(within(screen.getByRole('listitem', { name: 'added.txt' })).getByRole('combobox'), 'receipt');
    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    const laterReview = await screen.findByRole('dialog', { name: 'upload.review.title' });
    expect(
      within(laterReview)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['failed.txt, Receipt', 'added.txt, Receipt']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectResultCounts(0, 2);
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('focuses uploaded-only confirmation after removing the last pending file and finishes without uploading again', async () => {
    const user = userEvent.setup();
    const submissions: FormData[] = [];
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const formData = await request.formData();
      submissions.push(formData);
      const formAction = formData.get('_action');

      if (formAction === FORM_ACTION.addFiles) {
        return { formAction, source: 'client', responseType: 'success', validationId: String(formData.get('_validation_id')), errors: undefined };
      }

      if (formAction === FORM_ACTION.finish) {
        return redirect('/confirmation');
      }

      const ids = formData.getAll('file_id') as string[];
      const files = formData.getAll('file_object') as File[];
      return {
        formAction: FORM_ACTION.upload,
        source: 'server',
        responseType: 'upload-errors',
        errors: { errors: [] },
        documents: ids.map((id, index) => ({ id, fileName: files[index]!.name, fileSize: files[index]!.size, documentType: 'receipt', status: index === 0 ? 'pending' : 'uploaded' })),
      };
    });
    renderForm(action);
    await addFile(user, 'pending-first.txt');
    await addFile(user, 'successful-last.txt');

    await Promise.all(screen.getAllByRole('combobox', { name: 'upload.documentType' }).map(async (select) => await user.selectOptions(select, 'receipt')));

    await user.click(screen.getByRole('button', { name: 'upload.submit' }));
    await user.click(await screen.findByRole('button', { name: 'upload.review.submit' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectResultCounts(1, 1);

    const removeButton = within(screen.getByRole('listitem', { name: 'pending-first.txt' })).getByRole('button', { name: 'upload.remove' });
    await waitFor(() => expect(removeButton).toBeEnabled());
    await user.click(removeButton);
    await user.click(await screen.findByRole('button', { name: 'upload.removeFileConfirmation.confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const region = screen.getByRole('region', { name: JSON.stringify({ key: 'upload.uploadFiles.uploadedFiles', options: { count: 1 } }) });
    await waitFor(() => expect(region).toHaveFocus());
    expectResultCounts(1, 0);
    expect(region).toHaveAccessibleDescription('upload.uploadFiles.documentsSent upload.uploadFiles.noPendingFiles');
    expect(screen.queryByRole('list', { name: 'upload.uploadFiles.pendingFilesHeading' })).not.toBeInTheDocument();
    const uploadedList = screen.getByRole('list', { name: 'upload.uploadFiles.uploadedFilesHeading' });
    const uploadedItem = within(uploadedList).getByRole('listitem');
    expect(within(uploadedItem).getByText('successful-last.txt', { exact: true })).toHaveRole('definition');
    expect(uploadedItem).not.toHaveAttribute('aria-posinset');
    expect(uploadedItem).not.toHaveAttribute('aria-setsize');

    await user.click(within(region).getByRole('button', { name: 'upload.viewSubmissionConfirmation' }));
    expect(await screen.findByRole('heading', { name: 'Submission confirmation' })).toBeInTheDocument();
    expect(submissions.map((formData) => formData.get('_action'))).toEqual([FORM_ACTION.addFiles, FORM_ACTION.addFiles, FORM_ACTION.upload, FORM_ACTION.finish]);
    const finish = submissions.at(-1)!;
    expect(finish.get('_csrf')).toBe('test-token');
    expect(finish.getAll('file_id')).toEqual([]);
    expect(finish.getAll('file_object')).toEqual([]);
    expect(finish.getAll('file_document_type')).toEqual([]);
  });
});
