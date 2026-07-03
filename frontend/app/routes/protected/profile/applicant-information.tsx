import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/applicant-information';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin, isValidSin } from '~/utils/sin-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  pageIdentifier: pageIds.protected.profile.applicantInformation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });

  const t = await getFixedT(url, ['protectedProfile', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.applicantInformation.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const primaryApplicant = {
    firstName: clientApplication.applicantInformation.firstName,
    lastName: clientApplication.applicantInformation.lastName,
    id: clientApplication.applicantInformation.clientNumber,
    dob: clientApplication.dateOfBirth.toString(),
    sin: clientApplication.applicantInformation.socialInsuranceNumber,
  };

  const children = clientApplication.children.map((child) => ({
    firstName: child.information.firstName,
    lastName: child.information.lastName,
    id: child.information.clientNumber,
    dob: child.information.dateOfBirth.toString(),
    sin: child.information.socialInsuranceNumber,
  }));

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.applicant-information', { userId: idToken.sub });

  return {
    meta,
    SCCH_BASE_URI,
    primaryApplicant,
    children,
  };
}

export default function ProtectedApplicantInformation({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedProfile', 'gcweb']);
  const { primaryApplicant, children, SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.applicantInformation.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        <p>
          <Trans ns="protectedProfile" i18nKey={($) => $.applicantInformation.formInstructions} components={{ noWrap: <span className="whitespace-nowrap" /> }} />
        </p>
        <section className="space-y-6">
          <h2 className="font-lato text-2xl font-bold">{`${primaryApplicant.firstName} ${primaryApplicant.lastName}`}</h2>
          <DefinitionList border>
            <DefinitionListItem term={t(($) => $.applicantInformation.memberId)}>{primaryApplicant.id}</DefinitionListItem>
            <DefinitionListItem term={t(($) => $.applicantInformation.dob)}>{primaryApplicant.dob}</DefinitionListItem>
            <DefinitionListItem term={t(($) => $.applicantInformation.sin)}>{isValidSin(primaryApplicant.sin) ? formatSin(primaryApplicant.sin) : primaryApplicant.sin}</DefinitionListItem>
          </DefinitionList>
        </section>
        {children.map((child) => {
          return (
            <section className="space-y-6" key={child.id}>
              <h2 className="font-lato text-2xl font-bold">{`${child.firstName} ${child.lastName}`}</h2>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.applicantInformation.memberId)}>{child.id}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.applicantInformation.dob)}>{child.dob}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.applicantInformation.sin)}>{typeof child.sin === 'string' && isValidSin(child.sin) ? formatSin(child.sin) : child.sin}</DefinitionListItem>
              </DefinitionList>
            </section>
          );
        })}
        <ButtonLink
          variant="primary"
          id="back-button"
          to={t(($) => $.header.menuDashboardHref, {
            baseUri: SCCH_BASE_URI,
            ns: 'gcweb',
          })}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Return to dashboard - Applicant information return button click"
        >
          {t(($) => $.applicantInformation.returnButton)}
        </ButtonLink>
      </div>
    </>
  );
}
