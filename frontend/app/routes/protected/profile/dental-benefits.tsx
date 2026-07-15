import { useTranslation } from 'react-i18next';

import type { Route } from './+types/dental-benefits';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { InlineLink } from '~/components/inline-link';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  pageIdentifier: pageIds.protected.profile.dentalBenefits,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });

  const t = await getFixedT(url, ['protectedProfile', 'gcweb']);
  const locale = getLocale(url);

  const federalGovernmentInsurancePlanService = appContainer.get(TYPES.FederalGovernmentInsurancePlanService);
  const provincialGovernmentInsurancePlanService = appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService);
  const listAllLocalizedDentalBenefits = await federalGovernmentInsurancePlanService.listAndSortLocalizedFederalGovernmentInsurancePlans(locale);
  const listAllLocalizedProvincialDentalBenefits = await provincialGovernmentInsurancePlanService.listAndSortLocalizedProvincialGovernmentInsurancePlans(locale);

  const clientDentalBenefits = clientApplication.dentalBenefits?.flatMap((id) => {
    const federalBenefit = listAllLocalizedDentalBenefits.find((benefit) => benefit.id === id);
    if (federalBenefit) return [federalBenefit.name];

    const provincialBenefit = listAllLocalizedProvincialDentalBenefits.find((benefit) => benefit.id === id);
    if (provincialBenefit) return [provincialBenefit.name];

    return [];
  });

  const children = clientApplication.children.map((child) => {
    const dentalBenefits = child.dentalBenefits.flatMap((id) => {
      const federalBenefit = listAllLocalizedDentalBenefits.find((benefit) => benefit.id === id);
      if (federalBenefit) return [federalBenefit.name];

      const provincialBenefit = listAllLocalizedProvincialDentalBenefits.find((benefit) => benefit.id === id);
      if (provincialBenefit) return [provincialBenefit.name];

      return [];
    });

    return { ...child, dentalBenefits };
  });

  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.dentalBenefits.pageTitle) }),
  };

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.dental-benefits', { userId: idToken.sub });

  return { meta, clientApplication, clientDentalBenefits, children, SCCH_BASE_URI };
}

export default function ViewGovernmentDentalBenefits({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedProfile', 'gcweb']);
  const { clientApplication, clientDentalBenefits, children, SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalBenefits.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        <p className="mb-4">{t(($) => $.dentalBenefits.accessToDental)}</p>
        <p className="mb-4">{t(($) => $.dentalBenefits.eligibilityCriteria)}</p>
        <section className="space-y-6">
          <h2 className="font-lato text-2xl font-bold">{`${clientApplication.applicantInformation.firstName} ${clientApplication.applicantInformation.lastName}`}</h2>
          <DefinitionList border>
            <DefinitionListItem term={t(($) => $.dentalBenefits.haveAccess)}>
              <div className="space-y-4">
                <p>{clientDentalBenefits && clientDentalBenefits.length > 0 ? t(($) => $.dentalBenefits.yes) : t(($) => $.dentalBenefits.no)}</p>
                {clientDentalBenefits && clientDentalBenefits.length > 0 && (
                  <ul className="list-disc space-y-2 pl-10">
                    {clientDentalBenefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-4 sm:mt-6">
                <InlineLink routeId="protected/profile/dental-benefits/edit" params={params}>
                  {t(($) => $.dentalBenefits.updateLinkText)}
                </InlineLink>
              </div>
            </DefinitionListItem>
          </DefinitionList>
        </section>
        {children.map((child) => {
          const childParams = { ...params, childId: child.information.clientId };
          const childName = `${child.information.firstName} ${child.information.lastName}`;
          return (
            <section className="space-y-6" key={child.information.clientId}>
              <h2 className="font-lato text-2xl font-bold">{childName}</h2>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.dentalBenefits.haveAccess)}>
                  <div className="space-y-4">
                    <p>{child.dentalBenefits.length > 0 ? t(($) => $.dentalBenefits.yes) : t(($) => $.dentalBenefits.no)}</p>
                    {child.dentalBenefits.length > 0 && (
                      <ul className="list-disc space-y-2 pl-10">
                        {child.dentalBenefits.map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-4 sm:mt-6">
                    <InlineLink routeId="protected/profile/dental-benefits/:childId/edit" params={childParams}>
                      {t(($) => $.dentalBenefits.updateLinkText)}
                    </InlineLink>
                  </div>
                </DefinitionListItem>
              </DefinitionList>
            </section>
          );
        })}
        <ButtonLink
          variant="primary"
          id="back-button"
          to={t(($) => $.header.menuDashboardHref, { ns: 'gcweb', baseUri: SCCH_BASE_URI })}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Return to dashboard - Other government dental benefits return button click"
        >
          {t(($) => $.dentalBenefits.returnButton)}
        </ButtonLink>
      </div>
    </>
  );
}
