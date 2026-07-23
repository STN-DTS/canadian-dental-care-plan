import { invariant } from '@dts-stn/invariant';
import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/eligibility-requirements';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isTaxFilingSectionCompleted, isTermsAndConditionsSectionCompleted } from '~/.server/routes/helpers/protected-application-entry-section-checks';
import { getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import type { IdToken } from '~/.server/utils/raoidc-utils';
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
  pageIdentifier: pageIds.protected.application.eligibilityRequirements,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const userInfoToken = session.get('userInfoToken');
  invariant(userInfoToken.sin, 'Expected userInfoToken.sin to be defined');

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.application.entry.eligibility-requirements', { userId: idToken.sub });

  const state = getProtectedApplicationState({ params, session });
  const t = await getFixedT(url, ['protectedApplication', 'gcweb']);
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
    isIntake: state.context === 'intake',
    meta,
  };
}

export default function ProtectedApplicationEligibilityRequirements({ loaderData, params }: Route.ComponentProps) {
  const { state, sections, isIntake } = loaderData;
  const { t } = useTranslation('protectedApplication');

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.eligibilityRequirements.pageHeading)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <div className="space-y-4">
          <p>{t(($) => $.completeAllSections)}</p>
          <p>{completedSectionsLabel}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t(($) => $.eligibilityRequirements.termsConditionsSection.title)}</CardTitle>
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
                id="edit-terms-conditions-button"
                variant="link"
                className="p-0"
                routeId="protected/application/$id/terms-conditions"
                params={params}
                startIcon={faPenToSquare}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Edit terms conditions click"
                aria-label={t(($) => $.eligibilityRequirements.termsConditionsSection.editButtonAria)}
              >
                {t(($) => $.eligibilityRequirements.termsConditionsSection.editButton)}
              </ButtonLink>
            ) : (
              <ButtonLink
                id="add-terms-conditions-button"
                variant="link"
                className="p-0"
                routeId="protected/application/$id/terms-conditions"
                params={params}
                startIcon={faCircleCheck}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Add terms conditions click"
              >
                {t(($) => $.eligibilityRequirements.termsConditionsSection.addButton)}
              </ButtonLink>
            )}
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t(($) => $.eligibilityRequirements.taxFilingSection.title)}</CardTitle>
            <CardAction>{sections.taxFiling.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            <p>{state.hasFiledTaxes === true ? t(($) => $.eligibilityRequirements.taxFilingSection.haveFiledTaxes) : t(($) => $.eligibilityRequirements.taxFilingSection.instructions)}</p>
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            {sections.taxFiling.completed ? (
              <ButtonLink
                id="edit-tax-filing-button"
                variant="link"
                className="p-0"
                routeId="protected/application/$id/tax-filing"
                params={params}
                startIcon={faPenToSquare}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Edit tax filing click"
                aria-label={t(($) => $.eligibilityRequirements.taxFilingSection.editButtonAria)}
              >
                {t(($) => $.eligibilityRequirements.taxFilingSection.editButton)}
              </ButtonLink>
            ) : (
              <ButtonLink
                id="add-tax-filing-button"
                variant="link"
                className="p-0"
                routeId="protected/application/$id/tax-filing"
                params={params}
                startIcon={faCircleCheck}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Add tax filing click"
              >
                {t(($) => $.eligibilityRequirements.taxFilingSection.addButton)}
              </ButtonLink>
            )}
          </CardFooter>
        </Card>
        <NavigationButtonLink
          disabled={!allSectionsCompleted}
          variant="primary"
          direction="next"
          routeId={`protected/application/$id/${isIntake ? 'your-application' : 'renew'}`}
          params={params}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Continue click"
        >
          {t(($) => $.eligibilityRequirements.nextButton[isIntake ? 'intake' : 'renewal'])}
        </NavigationButtonLink>
      </div>
    </>
  );
}
