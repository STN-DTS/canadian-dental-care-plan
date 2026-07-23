import type { PickDeep, SetRequired } from 'type-fest';
import validator from 'validator';

import { isChildClientNumberValid, isChildOrYouth } from '~/.server/routes/helpers/base-application-route-helpers';
import type { PublicApplicationChildState, PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getEnv } from '~/.server/utils/env-utils';
import { isValidDateString } from '~/utils/date-utils';

/**
 * Checks if the phone number section is completed for simplified application.
 */
export function isPhoneNumberSectionCompleted(state: Pick<PublicApplicationState, 'phoneNumber'>): boolean {
  return state.phoneNumber !== undefined;
}

/**
 * Checks if the address section is completed for a public simplified application.
 *
 * Both address change statuses must be answered before completion can be evaluated.
 * The section is then considered complete in two scenarios:
 * - Both addresses have changed: the user has provided updated mailing and home addresses, and
 *   the user has answered whether their home address is the same as their mailing address, or
 * - Neither address has changed (renewal only): the client application must already have both
 *   a mailing and home address on file so the existing addresses can be carried forward.
 *
 * A mismatch in change status (one changed, one did not) is always considered incomplete.
 * The carry-forward path is not available for intake applications.
 */
export function isAddressSectionCompleted(
  state: PickDeep<
    PublicApplicationState,
    | 'context' //
    | 'mailingAddress'
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

  // Neither changed (renewal only): carry forward existing addresses only if both are on file.
  // Intake applications must always provide addresses, so carry-forward is not allowed.
  // mailingAddress is always required on the client application (eslint suppressed); homeAddress is optional.
  // A mismatch (one changed, one did not) also falls through here and evaluates to false.
  return (
    state.context === 'renewal' && //
    !state.mailingAddress.hasChanged &&
    !state.homeAddress.hasChanged &&
    state.clientApplication?.contactInformation.homeAddress !== undefined &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    state.clientApplication.contactInformation.mailingAddress !== undefined
  );
}

/**
 * Checks if the communication preferences section is completed for simplified application.
 */
export function isCommunicationPreferencesSectionCompleted({
  clientApplication,
  communicationPreferences,
  email,
  emailVerified,
}: SetRequired<
  PickDeep<
    PublicApplicationState,
    | 'clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada'
    | 'clientApplication.communicationPreferences.preferredMethodSunLife'
    | 'clientApplication.contactInformation.email'
    | 'clientApplication.contactInformation.emailVerified'
    | 'communicationPreferences'
    | 'email'
    | 'emailVerified'
  >,
  'clientApplication'
>): boolean {
  if (communicationPreferences === undefined) {
    return false; // communication preferences not set
  }

  const resolvedSunLifePreferredMethod = communicationPreferences.hasChanged //
    ? communicationPreferences.value.preferredMethod
    : clientApplication.communicationPreferences.preferredMethodSunLife;

  if (resolvedSunLifePreferredMethod === undefined) {
    return false; // preferred Sun Life method not set, section is incomplete
  }

  const resolvedGovernmentOfCanadaPreferredMethod = communicationPreferences.hasChanged //
    ? communicationPreferences.value.preferredNotificationMethod
    : clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada;

  if (resolvedGovernmentOfCanadaPreferredMethod === undefined) {
    return false; // preferred government of Canada method not set, section is incomplete
  }

  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = getEnv();
  const emailMethods = new Set([COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID]); // methods that require email
  const isEmailRequired = emailMethods.has(resolvedSunLifePreferredMethod) || emailMethods.has(resolvedGovernmentOfCanadaPreferredMethod);

  if (!isEmailRequired) {
    return true; // email not required, section is complete
  }

  const resolvedEmail = communicationPreferences.hasChanged ? email : clientApplication.contactInformation.email;
  const resolvedEmailVerified = communicationPreferences.hasChanged ? emailVerified : clientApplication.contactInformation.emailVerified;
  return resolvedEmail !== undefined && validator.isEmail(resolvedEmail) && resolvedEmailVerified === true;
}

/**
 * Checks if the dental insurance section is completed for simplified application.
 */
export function isDentalInsuranceSectionCompleted(state: Pick<PublicApplicationState, 'dentalInsurance'>): boolean {
  return state.dentalInsurance !== undefined;
}

/**
 * Checks if the dental benefits section is completed for simplified application.
 *
 * The dental benefits section is considered complete if the user has indicated whether their access to government
 * dental benefits has changed. If they have indicated that their access has changed, the section is complete regardless
 * of whether they have access or not. If they have indicated that their access has not changed, then they must indicate
 * their existing access to government dental benefits for the section to be considered complete.
 */
export function isDentalBenefitsSectionCompleted(state: PickDeep<PublicApplicationState, 'dentalBenefits' | 'clientApplication.dentalBenefits'>): boolean {
  if (!state.dentalBenefits) return false; // user must indicate if their access to government dental benefits has changed
  if (state.dentalBenefits.hasChanged) return true; // if access has changed, section is complete regardless of whether they have access or not
  return state.clientApplication?.dentalBenefits !== undefined; // if access has not changed, existing access must be indicated
}

/**
 * Checks if the child information section is completed for simplified application.
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
 * Checks if the child dental insurance section is completed for simplified application.
 */
export function isChildDentalInsuranceSectionCompleted(child: Pick<PublicApplicationChildState, 'dentalInsurance'>): boolean {
  return child.dentalInsurance !== undefined;
}

/**
 * Checks if the child dental benefits section is completed for simplified application.
 */
export function isChildDentalBenefitsSectionCompleted(child: Pick<PublicApplicationChildState, 'dentalBenefits'>): boolean {
  return child.dentalBenefits !== undefined;
}
