import { faCirclePlus, faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/dental-insurance';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadPublicApplicationFullAdultState } from '~/.server/routes/helpers/public-application-full-adult-route-helpers';
import { isDentalBenefitsSectionCompleted, isDentalInsuranceSectionCompleted } from '~/.server/routes/helpers/public-application-full-section-checks';
import { validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/public/application/full-adult/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.public.application.fullAdult.dentalInsurance,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationFullAdultState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['full-adult']);

  const t = await getFixedT(url, ['applicationFullAdult', 'gcweb']);
  const locale = getLocale(url);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.dentalInsurance.pageTitle) }),
  };

  const selectedFederalGovernmentInsurancePlan = state.dentalBenefits?.value?.federalSocialProgram
    ? await appContainer.get(TYPES.FederalGovernmentInsurancePlanService).getLocalizedFederalGovernmentInsurancePlanById(state.dentalBenefits.value.federalSocialProgram, locale)
    : undefined;

  const selectedProvincialBenefit = state.dentalBenefits?.value?.provincialTerritorialSocialProgram
    ? await appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService).getLocalizedProvincialGovernmentInsurancePlanById(state.dentalBenefits.value.provincialTerritorialSocialProgram, locale)
    : undefined;

  return {
    state: {
      dentalInsurance: state.dentalInsurance,
      dentalBenefits:
        state.dentalBenefits?.hasChanged === true
          ? {
              federalBenefit: {
                access: state.dentalBenefits.value.hasFederalBenefits,
                benefit: selectedFederalGovernmentInsurancePlan?.name,
              },
              provTerrBenefit: {
                access: state.dentalBenefits.value.hasProvincialTerritorialBenefits,
                benefit: selectedProvincialBenefit?.name,
              },
            }
          : undefined,
    },
    sections: {
      dentalInsurance: { completed: isDentalInsuranceSectionCompleted(state) },
      dentalBenefits: { completed: isDentalBenefitsSectionCompleted(state) },
    },
    meta,
  };
}

export default function NewAdultDentalInsurance({ loaderData, params }: Route.ComponentProps) {
  const { state, sections } = loaderData;
  const { t } = useTranslation(['applicationFullAdult', 'application']);

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalInsurance.pageHeading)}</AppPageTitle>
      <ProgressStepper activeStep="dentalInsurance" className="mb-8" />
      <div className="max-w-prose space-y-8">
        <div className="space-y-4">
          <p>{t(($) => $.completeAllSections, { ns: 'application' })}</p>
          <p>{completedSectionsLabel}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.dentalInsurance.accessToDentalInsurance)}</h2>
            </CardTitle>
            <CardAction>{sections.dentalInsurance.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {state.dentalInsurance?.dentalInsuranceEligibilityConfirmation === true ? (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.dentalInsurance.accessToDentalInsuranceOrCoverage)}>
                  {state.dentalInsurance.hasDentalInsurance ? t(($) => $.dentalInsurance.dentalInsuranceYes) : t(($) => $.dentalInsurance.dentalInsuranceNo)}
                </DefinitionListItem>
              </DefinitionList>
            ) : (
              <p>{t(($) => $.dentalInsurance.dentalInsuranceIndicateStatus)}</p>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="edit-insurance-button"
              variant="link"
              className="p-0"
              routeId="public/application/$id/dental-insurance"
              params={params}
              startIcon={sections.dentalInsurance.completed ? faPenToSquare : faCirclePlus}
              size="lg"
              aria-label={state.dentalInsurance === undefined ? `${t(($) => $.dentalInsurance.addAnswer)} - ${t(($) => $.dentalInsurance.accessToDentalInsurance)}` : t(($) => $.dentalInsurance.editAccessToDentalInsurance)}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Full_Adult:Edit insurance click"
            >
              {state.dentalInsurance === undefined ? t(($) => $.dentalInsurance.addAnswer) : t(($) => $.dentalInsurance.editAccessToDentalInsurance)}
            </ButtonLink>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.dentalInsurance.otherBenefits)}</h2>
            </CardTitle>
            <CardAction>{sections.dentalBenefits.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {state.dentalBenefits ? (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.dentalInsurance.accessToGovernmentBenefits)}>
                  {state.dentalBenefits.federalBenefit.access || state.dentalBenefits.provTerrBenefit.access ? (
                    <div className="space-y-3">
                      <p>{t(($) => $.dentalInsurance.accessToGovernmentBenefitsYes)}</p>
                      <ul className="list-disc space-y-1 pl-7">
                        {state.dentalBenefits.federalBenefit.access && <li>{state.dentalBenefits.federalBenefit.benefit}</li>}
                        {state.dentalBenefits.provTerrBenefit.access && <li>{state.dentalBenefits.provTerrBenefit.benefit}</li>}
                      </ul>
                    </div>
                  ) : (
                    <p>{t(($) => $.dentalInsurance.accessToGovernmentBenefitsNo)}</p>
                  )}
                </DefinitionListItem>
              </DefinitionList>
            ) : (
              <p>{t(($) => $.dentalInsurance.dentalBenefitsIndicateStatus)}</p>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="edit-benefits-button"
              variant="link"
              className="p-0"
              routeId="public/application/$id/federal-provincial-territorial-benefits"
              params={params}
              startIcon={sections.dentalBenefits.completed ? faPenToSquare : faCirclePlus}
              size="lg"
              aria-label={state.dentalBenefits === undefined ? `${t(($) => $.dentalInsurance.addAnswer)} - ${t(($) => $.dentalInsurance.otherBenefits)}` : t(($) => $.dentalInsurance.editAccessToGovernmentBenefits)}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Full_Adult:Edit benefits click"
            >
              {state.dentalBenefits === undefined ? t(($) => $.dentalInsurance.addAnswer) : t(($) => $.dentalInsurance.editAccessToGovernmentBenefits)}
            </ButtonLink>
          </CardFooter>
        </Card>

        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink
            disabled={!allSectionsCompleted}
            variant="primary"
            direction="next"
            routeId="public/application/$id/full-adult/submit"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Full_Adult:Continue click"
          >
            {t(($) => $.dentalInsurance.submit)}
          </NavigationButtonLink>
          <NavigationButtonLink variant="secondary" direction="previous" routeId="public/application/$id/full-adult/contact-information" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Full_Adult:Back click">
            {t(($) => $.dentalInsurance.contactInformation)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}
