import { RouterContextProvider, data } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { getDocumentUploadFormUrl, getDocumentUploadSubmittedUrl, loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { Session } from '~/.server/web/session';
import { middleware } from '~/routes/protected/documents/upload/upload-submitted-middleware.server';

vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'), async (importOriginal) => ({
  ...(await importOriginal()),
  loadDocumentUploadState: vi.fn(),
}));

const uploadId = '00000000-0000-0000-0000-000000000000';
const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', fileSize: 8, documentType: 'receipt', status: 'uploaded' as const };
const guard = middleware[0];
if (!guard) throw new Error('Expected a submitted upload lifecycle guard');

function createArgs(lang: string): Parameters<(typeof middleware)[number]>[0] {
  const session = mock<Session>();
  const context = new RouterContextProvider();
  context.set(appContext, mock<AppContext>({ session }));
  const params = { id: uploadId, lang };
  const url = new URL(getDocumentUploadSubmittedUrl(uploadId, params), 'http://localhost');
  return { context, params, url, request: new Request(url), pattern: '/:lang/protected/documents/upload/:id/submitted' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitted upload lifecycle middleware', () => {
  it.each(['en', 'fr'])('continues a finished flow for %s', async (lang) => {
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'finished', documents: [uploadedDocument] });
    const args = createArgs(lang);
    const response = new Response(null, { status: 204 });
    const next = vi.fn().mockResolvedValue(response);

    await expect(guard(args, next)).resolves.toBe(response);
    expect(loadDocumentUploadState).toHaveBeenCalledExactlyOnceWith({ id: uploadId, params: args.params, session: args.context.get(appContext).session });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    { lang: 'en', status: 'initialized' as const },
    { lang: 'fr', status: 'initialized' as const },
    { lang: 'en', status: 'partial-upload' as const },
    { lang: 'fr', status: 'partial-upload' as const },
  ])('redirects an open $status flow to the $lang form', async ({ lang, status }) => {
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status, documents: status === 'partial-upload' ? [uploadedDocument] : [] });
    const args = createArgs(lang);
    const next = vi.fn();

    const response = await Promise.resolve(guard(args, next)).catch((error: unknown) => error);
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) throw new Error('Expected an upload form redirect');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(getDocumentUploadFormUrl(uploadId, args.params));
    expect(next).not.toHaveBeenCalled();
  });

  it('propagates a missing-flow response without invoking the loader', async () => {
    const notFound = data(null, { status: 404 });
    vi.mocked(loadDocumentUploadState).mockImplementation(() => {
      throw notFound;
    });
    const next = vi.fn();

    await expect(guard(createArgs('en'), next)).rejects.toBe(notFound);
    expect(next).not.toHaveBeenCalled();
  });
});
