import { redirect } from 'react-router';

import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationStateParams, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getContextualAgeCategoryFromDate, getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

interface LoadProtectedApplicationIntakeAdultStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads protected application intake adult state.
 * @param args - The arguments.
 * @returns The loaded adult state.
 */
export function loadProtectedApplicationIntakeAdultState({ params, requestUrl, session }: LoadProtectedApplicationIntakeAdultStateArgs) {
  const log = createLogger('protected-application-intake-adult-route-helpers/loadProtectedApplicationIntakeAdultState');
  const { pathname } = requestUrl;
  const applicationState = getProtectedApplicationState({ params, session });

  if (applicationState.context !== 'intake' || applicationState.typeOfApplication !== 'adult') {
    throw redirect(getPathById('protected/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('protected/application/$id/intake-adult/confirmation', params);
  if (applicationState.submissionInfo && !pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has been submitted; sessionId: [%s], ', confirmationRouteUrl, applicationState.id);
    throw redirect(confirmationRouteUrl);
  }

  // Redirect to the first flow page if the application has not been submitted and
  // the current route is the confirmation page.
  const typeOfApplicationRouteUrl = getPathById('protected/application/$id/your-application', params);
  if (!applicationState.submissionInfo && pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has not been submitted; sessionId: [%s], ', typeOfApplicationRouteUrl, applicationState.id);
    throw redirect(typeOfApplicationRouteUrl);
  }

  return applicationState;
}

interface LoadProtectedApplicationIntakeAdultStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the intake adult state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated adult state.
 */
export function loadProtectedApplicationIntakeAdultStateForReview({ params, requestUrl, session }: LoadProtectedApplicationIntakeAdultStateForReviewArgs) {
  const state = loadProtectedApplicationIntakeAdultState({ params, requestUrl, session });
  return validateProtectedApplicationIntakeAdultStateForReview({ params, state });
}

interface ValidateProtectedApplicationIntakeAdultStateForReviewArgs {
  params: ApplicationStateParams;
  state: ProtectedApplicationState;
}

export function validateProtectedApplicationIntakeAdultStateForReview({ params, state }: ValidateProtectedApplicationIntakeAdultStateForReviewArgs) {
  const {
    context,
    applicantInformation,
    applicationYear,
    communicationPreferences,
    phoneNumber,
    dentalBenefits,
    dentalInsurance,
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
    typeOfApplication,
    clientApplication,
    newOrReturningMember,
  } = state;

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('protected/application/$id/eligibility-requirements', params));
  }

  if (context !== 'intake') {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'adult') {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (getAllowedTypeOfApplication({ context }).includes(typeOfApplication) === false) {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (hasFiledTaxes === undefined) {
    throw redirect(getPathById('protected/application/$id/eligibility-requirements', params));
  }

  if (hasFiledTaxes === false) {
    throw redirect(getPathById('protected/application/$id/eligibility-requirements', params));
  }

  if (applicantInformation === undefined) {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  const ageCategory = getContextualAgeCategoryFromDate(applicantInformation.dateOfBirth, applicationYear);

  if (ageCategory === 'children') {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (ageCategory === 'youth' && livingIndependently !== true) {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (maritalStatusHasPartner(maritalStatus) && !partnerInformation) {
    throw redirect(getPathById('protected/application/$id/intake-adult/marital-status', params));
  }

  if (!maritalStatusHasPartner(maritalStatus) && partnerInformation) {
    throw redirect(getPathById('protected/application/$id/intake-adult/marital-status', params));
  }

  if (phoneNumber === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-adult/contact-information', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-adult/contact-information', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-adult/contact-information', params));
  }

  if (!email || !validator.isEmail(email) || !emailVerified) {
    throw redirect(getPathById('protected/application/$id/intake-adult/contact-information', params));
  }

  if (dentalInsurance === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-adult/dental-insurance', params));
  }

  if (dentalBenefits?.hasChanged !== true) {
    throw redirect(getPathById('protected/application/$id/intake-adult/dental-insurance', params));
  }

  return {
    ageCategory,
    applicantInformation,
    applicationYear,
    context,
    communicationPreferences,
    phoneNumber,
    dentalBenefits,
    dentalInsurance,
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
    typeOfApplication,
    clientApplication,
    newOrReturningMember,
  };
}
