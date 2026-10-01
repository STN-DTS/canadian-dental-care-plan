import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { faArrowUpFromBracket, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Trans, getI18n, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/upload';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { addSubmittedDocuments, getDocumentUploadSubmittedUrl, loadDocumentUploadState, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { Button, ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-provider';
import { FileUpload, FileUploadItem, FileUploadItemDelete, FileUploadList, FileUploadTrigger } from '~/components/file-upload';
import type { FileState } from '~/components/file-upload';
import { InlineLink } from '~/components/inline-link';
import { InputError } from '~/components/input-error';
import { InputLegend } from '~/components/input-legend';
import type { InputOptionProps } from '~/components/input-option';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';
import { useClientEnv, useFetcherActionComplete, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree } from '~/route-helpers/protected-documents-upload-helpers';
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

interface DocumentUploadItemProps extends FileStateWithDocumentType {
  readonly documentTypeLabel: string;
  readonly fileNameLabel: string;
}

interface UploadedDocumentItemProps extends DocumentUploadItemProps {
  readonly documentTypeName: string;
  readonly uploadedStatus: string;
}

interface PendingDocumentUploadItemProps extends DocumentUploadItemProps {
  readonly disabled: boolean;
  readonly documentTypeError?: string;
  readonly fileError?: string;
  readonly onDocumentTypeChange: (id: string, documentType: string) => void;
  readonly options: InputOptionProps[];
  readonly recoveryStatus?: string;
  readonly removeLabel: string;
}

function UploadedDocumentItem({ id, file, documentTypeLabel, documentTypeName, fileNameLabel, uploadedStatus }: UploadedDocumentItemProps): JSX.Element {
  const fileNameId = `file-upload-item-${id}-name`;
  return (
    <FileUploadItem id={`file-upload-item-${id}`} aria-labelledby={fileNameId} key={id} value={id} className="flex-col items-stretch gap-3 sm:gap-4" tabIndex={-1}>
      <p>{uploadedStatus}</p>
      <dl className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <dt className="font-semibold">{fileNameLabel}</dt>
          <dd id={fileNameId}>{file.name}</dd>
        </div>
        <div className="space-y-2">
          <dt className="font-semibold">{documentTypeLabel}</dt>
          <dd>{documentTypeName}</dd>
        </div>
      </dl>
    </FileUploadItem>
  );
}

function PendingDocumentUploadItem({ id, file, documentType, disabled, documentTypeError, documentTypeLabel, fileError, fileNameLabel, onDocumentTypeChange, options, recoveryStatus, removeLabel }: PendingDocumentUploadItemProps): JSX.Element {
  const fileNameId = `file-upload-item-${id}-name`;
  const fileErrorId = `file-error-${id}`;
  return (
    <FileUploadItem
      id={`file-upload-item-${id}`}
      aria-labelledby={fileNameId}
      aria-describedby={fileError ? fileErrorId : undefined}
      key={id}
      value={id}
      className={cn('flex-col items-stretch gap-3 sm:gap-4', fileError && 'border-red-500 focus:border-red-500 focus:ring-3 focus:ring-red-500 focus:outline-hidden')}
      tabIndex={-1}
    >
      {fileError && <InputError id={fileErrorId} fieldId={`file-upload-item-${id}`} message={fileError} />}
      {recoveryStatus && <p>{recoveryStatus}</p>}
      <dl className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <dt className="font-semibold">{fileNameLabel}</dt>
          <dd id={fileNameId}>{file.name}</dd>
        </div>
      </dl>
      <InputSelect
        id={`document-type-${id}`}
        name={`document-type-${id}`}
        label={documentTypeLabel}
        required
        className="w-full"
        options={options}
        value={documentType}
        onChange={(event) => onDocumentTypeChange(id, event.currentTarget.value)}
        disabled={disabled}
        errorMessage={documentTypeError}
      />
      <div className="mt-2">
        <FileUploadItemDelete asChild aria-describedby={fileNameId}>
          <Button variant="secondary" size="sm" endIcon={faTimes} disabled={disabled}>
            {removeLabel}
          </Button>
        </FileUploadItemDelete>
      </div>
    </FileUploadItem>
  );
}

const FORM_ACTION = {
  upload: 'upload',
  finish: 'finish',
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

  if (formAction === FORM_ACTION.finish) {
    return await serverAction();
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
  if (formAction === FORM_ACTION.finish) {
    const id = z.uuid().parse(formData.get('flow_id'));
    const state = loadDocumentUploadState({ id, params, session });
    if (state.submittedDocuments.length === 0) {
      throw redirect(getPathById('protected/documents/upload', params));
    }

    return redirect(getDocumentUploadSubmittedUrl({ id, params }));
  }

  if (formAction !== FORM_ACTION.upload) {
    throw new Error(`Invalid formAction: ${formAction}`);
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, errors: validationResult.errors } as const, 400);
  }

  const { files } = validationResult.data;
  const submittedFlowIdValue = formData.get('flow_id');
  const submittedFlowId = typeof submittedFlowIdValue === 'string' && submittedFlowIdValue ? submittedFlowIdValue : undefined;
  const existingState = submittedFlowId ? loadDocumentUploadState({ id: submittedFlowId, params, session }) : undefined;
  const confirmedIds = new Set(existingState?.submittedDocuments.map(({ id }) => id));
  const pendingFiles = Object.fromEntries(Object.entries(files).filter(([fileId]) => !confirmedIds.has(fileId)));
  const scanResult = await scanDocuments(pendingFiles);
  const scannedFileIds = new Set(scanResult.scannedFileIds);
  const scannedFiles = Object.fromEntries(Object.entries(pendingFiles).filter(([fileId]) => scannedFileIds.has(fileId)));
  const uploadResult = Object.keys(scannedFiles).length > 0 ? await uploadDocuments(scannedFiles) : { success: true as const, uploadedFileIds: [] };
  const errors = mergeUploadErrors(scanResult.success ? undefined : scanResult.errors, uploadResult.success ? undefined : uploadResult.errors);
  const uploadedFileIds = uploadResult.uploadedFileIds;
  const submittedDocuments = uploadedFileIds.map((fileId) => {
    const fileData = pendingFiles[fileId];
    if (!fileData) throw new Error('An uploaded document was not included in the current request');
    const { file, documentType } = fileData;
    return { id: fileId, fileName: file.name, documentType, fileSize: file.size };
  });
  const failed = errors !== undefined;

  if (submittedFlowId) {
    addSubmittedDocuments({ id: submittedFlowId, params, session, submittedDocuments });
    return data({ formAction, source, flowId: submittedFlowId, uploadedFileIds, errors });
  }

  const id = crypto.randomUUID();
  startDocumentUploadState({ id, session, submittedDocuments });
  if (!failed) {
    return redirect(getDocumentUploadSubmittedUrl({ id, params }));
  }

  return data({ formAction, source, flowId: id, uploadedFileIds, errors });
}

function mergeUploadErrors(...errorTrees: ReadonlyArray<DocumentUploadSchemaErrorTree | undefined>): DocumentUploadSchemaErrorTree | undefined {
  const fileErrors = Object.assign({}, ...errorTrees.map((tree) => tree?.properties?.files?.properties));
  if (Object.keys(fileErrors).length === 0) return undefined;

  return {
    errors: [],
    properties: {
      files: {
        errors: [],
        properties: fileErrors,
      },
    },
  };
}

export default function DocumentsUpload({ loaderData }: Route.ComponentProps) {
  const { t, i18n } = useTranslation(['documents', 'gcweb']);
  const { documentTypes, SCCH_BASE_URI } = loaderData;
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILE_COUNT, DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB } = useClientEnv();

  const fetcher = useFetcher<typeof clientAction | typeof action>();
  const { isSubmitting, submitAction } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;
  const filesError = errors?.properties?.files?.errors[0];
  const fileUploadDescriptionId = filesError ? 'files-error file-upload-instructions' : 'file-upload-instructions';

  const [filesWithTypes, setFilesWithTypes] = useState<FileStateWithDocumentType[]>([]);
  const [flowId, setFlowId] = useState<string>();
  const [uploadedFileIds, setUploadedFileIds] = useState<ReadonlySet<string>>(() => new Set());
  const [recoveryAnnouncement, setRecoveryAnnouncement] = useState('');
  const pendingFileValidationRef = useRef<{ validationId: string; files: ReadonlyArray<File> } | undefined>(undefined);
  const remainingFiles = filesWithTypes.filter(({ id }) => !uploadedFileIds.has(id));
  const canFinish = flowId !== undefined && remainingFiles.length === 0 && uploadedFileIds.size > 0;
  const handleCompletedUpload = useCallback(
    (result: NonNullable<typeof fetcher.data>) => {
      if (!('flowId' in result) || !result.flowId || !('uploadedFileIds' in result)) return;

      const { flowId: nextFlowId, uploadedFileIds: newlyUploadedIds, errors: uploadErrors } = result;
      setFlowId(nextFlowId);
      setUploadedFileIds((previousIds) => new Set([...previousIds, ...newlyUploadedIds]));
      setRecoveryAnnouncement(
        t(($) => $.upload.recovery.summary, {
          uploaded: newlyUploadedIds.length,
          failed: Object.keys(uploadErrors?.properties?.files?.properties ?? {}).length,
        }),
      );
      focusOnNextFrame(() => document.getElementById('upload-recovery-summary'));
    },
    [t],
  );
  useFetcherActionComplete(fetcher, handleCompletedUpload);

  const handleBeforeFilesAdd = useCallback(
    (files: ReadonlyArray<File>) => {
      if (pendingFileValidationRef.current || filesWithTypes.length >= DOCUMENT_UPLOAD_MAX_FILE_COUNT) return false;

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
    [DOCUMENT_UPLOAD_MAX_FILE_COUNT, fetcher, filesWithTypes],
  );

  const handleFileChange = useCallback(
    (files: ReadonlyArray<FileState>) => {
      const previousFileIds = new Set(filesWithTypes.map(({ id }) => id));
      const currentFileIds = new Set(files.map(({ id }) => id));
      const firstAddedFile = files.find(({ id }) => !previousFileIds.has(id));
      const firstRemovedFile = filesWithTypes.find(({ id }) => !currentFileIds.has(id));

      if (!firstAddedFile && !firstRemovedFile) {
        // No files were added or removed, so no need to update focus or state.
        return;
      }

      if (firstAddedFile) {
        focusOnNextFrame(() => document.querySelector<HTMLElement>(`#file-upload-item-${CSS.escape(firstAddedFile.id)}`));
      }

      if (firstRemovedFile) {
        const removedIndex = filesWithTypes.findIndex(({ id }) => id === firstRemovedFile.id);
        focusOnNextFrame(() => {
          const fileNowAtRemovedIndex = files[removedIndex];
          const precedingFile = files[removedIndex - 1];
          const fileToFocus = fileNowAtRemovedIndex ?? precedingFile;
          const focusTargetId = fileToFocus ? `file-upload-item-${fileToFocus.id}` : 'fileUploadTrigger';
          return document.getElementById(focusTargetId);
        });
      }

      setFilesWithTypes((prev) => {
        const prevMap = new Map(prev.map((item) => [item.id, item]));
        return files.map((file) => prevMap.get(file.id) ?? { ...file, documentType: '' });
      });
    },
    [filesWithTypes],
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

    if (fetcher.data.errors) {
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
    const submitter = event.nativeEvent.submitter as HTMLButtonElement | null;
    const formAction = submitter?.value === FORM_ACTION.finish ? FORM_ACTION.finish : FORM_ACTION.upload;
    formData.set('_action', formAction);
    formData.delete('file_id');
    formData.delete('file_object');
    formData.delete('file_document_type');

    if (flowId) formData.set('flow_id', flowId);

    if (formAction === FORM_ACTION.upload) {
      for (const { id, file, documentType } of remainingFiles) {
        formData.append('file_id', id);
        formData.append('file_object', file);
        formData.append('file_document_type', documentType);
      }
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
                <fieldset className="space-y-2">
                  <InputLegend>{t(($) => $.upload.uploadFiles.chooseFile)}</InputLegend>
                  <ul id="file-upload-instructions" className="list-disc space-y-1 pl-7">
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
                    descriptionId={fileUploadDescriptionId}
                    hideInputFromAccessibility
                    value={filesWithTypes}
                    onValueChange={handleFileChange}
                    onBeforeFilesAdd={handleBeforeFilesAdd}
                    accept={DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(',')}
                    disabled={isSubmitting}
                    required={!canFinish}
                    className="gap-4 sm:gap-6"
                  >
                    <div>
                      <FileUploadTrigger asChild disabled={filesWithTypes.length >= DOCUMENT_UPLOAD_MAX_FILE_COUNT}>
                        <Button
                          id="fileUploadTrigger"
                          variant="secondary"
                          aria-describedby={fileUploadDescriptionId}
                          className={cn(filesError !== undefined && 'border-red-500 text-red-500 hover:bg-red-100 focus:bg-red-100')}
                          startIcon={faArrowUpFromBracket}
                        >
                          {t(($) => $.upload.addFile)}
                        </Button>
                      </FileUploadTrigger>
                    </div>
                    <p role="status" aria-atomic="true">
                      {t(($) => $.upload.uploadFiles.filesSelected, {
                        count: DOCUMENT_UPLOAD_MAX_FILE_COUNT,
                        selected: filesWithTypes.length,
                      })}
                    </p>
                    {flowId && (
                      <div id="upload-recovery-summary" role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
                        {recoveryAnnouncement}
                      </div>
                    )}
                    <FileUploadList className="gap-4 sm:gap-6">
                      {filesWithTypes.map((fileState) => {
                        const { id } = fileState;
                        const isUploaded = uploadedFileIds.has(id);
                        const itemProps = {
                          ...fileState,
                          documentTypeLabel: t(($) => $.upload.documentType),
                          fileNameLabel: t(($) => $.upload.fileName),
                        };
                        if (isUploaded) {
                          const documentTypeName = documentTypes.find(({ id: typeId }) => typeId === fileState.documentType)?.name ?? fileState.documentType;
                          return <UploadedDocumentItem {...itemProps} documentTypeName={documentTypeName} uploadedStatus={t(($) => $.upload.recovery.uploaded)} key={id} />;
                        }

                        return (
                          <PendingDocumentUploadItem
                            {...itemProps}
                            disabled={isSubmitting}
                            fileError={errors?.properties?.files?.properties?.[id]?.properties?.file?.errors[0]}
                            documentTypeError={errors?.properties?.files?.properties?.[id]?.properties?.documentType?.errors[0]}
                            options={docTypeOptions}
                            onDocumentTypeChange={handleDocumentTypeChange}
                            recoveryStatus={flowId ? t(($) => $.upload.recovery.notUploaded) : undefined}
                            removeLabel={t(($) => $.upload.remove)}
                            key={id}
                          />
                        );
                      })}
                    </FileUploadList>
                  </FileUpload>
                </fieldset>
              </div>

              <div className="mt-8">
                {!flowId && (
                  <LoadingButton
                    id="submit-button"
                    name="_action"
                    value={FORM_ACTION.upload}
                    variant="primary"
                    type="submit"
                    loading={isSubmitting && submitAction === FORM_ACTION.upload}
                    disabled={isSubmitting}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Submit - Upload my documents click"
                  >
                    {t(($) => $.upload.submit)}
                  </LoadingButton>
                )}
                {flowId && remainingFiles.length > 0 && (
                  <LoadingButton
                    id="submit-remaining-files-button"
                    name="_action"
                    value={FORM_ACTION.upload}
                    variant="primary"
                    type="submit"
                    loading={isSubmitting && submitAction === FORM_ACTION.upload}
                    disabled={isSubmitting}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Submit remaining files click"
                  >
                    {t(($) => $.upload.recovery.submitRemaining)}
                  </LoadingButton>
                )}
                {canFinish && remainingFiles.length === 0 && (
                  <LoadingButton
                    id="finish-upload-button"
                    name="_action"
                    value={FORM_ACTION.finish}
                    variant="primary"
                    type="submit"
                    loading={isSubmitting && submitAction === FORM_ACTION.finish}
                    disabled={isSubmitting}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Finish document upload click"
                  >
                    {t(($) => $.upload.recovery.finish)}
                  </LoadingButton>
                )}
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
