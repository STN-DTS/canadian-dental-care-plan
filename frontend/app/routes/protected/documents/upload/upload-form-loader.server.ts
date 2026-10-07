import type { Route } from './+types/upload-form';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getUser } from '~/.server/context/user-context';
import { loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const documentUploadState = loadDocumentUploadState({ id: params.id, params, session });

  const locale = getLocale(url);
  const t = await getFixedT(url, ['documents', 'gcweb']);

  const documentTypes = await appContainer.get(TYPES.EvidentiaryDocumentTypeService).listLocalizedEvidentiaryDocumentTypesByStatus(EVIDENTIARY_DOCUMENT_TYPE_STATUS.active, locale);

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const user = getUser(context);
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-upload', { userId: user.id });

  return {
    meta: { title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.upload.pageTitle) }) },
    documentUploadState,
    documentTypes,
    SCCH_BASE_URI,
  };
}
