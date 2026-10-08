import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import { FileUploadItem } from '~/components/file-upload';

interface UploadedDocumentUploadItemProps {
  id: string;
  fileName: string;
  documentTypeName: string;
}

export function UploadedDocumentUploadItem({ id, fileName, documentTypeName }: UploadedDocumentUploadItemProps) {
  const { t } = useTranslation('documents');
  const fileNameId = `file-upload-item-${id}-name`;
  const statusId = `file-upload-item-${id}-status`;

  return (
    <FileUploadItem id={`file-upload-item-${id}`} aria-labelledby={fileNameId} aria-describedby={statusId} value={id} className="min-w-0 flex-col items-stretch gap-3 sm:gap-4">
      <dl className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <dt className="font-semibold">{t(($) => $.upload.fileName)}</dt>
          <dd id={fileNameId} className="wrap-break-word">
            {fileName}
          </dd>
        </div>
        <div className="space-y-2">
          <dt className="font-semibold">{t(($) => $.upload.documentType)}</dt>
          <dd>{documentTypeName}</dd>
        </div>
        <div className="space-y-2">
          <dt className="font-semibold">{t(($) => $.upload.status)}</dt>
          <dd id={statusId} className="flex items-baseline gap-2">
            <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" className="shrink-0 text-green-700" />
            <span>{t(($) => $.upload.uploadedSuccessfully)}</span>
          </dd>
        </div>
      </dl>
    </FileUploadItem>
  );
}
