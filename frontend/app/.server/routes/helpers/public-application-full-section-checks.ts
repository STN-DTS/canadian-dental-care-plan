import validator from 'validator';

import { isChildClientNumberValid, isChildOrYouth } from '~/.server/routes/helpers/base-application-route-helpers';
import type { PublicApplicationChildState, PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import { isValidDateString } from '~/utils/date-utils';

/**
 * Checks if the phone number section is completed for full application.
 */
export function isPhoneNumberSectionCompleted(state: Pick<PublicApplicationState, 'phoneNumber'>): boolean {
  return state.phoneNumber?.hasChanged === true;
}

/**
 * Checks if the address section is completed for full application.
 *
 * The section is considered complete when all three conditions are met:
 * - Both the mailing and home address responses are present,
 * - Both addresses are marked as changed (the user has provided new addresses), and
 * - The user has answered whether their home address is the same as their mailing address.
 */
export function isAddressSectionCompleted(state: Pick<PublicApplicationState, 'mailingAddress' | 'homeAddress' | 'isHomeAddressSameAsMailingAddress'>): boolean {
  // Both address responses must be present before evaluating completion
  if (!state.mailingAddress || !state.homeAddress) {
    return false;
  }

  // Both addresses must be marked as changed and the same-address question must have been answered
  return state.mailingAddress.hasChanged && state.homeAddress.hasChanged && state.isHomeAddressSameAsMailingAddress !== undefined;
}

/**
 * Checks if the communication preferences section is completed for full application.
 */
export function isCommunicationPreferencesSectionCompleted(state: Pick<PublicApplicationState, 'communicationPreferences' | 'email' | 'emailVerified'>): boolean {
  if (state.communicationPreferences?.hasChanged !== true) {
    return false; // communication preferences not set
  }

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = getEnv();
  const emailMethods = new Set([COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID]); // methods that require email
  const isEmailRequired =
    emailMethods.has(state.communicationPreferences.value.preferredMethod) || //
    emailMethods.has(state.communicationPreferences.value.preferredNotificationMethod);

  if (!isEmailRequired) {
    return true; // email not required, section is complete
  }

  return state.email !== undefined && validator.isEmail(state.email) && state.emailVerified === true;
}

/**
 * Checks if the dental insurance section is completed for full application.
 */
export function isDentalInsuranceSectionCompleted(state: Pick<PublicApplicationState, 'dentalInsurance'>): boolean {
  return state.dentalInsurance?.dentalInsuranceEligibilityConfirmation === true;
}

/**
 * Checks if the dental benefits section is completed for full application.
 */
export function isDentalBenefitsSectionCompleted(state: Pick<PublicApplicationState, 'dentalBenefits'>): boolean {
  return state.dentalBenefits?.hasChanged === true;
}

/**
 * Checks if the marital status section is completed for full application.
 */
export function isMaritalStatusSectionCompleted(state: Pick<PublicApplicationState, 'maritalStatus' | 'partnerInformation'>): boolean {
  if (state.maritalStatus === undefined) return false; // marital status not selected

  const { MARITAL_STATUS_CODE_COMMON_LAW, MARITAL_STATUS_CODE_MARRIED } = getEnv();
  const partnerMaritalStatuses = [MARITAL_STATUS_CODE_COMMON_LAW, MARITAL_STATUS_CODE_MARRIED]; // statuses that require partner information

  if (partnerMaritalStatuses.includes(state.maritalStatus)) {
    return state.partnerInformation?.consentToSharePersonalInformation === true; // partner information required and consent given
  }

  return true; // no partner information required
}

/**
 * Checks if the child information section is completed for full application.
 */
export function isChildInformationSectionCompleted(state: Pick<PublicApplicationState, 'context' | 'applicationYear' | 'clientApplication'>, child: Pick<PublicApplicationChildState, 'information'>): boolean {
  // TODO: Check with age category and live independently status
  return (
    child.information !== undefined && //
    child.information.isParent &&
    isValidDateString(child.information.dateOfBirth) &&
    isChildOrYouth(child.information.dateOfBirth, state.applicationYear) &&
    isChildClientNumberValid(state.context, state.clientApplication, child.information.memberId)
  );
}

/**
 * Checks if the child dental insurance section is completed for full application.
 */
export function isChildDentalInsuranceSectionCompleted(child: Pick<PublicApplicationChildState, 'dentalInsurance'>): boolean {
  return child.dentalInsurance !== undefined;
}

/**
 * Checks if the child dental benefits section is completed for full application.
 */
export function isChildDentalBenefitsSectionCompleted(child: Pick<PublicApplicationChildState, 'dentalBenefits'>): boolean {
  return child.dentalBenefits?.hasChanged === true;
}
