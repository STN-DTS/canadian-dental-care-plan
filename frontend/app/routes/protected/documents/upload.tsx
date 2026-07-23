import { useMemo, useState } from 'react';
import type { JSX } from 'react';

import { redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { faArrowUpFromBracket, faTimes } from '@fortawesome/free-solid-svg-icons';
import { fileTypeFromBuffer } from 'file-type';
import type { TFunction } from 'i18next';
import { getI18n, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/upload';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import type { DocumentUploadService } from '~/.server/domain/services';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import type { IdToken } from '~/.server/utils/raoidc-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { Button, ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { FileUpload, FileUploadItem, FileUploadItemDelete, FileUploadList, FileUploadTrigger } from '~/components/file-upload';
import type { FileState } from '~/components/file-upload';
import { InputError } from '~/components/input-error';
import { InputLegend } from '~/components/input-legend';
import type { InputOptionProps } from '~/components/input-option';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useClientEnv } from '~/root';
import { expectDefined } from '~/utils/assert-utils';
import { getClientEnv } from '~/utils/env-utils';
import { arrayBufferToBase64, getFileExtension, getMimeType } from '~/utils/file-utils';
import { getLanguage } from '~/utils/locale-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { cn } from '~/utils/tw-utils';
import { bytesToFilesize, megabytesToBytes } from '~/utils/units-utils';

type FileStateWithDocumentType = FileState & { readonly documentType: string };

type DocumentUploadSchema = ReturnType<typeof createDocumentUploadSchema>;
type DocumentUploadSchemaOuput = z.output<DocumentUploadSchema>;
type DocumentUploadSchemaErrorTree = z.core.$ZodErrorTree<DocumentUploadSchemaOuput>;

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.documents.upload,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  const { t } = useTranslation('documents');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.index.pageTitle),
          routeId: 'protected/documents/index',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('doc-upload');
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const clientApplication = await securityHandler.requireClientApplication({
    params,
    requestUrl: url,
    session,
    options: { redirectUrl: getPathById('protected/documents/not-required', params) },
  });

  await securityHandler.requireEnrolledApplicant({
    clientNumber: clientApplication.applicantInformation.clientNumber,
    params,
    options: { redirectUrl: getPathById('protected/documents/not-required', params) },
  });

  const locale = getLocale(url);
  const t = await getFixedT(url, ['documents', 'gcweb']);

  const applicants: Array<{ clientId: string; clientNumber: string; name: string }> = [
    {
      clientId: clientApplication.applicantInformation.clientId,
      clientNumber: clientApplication.applicantInformation.clientNumber,
      name: `${clientApplication.applicantInformation.firstName} ${clientApplication.applicantInformation.lastName}`.trim(),
    },
    // TODO: Add children later when upload for children is supported
    // ...clientApplication.children.map((c) => ({
    //   clientId: c.information.clientId,
    //   clientNumber: c.information.clientNumber,
    //   name: `${c.information.firstName} ${c.information.lastName}`.trim(),
    // })),
  ];

  const documentTypes = await appContainer.get(TYPES.EvidentiaryDocumentTypeService).listLocalizedEvidentiaryDocumentTypes(locale);

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);
  const idToken: IdToken = session.get('idToken');

  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-upload', { userId: idToken.sub });

  return {
    meta: {
      title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.upload.pageTitle) }),
    },
    applicants,
    documentTypes,
    SCCH_BASE_URI,
  };
}

export async function clientAction({ request, url, serverAction }: Route.ClientActionArgs) {
  const formData = await request.clone().formData();
  const locale = getLanguage(url);
  const t = getI18n().getFixedT(locale, 'documents');
  const env = getClientEnv();

  const validationResult = await validateUploadForm(formData, locale, t, {
    allowedExtensions: env.DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS,
    maxSizeMB: env.DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB,
    maxCount: env.DOCUMENT_UPLOAD_MAX_FILE_COUNT,
  });

  if (!validationResult.success) {
    return { errors: validationResult.errors };
  }

  return await serverAction();
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('doc-upload');
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const formData = await request.formData();
  securityHandler.validateCsrfToken({ formData, session });

  const clientApplication = await securityHandler.requireClientApplication({
    params,
    requestUrl: url,
    session,
    options: { redirectUrl: getPathById('protected/documents/not-required', params) },
  });

  await securityHandler.requireEnrolledApplicant({
    clientNumber: clientApplication.applicantInformation.clientNumber,
    params,
    options: { redirectUrl: getPathById('protected/documents/not-required', params) },
  });

  const clientIdToNumberMap: ReadonlyMap<string, string> = new Map<string, string>([
    [clientApplication.applicantInformation.clientId, clientApplication.applicantInformation.clientNumber] as const,
    ...clientApplication.children.map((c) => [c.information.clientId, c.information.clientNumber] as const),
  ]);

  const locale = getLocale(url);
  const t = await getFixedT(locale, 'documents');
  const config = appContainer.get(TYPES.ClientConfig);
  const idToken: IdToken = session.get('idToken');
  const allowedExtensions = config.DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS;

  const validationResult = await validateUploadForm(formData, locale, t, {
    allowedExtensions,
    maxSizeMB: config.DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB,
    maxCount: config.DOCUMENT_UPLOAD_MAX_FILE_COUNT,
  });

  if (!validationResult.success) {
    return { errors: validationResult.errors };
  }

  const { applicant, files } = validationResult.data;
  const uploadService = appContainer.get(TYPES.DocumentUploadService);

  const scanResult = await scanDocuments({ allowedExtensions, files, userId: idToken.sub, service: uploadService, t });
  if (!scanResult.success) {
    return { errors: scanResult.errors };
  }

  const clientNumber = clientIdToNumberMap.get(applicant);
  invariant(clientNumber, 'Client number not found for client ID: ' + applicant);
  const uploadResult = await uploadDocuments({ clientNumber, files: files, service: uploadService, t, userId: idToken.sub });

  if (!uploadResult.success) {
    return { errors: uploadResult.errors };
  }

  await createMetadata({ appContainer, clientId: applicant, files, userId: idToken.sub });

  return redirect(getPathById('protected/documents/index', params));
}

async function validateUploadForm(
  formData: FormData,
  locale: string,
  t: TFunction<'documents'>,
  config: { allowedExtensions: readonly string[]; maxSizeMB: number; maxCount: number },
): Promise<{ success: true; data: DocumentUploadSchemaOuput } | { success: false; errors: DocumentUploadSchemaErrorTree }> {
  const schema = createDocumentUploadSchema({ locale, t, allowedExtensions: config.allowedExtensions, maxFileSizeInMB: config.maxSizeMB, maxFileCount: config.maxCount });

  // Parse form data into expected structure
  const fileIds = formData.getAll('file_id') as string[];
  const fileObjects = formData.getAll('file_object') as File[];
  const documentTypes = formData.getAll('file_document_type') as string[];

  // Build files record
  const files: Record<string, { file: File; fileBuffer: ArrayBuffer; fileHash: string; documentType: string }> = {};

  for (const [i, fileId] of fileIds.entries()) {
    const file = expectDefined(fileObjects[i], 'Expected file object at index ' + i);
    const fileBuffer = await file.arrayBuffer();
    const fileHashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const fileHash = [...new Uint8Array(fileHashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const documentType = documentTypes[i] ?? '';
    files[fileId] = { file, fileBuffer, fileHash, documentType };
  }

  // Build final data object
  const data = {
    applicant: formData.get('applicant'),
    files: files,
  };

  // Validate using Zod schema
  const result = schema.safeParse(data);

  if (!result.success) {
    return { success: false, errors: z.treeifyError(result.error) };
  }

  return { success: true, data: result.data };
}

interface ScanDocumentsRequestArgs {
  allowedExtensions: ReadonlyArray<string>;
  files: DocumentUploadSchemaOuput['files'];
  userId: string;
  service: DocumentUploadService;
  t: TFunction<'documents'>;
}

async function scanDocuments({ allowedExtensions, files, service, t, userId }: ScanDocumentsRequestArgs): Promise<UploadDocumentsResponseArgs> {
  const allowedMimeTypes = new Set(allowedExtensions.map(getMimeType));

  const promises = Object.entries(files).map(async ([id, { file, fileBuffer }]) => {
    try {
      const invalidTypeError = t(($) => $.upload.errorMessage.invalidFileType, {
        filename: file.name,
        extensions: allowedExtensions.join(', '),
      });

      const detected = await fileTypeFromBuffer(fileBuffer);
      const declared = file.type;

      // --- MIME VALIDATION ----------------------------------------------------

      // no detected type → only allow declared text/plain
      if (!detected && declared !== 'text/plain') {
        return { id, error: invalidTypeError };
      }

      // detected but not allowed
      if (detected && !allowedMimeTypes.has(detected.mime)) {
        return { id, error: invalidTypeError };
      }

      // --- VIRUS SCAN ---------------------------------------------------------

      const scanResponse = await service.scanDocument({
        fileName: file.name,
        binary: arrayBufferToBase64(fileBuffer),
        userId,
      });

      if (scanResponse.Error) {
        return {
          id,
          error: t(($) => $.upload.errorMessage.scanFailed, {
            error: scanResponse.Error.ErrorMessage,
            code: scanResponse.Error.ErrorCode,
          }),
        };
      }

      return { id, success: true };
    } catch {
      return {
        id,
        error: t(($) => $.upload.errorMessage.scanError),
      };
    }
  });

  const results = await Promise.all(promises);
  return processBatchResults(results);
}

interface UploadDocumentsRequestArgs {
  clientNumber: string;
  files: DocumentUploadSchemaOuput['files'];
  userId: string;
  service: DocumentUploadService;
  t: TFunction<'documents'>;
}

type UploadDocumentsResponseArgs =
  | { success: true; errors?: undefined } //
  | { success: false; errors: DocumentUploadSchemaErrorTree };

async function uploadDocuments({ clientNumber, files, service, t, userId }: UploadDocumentsRequestArgs): Promise<UploadDocumentsResponseArgs> {
  const promises = Object.entries(files).map(async ([id, { file, fileBuffer, documentType }]) => {
    try {
      const response = await service.uploadDocument({
        clientNumber,
        evidentiaryDocumentTypeId: documentType,
        fileName: file.name,
        binary: arrayBufferToBase64(fileBuffer),
        uploadDate: new Date(),
        userId,
      });

      return response.Error //
        ? {
            id,
            error: t(($) => $.upload.errorMessage.uploadFailed, {
              error: response.Error.ErrorMessage,
              code: response.Error.ErrorCode,
            }),
          }
        : { id, success: true };
    } catch {
      return {
        id,
        error: t(($) => $.upload.errorMessage.uploadError),
      };
    }
  });

  const results = await Promise.all(promises);
  return processBatchResults(results);
}

function processBatchResults(results: ReadonlyArray<{ id: string; error?: string }>):
  | { success: true; errors?: undefined } //
  | { success: false; errors: DocumentUploadSchemaErrorTree } {
  const failures = results.filter((r) => r.error);
  if (failures.length === 0) return { success: true };

  const errors: DocumentUploadSchemaErrorTree = {
    errors: [],
    properties: {
      files: {
        errors: [],
        properties: {},
      },
    },
  };

  for (const { id, error } of failures) {
    if (error && errors.properties?.files?.properties) {
      errors.properties.files.properties[id] = {
        errors: [],
        properties: {
          file: {
            errors: [error],
          },
        },
      };
    }
  }

  return { success: false, errors };
}

interface CreateMetadataArgs {
  appContainer: AppContainerProvider;
  clientId: string;
  files: DocumentUploadSchemaOuput['files'];
  userId: string;
}

async function createMetadata({ appContainer, clientId, files, userId }: CreateMetadataArgs) {
  const reasons = await appContainer.get(TYPES.DocumentUploadReasonService).listDocumentUploadReasons();
  const reasonId = expectDefined(reasons[0], 'Expected at least one document upload reason').id;
  const recordSource = Number(appContainer.get(TYPES.ServerConfig).EWDU_RECORD_SOURCE_MSCA);
  const evidentiaryDocumentService = appContainer.get(TYPES.EvidentiaryDocumentService);
  return await evidentiaryDocumentService.createEvidentiaryDocumentMetadata({
    clientId: clientId,
    documents: Object.entries(files).map(([fileId, { file, documentType }]) => ({
      fileName: file.name,
      evidentiaryDocumentTypeId: documentType,
      documentUploadReasonId: reasonId,
      recordSource,
      uploadDate: new Date(),
    })),
    userId: userId,
  });
}

type CreateDocumentUploadSchemaArgs = {
  locale: string;
  t: TFunction<'documents'>;
  allowedExtensions: ReadonlyArray<string>;
  maxFileSizeInMB: number;
  maxFileCount: number;
};

function createDocumentUploadSchema({ locale, t, allowedExtensions, maxFileSizeInMB, maxFileCount }: CreateDocumentUploadSchemaArgs) {
  const maxFileSizeInBytes = megabytesToBytes(maxFileSizeInMB);

  const fileSchema = z
    .object({
      file: z.instanceof(File),
      fileBuffer: z.instanceof(ArrayBuffer),
      fileHash: z.string(),
      documentType: z.string(),
    })
    .superRefine((data, ctx) => {
      if (!allowedExtensions.includes(getFileExtension(data.file.name))) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.invalidFileType, {
            filename: data.file.name,
            extensions: allowedExtensions.join(', '),
          }),
          path: ['file'],
        });
      } else if (data.file.size > maxFileSizeInBytes) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.fileTooLarge, {
            filename: data.file.name,
            filesize: bytesToFilesize(maxFileSizeInBytes, `${locale}-CA`),
          }),
          path: ['file'],
        });
      } else if (!data.documentType) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.upload.errorMessage.documentTypeRequired, {
            filename: data.file.name,
          }),
          path: ['documentType'],
        });
      }
    });

  return z.object({
    applicant: z
      .string(t(($) => $.upload.errorMessage.applicantRequired)) //
      .trim()
      .nonempty(t(($) => $.upload.errorMessage.applicantRequired)),
    files: z
      .record(z.string(), fileSchema) //
      .refine(
        (value) => Object.keys(value).length > 0,
        t(($) => $.upload.errorMessage.fileRequired),
      )
      .refine(
        (value) => Object.keys(value).length <= maxFileCount,
        t(($) => $.upload.errorMessage.tooManyFiles, { count: maxFileCount }),
      )
      .superRefine((files, ctx) => {
        const seenFiles = new Set<string>();
        for (const [id, { file, fileHash }] of Object.entries(files)) {
          const fileKey = `file-${file.name}-${file.size}-${fileHash}`;
          if (seenFiles.has(fileKey)) {
            ctx.addIssue({
              code: 'custom',
              message: t(($) => $.upload.errorMessage.duplicateFile, { filename: file.name }),
              path: [id, 'file'],
            });
          } else {
            seenFiles.add(fileKey);
          }
        }
      }),
  });
}

export default function DocumentsUpload({ loaderData, params }: Route.ComponentProps) {
  const { t, i18n } = useTranslation(['documents', 'gcweb']);
  const { applicants, documentTypes, SCCH_BASE_URI } = loaderData;
  const env = useClientEnv();
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILE_COUNT } = env;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;
  const applicantError = errors?.properties?.applicant?.errors[0];
  const filesError = errors?.properties?.files?.errors[0];

  const [filesWithTypes, setFilesWithTypes] = useState<FileStateWithDocumentType[]>([]);

  const handleFileChange = (files: ReadonlyArray<FileState>) => {
    setFilesWithTypes((prev) => {
      const prevMap = new Map(prev.map((item) => [item.id, item]));
      const newItems: FileStateWithDocumentType[] = [];

      for (const file of files) {
        const prevFile = prevMap.get(file.id);
        if (prevFile) {
          newItems.push(prevFile);
        } else {
          newItems.push({ ...file, documentType: '' });
        }
      }
      const uniqueItems = new Map(newItems.map((item) => [item.id, item]));
      return [...uniqueItems.values()];
    });
  };

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
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

  const applicantOptions = useMemo<InputOptionProps[]>(() => {
    return [
      {
        children: t(($) => $.upload.selectOne),
        value: '',
        disabled: true,
        hidden: true,
      }, //
      ...applicants.map(({ clientId, clientNumber, name }) => ({ children: `${name} - ${clientNumber}`, value: clientId })),
    ];
  }, [applicants, t]);

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

  return (
    <>
      <AppPageTitle>{t(($) => $.upload.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" onSubmit={handleSubmit} noValidate>
            <CsrfTokenInput />
            <div className="space-y-6">
              <InputSelect id="applicant" name="applicant" label={t(($) => $.upload.whoAreYouUploadingFor)} required className="w-full" options={applicantOptions} defaultValue="" errorMessage={applicantError} />
              <fieldset>
                <InputLegend className="mb-2">{t(($) => $.upload.uploadDocument)}</InputLegend>
                <p>{t(($) => $.upload.maxFiles, { count: DOCUMENT_UPLOAD_MAX_FILE_COUNT })}</p>
                <p className="mb-2">
                  {t(($) => $.upload.maxSize, {
                    filesize: bytesToFilesize(megabytesToBytes(env.DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB), `${i18n.language}-CA`),
                    extensions: DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(', '),
                  })}
                </p>
                {filesError && <InputError id="files-error" className="mb-2" fieldId="fileUploadTrigger" message={filesError} />}
                <FileUpload id="file-upload" label={t(($) => $.upload.uploadDocument)} value={filesWithTypes} onValueChange={handleFileChange} accept={DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(',')} className="gap-4 sm:gap-6">
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
                            onChange={(e) => {
                              setFilesWithTypes((prev) => prev.map((p) => (p.id === id ? { ...p, documentType: e.target.value } : p)));
                            }}
                            errorMessage={documentTypeError}
                          />
                          <div className="mt-2">
                            <FileUploadItemDelete asChild>
                              <Button variant="secondary" size="sm" endIcon={faTimes}>
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
              <LoadingButton id="submit-button" variant="primary" type="submit" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Submit - Upload my documents click">
                {t(($) => $.upload.submit)}
              </LoadingButton>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
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
