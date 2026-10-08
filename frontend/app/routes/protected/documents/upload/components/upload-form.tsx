import { useMemo } from 'react';

import { faArrowUpFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import { Button } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-provider';
import { FileUpload, FileUploadList, FileUploadTrigger } from '~/components/file-upload';
import { InputError } from '~/components/input-error';
import { InputLegend } from '~/components/input-legend';
import type { InputOptionProps } from '~/components/input-option';
import { LoadingButton } from '~/components/loading-button';
import { useClientEnv, useFetcherSubmissionState } from '~/hooks';
import { PendingDocumentUploadItem } from '~/routes/protected/documents/upload/components/pending-document-upload-item';
import { UploadedDocumentUploadItem } from '~/routes/protected/documents/upload/components/uploaded-document-upload-item';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { useDocumentUploadForm } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { cn } from '~/utils/tw-utils';
import { bytesToFilesize, megabytesToBytes } from '~/utils/units-utils';

interface DocumentUploadFormProps {
  documentTypes: ReadonlyArray<{ id: string; name: string }>;
}

export function DocumentUploadForm({ documentTypes }: DocumentUploadFormProps) {
  const { t, i18n } = useTranslation('documents');
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS, DOCUMENT_UPLOAD_MAX_FILE_COUNT, DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB } = useClientEnv();

  const fetcher = useDocumentUploadFetcher();
  const { isSubmitting, submitAction } = useFetcherSubmissionState(fetcher);
  const { documentUploadFormState, handleBeforeFilesAdd, handleDocumentTypeChange, handleFileChange, submitForm } = useDocumentUploadForm();

  const filesWithTypes = useMemo(() => [...documentUploadFormState.documents], [documentUploadFormState.documents]);

  const errors = fetcher.data?.errors;
  const filesError = errors?.properties?.files?.errors[0];
  const fileUploadDescriptionId = filesError ? 'files-error file-upload-instructions' : 'file-upload-instructions';

  const docTypeOptions = useMemo<InputOptionProps[]>(() => {
    return [
      {
        children: t(($) => $.upload.selectOne),
        value: '',
        disabled: true,
        hidden: true,
      },
      ...documentTypes.map((documentType) => ({ children: documentType.name, value: documentType.id })),
    ];
  }, [documentTypes, t]);

  return (
    <ErrorSummaryProvider actionData={fetcher.data}>
      <ErrorSummary />
      <fetcher.Form
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          submitForm(event.currentTarget);
        }}
        noValidate
      >
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
              required
              className="gap-4 sm:gap-6"
            >
              <div>
                <FileUploadTrigger asChild>
                  <Button id="fileUploadTrigger" variant="secondary" aria-describedby={fileUploadDescriptionId} className={cn(filesError !== undefined && 'border-red-500 text-red-500 hover:bg-red-100 focus:bg-red-100')} startIcon={faArrowUpFromBracket}>
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
              <FileUploadList className="gap-4 sm:gap-6">
                {filesWithTypes.map(({ id, file, documentType, status }) => {
                  if (status === 'uploaded') {
                    return <UploadedDocumentUploadItem key={id} id={id} fileName={file.name} documentTypeName={documentTypes.find((type) => type.id === documentType)?.name ?? t(($) => $.upload.documentTypeUnavailable)} />;
                  }

                  const fileError = errors?.properties?.files?.properties?.[id]?.properties?.file?.errors[0];
                  const documentTypeError = errors?.properties?.files?.properties?.[id]?.properties?.documentType?.errors[0];

                  return (
                    <PendingDocumentUploadItem
                      key={id}
                      id={id}
                      fileName={file.name}
                      documentType={documentType}
                      documentTypeOptions={docTypeOptions}
                      disabled={isSubmitting}
                      fileError={fileError}
                      documentTypeError={documentTypeError}
                      onDocumentTypeChange={handleDocumentTypeChange}
                    />
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
  );
}
