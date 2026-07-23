import { redirect } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, isChildClientNumberValid, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationStateParams, PublicApplicationChildrenState, PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getChildrenState, getContextualAgeCategoryFromDate, getPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

type PublicApplicationRenewalChildState = OmitStrict<PublicApplicationState, 'clientApplication'> & {
  clientApplication: NonNullable<PublicApplicationState['clientApplication']>;
};

interface LoadPublicApplicationSimplifiedChildStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads public application simplified renew child state.
 * @param args - The arguments.
 * @returns The loaded child state.
 */
export function loadPublicApplicationSimplifiedChildState({ params, requestUrl, session }: LoadPublicApplicationSimplifiedChildStateArgs): PublicApplicationRenewalChildState {
  const log = createLogger('public-application-simplified-child-route-helpers/loadPublicApplicationSimplifiedChildState');
  const { pathname } = requestUrl;
  const applicationState = getPublicApplicationState({ params, session });

  if (applicationState.inputModel !== 'simplified' || applicationState.typeOfApplication !== 'children') {
    throw redirect(getPathById('public/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('public/application/$id/simplified-children/confirmation', params);
  if (applicationState.submissionInfo && !pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has been submitted; sessionId: [%s], ', confirmationRouteUrl, applicationState.id);
    throw redirect(confirmationRouteUrl);
  }

  // Redirect to the first flow page if the application has not been submitted and
  // the current route is the confirmation page.
  const typeOfApplicationRouteUrl = getPathById('public/application/$id/type-application', params);
  if (!applicationState.submissionInfo && pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has not been submitted; sessionId: [%s], ', typeOfApplicationRouteUrl, applicationState.id);
    throw redirect(typeOfApplicationRouteUrl);
  }

  const { clientApplication, ...rest } = applicationState;
  invariant(clientApplication, 'clientApplication must be defined in the public simplified child application state');
  return { ...rest, clientApplication };
}

interface LoadPublicApplicationSimplifiedChildStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the application simplified child state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated child state.
 */
export function loadPublicApplicationSimplifiedChildStateForReview({ params, requestUrl, session }: LoadPublicApplicationSimplifiedChildStateForReviewArgs) {
  const state = loadPublicApplicationSimplifiedChildState({ params, requestUrl, session });
  return validatePublicApplicationSimplifiedChildStateForReview({ params, state });
}

interface ValidatePublicApplicationSimplifiedChildStateForReviewArgs {
  params: ApplicationStateParams;
  state: PublicApplicationRenewalChildState;
}

export function validatePublicApplicationSimplifiedChildStateForReview({ params, state }: ValidatePublicApplicationSimplifiedChildStateForReviewArgs) {
  const {
    applicantInformation,
    applicationYear,
    clientApplication,
    context,
    communicationPreferences,
    phoneNumber,
    email,
    emailVerified,
    hasFiledTaxes,
    homeAddress,
    id,
    isHomeAddressSameAsMailingAddress,
    lastUpdatedOn,
    livingIndependently,
    mailingAddress,
    maritalStatus,
    partnerInformation,
    submissionInfo,
    termsAndConditions,
    inputModel,
    typeOfApplication,
  } = state;

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = getEnv();

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  if (inputModel !== 'simplified') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'children') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (context === 'renewal' && getAllowedTypeOfApplication({ context, clientApplication }).includes(typeOfApplication) === false) {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (hasFiledTaxes === undefined) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  if (hasFiledTaxes === false) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  const children = validateChildrenStateForReview({ childrenState: state.children, state, params });

  if (applicantInformation === undefined) {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  const ageCategory = getContextualAgeCategoryFromDate(applicantInformation.dateOfBirth, applicationYear);

  if (ageCategory === 'children') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (ageCategory === 'youth' && livingIndependently !== true) {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (maritalStatusHasPartner(maritalStatus) && !partnerInformation) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  if (!maritalStatusHasPartner(maritalStatus) && partnerInformation) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  if (phoneNumber === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  if (homeAddress === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  const resolvedSunLifePreferredMethod = communicationPreferences.hasChanged ? communicationPreferences.value.preferredMethod : clientApplication.communicationPreferences.preferredMethodSunLife;
  if (resolvedSunLifePreferredMethod === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  const resolvedGovernmentOfCanadaPreferredMethod = communicationPreferences.hasChanged ? communicationPreferences.value.preferredNotificationMethod : clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada;
  if (resolvedGovernmentOfCanadaPreferredMethod === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  const isEmailRequired = resolvedSunLifePreferredMethod === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || resolvedGovernmentOfCanadaPreferredMethod === COMMUNICATION_METHOD_GC_DIGITAL_ID;
  const resolvedEmail = communicationPreferences.hasChanged ? email : clientApplication.contactInformation.email;
  const resolvedEmailVerified = communicationPreferences.hasChanged ? emailVerified : clientApplication.contactInformation.emailVerified;
  const hasValidVerifiedEmail = resolvedEmail !== undefined && validator.isEmail(resolvedEmail) && resolvedEmailVerified === true;

  if (isEmailRequired && !hasValidVerifiedEmail) {
    throw redirect(getPathById('public/application/$id/simplified-children/parent-or-guardian', params));
  }

  return {
    ageCategory,
    applicantInformation,
    applicationYear,
    children,
    clientApplication,
    context,
    communicationPreferences,
    phoneNumber,
    email,
    emailVerified,
    hasFiledTaxes,
    homeAddress,
    id,
    isHomeAddressSameAsMailingAddress,
    lastUpdatedOn,
    livingIndependently,
    mailingAddress,
    maritalStatus,
    partnerInformation,
    submissionInfo,
    termsAndConditions,
    inputModel,
    typeOfApplication,
  };
}

interface ValidateChildrenStateForReviewArgs {
  childrenState: PublicApplicationChildrenState;
  state: Pick<PublicApplicationState, 'context' | 'clientApplication' | 'applicationYear'>;
  params: ApplicationStateParams;
}

function validateChildrenStateForReview({ childrenState, state, params }: ValidateChildrenStateForReviewArgs) {
  const children = getChildrenState({ children: childrenState });

  if (children.length === 0) {
    throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
  }

  return children.map(({ id, dentalBenefits, dentalInsurance, information }) => {
    if (information === undefined) {
      throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
    }

    if (information.dateOfBirth === '') {
      throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
    }

    if (!information.isParent) {
      throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
    }

    if (!isChildClientNumberValid(state.context, state.clientApplication, information.memberId)) {
      throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
    }

    const ageCategory = getContextualAgeCategoryFromDate(information.dateOfBirth, state.applicationYear);

    if (ageCategory === 'adults' || ageCategory === 'seniors') {
      throw redirect(getPathById('public/application/$id/your-application', params));
    }

    if (dentalInsurance === undefined) {
      throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
    }

    if (dentalBenefits === undefined) {
      throw redirect(getPathById('public/application/$id/simplified-children/childrens-application', params));
    }

    return {
      ageCategory,
      dentalBenefits,
      dentalInsurance,
      id,
      information,
    };
  });
}
