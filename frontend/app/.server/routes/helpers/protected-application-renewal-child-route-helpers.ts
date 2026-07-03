import { redirect } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import validator from 'validator';

import { createLogger } from '~/.server/logging';
import { getAllowedTypeOfApplication, isChildClientNumberValid, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ApplicationStateParams, ProtectedApplicationChildrenState, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getChildrenState, getContextualAgeCategoryFromDate, getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import type { Session } from '~/.server/web/session';
import { getPathById } from '~/utils/route-utils';

type ProtectedApplicationRenewalChildState = OmitStrict<ProtectedApplicationState, 'clientApplication'> & {
  clientApplication: NonNullable<ProtectedApplicationState['clientApplication']>;
};

interface LoadProtectedApplicationRenewalChildStateArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads protected application renewal renew child state.
 * @param args - The arguments.
 * @returns The loaded child state.
 */
export function loadProtectedApplicationRenewalChildState({ params, requestUrl, session }: LoadProtectedApplicationRenewalChildStateArgs): ProtectedApplicationRenewalChildState {
  const log = createLogger('protected-application-renewal-child-route-helpers/loadProtectedApplicationRenewalChildState');
  const { pathname } = requestUrl;
  const applicationState = getProtectedApplicationState({ params, session });

  if (applicationState.context !== 'renewal' || applicationState.typeOfApplication !== 'children') {
    throw redirect(getPathById('protected/application/$id/type-application', params));
  }

  // Redirect to the confirmation page if the application has been submitted and
  // the current route is not the confirmation page.
  const confirmationRouteUrl = getPathById('protected/application/$id/renewal-children/confirmation', params);
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

  const { clientApplication, ...rest } = applicationState;
  invariant(clientApplication, 'clientApplication must be defined in the protected renewal child application state');
  return { ...rest, clientApplication };
}

interface LoadProtectedApplicationRenewalChildStateForReviewArgs {
  params: ApplicationStateParams;
  requestUrl: URL;
  session: Session;
}

/**
 * Loads the application renewal child state for the review page. It validates the state and throws a redirect if invalid.
 * @param args - The arguments.
 * @returns The validated child state.
 */
export function loadProtectedApplicationRenewalChildStateForReview({ params, requestUrl, session }: LoadProtectedApplicationRenewalChildStateForReviewArgs) {
  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl, session });
  return validateProtectedApplicationRenewalChildStateForReview({ params, state });
}

interface ValidateProtectedApplicationRenewalChildStateForReviewArgs {
  params: ApplicationStateParams;
  state: ProtectedApplicationRenewalChildState;
}

export function validateProtectedApplicationRenewalChildStateForReview({ params, state }: ValidateProtectedApplicationRenewalChildStateForReviewArgs) {
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
    typeOfApplication,
  } = state;

  if (termsAndConditions === undefined) {
    throw redirect(getPathById('protected/application/$id/eligibility-requirements', params));
  }

  if (context !== 'renewal') {
    throw redirect(getPathById('protected/application/$id/renew', params));
  }

  if (typeOfApplication !== 'children') {
    throw redirect(getPathById('protected/application/$id/renew', params));
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

  const children = validateChildrenStateForReview({ childrenState: state.children, state, params });

  if (applicantInformation === undefined) {
    throw redirect(getPathById('protected/application/$id/renew', params));
  }

  const ageCategory = getContextualAgeCategoryFromDate(applicantInformation.dateOfBirth, applicationYear);

  if (ageCategory === 'children') {
    throw redirect(getPathById('protected/application/$id/renew', params));
  }

  if (ageCategory === 'youth' && livingIndependently !== true) {
    throw redirect(getPathById('protected/application/$id/renew', params));
  }

  if (maritalStatusHasPartner(maritalStatus) && !partnerInformation) {
    throw redirect(getPathById('protected/application/$id/renewal-children/parent-or-guardian', params));
  }

  if (!maritalStatusHasPartner(maritalStatus) && partnerInformation) {
    throw redirect(getPathById('protected/application/$id/renewal-children/parent-or-guardian', params));
  }

  if (phoneNumber === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-children/parent-or-guardian', params));
  }

  if (mailingAddress === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-children/parent-or-guardian', params));
  }

  if (communicationPreferences === undefined) {
    throw redirect(getPathById('protected/application/$id/renewal-children/parent-or-guardian', params));
  }

  if (!email || !validator.isEmail(email) || !emailVerified) {
    throw redirect(getPathById('protected/application/$id/renewal-children/parent-or-guardian', params));
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
    throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
  }

  return children.map(({ id, dentalBenefits, dentalInsurance, information }) => {
    if (information === undefined) {
      throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
    }

    if (information.dateOfBirth === '') {
      throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
    }

    if (!information.isParent) {
      throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
    }

    if (!isChildClientNumberValid(state.context, state.clientApplication, information.memberId)) {
      throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
    }

    const ageCategory = getContextualAgeCategoryFromDate(information.dateOfBirth, state.applicationYear);

    if (ageCategory === 'adults' || ageCategory === 'seniors') {
      throw redirect(getPathById('protected/application/$id/renew', params));
    }

    if (dentalInsurance === undefined) {
      throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
    }

    if (dentalBenefits === undefined) {
      throw redirect(getPathById('protected/application/$id/renewal-children/childrens-application', params));
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
