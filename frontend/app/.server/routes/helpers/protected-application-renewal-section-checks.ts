import type { PickDeep } from 'type-fest';
import validator from 'validator';

import { isChildClientNumberValid, isChildOrYouth } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ProtectedApplicationChildState, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import { isValidDateString } from '~/utils/date-utils';

/**
 * Checks if the phone number section is completed for renewal application.
 */
export function isPhoneNumberSectionCompleted(state: Pick<ProtectedApplicationState, 'phoneNumber'>): boolean {
  return state.phoneNumber !== undefined;
}

/**
 * Checks if the address section is completed for a protected renewal application.
 *
 * Both address change statuses must be answered before completion can be evaluated.
 * The section is then considered complete in two scenarios:
 * - Both addresses have changed: the user has provided updated mailing and home addresses, and
 *   the user has answered whether their home address is the same as their mailing address, or
 * - Neither address has changed: the client application must already have both a mailing and
 *   home address on file so the existing addresses can be carried forward.
 *
 * A mismatch in change status (one changed, one did not) is always considered incomplete.
 */
export function isAddressSectionCompleted(
  state: PickDeep<
    ProtectedApplicationState,
    | 'mailingAddress' //
    | 'homeAddress'
    | 'isHomeAddressSameAsMailingAddress'
    | 'clientApplication.contactInformation.homeAddress'
    | 'clientApplication.contactInformation.mailingAddress'
  >,
): boolean {
  // Both address change statuses must be answered before evaluating completion
  if (!state.mailingAddress || !state.homeAddress) {
    return false;
  }

  // Both changed: user has provided updated mailing and home addresses, and the same-address question must be answered
  if (state.mailingAddress.hasChanged && state.homeAddress.hasChanged && state.isHomeAddressSameAsMailingAddress !== undefined) {
    return true;
  }

  // Neither changed: carry forward existing addresses only if both are on file.
  // mailingAddress is always required on the client application (eslint suppressed); homeAddress is optional.
  // A mismatch (one changed, one did not) also falls through here and evaluates to false.
  return (
    !state.mailingAddress.hasChanged && //
    !state.homeAddress.hasChanged &&
    state.clientApplication?.contactInformation.homeAddress !== undefined &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    state.clientApplication.contactInformation.mailingAddress !== undefined
  );
}

/**
 * Checks if the communication preferences section is completed for renewal application.
 */
export function isCommunicationPreferencesSectionCompleted(state: Pick<ProtectedApplicationState, 'communicationPreferences'>): boolean {
  return state.communicationPreferences !== undefined;
}

/**
 * Checks if the email section is completed for renewal application.
 */
export function isEmailSectionCompleted(state: Pick<ProtectedApplicationState, 'email' | 'emailVerified'>): boolean {
  return state.email !== undefined && validator.isEmail(state.email) && state.emailVerified === true;
}

/**
 * Checks if the dental insurance section is completed for renewal application.
 */
export function isDentalInsuranceSectionCompleted(state: Pick<ProtectedApplicationState, 'dentalInsurance'>): boolean {
  return state.dentalInsurance !== undefined;
}

/**
 * Checks if the dental benefits section is completed for renewal application.
 *
 * The dental benefits section is considered complete if the user has indicated whether their access to government
 * dental benefits has changed. If they have indicated that their access has changed, the section is complete regardless
 * of whether they have access or not. If they have indicated that their access has not changed, then they must indicate
 * their existing access to government dental benefits for the section to be considered complete.
 */
export function isDentalBenefitsSectionCompleted(state: PickDeep<ProtectedApplicationState, 'dentalBenefits' | 'clientApplication.dentalBenefits'>): boolean {
  if (!state.dentalBenefits) return false; // user must indicate if their access to government dental benefits has changed
  if (state.dentalBenefits.hasChanged) return true; // if access has changed, section is complete regardless of whether they have access or not
  return state.clientApplication?.dentalBenefits !== undefined; // if access has not changed, existing access must be indicated
}

/**
 * Checks if the marital status section is completed for renewal application.
 */
export function isMaritalStatusSectionCompleted(state: Pick<ProtectedApplicationState, 'maritalStatus' | 'partnerInformation'>): boolean {
  if (state.maritalStatus === undefined) return false; // marital status not selected

  const { MARITAL_STATUS_CODE_COMMON_LAW, MARITAL_STATUS_CODE_MARRIED } = getEnv();
  const partnerMaritalStatuses = [MARITAL_STATUS_CODE_COMMON_LAW, MARITAL_STATUS_CODE_MARRIED]; // statuses that require partner information

  if (partnerMaritalStatuses.includes(state.maritalStatus)) {
    return state.partnerInformation?.consentToSharePersonalInformation === true; // partner information required and consent given
  }

  return true; // no partner information required
}

/**
 * Checks if the child information section is completed for renewal application.
 */
export function isChildInformationSectionCompleted(state: Pick<ProtectedApplicationState, 'applicationYear' | 'clientApplication'>, child: Pick<ProtectedApplicationChildState, 'information'>): boolean {
  // TODO: Check with age category and live independently status
  return (
    child.information !== undefined && //
    child.information.isParent &&
    isValidDateString(child.information.dateOfBirth) &&
    isChildOrYouth(child.information.dateOfBirth, state.applicationYear) &&
    isChildClientNumberValid('renewal', state.clientApplication, child.information.memberId)
  );
}

/**
 * Checks if the child parent or legal guardian section is completed for renewal application.
 */
export function isChildParentGuardianSectionCompleted(child: Pick<ProtectedApplicationChildState, 'information'>): boolean {
  return child.information?.isParent !== undefined;
}

/**
 * Checks if the child Social Insurance Number section is completed for renewal application.
 */
export function isChildSinSectionCompleted(child: Pick<ProtectedApplicationChildState, 'information'>): boolean {
  return child.information?.socialInsuranceNumber !== undefined;
}

/**
 * Checks if the child dental insurance section is completed for renewal application.
 */
export function isChildDentalInsuranceSectionCompleted(child: Pick<ProtectedApplicationChildState, 'dentalInsurance'>): boolean {
  return child.dentalInsurance !== undefined;
}

/**
 * Checks if the child dental benefits section is completed for renewal application.
 */
export function isChildDentalBenefitsSectionCompleted(child: Pick<ProtectedApplicationChildState, 'dentalBenefits'>): boolean {
  return child.dentalBenefits !== undefined;
}
