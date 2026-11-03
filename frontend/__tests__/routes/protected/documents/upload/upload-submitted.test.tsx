import { getDefaultNormalizer, render, screen, within } from '@testing-library/react';

import { MemoryRouter, RouterContextProvider } from 'react-router';

import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { getUser } from '~/.server/context/user-context';
import type { AuditService, DocumentUploadService, EvidentiaryDocumentTypeService } from '~/.server/domain/services';
import enDocuments from '~/.server/locales/en/documents';
import frDocuments from '~/.server/locales/fr/documents';
import { loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { DocumentUploadState, SubmittedDocument } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import { getFixedT, getLocale, initI18n } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';
import { pageIds } from '~/page-ids';
import DocumentsSubmitted, { handle, loader, meta } from '~/routes/protected/documents/upload/upload-submitted';

vi.unmock(import('react-i18next'));
vi.mock(import('~/.server/context/user-context'));
vi.mock(import('~/.server/utils/env-utils'));
vi.mock(import('~/.server/utils/locale-utils'), { spy: true });
vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'), { spy: true });

const uploadId = '00000000-0000-0000-0000-000000000000';
const sessionKey = `document-upload-flow-${uploadId}` as const;
const session = mock<Session>();
const appContainer = mock<AppContext['appContainer']>();
const documentTypeService = mock<EvidentiaryDocumentTypeService>();
const documentUploadService = mock<DocumentUploadService>();
const auditService = mock<AuditService>();
const baseUri = 'https://account.example.test';
const uploadedDocument: SubmittedDocument = { id: 'first', fileName: 'evidence.pdf', documentType: 'receipt', fileSize: 12, status: 'uploaded' };

function storeDocuments(documents: ReadonlyArray<SubmittedDocument>) {
  const state: DocumentUploadState = { id: uploadId, status: 'finished', documents };
  session.get.calledWith(sessionKey).mockReturnValue(state);
  return state;
}

function createArgs(locale: AppLocale): Parameters<typeof loader>[0] {
  const context = new RouterContextProvider();
  context.set(appContext, { appContainer, session });
  const pathname = locale === 'en' ? 'protected/documents/upload' : 'protege/documents/televerser';
  const url = new URL(`https://example.test/${locale}/${pathname}/${uploadId}/submitted`);
  return { context, params: { id: uploadId, lang: locale }, url, request: new Request(url), pattern: '/:lang/protected/documents/upload/:id/submitted' };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEnv, { partial: true }).mockReturnValue({ I18NEXT_DEBUG: false });
  vi.mocked(getUser).mockReturnValue(mock<ReturnType<typeof getUser>>({ id: 'receipt-user' }));
  session.has.mockReturnValue(true);
  storeDocuments([uploadedDocument]);
  appContainer.get.calledWith(TYPES.EvidentiaryDocumentTypeService).mockReturnValue(documentTypeService);
  appContainer.get.calledWith(TYPES.DocumentUploadService).mockReturnValue(documentUploadService);
  appContainer.get.calledWith(TYPES.ClientConfig).mockReturnValue({ SCCH_BASE_URI: baseUri });
  appContainer.get.calledWith(TYPES.AuditService).mockReturnValue(auditService);
  documentTypeService.listLocalizedEvidentiaryDocumentTypes.mockImplementation(
    async (locale) =>
      await Promise.resolve([
        { id: 'receipt', code: 'receipt-code', name: locale === 'en' ? 'Receipt' : 'Reçu', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active },
        { id: 'retired', code: 'retired-code', name: locale === 'en' ? 'Retired type' : 'Ancien type', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive },
      ]),
  );
});

describe.each(['en', 'fr'] as const)('submitted documents loader (%s)', (locale) => {
  it('loads the requested flow and resolves stored type IDs in the request language, including inactive types', async () => {
    const retiredDocument = { ...uploadedDocument, id: 'retired-file', documentType: 'retired' };
    storeDocuments([uploadedDocument, retiredDocument]);
    const args = createArgs(locale);

    const result = await loader(args);

    expect(loadDocumentUploadState).toHaveBeenCalledExactlyOnceWith({ id: uploadId, params: args.params, session });
    expect(session.get).toHaveBeenCalledExactlyOnceWith(sessionKey);
    expect(getLocale).toHaveBeenCalledWith(args.url);
    expect(getFixedT).toHaveBeenCalledExactlyOnceWith(args.url, ['documents', 'gcweb']);
    expect(documentTypeService.listLocalizedEvidentiaryDocumentTypes).toHaveBeenCalledExactlyOnceWith(locale);
    expect(documentTypeService.listLocalizedEvidentiaryDocumentTypesByStatus).not.toHaveBeenCalled();
    expect(result.uploadedDocuments).toEqual([
      { id: uploadedDocument.id, fileName: uploadedDocument.fileName, documentTypeName: locale === 'en' ? 'Receipt' : 'Reçu' },
      { id: retiredDocument.id, fileName: retiredDocument.fileName, documentTypeName: locale === 'en' ? 'Retired type' : 'Ancien type' },
    ]);
  });

  it('omits pending selections and failed uploads (stored as pending) while retaining successes in selection order', async () => {
    const earlierSuccess = { ...uploadedDocument, id: 'earlier-success' };
    const laterSuccess = { ...uploadedDocument, id: 'later-success', fileName: 'later.pdf' };
    storeDocuments([{ ...uploadedDocument, id: 'pending-selection', status: 'pending' }, earlierSuccess, { ...uploadedDocument, id: 'failed-upload', status: 'pending' }, laterSuccess]);

    const result = await loader(createArgs(locale));

    expect(result.uploadedDocuments).toEqual([
      { id: earlierSuccess.id, fileName: earlierSuccess.fileName, documentTypeName: locale === 'en' ? 'Receipt' : 'Reçu' },
      { id: laterSuccess.id, fileName: laterSuccess.fileName, documentTypeName: locale === 'en' ? 'Receipt' : 'Reçu' },
    ]);
  });

  it('deduplicates stable IDs in first-insertion order, not matching filenames', async () => {
    const secondDocument = { ...uploadedDocument, id: 'second', documentType: 'retired' };
    const replacement = { ...uploadedDocument, fileSize: 99 };
    storeDocuments([uploadedDocument, secondDocument, replacement]);

    const result = await loader(createArgs(locale));

    expect(result.uploadedDocuments).toEqual([
      { id: replacement.id, fileName: replacement.fileName, documentTypeName: locale === 'en' ? 'Receipt' : 'Reçu' },
      { id: secondDocument.id, fileName: secondDocument.fileName, documentTypeName: locale === 'en' ? 'Retired type' : 'Ancien type' },
    ]);
  });

  it('uses the localized fallback when a stored type ID is no longer available', async () => {
    const unknownDocument = { ...uploadedDocument, documentType: 'unknown-type-id' };
    storeDocuments([unknownDocument]);

    const result = await loader(createArgs(locale));

    expect(result.uploadedDocuments).toEqual([{ id: unknownDocument.id, fileName: unknownDocument.fileName, documentTypeName: locale === 'en' ? 'Document type unavailable' : 'Type de document non disponible' }]);
  });

  it('preserves the client URI, page-view audit, localized title and inherited metadata', async () => {
    const args = createArgs(locale);
    const result = await loader(args);
    const title = locale === 'en' ? 'Documents submitted - Canadian Dental Care Plan - My Service Canada Account - Canada.ca' : 'Vos documents sont soumis - Mon dossier Service Canada - Régime canadien de soins dentaires - Canada.ca';

    expect(result.meta).toEqual({ title });
    expect(result.SCCH_BASE_URI).toBe(baseUri);
    expect(getUser).toHaveBeenCalledExactlyOnceWith(args.context);
    expect(auditService.createAudit).toHaveBeenCalledExactlyOnceWith('page-view.documents-submitted', { userId: 'receipt-user' });
    const parentMatch = mock<NonNullable<Parameters<typeof meta>[0]['matches'][0]>>({ meta: [{ title: 'Parent title' }, { name: 'description', content: 'Parent description' }] });
    const metaArgs = mock<Parameters<typeof meta>[0]>();
    metaArgs.loaderData = result;
    metaArgs.matches = [
      parentMatch,
      mock<Parameters<typeof meta>[0]['matches'][1]>({ meta: [] }),
      mock<Parameters<typeof meta>[0]['matches'][2]>({ meta: [] }),
      mock<Parameters<typeof meta>[0]['matches'][3]>({ meta: [] }),
      mock<Parameters<typeof meta>[0]['matches'][4]>({ meta: [] }),
      mock<Extract<Parameters<typeof meta>[0]['matches'][5], { id: 'protected/documents/upload/upload-submitted-en' }>>({ meta: [] }),
    ];
    expect(meta(metaArgs)).toMatchObject([{ title }, { property: 'og:title', content: title }, { property: 'dcterms.title', content: title }, { name: 'description', content: 'Parent description' }]);
    expect(handle.i18nPreloadNamespace).toEqual(['documents', 'gcweb']);
    expect(handle.pageIdentifier).toBe(pageIds.protected.documents.submitted);
  });

  it('does not scan or upload files when the receipt is loaded or reloaded', async () => {
    await loader(createArgs(locale));
    await loader(createArgs(locale));

    expect(appContainer.get).not.toHaveBeenCalledWith(TYPES.DocumentUploadService);
    expect(documentUploadService.scanDocument).not.toHaveBeenCalled();
    expect(documentUploadService.uploadDocument).not.toHaveBeenCalled();
    expect(session.set).not.toHaveBeenCalled();
    expect(session.unset).not.toHaveBeenCalled();
  });
});

describe('submitted documents reloads', () => {
  it('uses the flow ID in the current route rather than another stored flow or a query-string ID', async () => {
    const otherId = '11111111-1111-4111-8111-111111111111';
    const otherDocument = { ...uploadedDocument, id: 'other-flow-file', fileName: 'other-flow.pdf' };
    session.get.calledWith(`document-upload-flow-${otherId}`).mockReturnValue({ id: otherId, status: 'finished', documents: [otherDocument] });
    const args = createArgs('en');
    args.params.id = otherId;
    args.url.pathname = args.url.pathname.replace(uploadId, otherId);
    args.url.searchParams.set('id', uploadId);
    args.request = new Request(args.url);

    const result = await loader(args);

    expect(loadDocumentUploadState).toHaveBeenCalledExactlyOnceWith({ id: otherId, params: args.params, session });
    expect(session.get).toHaveBeenCalledExactlyOnceWith(`document-upload-flow-${otherId}`);
    expect(result.uploadedDocuments).toEqual([{ id: otherDocument.id, fileName: otherDocument.fileName, documentTypeName: 'Receipt' }]);
  });

  it('re-resolves type names on reload and language changes without decorating or mutating session metadata', async () => {
    const state = storeDocuments([uploadedDocument, { ...uploadedDocument, id: 'unknown', documentType: 'unknown' }]);
    const originalState = structuredClone(state);
    Object.freeze(state.documents[0]);
    Object.freeze(state.documents[1]);
    Object.freeze(state.documents);
    Object.freeze(state);

    const english = await loader(createArgs('en'));
    documentTypeService.listLocalizedEvidentiaryDocumentTypes.mockResolvedValueOnce([{ id: 'receipt', code: 'receipt-code', name: 'Updated receipt', status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active }]);
    const reloaded = await loader(createArgs('en'));
    const french = await loader(createArgs('fr'));

    expect(english.uploadedDocuments.map((document) => document.documentTypeName)).toEqual(['Receipt', 'Document type unavailable']);
    expect(reloaded.uploadedDocuments.map((document) => document.documentTypeName)).toEqual(['Updated receipt', 'Document type unavailable']);
    expect(french.uploadedDocuments.map((document) => document.documentTypeName)).toEqual(['Reçu', 'Type de document non disponible']);
    expect(documentTypeService.listLocalizedEvidentiaryDocumentTypes.mock.calls).toEqual([['en'], ['en'], ['fr']]);
    expect(state).toEqual(originalState);
    expect(session.set).not.toHaveBeenCalled();
    expect(session.unset).not.toHaveBeenCalled();
  });

  it('propagates lookup failures rather than silently presenting every type as unavailable', async () => {
    const error = new Error('Type lookup unavailable');
    documentTypeService.listLocalizedEvidentiaryDocumentTypes.mockRejectedValueOnce(error);

    await expect(loader(createArgs('en'))).rejects.toBe(error);
    expect(session.set).not.toHaveBeenCalled();
    expect(documentUploadService.uploadDocument).not.toHaveBeenCalled();
  });
});

describe.each(['en', 'fr'] as const)('submitted documents page (%s)', (locale) => {
  it('adds localized screen-reader labels without changing visible filename/type pairs', async () => {
    storeDocuments([uploadedDocument, { ...uploadedDocument, id: 'second', documentType: 'retired' }]);
    const loaderData = await loader(createArgs(locale));
    const i18n = await initI18n(locale, ['documents', 'gcweb']);
    const documents = locale === 'en' ? enDocuments : frDocuments;

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <DocumentsSubmitted {...mock<Parameters<typeof DocumentsSubmitted>[0]>({ loaderData })} />
        </I18nextProvider>
      </MemoryRouter>,
    );

    const receiptList = screen.getAllByRole('list').find((list) => list.tagName === 'OL');
    expect(receiptList).toBeDefined();
    expect(receiptList).toHaveAttribute('role', 'list');
    expect(receiptList).toHaveClass('space-y-1');
    const items = within(receiptList!).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(
      locale === 'en' ? ['Filename evidence.pdf, (document type Receipt)', 'Filename evidence.pdf, (document type Retired type)'] : ['Nom du fichier evidence.pdf, (type de document Reçu)', 'Nom du fichier evidence.pdf, (type de document Ancien type)'],
    );
    expect(
      items.map((item) => {
        const visibleContent = item.cloneNode(true) as HTMLElement;
        visibleContent.querySelectorAll('.sr-only').forEach((label) => label.remove());
        return visibleContent.textContent;
      }),
    ).toEqual(locale === 'en' ? ['evidence.pdf, (Receipt)', 'evidence.pdf, (Retired type)'] : ['evidence.pdf, (Reçu)', 'evidence.pdf, (Ancien type)']);

    for (const item of items) {
      expect(item).toHaveClass('min-w-0', 'wrap-anywhere');
      expect(item).not.toHaveAttribute('aria-label');
      expect(item).not.toHaveAttribute('aria-labelledby');
      expect(item.children).toHaveLength(2);
      expect(Array.from(item.children, (label) => label.textContent)).toEqual(locale === 'en' ? ['Filename ', 'document type '] : ['Nom du fichier ', 'type de document ']);

      for (const label of item.children) {
        expect(label).toHaveClass('sr-only');
        expect(label).not.toHaveAttribute('aria-hidden');
      }
    }

    expect(screen.getByRole('heading', { level: 1, name: documents.submitted.pageTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: documents.submitted.alertHeading })).toBeInTheDocument();
    expect(screen.getByText(documents.submitted.youSubmitted, { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument();
    expect(screen.getByText(documents.submitted.delayNote)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: documents.submitted.nextStepsHeading })).toBeInTheDocument();
    expect(screen.getByText(documents.submitted.nextSteps.review)).toBeInTheDocument();
    expect(screen.getByText(documents.submitted.nextSteps.letter)).toBeInTheDocument();
    const returnLink = screen.getByRole('link', { name: documents.submitted.returnButton });
    expect(returnLink).toHaveAttribute('href', `${baseUri}/${locale}/${locale === 'en' ? 'my-dashboard' : 'mon-tableau-de-bord'}`);
    expect(returnLink).toHaveAttribute('data-gc-analytics-customclick', 'ESDC-EDSC:CDCP Applicant Documents-Protected:Return to dashboard - Documents submitted button click');
  });

  it('uses the real paired locale template and renders markup-like filenames and type names only as text', async () => {
    const fileName = '<img src=x onerror=alert(1)> & "evidence".pdf';
    const documentTypeName = '<script>alert("type")</script> & <b>type</b>';
    const i18n = await initI18n(locale, ['documents', 'gcweb']);
    const loaderData = await loader(createArgs(locale));
    loaderData.uploadedDocuments = [{ id: uploadedDocument.id, fileName, documentTypeName }];
    const expected = locale === 'en' ? `Filename ${fileName}, (document type ${documentTypeName})` : `Nom du fichier ${fileName}, (type de document ${documentTypeName})`;

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <DocumentsSubmitted {...mock<Parameters<typeof DocumentsSubmitted>[0]>({ loaderData })} />
        </I18nextProvider>
      </MemoryRouter>,
    );

    const item = screen.getByText((_, element) => element?.tagName === 'LI' && element.textContent === expected);
    expect(item.tagName).toBe('LI');
    expect(item.textContent).toBe(expected);
    expect(item.children).toHaveLength(2);
    expect(item.querySelector('img, script, b')).toBeNull();
    expect(item.innerHTML).toContain('&lt;img');
    expect(item.innerHTML).toContain('&lt;script&gt;');
    expect(item.innerHTML).toContain('&amp;');
  });
});
