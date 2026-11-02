import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import { FileUploadItem } from '~/components/file-upload';

interface UploadedDocumentUploadItemProps {
  id: string;
  positionInSet: number;
  setSize: number;
  fileName: string;
  documentTypeName: string;
}

export function UploadedDocumentUploadItem({ id, positionInSet, setSize, fileName, documentTypeName }: UploadedDocumentUploadItemProps) {
  const { t } = useTranslation('documents');
  const fileNameId = `file-upload-item-${id}-name`;

  return (
    <FileUploadItem
      id={`file-upload-item-${id}`}
      // Explicit undefined values suppress FileUploadItem's default labels, leaving the definition list exposed.
      aria-labelledby={undefined}
      aria-describedby={undefined}
      aria-posinset={positionInSet}
      aria-setsize={setSize}
      value={id}
      className="min-w-0 items-start rounded-none border-green-700 p-4"
    >
      <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" className="mt-1 shrink-0 text-green-700" />
      <dl className="min-w-0 space-y-1">
        <div>
          <dt className="sr-only">{t(($) => $.upload.fileName)}</dt>
          <dd id={fileNameId} className="font-semibold wrap-break-word">
            {fileName}
          </dd>
        </div>
        <div className="wrap-break-word">
          <dt className="inline">{t(($) => $.upload.documentType)}: </dt>
          <dd className="inline">{documentTypeName}</dd>
        </div>
        <div className="sr-only">
          <dt>{t(($) => $.upload.status)}</dt>
          <dd>{t(($) => $.upload.uploadedSuccessfully)}</dd>
        </div>
      </dl>
    </FileUploadItem>
  );
}
