import { invariant } from '@dts-stn/invariant';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/index';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import type { IdToken, UserinfoToken } from '~/.server/utils/raoidc.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/table';
import { pageIds } from '~/page-ids';
import { parseDateTimeString, toLocaleDateString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  pageIdentifier: pageIds.protected.documents.index,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('doc-upload');
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const locale = getLocale(url);

  const userInfoToken: UserinfoToken = session.get('userInfoToken');
  invariant(userInfoToken.sin, 'Expected userInfoToken.sin to be defined');

  const applicant = await securityHandler.requireApplicant({ params, requestUrl: url, session });

  const evidentiaryDocumentService = appContainer.get(TYPES.EvidentiaryDocumentService);
  const evidentiaryDocuments = await evidentiaryDocumentService.listLocalizedEvidentiaryDocuments({ clientId: applicant.clientId, userId: userInfoToken.sub }, locale);

  const t = await getFixedT(url, ['documents', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.index.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents', { userId: idToken.sub });

  const { TIME_ZONE } = appContainer.get(TYPES.ClientConfig);

  return {
    meta,
    documents: evidentiaryDocuments.map((document) => {
      return {
        ...document,
        mscaUploadDateFormatted: toLocaleDateString(parseDateTimeString(document.mscaUploadDate), locale, { timeZone: TIME_ZONE }),
      };
    }),
    SCCH_BASE_URI,
  };
}

export default function DocumentsIndex({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['documents', 'gcweb']);
  const { documents, SCCH_BASE_URI } = loaderData;
  const hasDocuments = documents.length > 0;

  return (
    <>
      <AppPageTitle>{t(($) => $.index.pageTitle)}</AppPageTitle>
      <div className="space-y-8">
        <div className="space-y-4">
          <p>{hasDocuments ? t(($) => $.index.hasDocuments) : t(($) => $.index.noDocuments)}</p>
          {hasDocuments && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(($) => $.index.tableHeaders.fileName)}</TableHead>
                  <TableHead>{t(($) => $.index.tableHeaders.applicant)}</TableHead>
                  <TableHead>{t(($) => $.index.tableHeaders.typeOfDocument)}</TableHead>
                  <TableHead>{t(($) => $.index.tableHeaders.dateUploaded)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id} className="odd:bg-white even:bg-gray-50">
                    <TableCell className="max-w-[200px] break-all">{document.fileName}</TableCell>
                    <TableCell>{`${document.client.firstName} ${document.client.lastName}`}</TableCell>
                    <TableCell>{document.documentType.name}</TableCell>
                    <TableCell className="text-nowrap">{document.mscaUploadDateFormatted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div>
          <ButtonLink id="upload-button" routeId="protected/documents/upload" params={params} variant="primary" data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Upload documents - Submitted documents click">
            {t(($) => $.index.uploadDocuments)}
          </ButtonLink>
        </div>
        <div>
          <ButtonLink
            id="back-button"
            variant="secondary"
            to={t(($) => $.header.menuDashboardHref, {
              baseUri: SCCH_BASE_URI,
              ns: 'gcweb',
            })}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Return to dashboard - Submitted documents click"
          >
            {t(($) => $.index.returnDashboard)}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
