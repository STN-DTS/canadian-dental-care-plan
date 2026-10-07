import { useMemo } from 'react';

import { faArrowUpFromBracket, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import { Button } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-provider';
import { FileUpload, FileUploadItem, FileUploadItemDelete, FileUploadList, FileUploadTrigger } from '~/components/file-upload';
import { InputError } from '~/components/input-error';
import { InputLegend } from '~/components/input-legend';
import type { InputOptionProps } from '~/components/input-option';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { useClientEnv, useFetcherSubmissionState } from '~/hooks';
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
  const { filesWithTypes, handleBeforeFilesAdd, handleDocumentTypeChange, handleFileChange, submitForm } = useDocumentUploadForm(fetcher, DOCUMENT_UPLOAD_MAX_FILE_COUNT);

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
                <FileUploadTrigger asChild disabled={filesWithTypes.length >= DOCUMENT_UPLOAD_MAX_FILE_COUNT}>
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
                {filesWithTypes.map(({ id, file, documentType }) => {
                  const fileNameId = `file-upload-item-${id}-name`;
                  const fileError = errors?.properties?.files?.properties?.[id]?.properties?.file?.errors[0];
                  const documentTypeError = errors?.properties?.files?.properties?.[id]?.properties?.documentType?.errors[0];

                  return (
                    <FileUploadItem
                      id={`file-upload-item-${id}`}
                      aria-labelledby={fileNameId}
                      aria-describedby={undefined}
                      key={id}
                      value={id}
                      className={cn('flex-col items-stretch gap-3 sm:gap-4', fileError && 'border-red-500 focus:border-red-500 focus:ring-3 focus:ring-red-500 focus:outline-hidden')}
                      tabIndex={-1}
                    >
                      {fileError && <InputError id={`file-error-${id}`} fieldId={`file-upload-item-${id}`} message={fileError} />}
                      <dl className="space-y-3 sm:space-y-4">
                        <div className="space-y-2">
                          <dt className="font-semibold">{t(($) => $.upload.fileName)}</dt>
                          <dd id={fileNameId}>{file.name}</dd>
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
                        <FileUploadItemDelete asChild aria-describedby={fileNameId}>
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
  );
}
