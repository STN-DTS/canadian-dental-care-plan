import type { JSX } from 'react';

import { data, useFetcher, useLoaderData, useParams } from 'react-router';

import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/dental-insurance';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import type { PublicApplicationDentalFederalBenefitsState, PublicApplicationDentalProvincialTerritorialBenefitsState } from '~/.server/routes/helpers/public-application-route-helpers';
import { loadPublicApplicationSimplifiedAdultState } from '~/.server/routes/helpers/public-application-simplified-adult-route-helpers';
import { isDentalBenefitsSectionCompleted, isDentalInsuranceSectionCompleted } from '~/.server/routes/helpers/public-application-simplified-section-checks';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/public/application/simplified-adult/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const FORM_ACTION = {
  DENTAL_BENEFITS_NOT_CHANGED: 'dental-benefits-not-changed',
} as const;

export const handle = {
  pageIdentifier: pageIds.public.application.simplifiedAdult.dentalInsurance,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedAdultState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-adult']);

  const t = await getFixedT(url, ['applicationSimplifiedAdult', 'gcweb']);
  const locale = getLocale(url);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.dentalInsurance.pageTitle) }),
  };

  const federalGovernmentInsurancePlanService = appContainer.get(TYPES.FederalGovernmentInsurancePlanService);
  const provincialGovernmentInsurancePlanService = appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService);

  const federalGovernmentInsurancePlans = await federalGovernmentInsurancePlanService.listAndSortLocalizedFederalGovernmentInsurancePlans(locale);
  const provincialGovernmentInsurancePlans = await provincialGovernmentInsurancePlanService.listAndSortLocalizedProvincialGovernmentInsurancePlans(locale);

  const clientDentalBenefits = state.clientApplication.dentalBenefits?.reduce<PublicApplicationDentalFederalBenefitsState & PublicApplicationDentalProvincialTerritorialBenefitsState>(
    (benefits, planId) => {
      const federalProgram = federalGovernmentInsurancePlans.find(({ id }) => id === planId);
      if (federalProgram) {
        return {
          ...benefits,
          hasFederalBenefits: true,
          federalSocialProgram: federalProgram.name,
        };
      }

      const provincialProgram = provincialGovernmentInsurancePlans.find(({ id }) => id === planId);
      if (provincialProgram) {
        return {
          ...benefits,
          hasProvincialTerritorialBenefits: true,
          provincialTerritorialSocialProgram: provincialProgram.name,
        };
      }

      return benefits;
    },
    {} as PublicApplicationDentalFederalBenefitsState & PublicApplicationDentalProvincialTerritorialBenefitsState,
  );

  const selectedFederalGovernmentInsurancePlan = state.dentalBenefits?.value?.federalSocialProgram ? federalGovernmentInsurancePlans.find(({ id }) => id === state.dentalBenefits?.value?.federalSocialProgram) : undefined;
  const selectedProvincialBenefit = state.dentalBenefits?.value?.provincialTerritorialSocialProgram ? provincialGovernmentInsurancePlans.find(({ id }) => id === state.dentalBenefits?.value?.provincialTerritorialSocialProgram) : undefined;

  const sections = {
    dentalInsurance: {
      completed: isDentalInsuranceSectionCompleted(state),
    },
    dentalBenefits: {
      completed: isDentalBenefitsSectionCompleted(state),
    },
  };

  return {
    state: {
      dentalInsurance: state.dentalInsurance?.hasDentalInsurance,
      dentalBenefits: state.dentalBenefits
        ? {
            hasChanged: state.dentalBenefits.hasChanged,
            federalBenefit: {
              access: state.dentalBenefits.value?.hasFederalBenefits,
              benefit: selectedFederalGovernmentInsurancePlan?.name,
            },
            provTerrBenefit: {
              access: state.dentalBenefits.value?.hasProvincialTerritorialBenefits,
              benefit: selectedProvincialBenefit?.name,
            },
          }
        : undefined,
    },
    clientApplication: { dentalBenefits: clientDentalBenefits },
    sections,
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedAdultState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-adult']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === (FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED as string)) {
    savePublicApplicationState({ params, session, state: { dentalBenefits: { hasChanged: false, value: undefined } } });
  }

  return data({ success: true }, { status: 200 });
}

export default function RenewAdultDentalInsurance({ loaderData, params }: Route.ComponentProps) {
  const { sections } = loaderData;
  const { t } = useTranslation(['applicationSimplifiedAdult', 'application']);
  const fetcher = useFetcher<typeof action>();

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalInsurance.pageHeading)}</AppPageTitle>
      <fetcher.Form method="post" noValidate>
        <CsrfTokenInput />
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
            <DentalInsuranceCardContent />
            <DentalInsuranceCardFooter />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t(($) => $.dentalInsurance.otherBenefits)}</h2>
              </CardTitle>
              <CardAction>{sections.dentalBenefits.completed && <StatusTag status="complete" />}</CardAction>
            </CardHeader>
            <DentalBenefitsCardContent />
            <DentalBenefitsCardFooter />
          </Card>

          <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
            <NavigationButtonLink
              disabled={!allSectionsCompleted}
              variant="primary"
              direction="next"
              routeId="public/application/$id/simplified-adult/submit"
              params={params}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Adult:Continue click"
            >
              {t(($) => $.dentalInsurance.submit)}
            </NavigationButtonLink>
            <NavigationButtonLink
              variant="secondary"
              direction="previous"
              routeId="public/application/$id/simplified-adult/contact-information"
              params={params}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Adult:Back click"
            >
              {t(($) => $.dentalInsurance.contactInformation)}
            </NavigationButtonLink>
          </div>
        </div>
      </fetcher.Form>
    </>
  );
}

/**
 * This component determines what to show in the dental insurance card content based on whether the user has
 * entered new dental insurance information, whether there is existing dental insurance information on the client
 * application, or if there is no dental insurance information at all. The logic is as follows:
 *
 * - If the user has entered new dental insurance information (state.dentalInsurance is defined), show the new value.
 *
 * - If the user has not entered new dental insurance information, show the help text to indicate they need to provide it.
 *
 * Note: Unlike other sections, there is no existing client application data for dental insurance access,
 * so we only show the help text when no selection has been made.
 */
function DentalInsuranceCardContent(): JSX.Element {
  const { t } = useTranslation(['applicationSimplifiedAdult', 'application']);
  const { state } = useLoaderData<typeof loader>();

  if (state.dentalInsurance !== undefined) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.dentalInsurance.accessToDentalInsuranceOrCoverage)}>{state.dentalInsurance ? t(($) => $.dentalInsurance.dentalInsuranceYes) : t(($) => $.dentalInsurance.dentalInsuranceNo)}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <p>{t(($) => $.dentalInsurance.dentalInsuranceIndicateStatus)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the dental insurance card footer based on whether the user has
 * entered dental insurance information. The logic is as follows:
 *
 * - If the user has entered dental insurance information OR the section is completed, show the "Edit" button.
 *
 * - If the user has not entered dental insurance information, show the "Add" button.
 *
 * Note: There is no existing client application data for this section, so we only have two states.
 */
function DentalInsuranceCardFooter(): JSX.Element {
  const { t } = useTranslation(['applicationSimplifiedAdult', 'application']);
  const { state, sections } = useLoaderData<typeof loader>();
  const params = useParams();

  if (state.dentalInsurance !== undefined || sections.dentalInsurance.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-button-dental-insurance"
          variant="link"
          className="p-0"
          routeId="public/application/$id/dental-insurance"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Public-Simplified_Adult:Edit button dental insurance click"
        >
          {t(($) => $.dentalInsurance.editAccessToDentalInsurance)}
        </ButtonLink>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id="add-button-dental-insurance"
        variant="link"
        className="p-0"
        routeId="public/application/$id/dental-insurance"
        params={params}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Public-Simplified_Adult:Add button dental insurance click"
        aria-label={`${t(($) => $.dentalInsurance.addAnswer)} - ${t(($) => $.dentalInsurance.accessToDentalInsurance)}`}
      >
        {t(($) => $.dentalInsurance.addAnswer)}
      </ButtonLink>
    </CardFooter>
  );
}

/**
 * This component determines what to show in the dental benefits card content based on whether the user has
 * entered new dental benefits, whether there are existing dental benefits on the client application, or if there
 * are no dental benefits at all. The logic is as follows:
 *
 * - If the user has entered new dental benefits (state.dentalBenefits is defined), show the new benefits.
 *
 * - If the user has not entered new dental benefits but there are existing dental benefits on the client
 *   application, show the existing benefits.
 *
 * - If there are no dental benefits on the client application and the user has not entered new dental benefits,
 *   show the help text.
 */
function DentalBenefitsCardContent(): JSX.Element {
  const { t } = useTranslation(['applicationSimplifiedAdult', 'application']);
  const { state, clientApplication } = useLoaderData<typeof loader>();

  if (state.dentalBenefits?.hasChanged) {
    return (
      <CardContent>
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
      </CardContent>
    );
  }

  if (clientApplication.dentalBenefits) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.dentalInsurance.accessToGovernmentBenefits)}>
            {clientApplication.dentalBenefits.hasFederalBenefits || clientApplication.dentalBenefits.hasProvincialTerritorialBenefits ? (
              <div className="space-y-3">
                <p>{t(($) => $.dentalInsurance.accessToGovernmentBenefitsYes)}</p>
                <ul className="list-disc space-y-1 pl-7">
                  {clientApplication.dentalBenefits.hasFederalBenefits && <li>{clientApplication.dentalBenefits.federalSocialProgram}</li>}
                  {clientApplication.dentalBenefits.hasProvincialTerritorialBenefits && <li>{clientApplication.dentalBenefits.provincialTerritorialSocialProgram}</li>}
                </ul>
              </div>
            ) : (
              <p>{t(($) => $.dentalInsurance.accessToGovernmentBenefitsNo)}</p>
            )}
          </DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <p>{t(($) => $.dentalInsurance.dentalBenefitsIndicateStatus)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the dental benefits card footer based on whether the user has
 * entered new dental benefits or if there are existing dental benefits on the client application. The logic is as follows:
 *
 * - If the user has entered new dental benefits (state.dentalBenefits is defined), show the "Edit" button.
 *
 * - If the user has not entered new dental benefits but there are existing dental benefits on the client
 *   application, show both the "Update" button and the "Not changed" button.
 *
 * - If there are no dental benefits on the client application and the user has not entered new dental benefits,
 *   show the "Add" button.
 */
function DentalBenefitsCardFooter(): JSX.Element {
  const { t } = useTranslation(['applicationSimplifiedAdult', 'application']);
  const { state, sections, clientApplication } = useLoaderData<typeof loader>();
  const params = useParams();

  if (state.dentalBenefits || sections.dentalBenefits.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-button-government-benefits"
          variant="link"
          className="p-0"
          routeId="public/application/$id/federal-provincial-territorial-benefits"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Public-Simplified_Adult:Edit button government benefits click"
        >
          {t(($) => $.dentalInsurance.editAccessToGovernmentBenefits)}
        </ButtonLink>
      </CardFooter>
    );
  }

  if (clientApplication.dentalBenefits) {
    return (
      <CardFooter className="divide-y border-t bg-zinc-100 px-0">
        <div className="w-full px-6">
          <ButtonLink
            id="update-button-government-benefits"
            variant="link"
            className="mb-5 p-0"
            routeId="public/application/$id/federal-provincial-territorial-benefits"
            params={params}
            startIcon={faPenToSquare}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Public-Simplified_Adult:Update button government benefits click"
          >
            {t(($) => $.dentalInsurance.updateMyAccess)}
          </ButtonLink>
        </div>
        <div className="w-full px-6">
          <Button
            id="complete-benefits-button"
            name="_action"
            value={FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED}
            variant="link"
            className="mt-5 p-0"
            startIcon={faCircleCheck}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Public-Simplified_Adult:Complete benefits click"
          >
            <span className="text-left">{t(($) => $.dentalInsurance.accessNotChanged)}</span>
          </Button>
        </div>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id="add-button-dental-benefits"
        variant="link"
        className="p-0"
        routeId="public/application/$id/federal-provincial-territorial-benefits"
        params={params}
        startIcon={faPenToSquare}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Public-Simplified_Adult:Add button dental benefits click"
        aria-label={`${t(($) => $.dentalInsurance.addAnswer)} - ${t(($) => $.dentalInsurance.otherBenefits)}`}
      >
        {t(($) => $.dentalInsurance.addAnswer)}
      </ButtonLink>
    </CardFooter>
  );
}
