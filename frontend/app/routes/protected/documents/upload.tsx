import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { faArrowUpFromBracket, faTimes } from '@fortawesome/free-solid-svg-icons';
import { announce } from '@react-aria/live-announcer';
import { Trans, getI18n, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/upload';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { getDocumentUploadSubmittedUrl, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { Button, ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { FileUpload, FileUploadItem, FileUploadItemDelete, FileUploadList, FileUploadTrigger } from '~/components/file-upload';
import type { FileState } from '~/components/file-upload';
import { InlineLink } from '~/components/inline-link';
import { InputError } from '~/components/input-error';
import { InputLegend } from '~/components/input-legend';
import type { InputOptionProps } from '~/components/input-option';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';
import { useClientEnv, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import { focusOnNextFrame } from '~/utils/dom-utils';
import { getLanguage } from '~/utils/locale-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { cn } from '~/utils/tw-utils';
import { bytesToFilesize, megabytesToBytes } from '~/utils/units-utils';

type FileStateWithDocumentType = FileState & { readonly documentType: string };

const FORM_ACTION = {
  upload: 'upload',
  validateFiles: 'validate-files',
} as const;

/**
 * Middleware that permits access to the document upload route only for eligible applicants.
 *
 * Applicants must have at least one application paused due to a T4 mismatch. Ineligible
 * applicants are redirected to the not-required page.
 */
const appealUploadEligibilityMiddleware: Route.MiddlewareFunction = async ({ context, params, url }) => {
  const { appContainer } = context.get(appContext);
  const applicant = getApplicant(context);

  const appealUploadEligibilityService = appContainer.get(TYPES.AppealUploadEligibilityService);
  const appealUploadEligibility = await appealUploadEligibilityService.findAppealUploadEligibility(applicant.clientNumber);
  const canUploadAppealDocuments = appealUploadEligibility.isSome() && appealUploadEligibility.unwrap().canUploadAppealDocuments;

  // Redirect ineligible applicants.
  if (!canUploadAppealDocuments) {
    throw redirect(getPathById('protected/documents/not-required', params));
  }
};

export const middleware: Route.MiddlewareFunction[] = [appealUploadEligibilityMiddleware];

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.documents.upload,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  return <ProtectedBreadcrumbs />;
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);

  const locale = getLocale(url);
  const t = await getFixedT(url, ['documents', 'gcweb']);

  const documentTypes = await appContainer.get(TYPES.EvidentiaryDocumentTypeService).listLocalizedEvidentiaryDocumentTypesByStatus(EVIDENTIARY_DOCUMENT_TYPE_STATUS.active, locale);

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const user = getUser(context);
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-upload', { userId: user.id });

  return {
    meta: { title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.upload.pageTitle) }) },
    documentTypes,
    SCCH_BASE_URI,
  };
}

export async function clientAction({ request, url, serverAction }: Route.ClientActionArgs) {
  const locale = getLanguage(url);
  const t = getI18n().getFixedT(locale, 'documents');
  const formData = await request.clone().formData();
  const source = 'client';

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.validateFiles) {
    const selectionValidationResult = validateFileSelection({ formData, locale, t });
    const validationId = selectionValidationResult.validationId;

    if (!selectionValidationResult.success) {
      return data({ formAction, source, validationId, errors: selectionValidationResult.errors }, 400);
    }

    return { formAction, source, validationId, errors: undefined };
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, errors: validationResult.errors }, 400);
  }

  return await serverAction();
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { session } = context.get(appContext);
  const locale = getLocale(url);
  const t = await getFixedT(locale, 'documents');
  const formData = await request.formData();
  const source = 'server';

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));
  if (formAction !== FORM_ACTION.upload) {
    throw new Error(`Invalid formAction: ${formAction}`);
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, errors: validationResult.errors } as const, 400);
  }

  const { files } = validationResult.data;

  const scanResult = await scanDocuments(files);
  if (!scanResult.success) {
    return data({ formAction, source, errors: scanResult.errors } as const, 400);
  }

  const uploadResult = await uploadDocuments(files);
  if (!uploadResult.success) {
    return data({ formAction, source, errors: uploadResult.errors } as const, 400);
  }

  const id = crypto.randomUUID();
  const submittedDocuments = Object.values(files).map(({ file, documentType }) => {
    return { fileName: file.name, documentType, fileSize: file.size };
  });

  startDocumentUploadState({ id, session, submittedDocuments });

  return redirect(getDocumentUploadSubmittedUrl({ id, params }));
}

export default function DocumentsUpload({ loaderData }: Route.ComponentProps) {
  const { t, i18n } = useTranslation(['documents', 'gcweb']);
  const { documentTypes, SCCH_BASE_URI } = loaderData;
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILE_COUNT, DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB } = useClientEnv();

  const fetcher = useFetcher<typeof clientAction | typeof action>();
  const { isSubmitting, submitAction } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;
  const filesError = errors?.properties?.files?.errors[0];

  const [filesWithTypes, setFilesWithTypes] = useState<FileStateWithDocumentType[]>([]);
  const pendingFileValidationRef = useRef<{ validationId: string; files: ReadonlyArray<File> } | undefined>(undefined);

  const handleBeforeFilesAdd = useCallback(
    (files: ReadonlyArray<File>) => {
      if (pendingFileValidationRef.current) return false;

      const validationId = crypto.randomUUID();
      const formData = new FormData();
      formData.set('_action', FORM_ACTION.validateFiles);
      formData.set('_validation_id', validationId);
      formData.set('current_file_count', filesWithTypes.length.toString());
      for (const { file } of filesWithTypes) {
        formData.append('existing_file_object', file);
      }
      for (const file of files) {
        formData.append('file_object', file);
      }

      pendingFileValidationRef.current = { validationId, files };
      void fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
      return false;
    },
    [fetcher, filesWithTypes],
  );

  const handleFileChange = useCallback(
    (files: ReadonlyArray<FileState>) => {
      // Announce add/remove file actions to assistive technology since the file list updates without a
      // page navigation, which would otherwise be a silent DOM change for screen reader users.
      const previousFileIds = new Set(filesWithTypes.map(({ id }) => id));
      const currentFileIds = new Set(files.map(({ id }) => id));
      const addedFiles = files.filter(({ id }) => !previousFileIds.has(id));
      const removedFiles = filesWithTypes.filter(({ id }) => !currentFileIds.has(id));

      const addedFile = addedFiles[0];
      if (addedFile) {
        announce(
          t(($) => $.upload.fileAddedAnnouncement, {
            count: addedFiles.length,
            fileName: addedFile.file.name,
          }),
          'polite',
        );
        focusOnNextFrame(() => document.querySelector<HTMLElement>(`#file-upload-item-${CSS.escape(addedFile.id)}`));
      }

      const removedFile = removedFiles[0];
      if (removedFile) {
        announce(
          t(($) => $.upload.fileRemovedAnnouncement, {
            count: removedFiles.length,
            fileName: removedFile.file.name,
          }),
          'polite',
        );
      }

      setFilesWithTypes((prev) => {
        const prevMap = new Map(prev.map((item) => [item.id, item]));
        return files.map((file) => prevMap.get(file.id) ?? { ...file, documentType: '' });
      });
    },
    [filesWithTypes, t],
  );

  useEffect(() => {
    if (!pendingFileValidationRef.current || !fetcher.data) {
      return;
    }

    if (
      fetcher.data.source !== 'client' || //
      fetcher.data.formAction !== FORM_ACTION.validateFiles ||
      fetcher.data.validationId !== pendingFileValidationRef.current.validationId
    ) {
      return;
    }

    const files = pendingFileValidationRef.current.files;
    pendingFileValidationRef.current = undefined;

    if ('errors' in fetcher.data) {
      return;
    }

    handleFileChange([...filesWithTypes, ...files.map((file) => ({ id: crypto.randomUUID(), file }))]);
  }, [fetcher.data, filesWithTypes, handleFileChange]);

  const handleDocumentTypeChange = useCallback((id: string, documentType: string) => {
    setFilesWithTypes((prev) =>
      prev.map((file) => {
        // Update the document type for the matching file
        return file.id === id ? { ...file, documentType } : file;
      }),
    );
  }, []);

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('_action', FORM_ACTION.upload);
    formData.delete('file_id');
    formData.delete('file_object');
    formData.delete('file_document_type');

    for (const { id, file, documentType } of filesWithTypes) {
      formData.append('file_id', id);
      formData.append('file_object', file);
      formData.append('file_document_type', documentType);
    }

    await fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
  };

  const docTypeOptions = useMemo<InputOptionProps[]>(() => {
    return [
      {
        children: t(($) => $.upload.selectOne),
        value: '',
        disabled: true,
        hidden: true,
      }, //
      ...documentTypes.map((d) => ({ children: d.name, value: d.id })),
    ];
  }, [documentTypes, t]);

  const eligibilityFormLink = <InlineLink to={t(($) => $.upload.chooseDocuments.eligibilityFormHref)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.upload.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <p>{t(($) => $.upload.intro)}</p>
        <section className="space-y-4">
          <h2 className="font-lato text-2xl font-bold">{t(($) => $.upload.chooseDocuments.title)}</h2>
          <p>{t(($) => $.upload.chooseDocuments.canUpload)}</p>
          <ul className="list-disc space-y-1 pl-7">
            <li>
              <Trans ns="documents" i18nKey={($) => $.upload.chooseDocuments.list.eligibilityForm} components={{ eligibilityFormLink }} />
            </li>
            <li>{t(($) => $.upload.chooseDocuments.list.letter)}</li>
            <li>{t(($) => $.upload.chooseDocuments.list.proof)}</li>
          </ul>
          <p>{t(($) => $.upload.chooseDocuments.mustInclude)}</p>
          <ul className="list-disc space-y-1 pl-7">
            <li>{t(($) => $.upload.chooseDocuments.mustIncludeList.name)}</li>
            <li>{t(($) => $.upload.chooseDocuments.mustIncludeList.memberId)}</li>
            <li>{t(($) => $.upload.chooseDocuments.mustIncludeList.signature)}</li>
          </ul>
        </section>
        <section className="space-y-4">
          <h2 className="font-lato text-2xl font-bold">{t(($) => $.upload.uploadFiles.title)}</h2>
          <ErrorSummaryProvider actionData={fetcher.data}>
            <ErrorSummary />
            <fetcher.Form method="post" onSubmit={handleSubmit} noValidate>
              <CsrfTokenInput />
              <div className="space-y-6">
                <fieldset>
                  <InputLegend className="mb-2">{t(($) => $.upload.uploadFiles.chooseFile)}</InputLegend>
                  <ul className="mb-2 list-disc space-y-1 pl-7">
                    <li>{t(($) => $.upload.uploadFiles.maxFiles, { count: DOCUMENT_UPLOAD_MAX_FILE_COUNT })}</li>
                    <li>
                      {t(($) => $.upload.uploadFiles.maxSize, {
                        filesize: bytesToFilesize(megabytesToBytes(DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB), `${i18n.language}-CA`),
                      })}
                    </li>
                    <li>
                      {t(($) => $.upload.uploadFiles.acceptedTypes, {
                        extensions: DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(', '),
                      })}
                    </li>
                  </ul>
                  {filesError && <InputError id="files-error" className="mb-2" fieldId="fileUploadTrigger" message={filesError} />}
                  <FileUpload
                    id="file-upload"
                    label={t(($) => $.upload.uploadDocument)}
                    value={filesWithTypes}
                    onValueChange={handleFileChange}
                    onBeforeFilesAdd={handleBeforeFilesAdd}
                    accept={DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(',')}
                    disabled={isSubmitting}
                    className="gap-4 sm:gap-6"
                  >
                    <div>
                      <FileUploadTrigger asChild>
                        <Button id="fileUploadTrigger" variant="secondary" className={cn(filesError !== undefined && 'border-red-500 text-red-500 hover:bg-red-100 focus:bg-red-100')} startIcon={faArrowUpFromBracket}>
                          {t(($) => $.upload.addFile)}
                        </Button>
                      </FileUploadTrigger>
                    </div>
                    <FileUploadList className="gap-4 sm:gap-6">
                      {filesWithTypes.map(({ id, file, documentType }) => {
                        const fileError = errors?.properties?.files?.properties?.[id]?.properties?.file?.errors[0];
                        const documentTypeError = errors?.properties?.files?.properties?.[id]?.properties?.documentType?.errors[0];
                        return (
                          <FileUploadItem
                            id={`file-upload-item-${id}`}
                            key={id}
                            value={id}
                            className={cn('flex-col items-stretch gap-3 sm:gap-4', fileError && 'border-red-500 focus:border-red-500 focus:ring-3 focus:ring-red-500 focus:outline-hidden')}
                            tabIndex={-1}
                          >
                            {fileError && <InputError id={`file-error-${id}`} fieldId={`file-upload-item-${id}`} message={fileError} />}
                            <dl className="space-y-3 sm:space-y-4">
                              <div className="space-y-2">
                                <dt className="font-semibold">{t(($) => $.upload.fileName)}</dt>
                                <dd>{file.name}</dd>
                              </div>
                            </dl>
                            <InputSelect
                              id={`document-type-${id}`}
                              name={`document-type-${id}`}
                              label={t(($) => $.upload.documentType)}
                              required
                              className="w-full"
                              options={docTypeOptions}
                              value={documentType}
                              onChange={(event) => handleDocumentTypeChange(id, event.currentTarget.value)}
                              disabled={isSubmitting}
                              errorMessage={documentTypeError}
                            />
                            <div className="mt-2">
                              <FileUploadItemDelete asChild>
                                <Button variant="secondary" size="sm" endIcon={faTimes} disabled={isSubmitting}>
                                  {t(($) => $.upload.remove)}
                                </Button>
                              </FileUploadItemDelete>
                            </div>
                          </FileUploadItem>
                        );
                      })}
                    </FileUploadList>
                  </FileUpload>
                </fieldset>
              </div>

              <div className="mt-8">
                <LoadingButton
                  id="submit-button"
                  variant="primary"
                  type="submit"
                  loading={isSubmitting && submitAction === FORM_ACTION.upload}
                  disabled={isSubmitting}
                  data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Submit - Upload my documents click"
                >
                  {t(($) => $.upload.submit)}
                </LoadingButton>
              </div>
            </fetcher.Form>
          </ErrorSummaryProvider>
        </section>
        <div>
          <ButtonLink
            id="back-button"
            variant="secondary"
            to={t(($) => $.header.menuDashboardHref, {
              baseUri: SCCH_BASE_URI,
              ns: 'gcweb',
            })}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Return to dashboard - Upload my documents click"
          >
            {t(($) => $.index.returnDashboard)}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
