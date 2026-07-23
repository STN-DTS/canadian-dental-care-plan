import validator from 'validator';

import { isChildOrYouth } from '~/.server/routes/helpers/base-application-route-helpers';
import type { ProtectedApplicationChildState, ProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import { isValidDateString } from '~/utils/date-utils';

/**
 * Checks if the phone number section is completed for intake application.
 */
export function isPhoneNumberSectionCompleted(state: Pick<ProtectedApplicationState, 'phoneNumber'>): boolean {
  return state.phoneNumber !== undefined;
}

/**
 * Checks if the address section is completed for a protected intake application.
 *
 * The section is considered complete when all three conditions are met:
 * - Both the mailing and home address responses are present,
 * - Both addresses are marked as changed (the user has provided new addresses), and
 * - The user has answered whether their home address is the same as their mailing address.
 */
export function isAddressSectionCompleted(state: Pick<ProtectedApplicationState, 'mailingAddress' | 'homeAddress' | 'isHomeAddressSameAsMailingAddress'>): boolean {
  // Both address responses must be present before evaluating completion
  if (!state.mailingAddress || !state.homeAddress) {
    return false;
  }

  // Both addresses must be marked as changed and the same-address question must have been answered
  return state.mailingAddress.hasChanged && state.homeAddress.hasChanged && state.isHomeAddressSameAsMailingAddress !== undefined;
}

/**
 * Checks if the communication preferences section is completed for intake application.
 */
export function isCommunicationPreferencesSectionCompleted(state: Pick<ProtectedApplicationState, 'communicationPreferences'>): boolean {
  return state.communicationPreferences !== undefined;
}

/**
 * Checks if the email section is completed for intake application.
 */
export function isEmailSectionCompleted(state: Pick<ProtectedApplicationState, 'email' | 'emailVerified'>): boolean {
  return state.email !== undefined && validator.isEmail(state.email) && state.emailVerified === true;
}

/**
 * Checks if the dental insurance section is completed for intake application.
 */
export function isDentalInsuranceSectionCompleted(state: Pick<ProtectedApplicationState, 'dentalInsurance'>): boolean {
  return state.dentalInsurance?.dentalInsuranceEligibilityConfirmation === true;
}

/**
 * Checks if the dental benefits section is completed for intake application.
 */
export function isDentalBenefitsSectionCompleted(state: Pick<ProtectedApplicationState, 'dentalBenefits'>): boolean {
  return state.dentalBenefits !== undefined;
}

/**
 * Checks if the marital status section is completed for intake application.
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
 * Checks if the child information section is completed for intake application.
 */
export function isChildInformationSectionCompleted(state: Pick<ProtectedApplicationState, 'applicationYear'>, child: Pick<ProtectedApplicationChildState, 'information'>): boolean {
  // TODO: Check with age category and live independently status
  return (
    child.information !== undefined && //
    child.information.isParent &&
    isValidDateString(child.information.dateOfBirth) &&
    isChildOrYouth(child.information.dateOfBirth, state.applicationYear)
  );
}

/**
 * Checks if the child dental insurance section is completed for intake application.
 */
export function isChildDentalInsuranceSectionCompleted(child: Pick<ProtectedApplicationChildState, 'dentalInsurance'>): boolean {
  return child.dentalInsurance !== undefined;
}

/**
 * Checks if the child dental benefits section is completed for intake application.
 */
export function isChildDentalBenefitsSectionCompleted(child: Pick<ProtectedApplicationChildState, 'dentalBenefits'>): boolean {
  return child.dentalBenefits?.hasChanged === true;
}
