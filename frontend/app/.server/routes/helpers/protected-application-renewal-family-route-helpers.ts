import { redirect } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, isChildClientNumberValid, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import { getChildrenState, getContextualAgeCategoryFromDate, getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { ApplicationStateParams, ProtectedApplicationChildrenState, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

type ProtectedApplicationRenewalFamilyState = OmitStrict<ProtectedApplicationState, 'clientApplication'> & {
  clientApplication: NonNullable<ProtectedApplicationState['clientApplication']>;
};

interface LoadProtectedApplicationRenewalFamilyStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads protected application renewal family state.
 * @param args - The arguments.
 * @returns The loaded protected renewal family state.
 */
export function loadProtectedApplicationRenewalFamilyState({ params, requestUrl, session }: LoadProtectedApplicationRenewalFamilyStateArgs): ProtectedApplicationRenewalFamilyState {
  const log = createLogger('protected-application-renewal-family-route-helpers/loadProtectedApplicationRenewalFamilyState');
  const { pathname } = requestUrl;
  const applicationState = getProtectedApplicationState({ params, session });

  if (applicationState.context !== 'renewal' || applicationState.typeOfApplication !== 'family') {
    throw redirect(getPathById('protected/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('protected/application/$id/renewal-family/confirmation', params);
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

  const { clientApplication, ...rest } = applicationState;
  invariant(clientApplication, 'clientApplication must be defined in the protected renewal family application state');
  return { ...rest, clientApplication };
}

interface LoadProtectedApplicationRenewalFamilyStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the renewal family state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated family state.
 */
export function loadProtectedApplicationRenewalFamilyStateForReview({ params, requestUrl, session }: LoadProtectedApplicationRenewalFamilyStateForReviewArgs) {
  const state = loadProtectedApplicationRenewalFamilyState({ params, requestUrl, session });
  return validateProtectedApplicationFamilyStateForReview({ params, state });
}

interface ValidateProtectedApplicationFamilyStateForReviewArgs {
  params: ApplicationStateParams;
  state: ProtectedApplicationRenewalFamilyState;
}

export function validateProtectedApplicationFamilyStateForReview({ params, state }: ValidateProtectedApplicationFamilyStateForReviewArgs) {
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
    typeOfApplication,
  } = state;

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('protected/application/$id/eligibility-requirements', params));
  }

  if (context !== 'renewal') {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'family') {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (getAllowedTypeOfApplication({ context, clientApplication }).includes(typeOfApplication) === false) {
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
    throw redirect(getPathById('protected/application/$id/renew', params));
  }

  if (ageCategory === 'youth' && livingIndependently !== true) {
    throw redirect(getPathById('protected/application/$id/renew', params));
  }

  if (maritalStatusHasPartner(maritalStatus) && !partnerInformation) {
    throw redirect(getPathById('protected/application/$id/renewal-family/marital-status', params));
  }

  if (!maritalStatusHasPartner(maritalStatus) && partnerInformation) {
    throw redirect(getPathById('protected/application/$id/renewal-family/marital-status', params));
  }

  if (phoneNumber === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-family/contact-information', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-family/contact-information', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-family/contact-information', params));
  }

  if (!email || !validator.isEmail(email) || !emailVerified) {
    throw redirect(getPathById('protected/application/$id/renewal-family/contact-information', params));
  }

  if (dentalInsurance === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-family/dental-insurance', params));
  }

  if (
    dentalBenefits === undefined ||
    // if dental benefits has not changed and there is no existing value for dental benefits in the application,
    // redirect to dental benefits page
    (!dentalBenefits.hasChanged && clientApplication.dentalBenefits === undefined)
  ) {
    throw redirect(getPathById('protected/application/$id/renewal-family/dental-insurance', params));
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
    typeOfApplication,
  };
}

interface ValidateChildrenStateForReviewArgs {
  childrenState: ProtectedApplicationChildrenState;
  state: Pick<ProtectedApplicationState, 'context' | 'clientApplication' | 'applicationYear'>;
  params: ApplicationStateParams;
}

function validateChildrenStateForReview({ childrenState, state, params }: ValidateChildrenStateForReviewArgs) {
  const children = getChildrenState({ children: childrenState });

  if (children.length === 0) {
    throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
  }

  return children.map(({ id, dentalBenefits, dentalInsurance, information }) => {
    if (information === undefined) {
      throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
    }

    if (information.dateOfBirth === '') {
      throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
    }

    if (!information.isParent) {
      throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
    }

    if (!isChildClientNumberValid(state.context, state.clientApplication, information.memberId)) {
      throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
    }

    const ageCategory = getContextualAgeCategoryFromDate(information.dateOfBirth, state.applicationYear);

    if (ageCategory === 'adults' || ageCategory === 'seniors') {
      throw redirect(getPathById('protected/application/$id/your-application', params));
    }

    if (dentalInsurance === undefined) {
      throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
    }

    if (dentalBenefits === undefined) {
      throw redirect(getPathById('protected/application/$id/renewal-family/childrens-application', params));
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
