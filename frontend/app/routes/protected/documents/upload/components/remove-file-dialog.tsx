import { useRef } from 'react';

import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import { Button } from '~/components/buttons';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/dialog';
import { FileUploadItemDelete } from '~/components/file-upload';

interface RemoveFileDialogProps {
  fileName: string;
  fileNameId: string;
  disabled: boolean;
}

/**
 * Confirms pending-file removal within a FileUploadItem, preserving cancellation and removal focus.
 * @param props - The file name, its accessible description ID, and submission-disabled state.
 */
export function RemoveFileDialog({ fileName, fileNameId, disabled }: RemoveFileDialogProps) {
  const { t } = useTranslation('documents');
  const removalConfirmedRef = useRef(false);

  return (
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
  );
}
