import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/childrens-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadProtectedApplicationRenewalChildState } from '~/.server/routes/helpers/protected-application-renewal-child-route-helpers';
import { isChildDentalBenefitsSectionCompleted, isChildDentalInsuranceSectionCompleted, isChildParentGuardianSectionCompleted } from '~/.server/routes/helpers/protected-application-renewal-section-checks';
import { saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/protected/application/renewal-children/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin } from '~/utils/sin-utils';

type ClientDentalBenefits = {
  federalBenefit?: {
    access?: boolean;
    benefit?: string;
  };
  provTerrBenefit?: {
    access?: boolean;
    benefit?: string;
  };
};

const FORM_ACTION = { DENTAL_BENEFITS_NOT_CHANGED: 'dental-benefits-not-changed' } as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.renewalChild.childApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['renewal-children']);

  const t = await getFixedT(url, ['protectedApplicationRenewalChild', 'gcweb']);
  const locale = getLocale(url);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.childrensApplication.pageTitle) }),
  };

  const federalGovernmentInsurancePlanService = appContainer.get(TYPES.FederalGovernmentInsurancePlanService);
  const provincialGovernmentInsurancePlanService = appContainer.get(TYPES.ProvincialGovernmentInsurancePlanService);

  const children = await Promise.all(
    state.children.map(async (child) => {
      const federalGovernmentInsurancePlanProgram = child.dentalBenefits?.value?.federalSocialProgram
        ? await federalGovernmentInsurancePlanService.getLocalizedFederalGovernmentInsurancePlanById(child.dentalBenefits.value.federalSocialProgram, locale)
        : undefined;

      const provincialTerritorialSocialProgram = child.dentalBenefits?.value?.provincialTerritorialSocialProgram
        ? await provincialGovernmentInsurancePlanService.getLocalizedProvincialGovernmentInsurancePlanById(child.dentalBenefits.value.provincialTerritorialSocialProgram, locale)
        : undefined;

      const immutableChild = state.clientApplication.children.find((c) => c.information.clientNumber === child.information?.memberId);
      const clientDentalBenefits = (await immutableChild?.dentalBenefits.reduce(async (benefitsPromise, id) => {
        const benefits = await benefitsPromise;

        const federalProgram = await federalGovernmentInsurancePlanService.findLocalizedFederalGovernmentInsurancePlanById(id, locale);
        if (federalProgram.isSome()) {
          return {
            ...benefits,
            federalBenefit: {
              access: true,
              benefit: federalProgram.unwrap().name,
            },
          };
        }

        const provincialProgram = await provincialGovernmentInsurancePlanService.findLocalizedProvincialGovernmentInsurancePlanById(id, locale);
        if (provincialProgram.isSome()) {
          return {
            ...benefits,
            provTerrBenefit: {
              access: true,
              benefit: provincialProgram.unwrap().name,
            },
          };
        }

        return benefits;
      }, Promise.resolve({}))) as ClientDentalBenefits;

      return {
        ...child,
        clientApplication: {
          clientDentalBenefits: clientDentalBenefits,
        },
        dentalBenefits: child.dentalBenefits
          ? {
              hasChanged: child.dentalBenefits.hasChanged,
              federalBenefit: {
                access: child.dentalBenefits.value?.hasFederalBenefits,
                benefit: federalGovernmentInsurancePlanProgram?.name,
              },
              provTerrBenefit: {
                access: child.dentalBenefits.value?.hasProvincialTerritorialBenefits,
                benefit: provincialTerritorialSocialProgram?.name,
              },
            }
          : undefined,
      };
    }),
  );

  return {
    state: {
      children,
    },
    meta,
    childrenSections: Object.fromEntries(
      state.children.map((child) => [
        child.id,
        {
          parentGuardian: {
            completed: isChildParentGuardianSectionCompleted(child),
          },
          dentalInsurance: {
            completed: isChildDentalInsuranceSectionCompleted(child),
          },
          dentalBenefits: {
            completed: isChildDentalBenefitsSectionCompleted(child),
          },
        },
      ]),
    ),
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['renewal-children']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === (FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED as string)) {
    const childId = formData.get('childId');
    saveProtectedApplicationState({
      params,
      session,
      state: {
        children: state.children.map((child) => {
          if (child.id !== childId) return child;
          return {
            ...child,
            dentalBenefits: { hasChanged: false },
          };
        }),
      },
    });

    return data({ success: true }, { status: 200 });
  }

  return redirect(getPathById(`protected/application/$id/${state.context}-${state.typeOfApplication}/childrens-application`, params));
}

export default function ProtectedRenewChildChildrensApplication({ loaderData, params }: Route.ComponentProps) {
  const { state, childrenSections } = loaderData;
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  const allChildrenCompleted = Object.keys(childrenSections).length > 0 && Object.values(childrenSections).every((sections) => Object.values(sections).every((section) => section.completed));

  return (
    <>
      <AppPageTitle>{t(($) => $.childrensApplication.pageTitle)}</AppPageTitle>
      <ProgressStepper activeStep="childrensApplication" className="mb-8" />
      <div className="max-w-prose space-y-8">
        {state.children.map((child) => {
          const sections = childrenSections[child.id];
          invariant(sections, `Expected child sections to be defined for child ${child.id}`);
          const completedSectionsCount = Object.values(sections).filter((section) => section.completed).length;

          return (
            <div key={child.id}>
              <h2 className="font-lato mb-4 text-2xl font-bold">{`${child.information?.firstName} ${child.information?.lastName}`}</h2>
              <div className="space-y-4">
                <p>{t(($) => $.completeAllSections, { ns: 'protectedApplication' })}</p>
                <p>
                  {t(($) => $.sectionsCompleted, {
                    number: completedSectionsCount,
                    count: Object.keys(sections).length,
                    ns: 'common',
                  })}
                </p>
              </div>
              <Card className="my-4">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>{t(($) => $.childrensApplication.sinCardTitle)}</h2>
                  </CardTitle>
                  <CardAction>
                    <StatusTag status="optional" />
                  </CardAction>
                </CardHeader>
                <ChildSinCardContent child={child} />
                <ChildSinCardFooter child={child} params={params} sectionCompleted={true} />
              </Card>
              <Card className="my-4">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>{t(($) => $.childrensApplication.parentGuardianCardTitle)}</h2>
                  </CardTitle>
                  <CardAction>{sections.parentGuardian.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <ChildParentGuardianCardContent child={child} />
                <ChildParentGuardianCardFooter child={child} sectionCompleted={sections.parentGuardian.completed} params={params} />
              </Card>
              <Card className="my-4">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>{t(($) => $.childrensApplication.childDentalInsuranceCardTitle)}</h2>
                  </CardTitle>
                  <CardAction>{sections.dentalInsurance.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <ChildDentalInsuranceCardContent child={child} />
                <ChildDentalInsuranceCardFooter childId={child.id} dentalInsurance={child.dentalInsurance} sectionCompleted={sections.dentalInsurance.completed} params={params} />
              </Card>
              <Card className="my-4">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>{t(($) => $.childrensApplication.childDentalBenefitsCardTitle)}</h2>
                  </CardTitle>
                  <CardAction>{sections.dentalBenefits.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <ChildDentalBenefitsCardContent child={child} />
                <ChildDentalBenefitsCardFooter child={child} sectionCompleted={sections.dentalBenefits.completed} params={params} />
              </Card>
            </div>
          );
        })}

        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink
            disabled={!allChildrenCompleted}
            variant="primary"
            direction="next"
            routeId="protected/application/$id/renewal-children/submit"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Continue click"
          >
            {t(($) => $.childrensApplication.submitBtn)}
          </NavigationButtonLink>
          <NavigationButtonLink
            variant="secondary"
            direction="previous"
            routeId="protected/application/$id/renewal-children/parent-or-guardian"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Back click"
          >
            {t(($) => $.childrensApplication.backBtn)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}

/**
 * This component determines what to show in the SIN card content. The logic is as follows:
 *
 * - If the user has entered a SIN (child.information.socialInsuranceNumber is defined), show the formatted SIN.
 *
 * - If there is no SIN at all, show the help text.
 */
function ChildSinCardContent({ child }: { child: Route.ComponentProps['loaderData']['state']['children'][0] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  // User-entered SIN takes precedence
  if (child.information?.socialInsuranceNumber) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.childrensApplication.sinTitle)}>{formatSin(child.information.socialInsuranceNumber)}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  // No SIN at all
  return (
    <CardContent>
      <p>{t(($) => $.childrensApplication.sinHelp)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the SIN card footer. The logic is as follows:
 *
 * - If the user has entered a SIN OR there is a client SIN OR section is completed, show the "Edit" button.
 *
 * - If there is no SIN at all, show the "Add" button.
 */
function ChildSinCardFooter({ child, params }: { child: Route.ComponentProps['loaderData']['state']['children'][0]; sectionCompleted: boolean; params: Route.ComponentProps['params'] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  if (child.information?.socialInsuranceNumber !== undefined) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id={`edit-child-sin-${child.id}`}
          variant="link"
          className="p-0"
          routeId="protected/application/$id/children/$childId/social-insurance-number"
          params={{ ...params, childId: child.id }}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
        >
          {t(($) => $.childrensApplication.editSin)}
        </ButtonLink>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id={`add-child-sin-${child.id}`}
        variant="link"
        className="p-0"
        routeId="protected/application/$id/children/$childId/social-insurance-number"
        params={{ ...params, childId: child.id }}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
      >
        {t(($) => $.childrensApplication.addSin)}
      </ButtonLink>
    </CardFooter>
  );
}

/**
 * This component determines what to show in the Parent/Guardian card content. The logic is as follows:
 *
 * - If the user has entered parent/guardian status (child.information.isParent is defined), show Yes/No.
 *
 * - If there is no parent/guardian status at all, show the help text.
 */
function ChildParentGuardianCardContent({ child }: { child: Route.ComponentProps['loaderData']['state']['children'][0] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  // User-entered value takes precedence
  if (child.information?.isParent !== undefined) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.childrensApplication.parentGuardianTitle)}>{child.information.isParent ? t(($) => $.childrensApplication.yes) : t(($) => $.childrensApplication.no)}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  // No value at all
  return (
    <CardContent>
      <p>{t(($) => $.childrensApplication.parentGuardianHelp)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the Parent/Guardian card footer. The logic is as follows:
 *
 * - If the user has entered a value OR there is a client value OR section is completed, show the "Edit" button.
 *
 * - If there is no value at all, show the "Add" button.
 */
function ChildParentGuardianCardFooter({ child, sectionCompleted, params }: { child: Route.ComponentProps['loaderData']['state']['children'][0]; sectionCompleted: boolean; params: Route.ComponentProps['params'] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  if (child.information?.isParent !== undefined || sectionCompleted) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id={`edit-child-parent-${child.id}`}
          variant="link"
          className="p-0"
          routeId="protected/application/$id/children/$childId/parent-guardian"
          params={{ ...params, childId: child.id }}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
        >
          {t(($) => $.childrensApplication.editParentGuardian)}
        </ButtonLink>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id={`add-child-parent-${child.id}`}
        variant="link"
        className="p-0"
        routeId="protected/application/$id/children/$childId/parent-guardian"
        params={{ ...params, childId: child.id }}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
      >
        {t(($) => $.childrensApplication.addParentGuardian)}
      </ButtonLink>
    </CardFooter>
  );
}

/**
 * This component determines what to show in the child dental insurance card content. The logic is as follows:
 *
 * - If the user has entered dental insurance information (child.dentalInsurance is defined), show the value.
 *
 * - If the user has not entered dental insurance information, show the help text.
 */
function ChildDentalInsuranceCardContent({ child }: { child: Route.ComponentProps['loaderData']['state']['children'][0] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  if (child.dentalInsurance !== undefined) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.childrensApplication.dentalInsuranceTitle)}>
            {child.dentalInsurance.hasDentalInsurance ? t(($) => $.childrensApplication.dentalInsuranceYes) : t(($) => $.childrensApplication.dentalInsuranceNo)}
          </DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <p>{t(($) => $.childrensApplication.childDentalInsuranceIndicateStatus)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the child dental insurance card footer. The logic is as follows:
 *
 * - If the user has entered dental insurance information OR the section is completed, show the "Edit" button.
 *
 * - If the user has not entered dental insurance information, show the "Add" button.
 */
function ChildDentalInsuranceCardFooter({
  childId,
  dentalInsurance,
  sectionCompleted,
  params,
}: {
  childId: string;
  dentalInsurance: Route.ComponentProps['loaderData']['state']['children'][0]['dentalInsurance'];
  sectionCompleted: boolean;
  params: Route.ComponentProps['params'];
}): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  if (dentalInsurance !== undefined || sectionCompleted) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id={`edit-child-dental-insurance-${childId}`}
          variant="link"
          className="p-0"
          routeId="protected/application/$id/children/$childId/dental-insurance"
          params={{ ...params, childId }}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
        >
          {t(($) => $.childrensApplication.editChildDentalInsurance)}
        </ButtonLink>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id={`add-child-dental-insurance-${childId}`}
        variant="link"
        className="p-0"
        routeId="protected/application/$id/children/$childId/dental-insurance"
        params={{ ...params, childId }}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
        aria-label={`${t(($) => $.childrensApplication.addAnswer)} - ${t(($) => $.childrensApplication.childDentalInsuranceCardTitle)}`}
      >
        {t(($) => $.childrensApplication.addAnswer)}
      </ButtonLink>
    </CardFooter>
  );
}

/**
 * This component determines what to show in the child dental benefits card content. The logic is as follows:
 *
 * - If the user has entered new dental benefits (child.dentalBenefits is defined with hasChanged=true), show the new benefits.
 *
 * - If the user has confirmed existing benefits haven't changed (child.dentalBenefits is defined with hasChanged=false),
 *   show the existing client benefits (since they haven't changed).
 *
 * - If there are existing benefits from the client application (child.clientApplication.clientDentalBenefits is defined) and the user hasn't
 *   made changes, show the existing benefits.
 *
 * - If there are no dental benefits at all, show the help text.
 */
function ChildDentalBenefitsCardContent({ child }: { child: Route.ComponentProps['loaderData']['state']['children'][0] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);

  // Helper function to render benefits
  const renderBenefits = (benefits: ClientDentalBenefits) => {
    const hasBenefits = benefits.federalBenefit?.access === true || benefits.provTerrBenefit?.access === true;

    if (hasBenefits) {
      return (
        <div className="space-y-3">
          <p>{t(($) => $.childrensApplication.dentalBenefitsYes)}</p>
          <ul className="list-disc space-y-1 pl-7">
            {benefits.federalBenefit?.access && <li>{benefits.federalBenefit.benefit}</li>}
            {benefits.provTerrBenefit?.access && <li>{benefits.provTerrBenefit.benefit}</li>}
          </ul>
        </div>
      );
    }

    return <p>{t(($) => $.childrensApplication.dentalBenefitsNo)}</p>;
  };

  // Case 1: User has made changes (hasChanged true) - show their selections
  if (child.dentalBenefits?.hasChanged) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.childrensApplication.dentalBenefitsTitle)}>{renderBenefits(child.dentalBenefits)}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <DefinitionList layout="single-column">
        <DefinitionListItem term={t(($) => $.childrensApplication.dentalBenefitsTitle)}>{renderBenefits(child.clientApplication.clientDentalBenefits)}</DefinitionListItem>
      </DefinitionList>
    </CardContent>
  );
}

/**
 * This component determines what to show in the child dental benefits card footer. The logic is as follows:
 *
 * - If the user has entered new dental benefits (child.dentalBenefits is defined), show the "Edit" button.
 *
 * - If the user has not entered new dental benefits but there are existing dental benefits on the parent
 *   application (child.clientApplication.clientDentalBenefits is defined), show both the "Update" button and the "Not changed" button.
 *
 * - If there are no dental benefits on the parent application and the user has not entered new dental benefits,
 *   show the "Add" button.
 */
function ChildDentalBenefitsCardFooter({ child, sectionCompleted, params }: { child: Route.ComponentProps['loaderData']['state']['children'][0]; sectionCompleted: boolean; params: Route.ComponentProps['params'] }): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication', 'common']);
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  // Case 1: User has made changes or section is completed - show Edit button
  if (child.dentalBenefits || sectionCompleted) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id={`edit-child-benefits-${child.id}`}
          variant="link"
          className="p-0"
          routeId="protected/application/$id/children/$childId/federal-provincial-territorial-benefits"
          params={{ ...params, childId: child.id }}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
        >
          {t(($) => $.childrensApplication.editChildDentalBenefits)}
        </ButtonLink>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="divide-y border-t bg-zinc-100 px-0">
      <div className="w-full px-6">
        <ButtonLink
          id={`update-child-benefits-${child.id}`}
          variant="link"
          className="mb-5 p-0"
          routeId="protected/application/$id/children/$childId/federal-provincial-territorial-benefits"
          params={{ ...params, childId: child.id }}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
        >
          {t(($) => $.childrensApplication.updateDentalBenefits)}
        </ButtonLink>
      </div>
      <fetcher.Form method="post" noValidate>
        <CsrfTokenInput />
        <input type="hidden" name="childId" value={child.id} />
        <div className="w-full px-6">
          <Button
            id={`complete-benefits-${child.id}`}
            name="_action"
            value={FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED}
            disabled={isSubmitting}
            variant="link"
            className="mt-5 p-0"
            startIcon={faCircleCheck}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Action click"
          >
            <span className="text-left">{t(($) => $.childrensApplication.benefitsNotChanged)}</span>
          </Button>
        </div>
      </fetcher.Form>
    </CardFooter>
  );
}
