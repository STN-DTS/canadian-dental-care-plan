import { useRef } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '~/components/buttons';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/dialog';
import { usePromptOnUnsavedChanges } from '~/hooks/use-prompt-on-unsaved-changes';

interface UnsavedChangesDialogProps {
  isDirty: boolean;
}

/**
 * Guards pending uploads and confirms blocked SPA navigation, restoring focus on cancellation.
 * @param props - Whether the upload form has pending documents.
 */
export function UnsavedChangesDialog({ isDirty }: UnsavedChangesDialogProps) {
  const { t } = useTranslation('documents');
  const blocker = usePromptOnUnsavedChanges(isDirty);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t(($) => $.upload.unsavedChanges.title)}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t(($) => $.upload.unsavedChanges.description)}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary" type="button">
              {t(($) => $.upload.unsavedChanges.stay)}
            </Button>
          </DialogClose>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            {t(($) => $.upload.unsavedChanges.leave)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
