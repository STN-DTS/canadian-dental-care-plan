import { data, redirectDocument } from 'react-router';
import type { Params } from 'react-router';

import { UTCDate } from '@date-fns/utc';
import { differenceInMinutes } from 'date-fns';
import type { ArrayElement, PickDeep, ReadonlyDeep } from 'type-fest';

import type { ClientApplicationRenewalEligibleDto } from '~/.server/domain/dtos';
import { createLogger } from '~/.server/logging';
import type {
  BaseApplicationAddressDeclaredChangeState,
  BaseApplicationApplicantInformationState,
  BaseApplicationChildState,
  BaseApplicationCommunicationPreferencesDeclaredChangeState,
  BaseApplicationContextState,
  BaseApplicationDentalBenefitsDeclaredChangeState,
  BaseApplicationDentalInsuranceState,
  BaseApplicationPartnerInformationState,
  BaseApplicationPhoneNumberDeclaredChangeState,
  BaseApplicationSubmissionInfoState,
  BaseApplicationSubmitTermsState,
  BaseApplicationTermsAndConditionsState,
  BaseApplicationTypeOfApplicationState,
  BaseApplicationVerifyEmailState,
  BaseApplicationYearState,
} from '~/.server/routes/helpers/base-application-route-helpers';
import { getAgeCategoryFromAge, getAgeCategoryReferenceDate } from '~/.server/routes/helpers/base-application-route-helpers';
import { getEnv } from '~/.server/utils/env.utils';
import { getLocaleFromParams } from '~/.server/utils/locale.utils';
import { getCdcpWebsiteApplyUrl } from '~/.server/utils/url.utils';
import type { Session } from '~/.server/web/session';
import { getAgeFromDateString, parseDateString } from '~/utils/date-utils';
import { generateId } from '~/utils/id.utils';
import { getPathById } from '~/utils/route-utils';

export type PublicApplicationStateSessionKey = `public-application-flow-${string}`;

export type PublicApplicationInputModelState = 'full' | 'simplified';

export type PublicApplicationState = ReadonlyDeep<{
  /**
   * The unique identifier for the public application.
   */
  id: string;
  context: BaseApplicationContextState;
  inputModel?: PublicApplicationInputModelState;
  lastUpdatedOn: string;
  applicantInformation?: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  children: BaseApplicationChildState[];
  communicationPreferences?: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email?: string;
  verifyEmail?: BaseApplicationVerifyEmailState;
  emailVerified?: boolean;
  maritalStatus?: string;
  dentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
  dentalInsurance?: BaseApplicationDentalInsuranceState;
  livingIndependently?: boolean;
  partnerInformation?: BaseApplicationPartnerInformationState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  phoneNumber?: BaseApplicationPhoneNumberDeclaredChangeState;
  submitTerms?: BaseApplicationSubmitTermsState;
  submissionInfo?: BaseApplicationSubmissionInfoState;
  hasFiledTaxes?: boolean;
  termsAndConditions?: BaseApplicationTermsAndConditionsState;
  typeOfApplication?: BaseApplicationTypeOfApplicationState;
  clientApplication?: ClientApplicationRenewalEligibleDto;
  newOrReturningMember?: {
    isNewOrReturningMember: boolean;
    memberId?: string;
  };
}>;

export type PublicApplicationApplicantInformationState = NonNullable<PublicApplicationState['applicantInformation']>;
export type PublicApplicationChildInformationState = NonNullable<PublicApplicationChildState['information']>;
export type PublicApplicationChildrenState = PublicApplicationState['children'];
export type PublicApplicationChildSinState = Pick<NonNullable<PublicApplicationChildState['information']>, 'hasSocialInsuranceNumber' | 'socialInsuranceNumber'>;
export type PublicApplicationChildState = PublicApplicationChildrenState[number];
export type PublicApplicationCommunicationPreferencesState = NonNullable<NonNullable<PublicApplicationState['communicationPreferences']>['value']>;
export type PublicApplicationDentalFederalBenefitsState = Pick<NonNullable<NonNullable<PublicApplicationState['dentalBenefits']>['value']>, 'federalSocialProgram' | 'hasFederalBenefits'>;
export type PublicApplicationDentalProvincialTerritorialBenefitsState = Pick<NonNullable<NonNullable<PublicApplicationState['dentalBenefits']>['value']>, 'hasProvincialTerritorialBenefits' | 'province' | 'provincialTerritorialSocialProgram'>;
export type PublicApplicationPartnerInformationState = NonNullable<PublicApplicationState['partnerInformation']>;
export type PublicApplicationTypeOfApplicationState = NonNullable<PublicApplicationState['typeOfApplication']>;
export type PublicApplicationNewOrReturningMemberState = NonNullable<PublicApplicationState['newOrReturningMember']>;

/**
 * Gets the public application flow session key.
 * @param id - The public application flow ID.
 * @returns The public application flow session key.
 */
function getSessionKey(id: string): PublicApplicationStateSessionKey {
  return `public-application-flow-${id}`;
}

export type ApplicationStateParams = {
  id: string;
  lang: string;
};

interface LoadStateArgs {
  params: ApplicationStateParams;
  session: Session;
}

/**
 * Gets public application state.
 * @param args - The arguments.
 * @returns The public applicqation state.
 */
export function getPublicApplicationState({ params, session }: LoadStateArgs): PublicApplicationState {
  const log = createLogger('application-route-helpers.server/loadApplicationState');
  const locale = getLocaleFromParams(params);
  const cdcpWebsiteApplicationUrl = getCdcpWebsiteApplyUrl(locale);

  if (!params.id) {
    log.warn('Invalid "id" param; redirecting to [%s]; id: [%s], sessionId: [%s]', cdcpWebsiteApplicationUrl, params.id, session.id);
    throw redirectDocument(cdcpWebsiteApplicationUrl);
  }

  const sessionKey = getSessionKey(params.id);

  if (!session.has(sessionKey)) {
    log.warn('Application session state has not been found; redirecting to [%s]; sessionKey: [%s], sessionId: [%s]', cdcpWebsiteApplicationUrl, sessionKey, session.id);
    throw redirectDocument(cdcpWebsiteApplicationUrl);
  }

  const state = session.get(sessionKey);

  // Checks if the elapsed time since the last update exceeds 20 minutes,
  // and performs necessary actions if it does.
  const lastUpdatedOn = new UTCDate(state.lastUpdatedOn);
  const now = new UTCDate();

  if (differenceInMinutes(now, lastUpdatedOn) >= 20) {
    session.unset(sessionKey);
    log.warn('Application session state has expired; redirecting to [%s]; sessionKey: [%s], sessionId: [%s]', cdcpWebsiteApplicationUrl, sessionKey, session.id);
    throw redirectDocument(cdcpWebsiteApplicationUrl);
  }

  return state;
}

interface SavePublicApplicationStateArgs {
  params: ApplicationStateParams;
  session: Session;
  state: Partial<OmitStrict<PublicApplicationState, 'id' | 'lastUpdatedOn' | 'applicationYear' | 'context'>>;
}

/**
 * Saves public application state.
 * @param args - The arguments.
 * @returns The new public application state.
 */
export function savePublicApplicationState({ params, session, state }: SavePublicApplicationStateArgs): PublicApplicationState {
  const log = createLogger('application-route-helpers.server/saveApplicationState');
  const currentState = getPublicApplicationState({ params, session });

  const newState = {
    ...currentState,
    ...state,
    lastUpdatedOn: new UTCDate().toISOString(),
  } satisfies PublicApplicationState;

  const sessionkey = getSessionKey(currentState.id);
  session.set(sessionkey, newState);
  log.info('Application session state saved; sessionKey: [%s], sessionId: [%s]', sessionkey, session.id);
  return newState;
}

interface ClearStateArgs {
  params: ApplicationStateParams;
  session: Session;
}

/**
 * Clears public application state.
 * @param args - The arguments.
 */
export function clearPublicApplicationState({ params, session }: ClearStateArgs): void {
  const log = createLogger('application-route-helpers.server/clearApplicationState');
  const { id } = getPublicApplicationState({ params, session });

  const sessionKey = getSessionKey(id);
  session.unset(sessionKey);
  log.info('Application session state cleared; sessionKey: [%s], sessionId: [%s]', sessionKey, session.id);
}

interface StartArgs {
  applicationYear: BaseApplicationYearState;
  session: Session;
}

/**
 * Starts application state.
 * @param args - The arguments.
 * @returns The initial application state.
 */
export function startApplicationState({ applicationYear, session }: StartArgs): PublicApplicationState {
  const log = createLogger('application-route-helpers.server/startApplicationState');

  const id = generateId();
  const initialState: PublicApplicationState = {
    id,
    context: isWithinRenewalPeriod() ? 'renewal' : 'intake',
    lastUpdatedOn: new UTCDate().toISOString(),
    applicationYear,
    children: [],
  };

  const sessionKey = getSessionKey(initialState.id);
  session.set(sessionKey, initialState);
  log.info('Application session state started; sessionKey: [%s], sessionId: [%s]', sessionKey, session.id);
  return initialState;
}

/**
 * Gets the age category based on the given date string and application year. The reference date for age calculation
 * is determined by the application year, which allows for contextual age categorization.
 *
 * @param date - The date of birth as a string.
 * @param applicationYear - The application year data used to determine the reference date for age calculation.
 * @returns The age category as a string.
 */
export function getContextualAgeCategoryFromDate(date: string, applicationYear: Pick<BaseApplicationYearState, 'taxYear'>) {
  const referenceDate = getAgeCategoryReferenceDate(applicationYear);
  const age = getAgeFromDateString(date, referenceDate.toString());
  return getAgeCategoryFromAge(age);
}

export function isNewChildState(child: PublicApplicationChildState) {
  return !child.dentalInsurance || !child.information || !child.dentalBenefits;
}

export function getChildrenState<TState extends Pick<PublicApplicationState, 'children'>>(state: TState, includesNewChildState: boolean = false) {
  // prettier-ignore
  return includesNewChildState
    ? state.children
    : state.children.filter((child) => isNewChildState(child) === false);
}

/**
 * Extracts the input model and type of application from a combined string.
 *
 * @template S - A string in the format `${InputModelState}-${TypeOfApplicationState}`
 *
 * @returns An object containing `inputModel` and `typeOfApplication` if the input string is valid; otherwise, `never`.
 *
 * @example
 * ```typescript
 * type Result = ExtractStateFromApplicationFlow<'full-adult'>;
 * // Result is { inputModel: 'full'; typeOfApplication: 'adult' }
 * ```
 */
type ExtractStateFromApplicationFlow<S extends string> = S extends `${infer I}-${infer T}` //
  ? I extends PublicApplicationInputModelState
    ? T extends PublicApplicationTypeOfApplicationState
      ? { inputModel: I; typeOfApplication: T }
      : never
    : never
  : never;

/**
 * Validates the application flow based on the provided state and allowed flows.
 *
 * @template TAllowedFlows - A readonly array of allowed flow combinations in the format `${InputModelState}-${TypeOfApplicationState}`.
 *
 * @param state - The current public application state to validate.
 * @param params - The route parameters used for redirection if validation fails.
 * @param allowedFlows - An array of allowed flow combinations.
 *
 * @throws {RedirectDocument} If the input model or flow is not defined, or if the combination is not allowed.
 *
 * @example
 * ```typescript
 * validateApplicationFlow(state, params, ['full-adult', 'simplified-children']);
 * ```
 */
export function validateApplicationFlow<TAllowedFlows extends ReadonlyArray<`${PublicApplicationInputModelState}-${PublicApplicationTypeOfApplicationState}`>>(
  state: Pick<PublicApplicationState, 'inputModel' | 'typeOfApplication' | 'clientApplication' | 'id'>,
  params: Params,
  allowedFlows: TAllowedFlows,
): asserts state is OmitStrict<PublicApplicationState, 'inputModel' | 'typeOfApplication'> & ExtractStateFromApplicationFlow<TAllowedFlows[number]> {
  const log = createLogger('application-route-helpers.server/validateApplicationFlow');

  const inputModel = state.inputModel;
  const type = state.typeOfApplication;

  if (!inputModel || !type) {
    const redirectUrl = getInitialApplicationFlowUrl('entry', params);
    log.warn('Input model or type is not defined in the state; redirecting to [%s], stateId: [%s]', redirectUrl, state.id);
    throw redirectDocument(redirectUrl);
  }

  const flowKey = `${inputModel}-${type}` as const;

  if (!allowedFlows.includes(flowKey)) {
    const redirectUrl = getInitialApplicationFlowUrl(flowKey, params);
    log.warn('Flow [%s] is not allowed; allowedTypesAndFlows: [%s], redirecting to [%s], stateId: [%s]', flowKey, allowedFlows, redirectUrl, state.id);
    throw redirectDocument(redirectUrl);
  }

  if (inputModel === 'simplified' && state.clientApplication === undefined) {
    const redirectUrl = getInitialApplicationFlowUrl('entry', params);
    log.warn("Input model is 'simplified' but clientApplication is not defined in state; redirecting to [%s], stateId: [%s]", redirectUrl, state.id);
    throw redirectDocument(redirectUrl);
  }
}

export type ApplicationFlow = 'entry' | `${PublicApplicationInputModelState}-${PublicApplicationTypeOfApplicationState}`;

/**
 * Determines the initial URL path based on the input model and type of application.
 *
 * @param applicationFlow - Either 'entry' for initial entry point, or a combination of input model
 *                      and type of application in the format `${TypeOfApplicationState}-${TypeOfApplicationState}`
 * @param params - Route parameters used to generate the path, typically containing an application ID
 * @returns The URL path string for the corresponding input model and application type
 * @throws {Error} When an unknown applicationFlow value is provided
 */
export function getInitialApplicationFlowUrl(applicationFlow: ApplicationFlow, params: Params) {
  switch (applicationFlow) {
    case 'entry': {
      return getPathById('public/application/$id/eligibility-requirements', params);
    }
    case 'full-adult': {
      return getPathById('public/application/$id/full-adult/marital-status', params);
    }
    case 'full-children': {
      return getPathById('public/application/$id/full-children/parent-or-guardian', params);
    }
    case 'full-family': {
      return getPathById('public/application/$id/full-family/marital-status', params);
    }
    case 'full-delegate': {
      return getPathById('public/application/$id/application-delegate', params);
    }
    case 'simplified-adult': {
      return getPathById('public/application/$id/simplified-adult/contact-information', params);
    }
    case 'simplified-children': {
      return getPathById('public/application/$id/simplified-children/parent-or-guardian', params);
    }
    case 'simplified-family': {
      return getPathById('public/application/$id/simplified-family/contact-information', params);
    }
    case 'simplified-delegate': {
      return getPathById('public/application/$id/application-delegate', params);
    }
    default: {
      throw new Error(`Unknown applicationFlow value: [${applicationFlow}]`);
    }
  }
}

interface getSingleChildStateArgs {
  params: ApplicationStateParams & { childId: string };
  session: Session;
}

/**
 * Loads single child state from public application state.
 * @param args - The arguments.
 * @returns The loaded child state.
 */
export function getSingleChildState({ params, session }: getSingleChildStateArgs) {
  const log = createLogger('public-application-route-helpers.server/publicApplicationSingleChildState');
  const applicationState = getPublicApplicationState({ params, session });
  const childId = params.childId;
  const childState = applicationState.children.find(({ id }) => id === childId);

  if (!childState) {
    log.warn('Public application single child has not been found; stateId: [%s] childId: [%s]', applicationState.id, childId);
    throw data(null, { status: 404 });
  }

  const childNumber = applicationState.children.indexOf(childState) + 1;
  const isNew = isNewChildState(childState);

  return {
    ...childState,
    context: applicationState.context,
    childNumber,
    isNew,
  };
}

/**
 * Checks if the provided date falls within the configured renewal period.
 *
 * The renewal period is defined by the `RENEWAL_PERIOD_START_DATE` and
 * `RENEWAL_PERIOD_END_DATE` environment variables.
 *
 * @param date - The date to check. Defaults to the current date and time.
 * @returns `true` if the date is within the renewal period (inclusive); otherwise, `false`.
 */
export function isWithinRenewalPeriod(date: Date = new Date()): boolean {
  const { RENEWAL_PERIOD_START_DATE, RENEWAL_PERIOD_END_DATE } = getEnv();
  const startDate = new Date(RENEWAL_PERIOD_START_DATE);
  const endDate = new Date(RENEWAL_PERIOD_END_DATE);
  return date >= startDate && date <= endDate;
}

/**
 * Determines whether the new or returning member section is available.
 *
 * The section is available only for intake applications after personal information is completed,
 * and when the applicant birth year is 2007 or later.
 *
 * @param state - The public application state containing the applicant date of birth and living independently answer.
 * @returns `true` when the section is available; otherwise, `false`.
 */
export function isNewOrReturningMember(state: PickDeep<PublicApplicationState, 'context' | 'applicantInformation.dateOfBirth'>): boolean {
  if (state.context !== 'intake') return false;
  if (state.applicantInformation?.dateOfBirth === undefined) return false;

  const yearOfBirth = parseDateString(state.applicantInformation.dateOfBirth).getFullYear();
  return yearOfBirth >= 2007;
}

export function shouldSkipNewOrReturningMember(state: PickDeep<PublicApplicationState, 'context' | 'applicantInformation.dateOfBirth' | 'livingIndependently'>): boolean {
  return !isNewOrReturningMember(state);
}

/**
 * get the member ID for full application based on the application context.
 *
 * - For 'intake' context: returns the new-or-returning member's `memberId` when the new-or-returning
 *   member section applies; otherwise returns `undefined`.
 * - For 'renewal' context: returns the applicant's `memberId` from
 *   `applicantInformation`.
 *
 * @param state - The public application state containing context, applicant information, and
 *                optional new-or-returning member info.
 * @returns The resolved member ID, or `undefined` if not available.
 */
export function getMemberIdForFullApplication(state: PickDeep<PublicApplicationState, 'context' | 'applicantInformation.dateOfBirth' | 'applicantInformation.memberId' | 'newOrReturningMember.memberId'>): string | undefined {
  if (state.context === 'intake') {
    return shouldSkipNewOrReturningMember(state) ? undefined : state.newOrReturningMember?.memberId;
  }
  return state.applicantInformation?.memberId;
}

/**
 * Returns the applicant's SIN for a public application.
 *
 * Public flows are always intake, so the SIN is always read from `state.applicantInformation`.
 */
export function getPublicApplicantSin(state: PickDeep<PublicApplicationState, 'applicantInformation.socialInsuranceNumber'>): string | undefined {
  return state.applicantInformation?.socialInsuranceNumber;
}

/**
 * Returns the partner's SIN for a public application,
 * or `undefined` if no partner information has been captured yet.
 */
export function getPublicPartnerSin(state: PickDeep<PublicApplicationState, 'partnerInformation.socialInsuranceNumber'>): string | undefined {
  return state.partnerInformation?.socialInsuranceNumber;
}

/**
 * Returns the SINs of all children in a public application.
 * Pass `excludeChildId` to omit a specific child (e.g. the child currently being edited).
 * Entries may be `undefined` for children that have not yet provided a SIN.
 */
export function getPublicChildrenSins(state: { readonly children: ReadonlyArray<PickDeep<ArrayElement<PublicApplicationState['children']>, 'id' | 'information.socialInsuranceNumber'>> }, excludeChildId?: string): ReadonlyArray<string | undefined> {
  return state.children.filter((child) => child.id !== excludeChildId).map((child) => child.information?.socialInsuranceNumber);
}
