import type { PickDeep } from 'type-fest';

import { getAllowedTypeOfApplication } from '~/.server/routes/helpers/base-application-route-helpers';
import type { PublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getContextualAgeCategoryFromDate } from '~/.server/routes/helpers/public-application-route-helpers';

type TypeOfApplicationSectionCompletionResult = 'INCOMPLETED' | 'COMPLETED' | 'TYPE-MISMATCHED';

/**
 * Checks if the type of application section is completed.
 *
 * The section is considered completed if:
 *
 * - The type of application is not 'delegate'.
 * - For intake context, the type of application is included in the allowed types of application for intake.
 * - For other contexts, if there is a client application, the type of application is included in the allowed types of
 *   application for the context and client application. If there is no client application, we consider the section
 *   completed as the user has made a selection.
 *
 * If the type of application is 'delegate', the section is considered incompleted as the user has not made a selection.
 * If the type of application is not included in the allowed types of application for the context, the section is
 * considered incompleted.
 */
export function getTypeOfApplicationSectionCompletionResult(
  state: PickDeep<
    PublicApplicationState,
    | 'context' //
    | 'clientApplication.applicantInformation.clientNumber'
    | `clientApplication.children.${number}.information.clientNumber`
    | 'clientApplication.eligibleClientNumbers'
    | 'typeOfApplication'
  >,
): TypeOfApplicationSectionCompletionResult {
  if (!state.typeOfApplication || state.typeOfApplication === 'delegate') {
    return 'INCOMPLETED';
  }

  if (state.context === 'intake') {
    const intakeAllowedTypeOfApplication = getAllowedTypeOfApplication({ context: state.context });
    return intakeAllowedTypeOfApplication.includes(state.typeOfApplication) ? 'COMPLETED' : 'TYPE-MISMATCHED';
  }

  if (!state.clientApplication) {
    // If there is no client application, we cannot determine if the type of application is valid or not, but we
    // can consider it completed as the user has made a selection.
    return 'COMPLETED';
  }

  const renewalAllowedTypeOfApplication = getAllowedTypeOfApplication({ context: state.context, clientApplication: state.clientApplication });
  return renewalAllowedTypeOfApplication.includes(state.typeOfApplication) ? 'COMPLETED' : 'TYPE-MISMATCHED';
}

/**
 * Checks if the personal information section is completed.
 * For youth applicants, livingIndependently must also be completed.
 */
export function isPersonalInformationSectionCompleted(state: Pick<PublicApplicationState, 'context' | 'inputModel' | 'applicantInformation' | 'livingIndependently' | 'applicationYear'>): boolean {
  if (state.inputModel === undefined || state.applicantInformation === undefined) {
    return false;
  }

  const ageCategory = getContextualAgeCategoryFromDate(state.applicantInformation.dateOfBirth, state.applicationYear);

  if (ageCategory === 'children') {
    return false;
  }

  if (ageCategory === 'youth') {
    return state.livingIndependently === true;
  }

  // adults or seniors
  return true;
}

/**
 * Checks if the terms and conditions section is completed.
 */
export function isTermsAndConditionsSectionCompleted(state: Pick<PublicApplicationState, 'termsAndConditions'>): boolean {
  return (
    state.termsAndConditions?.acknowledgePrivacy === true && //
    state.termsAndConditions.acknowledgeTerms === true &&
    state.termsAndConditions.shareData === true
  );
}

/**
 * Checks if the tax filing section is completed.
 */
export function isTaxFilingSectionCompleted(state: Pick<PublicApplicationState, 'hasFiledTaxes'>): boolean {
  return state.hasFiledTaxes === true;
}

/**
 * Checks if the new or returning member section is completed.
 */
export function isNewOrReturningMemberSectionCompleted(state: Pick<PublicApplicationState, 'context' | 'applicantInformation' | 'livingIndependently' | 'newOrReturningMember' | 'applicationYear'>): boolean {
  return state.context === 'intake' && isPersonalInformationSectionCompleted(state) && state.newOrReturningMember?.isNewOrReturningMember !== undefined;
}
