import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/eligibility-requirements';

import { appContext } from '~/.server/context';
import { isTaxFilingSectionCompleted, isTermsAndConditionsSectionCompleted } from '~/.server/routes/helpers/public-application-entry-section-checks';
import { getPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.public.application.eligibilityRequirements,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  const t = await getFixedT(request, ['application', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.eligibilityRequirements.pageTitle) }),
  };
  return {
    state: {
      termsAndConditions: state.termsAndConditions,
      hasFiledTaxes: state.hasFiledTaxes,
    },
    sections: {
      termsAndConditions: { completed: isTermsAndConditionsSectionCompleted(state) },
      taxFiling: { completed: isTaxFilingSectionCompleted(state) },
    },
    meta,
  };
}

export default function ApplyIndex({ loaderData, params }: Route.ComponentProps) {
  const { state, sections } = loaderData;
  const { t } = useTranslation('application');

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.eligibilityRequirements.pageHeading)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <div className="space-y-4">
          <p>{t(($) => $.completeAllSections, { ns: 'application' })}</p>
          <p>{completedSectionsLabel}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.eligibilityRequirements.termsConditionsSection.title)}</h2>
            </CardTitle>
            <CardAction>{sections.termsAndConditions.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {state.termsAndConditions === undefined ? (
              <p>{t(($) => $.eligibilityRequirements.termsConditionsSection.instructions)}</p>
            ) : (
              <ul className="list-disc space-y-1 pl-7">
                {state.termsAndConditions.acknowledgeTerms && <li>{t(($) => $.eligibilityRequirements.termsConditionsSection.acknowledgeTerms)}</li>}
                {state.termsAndConditions.acknowledgePrivacy && <li>{t(($) => $.eligibilityRequirements.termsConditionsSection.acknowledgePrivacy)}</li>}
                {state.termsAndConditions.shareData && <li>{t(($) => $.eligibilityRequirements.termsConditionsSection.shareData)}</li>}
              </ul>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            {sections.termsAndConditions.completed ? (
              <ButtonLink
                id="edit-terms-conditions-button" //
                variant="link"
                className="p-0"
                routeId="public/application/$id/terms-conditions"
                params={params}
                startIcon={faPenToSquare}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Entry:Edit terms conditions click"
                aria-label={t(($) => $.eligibilityRequirements.termsConditionsSection.editButtonAria)}
              >
                {t(($) => $.eligibilityRequirements.termsConditionsSection.editButton)}
              </ButtonLink>
            ) : (
              <ButtonLink
                id="add-terms-conditions-button" //
                variant="link"
                className="p-0"
                routeId="public/application/$id/terms-conditions"
                params={params}
                startIcon={faCircleCheck}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Entry:Add terms conditions click"
              >
                {t(($) => $.eligibilityRequirements.termsConditionsSection.addButton)}
              </ButtonLink>
            )}
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.eligibilityRequirements.taxFilingSection.title)}</h2>
            </CardTitle>
            <CardAction>{sections.taxFiling.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            <p>
              {state.hasFiledTaxes === true //
                ? t(($) => $.eligibilityRequirements.taxFilingSection.haveFiledTaxes)
                : t(($) => $.eligibilityRequirements.taxFilingSection.instructions)}
            </p>
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            {sections.taxFiling.completed ? (
              <ButtonLink
                id="edit-tax-filing-button" //
                variant="link"
                className="p-0"
                routeId="public/application/$id/tax-filing"
                params={params}
                startIcon={faPenToSquare}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Entry:Edit tax filing click"
                aria-label={t(($) => $.eligibilityRequirements.taxFilingSection.editButtonAria)}
              >
                {t(($) => $.eligibilityRequirements.taxFilingSection.editButton)}
              </ButtonLink>
            ) : (
              <ButtonLink
                id="add-tax-filing-button" //
                variant="link"
                className="p-0"
                routeId="public/application/$id/tax-filing"
                params={params}
                startIcon={faCircleCheck}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Entry:Add tax filing click"
              >
                {t(($) => $.eligibilityRequirements.taxFilingSection.addButton)}
              </ButtonLink>
            )}
          </CardFooter>
        </Card>
        <NavigationButtonLink disabled={!allSectionsCompleted} variant="primary" direction="next" routeId="public/application/$id/your-application" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Entry:Continue click">
          {t(($) => $.eligibilityRequirements.nextButton)}
        </NavigationButtonLink>
      </div>
    </>
  );
}
