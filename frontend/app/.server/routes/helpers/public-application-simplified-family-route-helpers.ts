import { redirect } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, isChildClientNumberValid } from '~/.server/routes/helpers/base-application-route-helpers';
import { getChildrenState, getContextualAgeCategoryFromDate, getPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import type { ApplicationStateParams, PublicApplicationChildrenState, PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

type PublicApplicationRenewalFamilyState = OmitStrict<PublicApplicationState, 'clientApplication'> & {
  clientApplication: NonNullable<PublicApplicationState['clientApplication']>;
};

interface LoadPublicApplicationSimplifiedFamilyStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads public application simplified family state.
 * @param args - The arguments.
 * @returns The loaded public simplified family state.
 */
export function loadPublicApplicationSimplifiedFamilyState({ params, requestUrl, session }: LoadPublicApplicationSimplifiedFamilyStateArgs) {
  const log = createLogger('public-application-simplified-family-route-helpers/loadPublicApplicationSimplifiedFamilyState');
  const { pathname } = requestUrl;
  const applicationState = getPublicApplicationState({ params, session });

  if (applicationState.inputModel !== 'simplified' || applicationState.typeOfApplication !== 'family') {
    throw redirect(getPathById('public/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('public/application/$id/simplified-family/confirmation', params);
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
  invariant(clientApplication, 'clientApplication must be defined in the public simplified family application state');
  return { ...rest, clientApplication };
}

interface LoadPublicApplicationSimplifiedFamilyStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the simplified family state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated family state.
 */
export function loadPublicApplicationSimplifiedFamilyStateForReview({ params, requestUrl, session }: LoadPublicApplicationSimplifiedFamilyStateForReviewArgs) {
  const state = loadPublicApplicationSimplifiedFamilyState({ params, requestUrl, session });
  return validatePublicApplicationFamilyStateForReview({ params, state });
}

interface ValidatePublicApplicationFamilyStateForReviewArgs {
  params: ApplicationStateParams;
  state: PublicApplicationRenewalFamilyState;
}

export function validatePublicApplicationFamilyStateForReview({ params, state }: ValidatePublicApplicationFamilyStateForReviewArgs) {
  const {
    applicantInformation,
    applicationYear,
    context,
    clientApplication,
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
  } = state;

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = getEnv();

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('public/application/$id/eligibility-requirements', params));
  }

  if (inputModel !== 'simplified') {
    throw redirect(getPathById('public/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'family') {
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
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  if (homeAddress === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  const resolvedSunLifePreferredMethod = communicationPreferences.hasChanged ? communicationPreferences.value.preferredMethod : clientApplication.communicationPreferences.preferredMethodSunLife;
  if (resolvedSunLifePreferredMethod === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  const resolvedGovernmentOfCanadaPreferredMethod = communicationPreferences.hasChanged ? communicationPreferences.value.preferredNotificationMethod : clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada;
  if (resolvedGovernmentOfCanadaPreferredMethod === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  const isEmailRequired = resolvedSunLifePreferredMethod === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID || resolvedGovernmentOfCanadaPreferredMethod === COMMUNICATION_METHOD_GC_DIGITAL_ID;
  const resolvedEmail = communicationPreferences.hasChanged ? email : clientApplication.contactInformation.email;
  const resolvedEmailVerified = communicationPreferences.hasChanged ? emailVerified : clientApplication.contactInformation.emailVerified;
  const hasValidVerifiedEmail = resolvedEmail !== undefined && validator.isEmail(resolvedEmail) && resolvedEmailVerified === true;

  if (isEmailRequired && !hasValidVerifiedEmail) {
    throw redirect(getPathById('public/application/$id/simplified-family/contact-information', params));
  }

  if (dentalInsurance === undefined) {
    throw redirect(getPathById('public/application/$id/simplified-family/dental-insurance', params));
  }

  if (
    dentalBenefits === undefined ||
    // if dental benefits has not changed and there is no existing value for dental benefits in the application,
    // redirect to dental benefits page
    (!dentalBenefits.hasChanged && clientApplication.dentalBenefits === undefined)
  ) {
    throw redirect(getPathById('public/application/$id/simplified-family/dental-insurance', params));
  }

  const children = validateChildrenStateForReview({ childrenState: state.children, state, params });

  return {
    ageCategory,
    applicantInformation,
    applicationYear,
    clientApplication,
    children,
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
    throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
  }

  return children.map(({ id, dentalBenefits, dentalInsurance, information }) => {
    if (information === undefined) {
      throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
    }

    if (information.dateOfBirth === '') {
      throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
    }

    if (!information.isParent) {
      throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
    }

    if (!isChildClientNumberValid(state.context, state.clientApplication, information.memberId)) {
      throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
    }

    const ageCategory = getContextualAgeCategoryFromDate(information.dateOfBirth, state.applicationYear);

    if (ageCategory === 'adults' || ageCategory === 'seniors') {
      throw redirect(getPathById('public/application/$id/your-application', params));
    }

    if (dentalInsurance === undefined) {
      throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
    }

    if (dentalBenefits === undefined) {
      throw redirect(getPathById('public/application/$id/simplified-family/childrens-application', params));
    }

    return {
      ageCategory,
      id,
      dentalBenefits,
      dentalInsurance,
      information,
    };
  });
}
