import { invariant } from '@dts-stn/invariant';
import { faCirclePlus, faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/renew';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isRenewalSelectionCompleted } from '~/.server/routes/helpers/protected-application-entry-section-checks';
import { getContextualAgeCategoryFromDate, getInitialApplicationFlowUrl, getProtectedApplicationState, validateProtectedApplicationContext } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import type { IdToken } from '~/.server/utils/raoidc-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.typeOfApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const userInfoToken = session.get('userInfoToken');
  invariant(userInfoToken.sin, 'Expected userInfoToken.sin to be defined');

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.application.entry.type-of-application', { userId: idToken.sub });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'renewal');

  const t = await getFixedT(url, ['protectedApplication', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.renewalSelection.pageTitle) }),
  };

  const applicationFlow: ApplicationFlow = state.typeOfApplication ? `${state.context}-${state.typeOfApplication}` : 'entry';
  const nextRouteId = getInitialApplicationFlowUrl(applicationFlow, params);

  const applicants = state.clientApplication
    ? [
        { id: state.clientApplication.applicantInformation.clientId, name: `${state.clientApplication.applicantInformation.firstName} ${state.clientApplication.applicantInformation.lastName}` },
        ...state.clientApplication.children.map((child) => ({ id: child.information.clientId, name: `${child.information.firstName} ${child.information.lastName}` })),
      ].filter(({ id }) => state.applicantClientIdsToRenew?.includes(id))
    : [];

  const ageCategory = state.applicantInformation?.dateOfBirth ? getContextualAgeCategoryFromDate(state.applicantInformation.dateOfBirth, state.applicationYear) : undefined;

  return {
    defaultState: {
      context: state.context,
      typeOfApplication: state.typeOfApplication,
      applicantClientIdsToRenew: state.applicantClientIdsToRenew,
      livingIndependently: ageCategory === 'youth' ? state.livingIndependently : undefined,
    },
    applicants,
    nextRouteId,
    sections: {
      applicantClientIdsToRenew: { completed: isRenewalSelectionCompleted(state) },
    },
    meta,
  };
}

export default function ProtectedTypeOfApplication({ loaderData, params }: Route.ComponentProps) {
  const { defaultState, applicants, nextRouteId, sections } = loaderData;
  const { t } = useTranslation('protectedApplication');

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.renewalSelection.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <div className="space-y-4">
          <p>{t(($) => $.completeAllSections)}</p>
          <p>{completedSectionsLabel}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t(($) => $.renewalSelection.typeApplicationHeading)}</CardTitle>
            <CardAction>{sections.applicantClientIdsToRenew.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {defaultState.applicantClientIdsToRenew === undefined ? (
              <p>{t(($) => $.renewalSelection.typeApplicationDescription)}</p>
            ) : (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.renewalSelection.typeApplicationLegend)}>
                  <ul className="list-disc space-y-1 pl-7">
                    {applicants.map(({ id, name }) => (
                      <li key={id}>{name}</li>
                    ))}
                  </ul>
                </DefinitionListItem>
                {defaultState.livingIndependently !== undefined && (
                  <DefinitionListItem term={t(($) => $.renewalSelection.livingIndependently)}>{defaultState.livingIndependently ? t(($) => $.renewalSelection.livingIndependentlyYes) : t(($) => $.renewalSelection.livingIndependentlyNo)}</DefinitionListItem>
                )}
              </DefinitionList>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="type-of-application-edit-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/renewal-selection"
              params={params}
              startIcon={defaultState.applicantClientIdsToRenew ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Edit type of application click"
            >
              {defaultState.applicantClientIdsToRenew === undefined ? t(($) => $.renewalSelection.addTypeApplication) : t(($) => $.renewalSelection.editTypeApplication)}
            </ButtonLink>
          </CardFooter>
        </Card>
        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink disabled={!allSectionsCompleted} variant="primary" direction="next" to={nextRouteId} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Continue click">
            {t(($) => $.renewalSelection.application)}
          </NavigationButtonLink>
          <NavigationButtonLink variant="secondary" direction="previous" routeId="protected/application/$id/eligibility-requirements" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Back click">
            {t(($) => $.renewalSelection.beforeYouStart)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}
