import { useParams } from 'react-router';

import { faCheckCircle, faCircleXmark, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/eligibility';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { isWithinRenewalPeriod } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { InlineLink } from '~/components/inline-link';
import { pageIds } from '~/page-ids';
import { useClientEnv } from '~/root';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  pageIdentifier: pageIds.protected.profile.eligibility,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, request, session });

  const clientNumber = clientApplication.applicantInformation.clientNumber;
  const dependentClientNumbers = clientApplication.children.map((child) => child.information.clientNumber);
  const clientNumbers = [clientNumber, ...dependentClientNumbers];

  const clientEligibilityResponse = await appContainer.get(TYPES.ClientEligibilityService).listClientEligibilitiesByClientNumbers(clientNumbers);

  const primaryApplicantEligibility = clientEligibilityResponse.get(clientApplication.applicantInformation.clientNumber);
  const primaryApplicant = {
    clientId: clientApplication.applicantInformation.clientId,
    clientNumber: clientApplication.applicantInformation.clientNumber,
    firstName: clientApplication.applicantInformation.firstName,
    lastName: clientApplication.applicantInformation.lastName,
    earnings: primaryApplicantEligibility?.earnings ?? [],
    eligibilityStatusCode: primaryApplicantEligibility?.eligibilityStatusCode,
    eligibilityStatusCodeNextYear: primaryApplicantEligibility?.eligibilityStatusCodeNextYear,
  };

  const children = clientApplication.children.map((child) => {
    const childEligibility = clientEligibilityResponse.get(child.information.clientNumber);
    return {
      clientId: child.information.clientId,
      clientNumber: child.information.clientNumber,
      firstName: child.information.firstName,
      lastName: child.information.lastName,
      earnings: childEligibility?.earnings ?? [],
      eligibilityStatusCode: childEligibility?.eligibilityStatusCode,
      eligibilityStatusCodeNextYear: childEligibility?.eligibilityStatusCodeNextYear,
    };
  });

  const applicants = [primaryApplicant, ...children];

  const t = await getFixedT(request, ['protectedProfile', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.eligibility.pageTitle) }),
  };
  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.eligibility', { userId: idToken.sub });

  const currentCoverage = appContainer.get(TYPES.CoverageService).getCurrentCoverage();

  return {
    meta,
    SCCH_BASE_URI,
    applicants,
    currentCoverage,
    isWithinRenewalPeriod: isWithinRenewalPeriod(),
  };
}

export default function ProtectedProfileEligibility({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['protectedProfile', 'gcweb']);
  const { applicants, SCCH_BASE_URI, currentCoverage, isWithinRenewalPeriod } = loaderData;
  const { ELIGIBILITY_STATUS_CODE_ELIGIBLE } = useClientEnv();

  return (
    <>
      <AppPageTitle>{t(($) => $.eligibility.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        <p>{t(($) => $.eligibility.details)}</p>
        <section className="space-y-6">
          <h2 className="font-lato text-2xl font-bold">{t(($) => $.eligibility.currentYear)}</h2>
          <p>
            {t(($) => $.eligibility.currentYearDetails, {
              end: currentCoverage.endYear,
              ns: 'protectedProfile',
            })}
          </p>
          <DefinitionList border>
            {applicants.map((applicant) => {
              const eligibilityStatus = getEligibilityStatus({ applicant, taxationYear: currentCoverage.taxationYear, isNextYear: false, ELIGIBILITY_STATUS_CODE_ELIGIBLE });
              return (
                <DefinitionListItem key={applicant.clientId} term={`${applicant.firstName} ${applicant.lastName}`}>
                  <EligibilityStatusIndicator status={eligibilityStatus} coverageStartYear={currentCoverage.startYear} coverageEndYear={currentCoverage.endYear} />
                </DefinitionListItem>
              );
            })}
          </DefinitionList>
        </section>
        {isWithinRenewalPeriod && (
          <section className="space-y-6">
            <h2 className="font-lato text-2xl font-bold">{t(($) => $.eligibility.nextYear)}</h2>
            <p>
              {t(($) => $.eligibility.benefitYearRange, {
                start: currentCoverage.startYear + 1,
                end: currentCoverage.endYear + 1,
                ns: 'protectedProfile',
              })}
            </p>
            <DefinitionList border>
              {applicants.map((applicant) => {
                const taxationYear = currentCoverage.taxationYear + 1;
                const coverageStartYear = currentCoverage.startYear + 1;
                const coverageEndYear = currentCoverage.endYear + 1;
                const eligibilityStatus = getEligibilityStatus({ applicant, taxationYear, isNextYear: true, ELIGIBILITY_STATUS_CODE_ELIGIBLE });
                return (
                  <DefinitionListItem key={applicant.clientId} term={`${applicant.firstName} ${applicant.lastName}`}>
                    <EligibilityStatusIndicator status={eligibilityStatus} coverageStartYear={coverageStartYear} coverageEndYear={coverageEndYear} />
                  </DefinitionListItem>
                );
              })}
            </DefinitionList>
          </section>
        )}
        <ButtonLink
          variant="primary"
          id="back-button"
          to={t(($) => $.header.menuDashboardHref, {
            baseUri: SCCH_BASE_URI,
            ns: 'gcweb',
          })}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Return to dashboard - Member eligibility return button click"
        >
          {t(($) => $.eligibility.returnButton)}
        </ButtonLink>
      </div>
    </>
  );
}

type EligibilityStatus = 'eligible' | 'not-eligible' | 'not-enrolled';
interface GetEligibilityStatusParams {
  applicant: Route.ComponentProps['loaderData']['applicants'][number];
  taxationYear: number;
  isNextYear: boolean;
  ELIGIBILITY_STATUS_CODE_ELIGIBLE: string;
}

function getEligibilityStatus({ applicant, taxationYear, isNextYear, ELIGIBILITY_STATUS_CODE_ELIGIBLE }: GetEligibilityStatusParams): EligibilityStatus {
  const statusCode = isNextYear ? applicant.eligibilityStatusCodeNextYear : applicant.eligibilityStatusCode;

  // Applicant profile eligibility status codes take precedence over earnings
  if (statusCode) {
    return statusCode === ELIGIBILITY_STATUS_CODE_ELIGIBLE ? 'eligible' : 'not-eligible';
  }

  // Fallback to earnings if no status code is present
  const earning = applicant.earnings.find((earning) => earning.taxationYear === taxationYear);
  if (!earning) return 'not-enrolled';
  const hasEligibleStatusCode = earning.eligibilityStatusCode === ELIGIBILITY_STATUS_CODE_ELIGIBLE;
  const hasCoverageCopayTierTpcCode = !!earning.coverageCopayTierTpcCode;
  return hasEligibleStatusCode && hasCoverageCopayTierTpcCode ? 'eligible' : 'not-eligible';
}

interface EligibilityStatusIndicatorProps {
  status: EligibilityStatus;
  coverageStartYear: number;
  coverageEndYear: number;
}

export function EligibilityStatusIndicator({ status, coverageStartYear, coverageEndYear }: EligibilityStatusIndicatorProps) {
  const { t } = useTranslation('protectedProfile');
  const params = useParams();

  if (status === 'eligible') {
    return (
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faCheckCircle} className="text-green-700" />
        <span className="text-nowrap">{t(($) => $.eligibility.eligible)}</span>
      </div>
    );
  }

  if (status === 'not-eligible') {
    return (
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faCircleXmark} className="text-red-700" />
        <span className="text-nowrap">{t(($) => $.eligibility.notEligible)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-6">
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-700" />
        <span className="text-nowrap">{t(($) => $.eligibility.notEnrolled)}</span>
      </div>
      <InlineLink routeId="protected/application/index" params={params}>
        {t(($) => $.eligibility.apply, {
          start: coverageStartYear,
          end: coverageEndYear,
          ns: 'protectedProfile',
        })}
      </InlineLink>
    </div>
  );
}
