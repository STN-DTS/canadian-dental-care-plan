import { redirect } from 'react-router';

import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationStateParams, ProtectedApplicationChildrenState, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getChildrenState, getContextualAgeCategoryFromDate, getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

interface LoadProtectedApplicationIntakeChildStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads protected application intake child state.
 * @param args - The arguments.
 * @returns The loaded child state.
 */
export function loadProtectedApplicationIntakeChildState({ params, requestUrl, session }: LoadProtectedApplicationIntakeChildStateArgs) {
  const log = createLogger('protected-application-intake-child-route-helpers/loadProtectedApplicationIntakeChildState');
  const { pathname } = requestUrl;
  const applicationState = getProtectedApplicationState({ params, session });

  if (applicationState.context !== 'intake' || applicationState.typeOfApplication !== 'children') {
    throw redirect(getPathById('protected/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('protected/application/$id/intake-children/confirmation', params);
  if (applicationState.submissionInfo && !pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has been submitted; sessionId: [%s], ', confirmationRouteUrl, applicationState.id);
    throw redirect(confirmationRouteUrl);
  }

  // Redirect to the first flow page if the application has not been submitted and
  // the current route is the confirmation page.
  const typeOfApplicationRouteUrl = getPathById('protected/application/$id/type-application', params);
  if (!applicationState.submissionInfo && pathname.endsWith(confirmationRouteUrl)) {
    log.warn('Redirecting user to "%s" since the application has not been submitted; sessionId: [%s], ', typeOfApplicationRouteUrl, applicationState.id);
    throw redirect(typeOfApplicationRouteUrl);
  }

  return applicationState;
}

interface LoadProtectedApplicationIntakeChildStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the intake child state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated child state.
 */
export function loadProtectedApplicationIntakeChildStateForReview({ params, requestUrl, session }: LoadProtectedApplicationIntakeChildStateForReviewArgs) {
  const state = loadProtectedApplicationIntakeChildState({ params, requestUrl, session });
  return validateProtectedApplicationIntakeChildStateForReview({ params, state });
}

interface ValidateProtectedApplicationIntakeChildStateForReviewArgs {
  params: ApplicationStateParams;
  state: ProtectedApplicationState;
}

export function validateProtectedApplicationIntakeChildStateForReview({ params, state }: ValidateProtectedApplicationIntakeChildStateForReviewArgs) {
  const {
    applicantInformation,
    applicationYear,
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
    typeOfApplication,
    newOrReturningMember,
  } = state;

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('protected/application/$id/eligibility-requirements', params));
  }

  if (context !== 'intake') {
    throw redirect(getPathById('protected/application/$id/your-application', params));
  }

  if (typeOfApplication !== 'children') {
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

  const children = validateChildrenStateForReview({ applicationYear, childrenState: state.children, params });

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
    throw redirect(getPathById('protected/application/$id/intake-children/parent-or-guardian', params));
  }

  if (!maritalStatusHasPartner(maritalStatus) && partnerInformation) {
    throw redirect(getPathById('protected/application/$id/intake-children/parent-or-guardian', params));
  }

  if (phoneNumber === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-children/parent-or-guardian', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-children/parent-or-guardian', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('protected/application/$id/intake-children/parent-or-guardian', params));
  }

  if (!email || !validator.isEmail(email) || !emailVerified) {
    throw redirect(getPathById('protected/application/$id/intake-children/parent-or-guardian', params));
  }

  return {
    ageCategory,
    applicantInformation,
    applicationYear,
    children,
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
    typeOfApplication,
    newOrReturningMember,
  };
}

interface ValidateChildrenStateForReviewArgs {
  applicationYear: ProtectedApplicationState['applicationYear'];
  childrenState: ProtectedApplicationChildrenState;
  params: ApplicationStateParams;
}

function validateChildrenStateForReview({ applicationYear, childrenState, params }: ValidateChildrenStateForReviewArgs) {
  const children = getChildrenState({ children: childrenState });

  if (children.length === 0) {
    throw redirect(getPathById('protected/application/$id/intake-children/childrens-application', params));
  }

  return children.map(({ id, dentalBenefits, dentalInsurance, information }) => {
    if (information === undefined) {
      throw redirect(getPathById('protected/application/$id/intake-children/childrens-application', params));
    }

    if (information.dateOfBirth === '') {
      throw redirect(getPathById('protected/application/$id/intake-children/childrens-application', params));
    }

    if (!information.isParent) {
      throw redirect(getPathById('protected/application/$id/intake-children/childrens-application', params));
    }

    const ageCategory = getContextualAgeCategoryFromDate(information.dateOfBirth, applicationYear);

    if (ageCategory === 'adults' || ageCategory === 'seniors') {
      throw redirect(getPathById('protected/application/$id/your-application', params));
    }

    if (dentalInsurance === undefined) {
      throw redirect(getPathById('protected/application/$id/intake-children/childrens-application', params));
    }

    if (dentalBenefits?.hasChanged !== true) {
      throw redirect(getPathById('protected/application/$id/intake-children/childrens-application', params));
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
