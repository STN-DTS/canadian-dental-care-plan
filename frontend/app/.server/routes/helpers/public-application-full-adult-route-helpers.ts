import { redirect } from 'react-router';

import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationStateParams, PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getContextualAgeCategoryFromDate, getPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env.utils';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

interface LoadPublicApplicationFullAdultStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads public application full adult state.
 * @param args - The arguments.
 * @returns The loaded adult state.
 */
export function loadPublicApplicationFullAdultState({ params, requestUrl, session }: LoadPublicApplicationFullAdultStateArgs) {
  const log = createLogger('public-application-full-adult-route-helpers/loadPublicApplicationFullAdultState');
  const { pathname } = requestUrl;
  const applicationState = getPublicApplicationState({ params, session });

  if (applicationState.inputModel !== 'full' || applicationState.typeOfApplication !== 'adult') {
    throw redirect(getPathById('public/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('public/application/$id/full-adult/confirmation', params);
  if (applicationState.submissionInfo && !pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has been submitted; sessionId: [%s], ', confirmationRouteUrl, applicationState.id);
    throw redirect(confirmationRouteUrl);
  }

  // Redirect to the first flow page if the application has not been submitted and
  // the current route is the confirmation page.
  const typeOfApplicationRouteUrl = getPathById('public/application/$id/your-application', params);
  if (!applicationState.submissionInfo && pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has not been submitted; sessionId: [%s], ', typeOfApplicationRouteUrl, applicationState.id);
    throw redirect(typeOfApplicationRouteUrl);
  }

  return applicationState;
}

interface LoadPublicApplicationFullAdultStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the full adult state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated adult state.
 */
export function loadPublicApplicationFullAdultStateForReview({ params, requestUrl, session }: LoadPublicApplicationFullAdultStateForReviewArgs) {
  const state = loadPublicApplicationFullAdultState({ params, requestUrl, session });
  return validatePublicApplicationFullAdultStateForReview({ params, state });
}

interface ValidatePublicApplicationFullAdultStateForReviewArgs {
  params: ApplicationStateParams;
  state: PublicApplicationState;
}

export function validatePublicApplicationFullAdultStateForReview({ params, state }: ValidatePublicApplicationFullAdultStateForReviewArgs) {
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
    inputModel,
    typeOfApplication,
    clientApplication,
    newOrReturningMember,
  } = state;

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = getEnv();

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  if (inputModel !== 'full') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'adult') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (context === 'intake' && getAllowedTypeOfApplication({ context }).includes(typeOfApplication) === false) {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (context === 'renewal' && (!clientApplication || getAllowedTypeOfApplication({ context, clientApplication }).includes(typeOfApplication) === false)) {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (hasFiledTaxes === undefined) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  if (hasFiledTaxes === false) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

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
    throw redirect(getPathById('public/application/$id/full-adult/marital-status', params));
  }

  if (!maritalStatusHasPartner(maritalStatus) && partnerInformation) {
    throw redirect(getPathById('public/application/$id/full-adult/marital-status', params));
  }

  if (phoneNumber?.hasChanged !== true) {
    throw redirect(getPathById('public/application/$id/full-adult/contact-information', params));
  }

  if (homeAddress?.hasChanged !== true) {
    throw redirect(getPathById('public/application/$id/full-adult/contact-information', params));
  }

  if (mailingAddress?.hasChanged !== true) {
    throw redirect(getPathById('public/application/$id/full-adult/contact-information', params));
  }

  if (communicationPreferences?.hasChanged !== true) {
    throw redirect(getPathById('public/application/$id/full-adult/contact-information', params));
  }

  const isEmailRequired = communicationPreferences.value.preferredMethod === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || communicationPreferences.value.preferredNotificationMethod === COMMUNICATION_METHOD_GC_DIGITAL_ID;
  const hasValidVerifiedEmail = email !== undefined && validator.isEmail(email) && emailVerified === true;

  if (isEmailRequired && !hasValidVerifiedEmail) {
    throw redirect(getPathById('public/application/$id/full-adult/contact-information', params));
  }

  if (dentalInsurance === undefined) {
    throw redirect(getPathById('public/application/$id/full-adult/dental-insurance', params));
  }

  if (dentalBenefits?.hasChanged !== true) {
    throw redirect(getPathById('public/application/$id/full-adult/dental-insurance', params));
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
    inputModel,
    typeOfApplication,
    clientApplication,
    newOrReturningMember,
  };
}
