import { redirect } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationStateParams, PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getContextualAgeCategoryFromDate, getPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

type PublicApplicationRenewalAdultState = OmitStrict<PublicApplicationState, 'clientApplication'> & {
  clientApplication: NonNullable<PublicApplicationState['clientApplication']>;
};

interface LoadPublicApplicationSimplifiedAdultStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads public application simplified adult state.
 * @param args - The arguments.
 * @returns The loaded adult state.
 */
export function loadPublicApplicationSimplifiedAdultState({ params, requestUrl, session }: LoadPublicApplicationSimplifiedAdultStateArgs): PublicApplicationRenewalAdultState {
  const log = createLogger('public-application-simplified-adult-route-helpers/loadPublicApplicationSimplifiedAdultState');
  const { pathname } = requestUrl;
  const applicationState = getPublicApplicationState({ params, session });

  if (applicationState.inputModel !== 'simplified' || applicationState.typeOfApplication !== 'adult') {
    throw redirect(getPathById('public/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('public/application/$id/simplified-adult/confirmation', params);
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

  const { clientApplication, ...rest } = applicationState;
  invariant(clientApplication, 'clientApplication must be defined in the public simplified adult application state');
  return { ...rest, clientApplication };
}

interface LoadPublicApplicationSimplifiedAdultStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the application simplified adult state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated adult state.
 */
export function loadPublicApplicationSimplifiedAdultStateForReview({ params, requestUrl, session }: LoadPublicApplicationSimplifiedAdultStateForReviewArgs) {
  const state = loadPublicApplicationSimplifiedAdultState({ params, requestUrl, session });
  return validatePublicRenewAdultStateForReview({ params, state });
}

interface ValidatePublicRenewAdultStateForReviewArgs {
  params: ApplicationStateParams;
  state: PublicApplicationRenewalAdultState;
}

export function validatePublicRenewAdultStateForReview({ params, state }: ValidatePublicRenewAdultStateForReviewArgs) {
  const {
    applicantInformation,
    applicationYear,
    clientApplication,
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
    children,
  } = state;

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = getEnv();

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  if (inputModel !== 'simplified') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'adult') {
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

  if (phoneNumber === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  if (homeAddress === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  const resolvedSunLifePreferredMethod = communicationPreferences.hasChanged ? communicationPreferences.value.preferredMethod : clientApplication.communicationPreferences.preferredMethodSunLife;
  if (resolvedSunLifePreferredMethod === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  const resolvedGovernmentOfCanadaPreferredMethod = communicationPreferences.hasChanged ? communicationPreferences.value.preferredNotificationMethod : clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada;
  if (resolvedGovernmentOfCanadaPreferredMethod === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  const isEmailRequired = resolvedSunLifePreferredMethod === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || resolvedGovernmentOfCanadaPreferredMethod === COMMUNICATION_METHOD_GC_DIGITAL_ID;
  const resolvedEmail = communicationPreferences.hasChanged ? email : clientApplication.contactInformation.email;
  const resolvedEmailVerified = communicationPreferences.hasChanged ? emailVerified : clientApplication.contactInformation.emailVerified;
  const hasValidVerifiedEmail = resolvedEmail !== undefined && validator.isEmail(resolvedEmail) && resolvedEmailVerified === true;

  if (isEmailRequired && !hasValidVerifiedEmail) {
    throw redirect(getPathById('public/application/$id/simplified-adult/contact-information', params));
  }

  if (dentalInsurance === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-adult/dental-insurance', params));
  }

  if (
    dentalBenefits === undefined ||
    // if dental benefits has not changed and there is no existing value for dental benefits in the application,
    // redirect to dental benefits page
    (!dentalBenefits.hasChanged && clientApplication.dentalBenefits === undefined)
  ) {
    throw redirect(getPathById('public/application/$id/simplified-adult/dental-insurance', params));
  }

  return {
    ageCategory,
    applicantInformation,
    applicationYear,
    clientApplication,
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
    children,
  };
}
