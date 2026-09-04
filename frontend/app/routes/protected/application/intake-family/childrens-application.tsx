import { useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { faCirclePlus, faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { announce } from '@react-aria/live-announcer';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/childrens-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadProtectedApplicationIntakeFamilyState } from '~/.server/routes/helpers/protected-application-intake-family-route-helpers';
import { isChildDentalBenefitsSectionCompleted, isChildDentalInsuranceSectionCompleted, isChildInformationSectionCompleted } from '~/.server/routes/helpers/protected-application-intake-section-checks';
import { saveProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useCurrentLanguage, useFetcherActionComplete, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/protected/application/intake-family/progress-stepper';
import { parseDateString, toLocaleDateString } from '~/utils/date-utils';
import { generateId } from '~/utils/id-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin } from '~/utils/sin-utils';

const FORM_ACTION = { add: 'add', remove: 'remove' } as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.intakeFamily.childApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);

  const state = loadProtectedApplicationIntakeFamilyState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['intake-family']);

  const t = await getFixedT(url, ['protectedApplicationIntakeFamily', 'gcweb']);
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
        dentalBenefits:
          child.dentalBenefits?.hasChanged === true
            ? {
                federalBenefit: {
                  access: child.dentalBenefits.value.hasFederalBenefits,
                  benefit: federalGovernmentInsurancePlanProgram?.name,
                },
                provTerrBenefit: {
                  access: child.dentalBenefits.value.hasProvincialTerritorialBenefits,
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
    childrenSections: state.children.map((child) => ({
      id: child.id,
      sections: {
        childInformation: { completed: isChildInformationSectionCompleted(state, child) },
        childDentalInsurance: { completed: isChildDentalInsuranceSectionCompleted(child) },
        childDentalBenefits: { completed: isChildDentalBenefitsSectionCompleted(child) },
      },
    })),
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { session } = context.get(appContext);

  const state = loadProtectedApplicationIntakeFamilyState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['intake-family']);

  const formData = await request.formData();
  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.add) {
    const childId = generateId();
    const children = [...state.children, { id: childId }];

    saveProtectedApplicationState({
      params,
      session,
      state: {
        children: children,
      },
    });

    return { operation: FORM_ACTION.add, childId, childNumber: children.length };
  }

  const removeChildId = formData.get('childId');
  const removedIndex = state.children.findIndex((child) => child.id === removeChildId);
  const removedChild = state.children[removedIndex];
  const removedChildName = removedChild?.information ? `${removedChild.information.firstName} ${removedChild.information.lastName}` : undefined;
  const children = state.children.filter((child) => child.id !== removeChildId);

  saveProtectedApplicationState({
    params,
    session,
    state: {
      children: children,
    },
  });

  return { operation: FORM_ACTION.remove, childNumber: removedIndex + 1, childName: removedChildName, removedIndex };
}

export default function ProtectedNewFamilyChildrensApplication({ loaderData, params }: Route.ComponentProps) {
  const { currentLanguage } = useCurrentLanguage();
  const { state, childrenSections } = loaderData;
  const { t } = useTranslation(['protectedApplicationIntakeFamily', 'protectedApplication', 'common']);
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  useFetcherActionComplete(fetcher, (actionData) => {
    if (actionData.operation === FORM_ACTION.add) {
      announce(
        t(($) => $.childrensApplication.childAddedAnnouncement, { childNumber: actionData.childNumber }),
        'polite',
      );
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`#child-heading-${CSS.escape(actionData.childId)}`)?.focus({ preventScroll: true });
      });
      return;
    }

    announce(
      actionData.childName
        ? t(($) => $.childrensApplication.childRemovedAnnouncementWithName, { childNumber: actionData.childNumber, childName: actionData.childName })
        : t(($) => $.childrensApplication.childRemovedAnnouncement, { childNumber: actionData.childNumber }),
      'polite',
    );
    window.requestAnimationFrame(() => {
      const nextChild = state.children[actionData.removedIndex];
      const previousChild = state.children[actionData.removedIndex - 1];
      if (nextChild) {
        document.querySelector<HTMLElement>(`#child-heading-${CSS.escape(nextChild.id)}`)?.focus({ preventScroll: true });
      } else if (previousChild) {
        document.querySelector<HTMLElement>(`#child-heading-${CSS.escape(previousChild.id)}`)?.focus({ preventScroll: true });
      } else {
        document.querySelector<HTMLElement>('#add-child')?.focus({ preventScroll: true });
      }
    });
  });

  const allChildrenCompleted = state.children.length > 0 && childrenSections.every((child) => Object.values(child.sections).every((section) => section.completed));

  return (
    <>
      <AppPageTitle>{t(($) => $.childrensApplication.pageTitle)}</AppPageTitle>
      <ProgressStepper activeStep="childrensApplication" className="mb-8" />
      <div className="max-w-prose space-y-8">
        {state.children.map((child, index) => {
          const childName = `${child.information?.firstName} ${child.information?.lastName}`;
          const dateOfBirth = child.information?.dateOfBirth ? toLocaleDateString(parseDateString(child.information.dateOfBirth), currentLanguage) : '';

          const sections = childrenSections.find((c) => c.id === child.id)?.sections;
          invariant(sections, 'Expected sections to be defined for child');
          const sectionCompletedCount = Object.values(sections).filter((section) => section.completed).length;
          const sectionsCount = Object.values(sections).length;

          const deleteAriaLabel = child.information ? t(($) => $.childrensApplication.removeChildAccessibleNameWithName, { childNumber: index + 1, childName }) : t(($) => $.childrensApplication.removeChildAccessibleName, { childNumber: index + 1 });

          return (
            <div key={child.id}>
              <h2 id={`child-heading-${child.id}`} tabIndex={-1} className="font-lato mb-4 text-2xl font-bold">
                {t(($) => $.childrensApplication.childTitle, {
                  childNumber: index + 1,
                })}
              </h2>
              <div className="space-y-4">
                <p>{t(($) => $.completeAllSections, { ns: 'protectedApplication' })}</p>
                <p>
                  {t(($) => $.sectionsCompleted, {
                    number: sectionCompletedCount,
                    count: sectionsCount,
                    ns: 'common',
                  })}
                </p>
              </div>
              <Card className="my-2">
                <CardHeader>
                  <CardTitle asChild>
                    <h3>
                      {t(($) => $.childrensApplication.childInformationCardTitle, {
                        childNumber: index + 1,
                      })}
                    </h3>
                  </CardTitle>
                  <CardAction>{sections.childInformation.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <CardContent>
                  {child.information === undefined ? (
                    <p>{t(($) => $.childrensApplication.childInformationIndicateStatus)}</p>
                  ) : (
                    <DefinitionList layout="single-column">
                      {child.information.memberId && <DefinitionListItem term={t(($) => $.childrensApplication.memberIdTitle)}>{child.information.memberId}</DefinitionListItem>}
                      <DefinitionListItem term={t(($) => $.childrensApplication.fullNameTitle)}>{childName}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.dobTitle)}>{dateOfBirth}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.sinTitle)}>{child.information.socialInsuranceNumber ? formatSin(child.information.socialInsuranceNumber) : ''}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.childrensApplication.parentGuardianTitle)}>{child.information.isParent ? t(($) => $.childrensApplication.yes) : t(($) => $.childrensApplication.no)}</DefinitionListItem>
                    </DefinitionList>
                  )}
                </CardContent>
                <CardFooter className="border-t bg-zinc-100">
                  <ButtonLink
                    id="edit-info-button"
                    variant="link"
                    className="p-0"
                    routeId="protected/application/$id/children/$childId/information"
                    params={{ ...params, childId: child.id }}
                    startIcon={sections.childInformation.completed ? faPenToSquare : faCirclePlus}
                    size="lg"
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit info click"
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
                    <h3>{t(($) => $.childrensApplication.childDentalInsuranceCardTitle)}</h3>
                  </CardTitle>
                  <CardAction>{sections.childDentalInsurance.completed && <StatusTag status="complete" />}</CardAction>
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
                    id="edit-insurance-button"
                    variant="link"
                    className="p-0"
                    routeId="protected/application/$id/children/$childId/dental-insurance"
                    params={{ ...params, childId: child.id }}
                    startIcon={sections.childDentalInsurance.completed ? faPenToSquare : faCirclePlus}
                    size="lg"
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit insurance click"
                  >
                    {child.dentalInsurance === undefined ? t(($) => $.childrensApplication.addChildDentalInsurance) : t(($) => $.childrensApplication.editChildDentalInsurance)}
                  </ButtonLink>
                </CardFooter>
              </Card>
              <Card className="my-2">
                <CardHeader>
                  <CardTitle asChild>
                    <h3>{t(($) => $.childrensApplication.childDentalBenefitsCardTitle)}</h3>
                  </CardTitle>
                  <CardAction>{sections.childDentalBenefits.completed && <StatusTag status="complete" />}</CardAction>
                </CardHeader>
                <CardContent>
                  {child.dentalBenefits === undefined ? (
                    <p>{t(($) => $.childrensApplication.childDentalBenefitsIndicateStatus)}</p>
                  ) : (
                    <DefinitionList layout="single-column">
                      <DefinitionListItem term={t(($) => $.childrensApplication.dentalBenefitsTitle)}>
                        {child.dentalBenefits.federalBenefit.access || child.dentalBenefits.provTerrBenefit.access ? (
                          <div className="space-y-3">
                            <p>{t(($) => $.childrensApplication.dentalBenefitsYes)}</p>
                            <ul className="list-disc space-y-1 pl-7">
                              {child.dentalBenefits.federalBenefit.access && <li>{child.dentalBenefits.federalBenefit.benefit}</li>}
                              {child.dentalBenefits.provTerrBenefit.access && <li>{child.dentalBenefits.provTerrBenefit.benefit}</li>}
                            </ul>
                          </div>
                        ) : (
                          <p>{t(($) => $.childrensApplication.dentalBenefitsNo)}</p>
                        )}
                      </DefinitionListItem>
                    </DefinitionList>
                  )}
                </CardContent>
                <CardFooter className="border-t bg-zinc-100">
                  <ButtonLink
                    id={`edit-benefits-button-${child.id}`}
                    variant="link"
                    className="p-0"
                    routeId="protected/application/$id/children/$childId/federal-provincial-territorial-benefits"
                    params={{ ...params, childId: child.id }}
                    startIcon={sections.childDentalBenefits.completed ? faPenToSquare : faCirclePlus}
                    size="lg"
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit benefits click"
                  >
                    {child.dentalBenefits === undefined ? t(($) => $.childrensApplication.addChildDentalBenefits) : t(($) => $.childrensApplication.editChildDentalBenefits)}
                  </ButtonLink>
                </CardFooter>
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
                    aria-label={deleteAriaLabel}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Remove child - Child(ren) application click"
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
          <Button
            variant="primary"
            id="add-child"
            name="_action"
            value={FORM_ACTION.add}
            disabled={isSubmitting}
            aria-label={t(($) => $.childrensApplication.addChildAccessibleName, { childNumber: state.children.length + 1 })}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Add child - Child(ren) application click"
          >
            {t(($) => $.childrensApplication.addChild)}
          </Button>
        </fetcher.Form>

        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink
            disabled={!allChildrenCompleted}
            variant="primary"
            direction="next"
            routeId="protected/application/$id/intake-family/submit"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Continue click"
          >
            {t(($) => $.childrensApplication.submitBtn)}
          </NavigationButtonLink>
          <NavigationButtonLink
            variant="secondary"
            direction="previous"
            routeId="protected/application/$id/intake-family/dental-insurance"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Back click"
          >
            {t(($) => $.childrensApplication.backBtn)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}
