import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/childrens-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { loadPublicApplicationSimplifiedFamilyState } from '~/.server/routes/helpers/public-application-simplified-family-route-helpers';
import { isChildDentalBenefitsSectionCompleted, isChildDentalInsuranceSectionCompleted, isChildInformationSectionCompleted } from '~/.server/routes/helpers/public-application-simplified-section-checks';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useCurrentLanguage, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/public/application/simplified-family/progress-stepper';
import { parseDateString, toLocaleDateString } from '~/utils/date-utils';
import { generateId } from '~/utils/id-utils';
import { mergeMeta } from '~/utils/meta-utils';
import { getPathById } from '~/utils/route-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin } from '~/utils/sin-utils';

const FORM_ACTION = { add: 'add', remove: 'remove', DENTAL_BENEFITS_NOT_CHANGED: 'dental-benefits-not-changed' } as const;

export const handle = {
  pageIdentifier: pageIds.public.application.simplifiedFamily.childApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedFamilyState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-family']);

  const t = await getFixedT(url, ['applicationSimplifiedFamily', 'gcweb']);
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

      return {
        ...child,
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
      children: children,
    },
    childrenSections: Object.fromEntries(
      state.children.map((child) => [
        child.id,
        {
          childInformation: { completed: isChildInformationSectionCompleted(state, child) },
          dentalInsurance: { completed: isChildDentalInsuranceSectionCompleted(child) },
          dentalBenefits: { completed: isChildDentalBenefitsSectionCompleted(child) },
        },
      ]),
    ),
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedFamilyState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.add) {
    const childId = generateId();
    const children = [...state.children, { id: childId }];

    savePublicApplicationState({
      params,
      session,
      state: {
        children: children,
      },
    });
  }

  if (formAction === FORM_ACTION.remove) {
    const removeChildId = formData.get('childId');
    const children = [...state.children].filter((child) => child.id !== removeChildId);

    savePublicApplicationState({
      params,
      session,
      state: {
        children: children,
      },
    });
  }

  if (formAction === FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED) {
    const childId = formData.get('childId');
    savePublicApplicationState({
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

  return redirect(getPathById(`public/application/$id/${state.inputModel}-${state.typeOfApplication}/childrens-application`, params));
}

export default function RenewFamilyChildrensApplication({ loaderData, params }: Route.ComponentProps) {
  const { currentLanguage } = useCurrentLanguage();
  const { state, childrenSections } = loaderData;
  const { t } = useTranslation(['applicationSimplifiedFamily', 'application', 'common']);
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const allChildrenCompleted = Object.keys(childrenSections).length > 0 && Object.values(childrenSections).every((sections) => Object.values(sections).every((section) => section.completed));

  return (
    <>
      <AppPageTitle>{t(($) => $.childrensApplication.pageTitle)}</AppPageTitle>
      <ProgressStepper activeStep="childrensApplication" className="mb-8" />
      <div className="max-w-prose space-y-8">
        {state.children.map((child, index) => {
          const childName = `${child.information?.firstName} ${child.information?.lastName}`;
          const dateOfBirth = child.information?.dateOfBirth ? toLocaleDateString(parseDateString(child.information.dateOfBirth), currentLanguage) : '';

          const sections = childrenSections[child.id];
          invariant(sections, `Expected child sections to be defined for child ${child.id}`);
          const completedSectionsCount = Object.values(sections).filter((section) => section.completed).length;

          return (
            <div key={child.id}>
              <h2 className="font-lato mb-4 text-2xl font-bold">
                {t(($) => $.childrensApplication.childTitle, {
                  childNumber: index + 1,
                })}
              </h2>
              <div className="space-y-4">
                <p>{t(($) => $.completeAllSections, { ns: 'application' })}</p>
                <p>
                  {t(($) => $.sectionsCompleted, {
                    number: completedSectionsCount,
                    count: Object.keys(sections).length,
                    ns: 'common',
                  })}
                </p>
              </div>
              <Card className="my-2">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>
                      {t(($) => $.childrensApplication.childInformationCardTitle, {
                        childNumber: index + 1,
                      })}
                    </h2>
                  </CardTitle>
                  <CardAction>{sections.childInformation.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <CardContent>
                  {child.information === undefined ? (
                    <p>{t(($) => $.childrensApplication.childInformationIndicateStatus)}</p>
                  ) : (
                    <DefinitionList layout="single-column">
                      <DefinitionListItem term={t(($) => $.childrensApplication.memberIdTitle)}>{child.information.memberId}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.fullNameTitle)}>{childName}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.dobTitle)}>{dateOfBirth}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.sinTitle)}>{child.information.socialInsuranceNumber ? formatSin(child.information.socialInsuranceNumber) : ''}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.parentGuardianTitle)}>{child.information.isParent ? t(($) => $.childrensApplication.yes) : t(($) => $.childrensApplication.no)}</DefinitionListItem>
                    </DefinitionList>
                  )}
                </CardContent>
                <CardFooter className="border-t bg-zinc-100">
                  <ButtonLink
                    id={`edit-info-button-${child.id}`}
                    variant="link"
                    className="p-0"
                    routeId="public/application/$id/children/$childId/information"
                    params={{ ...params, childId: child.id }}
                    startIcon={sections.childInformation.completed ? faPenToSquare : faCirclePlus}
                    size="lg"
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Action click"
                  >
                    {child.information === undefined
                      ? t(($) => $.childrensApplication.addChildInformation)
                      : t(($) => $.childrensApplication.editChildInformation, {
                          childNumber: index + 1,
                        })}
                  </ButtonLink>
                </CardFooter>
              </Card>
              <Card className="my-2">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>{t(($) => $.childrensApplication.childDentalInsuranceCardTitle)}</h2>
                  </CardTitle>
                  <CardAction>{sections.dentalInsurance.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <CardContent>
                  {child.dentalInsurance === undefined ? (
                    <p>{t(($) => $.childrensApplication.childDentalInsuranceIndicateStatus)}</p>
                  ) : (
                    <DefinitionList layout="single-column">
                      <DefinitionListItem term={t(($) => $.childrensApplication.dentalInsuranceTitle)}>
                        {child.dentalInsurance.hasDentalInsurance ? t(($) => $.childrensApplication.dentalInsuranceYes) : t(($) => $.childrensApplication.dentalInsuranceNo)}
                      </DefinitionListItem>
                    </DefinitionList>
                  )}
                </CardContent>
                <CardFooter className="border-t bg-zinc-100">
                  <ButtonLink
                    id={`edit-insurance-button-${child.id}`}
                    variant="link"
                    className="p-0"
                    routeId="public/application/$id/children/$childId/dental-insurance"
                    params={{ ...params, childId: child.id }}
                    startIcon={sections.dentalInsurance.completed ? faPenToSquare : faCirclePlus}
                    size="lg"
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Action click"
                    aria-label={child.dentalInsurance === undefined ? `${t(($) => $.childrensApplication.addAnswer)} - ${t(($) => $.childrensApplication.childDentalInsuranceCardTitle)}` : t(($) => $.childrensApplication.editChildDentalInsurance)}
                  >
                    {child.dentalInsurance === undefined ? t(($) => $.childrensApplication.addAnswer) : t(($) => $.childrensApplication.editChildDentalInsurance)}
                  </ButtonLink>
                </CardFooter>
              </Card>
              <Card className="my-2">
                <CardHeader>
                  <CardTitle asChild>
                    <h2>{t(($) => $.childrensApplication.childDentalBenefitsCardTitle)}</h2>
                  </CardTitle>
                  <CardAction>{sections.dentalBenefits.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <CardContent>
                  {child.dentalBenefits === undefined ? (
                    <p>{t(($) => $.childrensApplication.childDentalBenefitsIndicateStatus)}</p>
                  ) : (
                    <DefinitionList layout="single-column">
                      <DefinitionListItem term={t(($) => $.childrensApplication.dentalBenefitsTitle)}>
                        {child.dentalBenefits.hasChanged ? (
                          child.dentalBenefits.federalBenefit.access || child.dentalBenefits.provTerrBenefit.access ? (
                            <div className="space-y-3">
                              <p>{t(($) => $.childrensApplication.dentalBenefitsYes)}</p>
                              <ul className="list-disc space-y-1 pl-7">
                                {child.dentalBenefits.federalBenefit.access && <li>{child.dentalBenefits.federalBenefit.benefit}</li>}
                                {child.dentalBenefits.provTerrBenefit.access && <li>{child.dentalBenefits.provTerrBenefit.benefit}</li>}
                              </ul>
                            </div>
                          ) : (
                            <p>{t(($) => $.childrensApplication.dentalBenefitsNo)}</p>
                          )
                        ) : (
                          <p>{t(($) => $.childrensApplication.noChange)}</p>
                        )}
                      </DefinitionListItem>
                    </DefinitionList>
                  )}
                </CardContent>
                {child.dentalBenefits ? (
                  <CardFooter className="border-t bg-zinc-100">
                    <ButtonLink
                      id={`edit-benefits-button-${child.id}`}
                      variant="link"
                      className="p-0"
                      routeId="public/application/$id/children/$childId/federal-provincial-territorial-benefits"
                      params={{ ...params, childId: child.id }}
                      startIcon={sections.dentalBenefits.completed ? faPenToSquare : faCirclePlus}
                      size="lg"
                      data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Action click"
                    >
                      {t(($) => $.childrensApplication.editChildDentalBenefits)}
                    </ButtonLink>
                  </CardFooter>
                ) : (
                  <CardFooter className="divide-y border-t bg-zinc-100 px-0">
                    <div className="w-full px-6">
                      <ButtonLink
                        id={`edit-button-update-access-${child.id}`}
                        variant="link"
                        className="mb-5 p-0"
                        routeId="public/application/$id/children/$childId/federal-provincial-territorial-benefits"
                        params={{ ...params, childId: child.id }}
                        startIcon={faPenToSquare}
                        size="lg"
                        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Edit button update access click"
                      >
                        {t(($) => $.childrensApplication.updateDentalBenefits)}
                      </ButtonLink>
                    </div>
                    <fetcher.Form method="post" noValidate>
                      <CsrfTokenInput />
                      <input type="hidden" name="childId" value={child.id} />
                      <div className="w-full px-6">
                        <Button
                          id={`edit-button-not-changed-${child.id}`}
                          name="_action"
                          value={FORM_ACTION.DENTAL_BENEFITS_NOT_CHANGED}
                          disabled={isSubmitting}
                          variant="link"
                          className="mt-5 p-0"
                          startIcon={faCircleCheck}
                          size="lg"
                          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Edit button not changed click"
                        >
                          <span className="text-left">{t(($) => $.childrensApplication.benefitsNotChanged)}</span>
                        </Button>
                      </div>
                    </fetcher.Form>
                  </CardFooter>
                )}
              </Card>
              {state.children.length > 1 && (
                <fetcher.Form method="post" noValidate>
                  <CsrfTokenInput />
                  <input type="hidden" name="childId" value={child.id} />
                  <Button
                    id={`remove-child-${child.id}`}
                    className="my-5"
                    name="_action"
                    value={FORM_ACTION.remove}
                    disabled={isSubmitting}
                    variant="secondary"
                    size="sm"
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Family:Remove child - Child(ren) application click"
                  >
                    {t(($) => $.childrensApplication.removeChild)}
                  </Button>
                </fetcher.Form>
              )}
            </div>
          );
        })}
        <fetcher.Form method="post" noValidate>
          <CsrfTokenInput />
          <Button variant="primary" id="add-child" name="_action" value={FORM_ACTION.add} disabled={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Family:Add child - Child(ren) application click">
            {t(($) => $.childrensApplication.addChild)}
          </Button>
        </fetcher.Form>

        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink
            disabled={!allChildrenCompleted}
            variant="primary"
            direction="next"
            routeId="public/application/$id/simplified-family/submit"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Continue click"
          >
            {t(($) => $.childrensApplication.submitBtn)}
          </NavigationButtonLink>
          <NavigationButtonLink
            variant="secondary"
            direction="previous"
            routeId="public/application/$id/simplified-family/dental-insurance"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Family:Back click"
          >
            {t(($) => $.childrensApplication.backBtn)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}
