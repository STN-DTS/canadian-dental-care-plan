import { invariant } from '@dts-stn/invariant';
import { injectable } from 'inversify';
import validator from 'validator';

import type { BenefitApplicationApplicantInformationDto, BenefitApplicationCommunicationPreferencesDto, BenefitApplicationDto, BenefitApplicationEmailDto } from '~/.server/domain/dtos';
import { checkValidAndVerifiedEmailAddress, isEmailAddressRequired } from '~/.server/routes/helpers/base-application-route-helpers';
import type {
  BaseApplicationAddressDeclaredChangeState,
  BaseApplicationApplicantInformationState,
  BaseApplicationChannelCodeState,
  BaseApplicationChildState,
  BaseApplicationCommunicationPreferencesDeclaredChangeState,
  BaseApplicationDentalBenefitsDeclaredChangeState,
  BaseApplicationDentalInsuranceState,
  BaseApplicationNewOrReturningMemberState,
  BaseApplicationPartnerInformationState,
  BaseApplicationPhoneNumberDeclaredChangeState,
  BaseApplicationTermsAndConditionsState,
  BaseApplicationYearState,
} from '~/.server/routes/helpers/base-application-route-helpers';
import { getContextualAgeCategoryFromDate } from '~/.server/routes/helpers/public-application-route-helpers';

export interface ApplicationAdultState {
  channelCode: BaseApplicationChannelCodeState;
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  dentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
  dentalInsurance: BaseApplicationDentalInsuranceState;
  email?: string;
  emailVerified?: boolean;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  livingIndependently?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
  newOrReturningMember?: BaseApplicationNewOrReturningMemberState;
}

export interface ApplicationFamilyState {
  channelCode: BaseApplicationChannelCodeState;
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  children: BaseApplicationChildState[];
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  dentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
  dentalInsurance: BaseApplicationDentalInsuranceState;
  email?: string;
  emailVerified?: boolean;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  livingIndependently?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
  newOrReturningMember?: BaseApplicationNewOrReturningMemberState;
}

export interface ApplicationChildrenState {
  channelCode: BaseApplicationChannelCodeState;
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  children: BaseApplicationChildState[];
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email?: string;
  emailVerified?: boolean;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  livingIndependently?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
  newOrReturningMember?: BaseApplicationNewOrReturningMemberState;
}

interface ToApplicantInformationArgs {
  applicantInformation: BaseApplicationApplicantInformationState;
  maritalStatus?: string;
  newOrReturningMember?: BaseApplicationNewOrReturningMemberState;
}

interface ToHomeAddressArgs {
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress: Extract<BaseApplicationAddressDeclaredChangeState, { hasChanged: true }>;
}

interface ToCommunicationPreferencesArgs {
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
}

interface ToContactInformationArgs {
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
}

interface ToEmailAddressArgs {
  applicationChannelCode: 'protected' | 'public';
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email: string | undefined;
  emailVerified: boolean | undefined;
}

interface ToEmailAddressProtectedChannelArgs {
  email: string | undefined;
  emailVerified: boolean | undefined;
}

interface ToEmailAddressPublicChannelArgs {
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email: string | undefined;
  emailVerified: boolean | undefined;
}

export interface BenefitApplicationStateMapper {
  mapApplicationAdultStateToBenefitApplicationDto(applicationAdultState: ApplicationAdultState, userId?: string): BenefitApplicationDto;

  mapApplicationFamilyStateToBenefitApplicationDto(applicationFamilyState: ApplicationFamilyState, userId?: string): BenefitApplicationDto;

  mapApplicationChildrenStateToBenefitApplicationDto(applicationChildrenState: ApplicationChildrenState, userId?: string): BenefitApplicationDto;
}

@injectable()
export class DefaultBenefitApplicationStateMapper implements BenefitApplicationStateMapper {
  mapApplicationAdultStateToBenefitApplicationDto(applicationAdultState: ApplicationAdultState, userId: string = 'anonymous'): BenefitApplicationDto {
    const ageCategory = getContextualAgeCategoryFromDate(applicationAdultState.applicantInformation.dateOfBirth, applicationAdultState.applicationYear);
    if (ageCategory === 'youth' && applicationAdultState.livingIndependently === undefined) {
      throw new Error('Expected livingIndependently to be defined');
    }

    invariant(applicationAdultState.dentalBenefits, 'Expected dentalBenefits to be defined for an adult application');

    return {
      applicationChannelCode: applicationAdultState.channelCode,
      applicantInformation: this.toApplicantInformation({
        applicantInformation: applicationAdultState.applicantInformation,
        maritalStatus: applicationAdultState.maritalStatus,
        newOrReturningMember: applicationAdultState.newOrReturningMember,
      }),
      applicationYearId: applicationAdultState.applicationYear.applicationYearId,
      // For adult-only applications, children are not collected and should be sent as an empty array.
      children: [],
      communicationPreferences: this.toCommunicationPreferences({ communicationPreferences: applicationAdultState.communicationPreferences }),
      contactInformation: this.toContactInformation({
        phoneNumber: applicationAdultState.phoneNumber,
        isHomeAddressSameAsMailingAddress: applicationAdultState.isHomeAddressSameAsMailingAddress,
        homeAddress: applicationAdultState.homeAddress,
        mailingAddress: applicationAdultState.mailingAddress,
      }),
      dateOfBirth: applicationAdultState.applicantInformation.dateOfBirth,
      emailAddress: this.toEmailAddress({
        applicationChannelCode: applicationAdultState.channelCode,
        communicationPreferences: applicationAdultState.communicationPreferences,
        email: applicationAdultState.email,
        emailVerified: applicationAdultState.emailVerified,
      }),
      dentalBenefits: this.toDentalBenefits(applicationAdultState.dentalBenefits),
      dentalInsurance: applicationAdultState.dentalInsurance,
      livingIndependently: applicationAdultState.livingIndependently,
      partnerInformation: applicationAdultState.partnerInformation,
      termsAndConditions: applicationAdultState.termsAndConditions,
      typeOfApplication: 'adult',
      userId: userId,
    };
  }

  mapApplicationFamilyStateToBenefitApplicationDto(applicationFamilyState: ApplicationFamilyState, userId: string = 'anonymous'): BenefitApplicationDto {
    const ageCategory = getContextualAgeCategoryFromDate(applicationFamilyState.applicantInformation.dateOfBirth, applicationFamilyState.applicationYear);
    if (ageCategory === 'youth' && applicationFamilyState.livingIndependently === undefined) {
      throw new Error('Expected livingIndependently to be defined');
    }

    invariant(applicationFamilyState.dentalBenefits, 'Expected dentalBenefits to be defined for a family application');

    return {
      applicationChannelCode: applicationFamilyState.channelCode,
      applicantInformation: this.toApplicantInformation({
        applicantInformation: applicationFamilyState.applicantInformation,
        maritalStatus: applicationFamilyState.maritalStatus,
        newOrReturningMember: applicationFamilyState.newOrReturningMember,
      }),
      applicationYearId: applicationFamilyState.applicationYear.applicationYearId,
      children: this.toChildren(applicationFamilyState.children),
      communicationPreferences: this.toCommunicationPreferences({ communicationPreferences: applicationFamilyState.communicationPreferences }),
      contactInformation: this.toContactInformation({
        phoneNumber: applicationFamilyState.phoneNumber,
        isHomeAddressSameAsMailingAddress: applicationFamilyState.isHomeAddressSameAsMailingAddress,
        homeAddress: applicationFamilyState.homeAddress,
        mailingAddress: applicationFamilyState.mailingAddress,
      }),
      dateOfBirth: applicationFamilyState.applicantInformation.dateOfBirth,
      emailAddress: this.toEmailAddress({
        applicationChannelCode: applicationFamilyState.channelCode,
        communicationPreferences: applicationFamilyState.communicationPreferences,
        email: applicationFamilyState.email,
        emailVerified: applicationFamilyState.emailVerified,
      }),
      dentalBenefits: this.toDentalBenefits(applicationFamilyState.dentalBenefits),
      dentalInsurance: applicationFamilyState.dentalInsurance,
      livingIndependently: applicationFamilyState.livingIndependently,
      partnerInformation: applicationFamilyState.partnerInformation,
      termsAndConditions: applicationFamilyState.termsAndConditions,
      typeOfApplication: 'adult-child',
      userId: userId,
    };
  }

  mapApplicationChildrenStateToBenefitApplicationDto(applicationChildrenState: ApplicationChildrenState, userId: string = 'anonymous'): BenefitApplicationDto {
    const ageCategory = getContextualAgeCategoryFromDate(applicationChildrenState.applicantInformation.dateOfBirth, applicationChildrenState.applicationYear);
    if (ageCategory === 'youth' && applicationChildrenState.livingIndependently === undefined) {
      throw new Error('Expected livingIndependently to be defined');
    }

    return {
      applicationChannelCode: applicationChildrenState.channelCode,
      applicantInformation: this.toApplicantInformation({
        applicantInformation: applicationChildrenState.applicantInformation,
        maritalStatus: applicationChildrenState.maritalStatus,
        newOrReturningMember: applicationChildrenState.newOrReturningMember,
      }),
      applicationYearId: applicationChildrenState.applicationYear.applicationYearId,
      children: this.toChildren(applicationChildrenState.children),
      communicationPreferences: this.toCommunicationPreferences({ communicationPreferences: applicationChildrenState.communicationPreferences }),
      contactInformation: this.toContactInformation({
        phoneNumber: applicationChildrenState.phoneNumber,
        isHomeAddressSameAsMailingAddress: applicationChildrenState.isHomeAddressSameAsMailingAddress,
        homeAddress: applicationChildrenState.homeAddress,
        mailingAddress: applicationChildrenState.mailingAddress,
      }),
      dateOfBirth: applicationChildrenState.applicantInformation.dateOfBirth,
      emailAddress: this.toEmailAddress({
        applicationChannelCode: applicationChildrenState.channelCode,
        communicationPreferences: applicationChildrenState.communicationPreferences,
        email: applicationChildrenState.email,
        emailVerified: applicationChildrenState.emailVerified,
      }),
      // For children-only applications, applicant-level dental benefits are not collected and should be sent as an empty array.
      dentalBenefits: [],
      // For children-only applications, applicant-level dental insurance is not collected and should be sent as undefined.
      dentalInsurance: undefined,
      livingIndependently: applicationChildrenState.livingIndependently,
      partnerInformation: applicationChildrenState.partnerInformation,
      termsAndConditions: applicationChildrenState.termsAndConditions,
      typeOfApplication: 'child',
      userId: userId,
    };
  }

  private toApplicantInformation({ applicantInformation, maritalStatus, newOrReturningMember }: ToApplicantInformationArgs): BenefitApplicationApplicantInformationDto {
    invariant(maritalStatus, 'Expected maritalStatus to be defined');
    return {
      clientNumber: newOrReturningMember?.memberId,
      firstName: applicantInformation.firstName,
      lastName: applicantInformation.lastName,
      maritalStatus: maritalStatus,
      socialInsuranceNumber: applicantInformation.socialInsuranceNumber,
    };
  }

  private toChildren(children: BaseApplicationChildState[]) {
    invariant(children.length > 0, 'Expected children to be non-empty when mapping children');
    return children.map((child) => {
      invariant(child.information, 'Expected child.information to be defined');
      invariant(child.dentalInsurance, 'Expected child.dentalInsurance to be defined');
      invariant(child.dentalBenefits?.value, 'Expected child.dentalBenefits.value to be defined');
      return {
        dentalInsurance: child.dentalInsurance,
        dentalBenefits: this.toDentalBenefits(child.dentalBenefits),
        information: {
          firstName: child.information.firstName,
          lastName: child.information.lastName,
          dateOfBirth: child.information.dateOfBirth,
          isParent: child.information.isParent,
          socialInsuranceNumber: child.information.socialInsuranceNumber,
        },
      };
    });
  }

  private toCommunicationPreferences({ communicationPreferences }: ToCommunicationPreferencesArgs): BenefitApplicationCommunicationPreferencesDto {
    invariant(communicationPreferences.value, 'Expected communicationPreferences.value to be defined');
    return {
      preferredLanguage: communicationPreferences.value.preferredLanguage,
      preferredMethod: communicationPreferences.value.preferredMethod,
      preferredMethodGovernmentOfCanada: communicationPreferences.value.preferredNotificationMethod,
    };
  }

  private toContactInformation({ phoneNumber, isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }: ToContactInformationArgs) {
    invariant(mailingAddress?.value, 'Expected mailingAddress.value to be defined');
    invariant(phoneNumber.value, 'Expected phoneNumber.value to be defined');
    return {
      copyMailingAddress: !!isHomeAddressSameAsMailingAddress,
      ...this.toHomeAddress({ isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }),
      ...this.toMailingAddress(mailingAddress),
      phoneNumber: phoneNumber.value.primary,
      phoneNumberAlt: phoneNumber.value.alternate,
    };
  }

  private toDentalBenefits(dentalBenefitsState: BaseApplicationDentalBenefitsDeclaredChangeState) {
    invariant(dentalBenefitsState.value, 'Expected dentalBenefitsState.value to be defined');
    const dentalBenefits = [];

    if (dentalBenefitsState.value.hasFederalBenefits && dentalBenefitsState.value.federalSocialProgram && !validator.isEmpty(dentalBenefitsState.value.federalSocialProgram)) {
      dentalBenefits.push(dentalBenefitsState.value.federalSocialProgram);
    }

    if (dentalBenefitsState.value.hasProvincialTerritorialBenefits && dentalBenefitsState.value.provincialTerritorialSocialProgram && !validator.isEmpty(dentalBenefitsState.value.provincialTerritorialSocialProgram)) {
      dentalBenefits.push(dentalBenefitsState.value.provincialTerritorialSocialProgram);
    }

    return dentalBenefits;
  }

  private toHomeAddress({ isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }: ToHomeAddressArgs) {
    if (isHomeAddressSameAsMailingAddress) {
      return {
        homeAddress: mailingAddress.value.address,
        homeCity: mailingAddress.value.city,
        homeCountry: mailingAddress.value.country,
        homePostalCode: mailingAddress.value.postalCode,
        homeProvince: mailingAddress.value.province,
      };
    }

    invariant(homeAddress?.value, 'Expected homeAddress.value to be defined when isHomeAddressSameAsMailingAddress is false.');
    return {
      homeAddress: homeAddress.value.address,
      homeCity: homeAddress.value.city,
      homeCountry: homeAddress.value.country,
      homePostalCode: homeAddress.value.postalCode,
      homeProvince: homeAddress.value.province,
    };
  }

  private toMailingAddress(mailingAddress: Extract<BaseApplicationAddressDeclaredChangeState, { hasChanged: true }>) {
    return {
      mailingAddress: mailingAddress.value.address,
      mailingCity: mailingAddress.value.city,
      mailingCountry: mailingAddress.value.country,
      mailingPostalCode: mailingAddress.value.postalCode,
      mailingProvince: mailingAddress.value.province,
    };
  }

  /**
   * Maps email address fields to an {@link BenefitApplicationEmailDto} using channel-specific validation rules.
   * Delegates to {@link toEmailAddressProtectedChannel} for protected-channel applications
   * and to {@link toEmailAddressPublicChannel} for public-channel applications.
   */
  private toEmailAddress({ applicationChannelCode, communicationPreferences, email, emailVerified }: ToEmailAddressArgs): BenefitApplicationEmailDto {
    if (applicationChannelCode === 'protected') {
      return this.toEmailAddressProtectedChannel({ email, emailVerified });
    }

    return this.toEmailAddressPublicChannel({ communicationPreferences, email, emailVerified });
  }

  /**
   * Maps email address fields for a protected-channel application.
   * Protected-channel applications always require a valid, verified email address;
   * throws if the email is absent or unverified.
   */
  private toEmailAddressProtectedChannel({ email, emailVerified }: ToEmailAddressProtectedChannelArgs): BenefitApplicationEmailDto {
    const result = checkValidAndVerifiedEmailAddress({ email, emailVerified });

    if (!result.success) {
      throw new Error('Expected a valid and verified email for protected application channel');
    }

    return { value: result.email, verified: result.emailVerified };
  }

  /**
   * Maps email address fields for a public-channel application.
   * Because this is a new application (intake), the applicant always enters their communication
   * preferences from scratch — there is no prior data to preserve. The spoke therefore always
   * sets `communicationPreferences.hasChanged` to `true`, which is enforced here as an invariant.
   * An email is only required when at least one of the applicant's chosen communication methods
   * (Sun Life and/or Government of Canada) necessitates one. If neither method requires email,
   * both {@link BenefitApplicationEmailDto.value} and {@link BenefitApplicationEmailDto.verified}
   * are returned as `undefined`. Otherwise a valid, verified email is required and throws if
   * absent or unverified.
   */
  private toEmailAddressPublicChannel({ communicationPreferences, email, emailVerified }: ToEmailAddressPublicChannelArgs): BenefitApplicationEmailDto {
    invariant(communicationPreferences.hasChanged === true, 'Expected communicationPreferences.hasChanged to be true for public application channel when mapping email address');

    if (
      !isEmailAddressRequired({
        preferredMethodSunLife: communicationPreferences.value.preferredMethod,
        preferredMethodGovernmentOfCanada: communicationPreferences.value.preferredNotificationMethod,
      })
    ) {
      // If no selected communication method requires email, both fields remain undefined.
      return { value: undefined, verified: undefined };
    }

    // If a selected communication method requires email, it must be valid and verified.
    const result = checkValidAndVerifiedEmailAddress({ email, emailVerified });

    if (!result.success) {
      throw new Error('Expected a valid and verified email for public application channel when at least one communication method requires email');
    }

    return { value: result.email, verified: result.emailVerified };
  }
}
