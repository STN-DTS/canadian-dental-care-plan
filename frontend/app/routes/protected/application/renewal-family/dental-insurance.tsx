import type { JSX } from 'react';

import { data, useFetcher, useLoaderData, useParams } from 'react-router';

import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/dental-insurance';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadProtectedApplicationRenewalFamilyState } from '~/.server/routes/helpers/protected-application-renewal-family-route-helpers';
import { isDentalBenefitsSectionCompleted, isDentalInsuranceSectionCompleted } from '~/.server/routes/helpers/protected-application-renewal-section-checks';
import { saveProtectedApplicationState, shouldSkipMaritalStatus, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ProtectedApplicationDentalFederalBenefitsState, ProtectedApplicationDentalProvincialTerritorialBenefitsState } from '~/.server/routes/helpers/protected-application-route-helpers';
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
import { ProgressStepper } from '~/routes/protected/application/renewal-family/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const FORM_ACTION = {
  DENTAL_BENEFITS_NOT_CHANGED: 'dental-benefits-not-changed',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.renewalFamily.dentalInsurance,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = loadProtectedApplicationRenewalFamilyState({ params, request, session });
  validateApplicationFlow(state, params, ['renewal-family']);

  const t = await getFixedT(request, ['protectedApplicationRenewalFamily', 'gcweb']);
  const locale = getLocale(request);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.dentalInsurance.pageTitle) }),
  };

  const federalGovernmentInsurancePlanService = appContainer.get(TYPES.FederalGovernmentInsurancePlanService);
  const provincialGovernmentInsurancePlanService = appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService);

  const federalGovernmentInsurancePlans = await federalGovernmentInsurancePlanService.listAndSortLocalizedFederalGovernmentInsurancePlans(locale);
  const provincialGovernmentInsurancePlans = await provincialGovernmentInsurancePlanService.listAndSortLocalizedProvincialGovernmentInsurancePlans(locale);

  const clientDentalBenefits = state.clientApplication.dentalBenefits?.reduce<ProtectedApplicationDentalFederalBenefitsState & ProtectedApplicationDentalProvincialTerritorialBenefitsState>(
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
    {} as ProtectedApplicationDentalFederalBenefitsState & ProtectedApplicationDentalProvincialTerritorialBenefitsState,
  );

  const selectedFederalGovernmentInsurancePlan = state.dentalBenefits?.value?.federalSocialProgram ? federalGovernmentInsurancePlans.find(({ id }) => id === state.dentalBenefits?.value?.federalSocialProgram) : undefined;
  const selectedProvincialBenefit = state.dentalBenefits?.value?.provincialTerritorialSocialProgram ? provincialGovernmentInsurancePlans.find(({ id }) => id === state.dentalBenefits?.value?.provincialTerritorialSocialProgram) : undefined;

  const currentDentalBenefits = state.dentalBenefits
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
    : undefined;

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
      dentalBenefits: currentDentalBenefits,
    },
    shouldSkipMaritalStatusStep: shouldSkipMaritalStatus(state),
    clientApplication: { dentalBenefits: clientDentalBenefits },
    sections,
    meta,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = loadProtectedApplicationRenewalFamilyState({ params, request, session });
  validateApplicationFlow(state, params, ['renewal-family']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === (FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED as string)) {
    saveProtectedApplicationState({
      params,
      session,
      state: {
        dentalBenefits: { hasChanged: false },
      },
    });
  }

  return data({ success: true }, { status: 200 });
}

export default function ProtectedRenewFamilyDentalInsurance({ loaderData, params }: Route.ComponentProps) {
  const { sections, shouldSkipMaritalStatusStep } = loaderData;
  const { t } = useTranslation(['protectedApplicationRenewalFamily', 'protectedApplication']);

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  const fetcher = useFetcher<typeof action>();

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalInsurance.pageHeading)}</AppPageTitle>
      <fetcher.Form method="post" noValidate>
        <CsrfTokenInput />
        <ProgressStepper activeStep="dentalInsurance" excludeMaritalStatus={shouldSkipMaritalStatusStep} className="mb-8" />
        <div className="max-w-prose space-y-8">
          <div className="space-y-4">
            <p>{t(($) => $.completeAllSections, { ns: 'protectedApplication' })}</p>
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
              routeId="protected/application/$id/renewal-family/childrens-application"
              params={params}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Continue click"
            >
              {t(($) => $.dentalInsurance.childrensApplication)}
            </NavigationButtonLink>
            <NavigationButtonLink
              variant="secondary"
              direction="previous"
              routeId="protected/application/$id/renewal-family/contact-information"
              params={params}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Back click"
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
  const { t } = useTranslation(['protectedApplicationRenewalFamily', 'protectedApplication']);
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
  const { t } = useTranslation(['protectedApplicationRenewalFamily', 'protectedApplication']);
  const { state, sections } = useLoaderData<typeof loader>();
  const params = useParams();

  if (state.dentalInsurance !== undefined || sections.dentalInsurance.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-button-dental-insurance"
          variant="link"
          className="p-0"
          routeId="protected/application/$id/dental-insurance"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Edit button dental insurance click"
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
        routeId="protected/application/$id/dental-insurance"
        params={params}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Add button dental insurance click"
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
  const { t } = useTranslation(['protectedApplicationRenewalFamily', 'protectedApplication']);
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
  const { t } = useTranslation(['protectedApplicationRenewalFamily', 'protectedApplication']);
  const { state, sections, clientApplication } = useLoaderData<typeof loader>();
  const params = useParams();

  if (state.dentalBenefits || sections.dentalBenefits.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-button-government-benefits"
          variant="link"
          className="p-0"
          routeId="protected/application/$id/federal-provincial-territorial-benefits"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Edit button government benefits click"
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
            routeId="protected/application/$id/federal-provincial-territorial-benefits"
            params={params}
            startIcon={faPenToSquare}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Update button government benefits click"
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
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Complete benefits click"
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
        routeId="protected/application/$id/federal-provincial-territorial-benefits"
        params={params}
        startIcon={faPenToSquare}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Add button dental benefits click"
        aria-label={`${t(($) => $.dentalInsurance.addAnswer)} - ${t(($) => $.dentalInsurance.otherBenefits)}`}
      >
        {t(($) => $.dentalInsurance.addAnswer)}
      </ButtonLink>
    </CardFooter>
  );
}
