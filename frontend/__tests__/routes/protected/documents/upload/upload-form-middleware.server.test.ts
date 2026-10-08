import { RouterContextProvider } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { Session } from '~/.server/web/session';
import { shouldRevalidate } from '~/routes/protected/documents/upload/upload-form';
import { middleware } from '~/routes/protected/documents/upload/upload-form-middleware.server';

vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'), async (importOriginal) => ({
  ...(await importOriginal()),
  loadDocumentUploadState: vi.fn(),
}));

const uploadId = '00000000-0000-0000-0000-000000000000';
const guard = middleware[0];
if (!guard) throw new Error('Expected an upload form lifecycle guard');

function createArgs(method: string): Parameters<(typeof middleware)[number]>[0] {
  const session = mock<Session>();
  const context = new RouterContextProvider();
  context.set(appContext, mock<AppContext>({ session }));
  const url = new URL(`http://localhost/en/protected/documents/upload/${uploadId}`);
  return { context, params: { id: uploadId, lang: 'en' }, url, request: new Request(url, { method }), pattern: '/:lang/protected/documents/upload/:id' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('upload form lifecycle middleware', () => {
  it.each(['GET', 'POST'])('redirects a finished flow before %s processing', async (method) => {
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'finished', pendingDocuments: [], uploadedDocuments: [] });
    const next = vi.fn();

    await expect(guard(createArgs(method), next)).rejects.toMatchObject({ status: 302 });
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['initialized', 'partial-upload'] as const)('continues an open %s flow', async (status) => {
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status, pendingDocuments: [], uploadedDocuments: [] });
    const response = new Response(null, { status: 204 });
    const next = vi.fn().mockResolvedValue(response);

    await expect(guard(createArgs('GET'), next)).resolves.toBe(response);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('upload form revalidation', () => {
  it.each(['add-files', 'upload', 'finish'])('preserves the active flow after a same-page %s POST', (formAction) => {
    const currentUrl = new URL(`http://localhost/en/protected/documents/upload/${uploadId}`);
    const formData = new FormData();
    formData.set('_action', formAction);
    const args: Parameters<typeof shouldRevalidate>[0] = { currentUrl, nextUrl: currentUrl, currentParams: {}, nextParams: {}, formAction: currentUrl.pathname, formMethod: 'POST', formData, defaultShouldRevalidate: true };

    expect(shouldRevalidate(args)).toBe(false);
  });

  it.each([true, false])('retains the default decision %s for explicit revalidation', (defaultShouldRevalidate) => {
    const currentUrl = new URL(`http://localhost/en/protected/documents/upload/${uploadId}`);

    expect(shouldRevalidate({ currentUrl, nextUrl: currentUrl, currentParams: {}, nextParams: {}, defaultShouldRevalidate })).toBe(defaultShouldRevalidate);
  });

  it.each(['different flow', 'different search', 'different action target', 'unknown action'])('allows default revalidation for a %s', (caseName) => {
    const currentUrl = new URL(`http://localhost/en/protected/documents/upload/${uploadId}`);
    const nextUrl = new URL(currentUrl);
    if (caseName === 'different flow') nextUrl.pathname += '/other';
    if (caseName === 'different search') nextUrl.search = '?refresh=true';
    const formData = new FormData();
    formData.set('_action', caseName === 'unknown action' ? 'unknown' : 'upload');
    const args: Parameters<typeof shouldRevalidate>[0] = {
      currentUrl,
      nextUrl,
      currentParams: {},
      nextParams: {},
      formAction: caseName === 'different action target' ? '/other' : currentUrl.pathname,
      formMethod: 'POST',
      formData,
      defaultShouldRevalidate: true,
    };

    expect(shouldRevalidate(args)).toBe(true);
  });
});
