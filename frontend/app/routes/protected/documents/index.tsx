import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/index';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { DateTimeDisplay } from '~/components/date-time-display';
import { InlineLink } from '~/components/inline-link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/table';
import { pageIds } from '~/page-ids';
import { getHints } from '~/utils/client-hints';
import { parseDateTimeString, toLocaleDateString, toLocaleString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  pageIdentifier: pageIds.protected.documents.index,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const applicant = getApplicant(context);
  const user = getUser(context);
  const locale = getLocale(url);

  const evidentiaryDocumentService = appContainer.get(TYPES.EvidentiaryDocumentService);
  const evidentiaryDocuments = await evidentiaryDocumentService.listLocalizedEvidentiaryDocuments({ clientId: applicant.clientId, userId: user.id }, locale);

  const t = await getFixedT(url, ['documents', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.index.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);
  const { timeZone } = getHints(request);

  appContainer.get(TYPES.AuditService).createAudit('page-view.documents', { userId: user.id });

  return {
    meta,
    documents: evidentiaryDocuments.map((document) => {
      const mscaUploadDate = parseDateTimeString(document.mscaUploadDate);
      return {
        ...document,
        mscaUploadIsoTimestamp: mscaUploadDate.toISOString(),
        mscaUploadDateDisplay: toLocaleDateString(mscaUploadDate, locale, { timeZone }),
        mscaUploadDateTooltip: toLocaleString(mscaUploadDate, locale, { timeZone }),
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
                  <TableHead>{t(($) => $.index.tableHeaders.typeOfDocument)}</TableHead>
                  <TableHead>{t(($) => $.index.tableHeaders.submittedBy)}</TableHead>
                  <TableHead>{t(($) => $.index.tableHeaders.dateReceived)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id} className="odd:bg-white even:bg-gray-50">
                    <TableCell className="max-w-50 break-all">{document.fileName}</TableCell>
                    <TableCell>{document.documentType.name}</TableCell>
                    <TableCell>{`${document.client.firstName} ${document.client.lastName}`}</TableCell>
                    <TableCell className="text-nowrap">
                      <DateTimeDisplay isoTimestamp={document.mscaUploadIsoTimestamp} tooltipText={document.mscaUploadDateTooltip}>
                        {document.mscaUploadDateDisplay}
                      </DateTimeDisplay>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {!hasDocuments && (
          <div className="space-y-4">
            <h2 className="font-lato text-2xl font-bold">{t(($) => $.index.whatYouCanDoHeading)}</h2>
            <p>
              <Trans
                ns="documents"
                i18nKey={($) => $.index.whatYouCanDo}
                components={{ uploadLink: <InlineLink routeId="protected/documents/upload" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Upload documents - Submitted documents click" /> }}
              />
            </p>
          </div>
        )}
        {hasDocuments && (
          <div>
            <ButtonLink id="upload-button" routeId="protected/documents/upload" params={params} variant="primary" data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Upload documents - Submitted documents click">
              {t(($) => $.index.uploadDocuments)}
            </ButtonLink>
          </div>
        )}
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
