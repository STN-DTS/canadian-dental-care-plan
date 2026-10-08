import { useRef } from 'react';

import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import { Button } from '~/components/buttons';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/dialog';
import { FileUploadItem, FileUploadItemDelete } from '~/components/file-upload';
import { InputError } from '~/components/input-error';
import type { InputOptionProps } from '~/components/input-option';
import { InputSelect } from '~/components/input-select';
import { cn } from '~/utils/tw-utils';

interface PendingDocumentUploadItemProps {
  id: string;
  fileName: string;
  documentType: string;
  documentTypeOptions: InputOptionProps[];
  disabled: boolean;
  fileError?: string;
  documentTypeError?: string;
  onDocumentTypeChange: (id: string, documentType: string) => void;
}

export function PendingDocumentUploadItem({ id, fileName, documentType, documentTypeOptions, disabled, fileError, documentTypeError, onDocumentTypeChange }: PendingDocumentUploadItemProps) {
  const { t } = useTranslation('documents');
  const fileNameId = `file-upload-item-${id}-name`;
  const removalConfirmedRef = useRef(false);

  return (
    <FileUploadItem
      id={`file-upload-item-${id}`}
      aria-labelledby={fileNameId}
      aria-describedby={undefined}
      value={id}
      className={cn('flex-col items-stretch gap-3 sm:gap-4', fileError && 'border-red-500 focus:border-red-500 focus:ring-3 focus:ring-red-500 focus:outline-hidden')}
      tabIndex={-1}
    >
      {fileError && <InputError id={`file-error-${id}`} fieldId={`file-upload-item-${id}`} message={fileError} />}
      <dl className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <dt className="font-semibold">{t(($) => $.upload.fileName)}</dt>
          <dd id={fileNameId}>{fileName}</dd>
        </div>
      </dl>
      <InputSelect
        id={`document-type-${id}`}
        name={`document-type-${id}`}
        label={t(($) => $.upload.documentType)}
        required
        className="w-full"
        options={documentTypeOptions}
        value={documentType}
        onChange={(event) => onDocumentTypeChange(id, event.currentTarget.value)}
        disabled={disabled}
        errorMessage={documentTypeError}
      />
      <div className="mt-2">
        <Dialog
          onOpenChange={(open) => {
            if (open) removalConfirmedRef.current = false;
          }}
        >
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" endIcon={faTimes} disabled={disabled} aria-describedby={fileNameId}>
              {t(($) => $.upload.remove)}
            </Button>
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-md"
            onCloseAutoFocus={(event) => {
              if (removalConfirmedRef.current) event.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t(($) => $.upload.removeFileConfirmation.title)}</DialogTitle>
            </DialogHeader>
            <DialogDescription className="text-base text-inherit">{t(($) => $.upload.removeFileConfirmation.description, { filename: fileName })}</DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="sm" type="button">
                  {t(($) => $.upload.removeFileConfirmation.keep)}
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <FileUploadItemDelete
                  asChild
                  disabled={disabled}
                  onClick={() => {
                    removalConfirmedRef.current = true;
                  }}
                >
                  <Button variant="primary" size="sm" type="button" disabled={disabled}>
                    {t(($) => $.upload.removeFileConfirmation.confirm)}
                  </Button>
                </FileUploadItemDelete>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FileUploadItem>
  );
}
