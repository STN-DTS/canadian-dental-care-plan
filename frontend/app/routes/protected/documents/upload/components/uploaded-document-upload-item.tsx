import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import { DateTimeDisplay } from '~/components/date-time-display';
import { FileUploadItem } from '~/components/file-upload';
import { parseDateTimeString, toLocaleString } from '~/utils/date-utils';

interface UploadedDocumentUploadItemProps {
  id: string;
  fileName: string;
  documentTypeName: string;
  uploadDate?: string;
  timeZone: string;
}

export function UploadedDocumentUploadItem({ id, fileName, documentTypeName, uploadDate, timeZone }: UploadedDocumentUploadItemProps) {
  const { t, i18n } = useTranslation('documents');
  const fileNameId = `file-upload-item-${id}-name`;
  const uploadDateDisplay = uploadDate ? toLocaleString(parseDateTimeString(uploadDate), i18n.language, { timeZone }) : undefined;

  return (
    <FileUploadItem id={`file-upload-item-${id}`} aria-labelledby={undefined} aria-describedby={undefined} value={id} className="min-w-0 items-start rounded-none border-green-700 p-4">
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
        {uploadDate && uploadDateDisplay && (
          <div className="wrap-break-word [&_time]:whitespace-normal">
            <dt className="inline">{t(($) => $.upload.uploadedOn)}: </dt>
            <dd className="inline">
              <DateTimeDisplay isoTimestamp={uploadDate} tooltipText={uploadDateDisplay}>
                {uploadDateDisplay}
              </DateTimeDisplay>
            </dd>
          </div>
        )}
        <div className="sr-only">
          <dt>{t(($) => $.upload.status)}</dt>
          <dd>{t(($) => $.upload.uploadedSuccessfully)}</dd>
        </div>
      </dl>
    </FileUploadItem>
  );
}
