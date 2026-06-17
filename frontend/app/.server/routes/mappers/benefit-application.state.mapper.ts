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
  BaseApplicationContextState,
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
  context: BaseApplicationContextState;
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
  context: BaseApplicationContextState;
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
  context: BaseApplicationContextState;
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

interface ToBenefitApplicationDtoArgs {
  channelCode: BaseApplicationChannelCodeState;
  context: BaseApplicationContextState;
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  children?: BaseApplicationChildState[];
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email?: string;
  emailVerified?: boolean;
  dentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
  dentalInsurance?: BaseApplicationDentalInsuranceState;
  livingIndependently?: boolean;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
  newOrReturningMember?: BaseApplicationNewOrReturningMemberState;
  typeOfApplication: 'adult' | 'adult-child' | 'child';
}

interface ToApplicantInformationArgs {
  applicantInformation: BaseApplicationApplicantInformationState;
  maritalStatus?: string;
  newOrReturningMember?: BaseApplicationNewOrReturningMemberState;
}

interface ToHomeAddressArgs {
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress: BaseApplicationAddressDeclaredChangeState;
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
  mapApplicationAdultStateToBenefitApplicationDto(applicationAdultState: ApplicationAdultState): BenefitApplicationDto;

  mapApplicationFamilyStateToBenefitApplicationDto(applicationFamilyState: ApplicationFamilyState): BenefitApplicationDto;

  mapApplicationChildrenStateToBenefitApplicationDto(applicationChildrenState: ApplicationChildrenState): BenefitApplicationDto;
}

@injectable()
export class DefaultBenefitApplicationStateMapper implements BenefitApplicationStateMapper {
  mapApplicationAdultStateToBenefitApplicationDto(applicationAdultState: ApplicationAdultState): BenefitApplicationDto {
    const ageCategory = getContextualAgeCategoryFromDate(applicationAdultState.applicantInformation.dateOfBirth, applicationAdultState.applicationYear);
    if (ageCategory === 'youth' && applicationAdultState.livingIndependently === undefined) {
      throw new Error('Expected livingIndependently to be defined');
    }

    return this.toBenefitApplicationDto({
      channelCode: applicationAdultState.channelCode,
      applicantInformation: applicationAdultState.applicantInformation,
      applicationYear: applicationAdultState.applicationYear,
      communicationPreferences: applicationAdultState.communicationPreferences,
      context: applicationAdultState.context,
      dentalBenefits: applicationAdultState.dentalBenefits,
      dentalInsurance: applicationAdultState.dentalInsurance,
      email: applicationAdultState.email,
      emailVerified: applicationAdultState.emailVerified,
      homeAddress: applicationAdultState.homeAddress,
      isHomeAddressSameAsMailingAddress: applicationAdultState.isHomeAddressSameAsMailingAddress,
      livingIndependently: ageCategory === 'youth' ? applicationAdultState.livingIndependently : undefined,
      mailingAddress: applicationAdultState.mailingAddress,
      maritalStatus: applicationAdultState.maritalStatus,
      newOrReturningMember: applicationAdultState.newOrReturningMember,
      partnerInformation: applicationAdultState.partnerInformation,
      phoneNumber: applicationAdultState.phoneNumber,
      termsAndConditions: applicationAdultState.termsAndConditions,
      typeOfApplication: 'adult',
    });
  }

  mapApplicationFamilyStateToBenefitApplicationDto(applicationFamilyState: ApplicationFamilyState): BenefitApplicationDto {
    const ageCategory = getContextualAgeCategoryFromDate(applicationFamilyState.applicantInformation.dateOfBirth, applicationFamilyState.applicationYear);
    if (ageCategory === 'youth' && applicationFamilyState.livingIndependently === undefined) {
      throw new Error('Expected livingIndependently to be defined');
    }

    invariant(applicationFamilyState.children.length > 0, 'Expected children to be non-empty for a family application');

    return this.toBenefitApplicationDto({
      channelCode: applicationFamilyState.channelCode,
      applicantInformation: applicationFamilyState.applicantInformation,
      applicationYear: applicationFamilyState.applicationYear,
      children: applicationFamilyState.children,
      communicationPreferences: applicationFamilyState.communicationPreferences,
      context: applicationFamilyState.context,
      dentalBenefits: applicationFamilyState.dentalBenefits,
      dentalInsurance: applicationFamilyState.dentalInsurance,
      email: applicationFamilyState.email,
      emailVerified: applicationFamilyState.emailVerified,
      homeAddress: applicationFamilyState.homeAddress,
      isHomeAddressSameAsMailingAddress: applicationFamilyState.isHomeAddressSameAsMailingAddress,
      livingIndependently: ageCategory === 'youth' ? applicationFamilyState.livingIndependently : undefined,
      mailingAddress: applicationFamilyState.mailingAddress,
      maritalStatus: applicationFamilyState.maritalStatus,
      newOrReturningMember: applicationFamilyState.newOrReturningMember,
      partnerInformation: applicationFamilyState.partnerInformation,
      phoneNumber: applicationFamilyState.phoneNumber,
      termsAndConditions: applicationFamilyState.termsAndConditions,
      typeOfApplication: 'adult-child',
    });
  }

  mapApplicationChildrenStateToBenefitApplicationDto(applicationChildrenState: ApplicationChildrenState): BenefitApplicationDto {
    const ageCategory = getContextualAgeCategoryFromDate(applicationChildrenState.applicantInformation.dateOfBirth, applicationChildrenState.applicationYear);
    if (ageCategory === 'youth' && applicationChildrenState.livingIndependently === undefined) {
      throw new Error('Expected livingIndependently to be defined');
    }

    invariant(applicationChildrenState.children.length > 0, 'Expected children to be non-empty for a child application');

    return this.toBenefitApplicationDto({
      channelCode: applicationChildrenState.channelCode,
      applicantInformation: applicationChildrenState.applicantInformation,
      applicationYear: applicationChildrenState.applicationYear,
      children: applicationChildrenState.children,
      communicationPreferences: applicationChildrenState.communicationPreferences,
      context: applicationChildrenState.context,
      email: applicationChildrenState.email,
      emailVerified: applicationChildrenState.emailVerified,
      homeAddress: applicationChildrenState.homeAddress,
      isHomeAddressSameAsMailingAddress: applicationChildrenState.isHomeAddressSameAsMailingAddress,
      livingIndependently: ageCategory === 'youth' ? applicationChildrenState.livingIndependently : undefined,
      mailingAddress: applicationChildrenState.mailingAddress,
      maritalStatus: applicationChildrenState.maritalStatus,
      newOrReturningMember: applicationChildrenState.newOrReturningMember,
      partnerInformation: applicationChildrenState.partnerInformation,
      phoneNumber: applicationChildrenState.phoneNumber,
      termsAndConditions: applicationChildrenState.termsAndConditions,
      typeOfApplication: 'child',
    });
  }

  private toBenefitApplicationDto({
    channelCode,
    applicantInformation,
    applicationYear,
    children,
    communicationPreferences,
    maritalStatus,
    dentalBenefits,
    dentalInsurance,
    email,
    emailVerified,
    homeAddress,
    isHomeAddressSameAsMailingAddress,
    livingIndependently,
    mailingAddress,
    partnerInformation,
    phoneNumber,
    termsAndConditions,
    typeOfApplication,
    newOrReturningMember,
  }: ToBenefitApplicationDtoArgs): BenefitApplicationDto {
    return {
      applicationChannelCode: channelCode,
      applicantInformation: this.toApplicantInformation({
        applicantInformation,
        maritalStatus,
        newOrReturningMember,
      }),
      applicationYearId: applicationYear.applicationYearId,
      children: this.toChildren(children),
      communicationPreferences: this.toCommunicationPreferences({ communicationPreferences }),
      contactInformation: this.toContactInformation({ phoneNumber, isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }),
      dateOfBirth: applicantInformation.dateOfBirth,
      emailAddress: this.toEmailAddress({ applicationChannelCode: channelCode, communicationPreferences, email, emailVerified }),
      dentalBenefits: this.toDentalBenefits(dentalBenefits),
      dentalInsurance,
      livingIndependently,
      partnerInformation,
      termsAndConditions,
      typeOfApplication,
      userId: 'anonymous',
    };
  }

  private toApplicantInformation({ applicantInformation, maritalStatus, newOrReturningMember }: ToApplicantInformationArgs): BenefitApplicationApplicantInformationDto {
    invariant(maritalStatus, 'Expected maritalStatus to be defined');
    return {
      ...applicantInformation,
      maritalStatus,
      clientNumber: newOrReturningMember?.memberId,
    };
  }

  private toChildren(children?: BaseApplicationChildState[]) {
    if (!children) return [];

    return children.map((child) => {
      invariant(child.information, 'Expected child.information to be defined');
      invariant(child.dentalInsurance, 'Expected child.dentalInsurance to be defined');

      return {
        ...child,
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
    invariant(mailingAddress, 'Expected mailingAddress to be defined');
    invariant(phoneNumber.value, 'Expected phoneNumber.value to be defined');
    return {
      copyMailingAddress: !!isHomeAddressSameAsMailingAddress,
      ...this.toHomeAddress({ isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }),
      ...this.toMailingAddress(mailingAddress),
      phoneNumber: phoneNumber.value.primary,
      phoneNumberAlt: phoneNumber.value.alternate,
    };
  }

  private toDentalBenefits(dentalBenefitsState?: BaseApplicationDentalBenefitsDeclaredChangeState) {
    invariant(dentalBenefitsState, 'Expected dentalBenefitsState.value to be defined');

    const dentalBenefits = [];

    if (dentalBenefitsState.value?.hasFederalBenefits && dentalBenefitsState.value.federalSocialProgram && !validator.isEmpty(dentalBenefitsState.value.federalSocialProgram)) {
      dentalBenefits.push(dentalBenefitsState.value.federalSocialProgram);
    }

    if (dentalBenefitsState.value?.hasProvincialTerritorialBenefits && dentalBenefitsState.value.provincialTerritorialSocialProgram && !validator.isEmpty(dentalBenefitsState.value.provincialTerritorialSocialProgram)) {
      dentalBenefits.push(dentalBenefitsState.value.provincialTerritorialSocialProgram);
    }

    return dentalBenefits;
  }

  private toHomeAddress({ isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }: ToHomeAddressArgs) {
    if (isHomeAddressSameAsMailingAddress) {
      return {
        homeAddress: mailingAddress.value?.address ?? '',
        homeCity: mailingAddress.value?.city ?? '',
        homeCountry: mailingAddress.value?.country ?? '',
        homePostalCode: mailingAddress.value?.postalCode ?? '',
        homeProvince: mailingAddress.value?.province ?? '',
      };
    }
    invariant(homeAddress, 'Expected homeAddress to be defined when isHomeAddressSameAsMailingAddress is false.');

    return {
      homeAddress: homeAddress.value?.address ?? '',
      homeCity: homeAddress.value?.city ?? '',
      homeCountry: homeAddress.value?.country ?? '',
      homePostalCode: homeAddress.value?.postalCode ?? '',
      homeProvince: homeAddress.value?.province ?? '',
    };
  }

  private toMailingAddress(mailingAddress: BaseApplicationAddressDeclaredChangeState) {
    return {
      mailingAddress: mailingAddress.value?.address ?? '',
      mailingApartment: undefined,
      mailingCity: mailingAddress.value?.city ?? '',
      mailingCountry: mailingAddress.value?.country ?? '',
      mailingPostalCode: mailingAddress.value?.postalCode ?? '',
      mailingProvince: mailingAddress.value?.province ?? '',
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
