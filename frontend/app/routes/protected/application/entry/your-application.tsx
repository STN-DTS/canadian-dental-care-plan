import { faCirclePlus, faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/your-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isNewOrReturningMemberSectionCompleted, isPersonalInformationSectionCompleted, isTypeOfApplicationSectionCompleted } from '~/.server/routes/helpers/protected-application-entry-section-checks';
import type { ApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getContextualAgeCategoryFromDate, getInitialApplicationFlowUrl, getProtectedApplicationState, shouldSkipNewOrReturningMember, validateProtectedApplicationContext } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { formatClientNumber } from '~/utils/application-code-utils';
import { parseDateString, toLocaleDateString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin } from '~/utils/sin-utils';

const APPLICANT_TYPE = { adult: 'adult', family: 'family', children: 'children' } as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.typeOfApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  validateProtectedApplicationContext(state, params, 'intake');

  const t = await getFixedT(url, ['protectedApplication', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.yourApplication.pageTitle) }),
  };

  const applicationFlow: ApplicationFlow = state.typeOfApplication ? `${state.context}-${state.typeOfApplication}` : 'entry';
  const nextRouteId = getInitialApplicationFlowUrl(applicationFlow, params);

  const ageCategory = state.applicantInformation?.dateOfBirth ? getContextualAgeCategoryFromDate(state.applicantInformation.dateOfBirth, state.applicationYear) : undefined;
  const shouldSkipNewOrReturningMemberStep = shouldSkipNewOrReturningMember(state);
  const showNewOrReturningMemberSection = !shouldSkipNewOrReturningMemberStep;

  return {
    defaultState: {
      context: state.context,
      typeOfApplication: state.typeOfApplication,
      personalInformation: state.applicantInformation,
      livingIndependently: ageCategory === 'youth' ? state.livingIndependently : undefined,
      newOrReturningMember: state.newOrReturningMember,
    },
    nextRouteId,
    showNewOrReturningMemberSection,
    sections: {
      typeOfApplication: { completed: isTypeOfApplicationSectionCompleted(state) },
      personalInformation: { completed: isPersonalInformationSectionCompleted(state) },
      ...(shouldSkipNewOrReturningMemberStep ? {} : { newOrReturningMember: { completed: isNewOrReturningMemberSectionCompleted(state) } }),
    },
    meta,
    locale: getLocale(url),
  };
}

export default function TypeOfApplication({ loaderData, params }: Route.ComponentProps) {
  const { defaultState, nextRouteId, sections, showNewOrReturningMemberSection, locale } = loaderData;
  const { t } = useTranslation('protectedApplication');

  function getTypeOfApplication(typeOfApplication: string) {
    switch (typeOfApplication) {
      case APPLICANT_TYPE.adult: {
        return t(($) => $.yourApplication.typeApplicationPersonal);
      }
      case APPLICANT_TYPE.family: {
        return t(($) => $.yourApplication.typeApplicationFamily);
      }
      case APPLICANT_TYPE.children: {
        return t(($) => $.yourApplication.typeApplicationChildren);
      }
      default: {
        return '';
      }
    }
  }

  const parsedDateOfBirth = defaultState.personalInformation ? parseDateString(defaultState.personalInformation.dateOfBirth) : undefined;
  const formattedDateOfBirth = parsedDateOfBirth ? toLocaleDateString(parsedDateOfBirth, locale) : undefined;

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.yourApplication.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <div className="space-y-4">
          <p>{t(($) => $.completeAllSections)}</p>
          <p>{completedSectionsLabel}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t(($) => $.yourApplication.typeApplicationHeading)}</CardTitle>
            <CardAction>{sections.typeOfApplication.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {defaultState.typeOfApplication === undefined ? (
              <p>{t(($) => $.yourApplication.typeApplicationDescription)}</p>
            ) : (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.yourApplication.typeApplicationLegend)}>{getTypeOfApplication(defaultState.typeOfApplication)}</DefinitionListItem>
              </DefinitionList>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="type-of-application-edit-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/type-application"
              params={params}
              startIcon={defaultState.typeOfApplication ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Edit type of application click"
            >
              {defaultState.typeOfApplication === undefined ? t(($) => $.yourApplication.addTypeApplication) : t(($) => $.yourApplication.editTypeApplication)}
            </ButtonLink>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t(($) => $.yourApplication.personalInfoHeading)}</CardTitle>
            <CardAction>{sections.personalInformation.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {defaultState.personalInformation === undefined ? (
              <p>{t(($) => $.yourApplication.personalInfoDescription[defaultState.context])}</p>
            ) : (
              <DefinitionList layout="single-column">
                {defaultState.personalInformation.memberId && <DefinitionListItem term={t(($) => $.yourApplication.memberId)}>{formatClientNumber(defaultState.personalInformation.memberId)}</DefinitionListItem>}
                <DefinitionListItem term={t(($) => $.yourApplication.fullName)}>{`${defaultState.personalInformation.firstName} ${defaultState.personalInformation.lastName}`}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.yourApplication.dateOfBirth)}>{formattedDateOfBirth}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.yourApplication.sin)}>{formatSin(defaultState.personalInformation.socialInsuranceNumber)}</DefinitionListItem>
                {defaultState.livingIndependently !== undefined && (
                  <DefinitionListItem term={t(($) => $.yourApplication.livingIndependently)}>{defaultState.livingIndependently ? t(($) => $.yourApplication.livingIndependentlyYes) : t(($) => $.yourApplication.livingIndependentlyNo)}</DefinitionListItem>
                )}
              </DefinitionList>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="personal-information-edit-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/personal-information"
              params={params}
              startIcon={defaultState.typeOfApplication ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Edit personal information click"
            >
              {defaultState.personalInformation === undefined ? t(($) => $.yourApplication.addPersonalInformation) : t(($) => $.yourApplication.editPersonalInformation)}
            </ButtonLink>
          </CardFooter>
        </Card>
        {showNewOrReturningMemberSection && (
          <Card>
            <CardHeader>
              <CardTitle>{t(($) => $.yourApplication.newOrReturningHeading)}</CardTitle>
              <CardAction>{sections.newOrReturningMember?.completed && <StatusTag status="complete" />}</CardAction>
            </CardHeader>
            <CardContent>
              {defaultState.newOrReturningMember === undefined ? (
                <p>{t(($) => $.yourApplication.newOrReturningDescription)}</p>
              ) : (
                <DefinitionList layout="single-column">
                  <DefinitionListItem term={t(($) => $.yourApplication.previouslyEnrolled)}>{defaultState.newOrReturningMember.isNewOrReturningMember ? t(($) => $.yourApplication.yes) : t(($) => $.yourApplication.no)}</DefinitionListItem>
                  {defaultState.newOrReturningMember.isNewOrReturningMember === true && <DefinitionListItem term={t(($) => $.yourApplication.memberId)}>{defaultState.newOrReturningMember.memberId}</DefinitionListItem>}
                </DefinitionList>
              )}
            </CardContent>
            <CardFooter className="border-t bg-zinc-100">
              <ButtonLink id="edit-button" variant="link" className="p-0" routeId="protected/application/$id/new-or-returning-member" params={params} startIcon={faCirclePlus} size="lg">
                {defaultState.newOrReturningMember === undefined ? t(($) => $.yourApplication.addAnswer) : t(($) => $.yourApplication.editAnswer)}
              </ButtonLink>
            </CardFooter>
          </Card>
        )}
        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink disabled={!allSectionsCompleted} variant="primary" direction="next" to={nextRouteId} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Continue click">
            {t(($) => $.yourApplication.application)}
          </NavigationButtonLink>
          <NavigationButtonLink variant="secondary" direction="previous" routeId="protected/application/$id/eligibility-requirements" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Entry:Back click">
            {t(($) => $.yourApplication.beforeYouStart)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}
