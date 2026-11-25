import { AUDIT_EVENT_PAGE_VIEW_DOCUMENTS_UPLOAD } from '~/.server/audit/audit-event-ids';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { resetDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';

import type { Route } from './+types/upload-form';

/**
 * Resets an open upload flow and loads localized form data, recording a page-view audit.
 * Every invocation clears the flow's pending and uploaded document metadata.
 * @param args - The route context, flow parameters, and localized URL.
 * @returns The reset flow, document types, page metadata, and dashboard base URI.
 * @throws If the upload flow is missing, invalid, or already finished.
 */
export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);

  const documentUploadState = resetDocumentUploadState({ id: params.id, params, session });

  const locale = getLocale(url);
  const t = await getFixedT(url, ['documents', 'gcweb']);
  const documentTypes = await appContainer.get(TYPES.EvidentiaryDocumentTypeService).listAndSortLocalizedEvidentiaryDocumentTypesByStatus(EVIDENTIARY_DOCUMENT_TYPE_STATUS.active, locale);
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);
  appContainer.get(TYPES.AuditService).createAudit(AUDIT_EVENT_PAGE_VIEW_DOCUMENTS_UPLOAD);

  return {
    meta: { title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.upload.pageTitle) }) },
    documentUploadState,
    documentTypes,
    SCCH_BASE_URI,
  };
}
