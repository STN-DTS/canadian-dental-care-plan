import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createRoutesStub } from 'react-router';

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
  ]);

  return render(<RoutesStub initialEntries={[`/${language}/protected/documents/upload/${uploadId}`]} />);
}

async function addFile(user: ReturnType<typeof userEvent.setup>, name = 'receipt.txt') {
  const file = new File(['receipt'], name, { type: 'text/plain' });
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');

  if (!input) {
    throw new Error('Expected the upload input');
  }

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
    expect(screen.getByRole('listitem', { name: 'first.txt' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'second.txt' })).toBeInTheDocument();
    expect(uploadCount).toBe(1);

    await user.click(screen.getByRole('button', { name: 'upload.submitRemaining' }));
    const retryDialog = await screen.findByRole('dialog', { name: 'upload.review.title' });
    expect(retryDialog).toHaveTextContent('second.txt, Receipt');
    expect(retryDialog).not.toHaveTextContent('first.txt, Receipt');
    expect(uploadCount).toBe(1);
  });
});
