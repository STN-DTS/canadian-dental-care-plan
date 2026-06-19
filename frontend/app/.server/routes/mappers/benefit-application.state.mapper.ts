import { invariant } from '@dts-stn/invariant';
import { injectable } from 'inversify';
import validator from 'validator';

import type { ApplicantInformationDto, BenefitApplicationDto, CommunicationPreferencesDto } from '~/.server/domain/dtos';
import type {
  BaseApplicationAddressDeclaredChangeState,
  BaseApplicationApplicantInformationState,
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
  mailingAddress: Extract<BaseApplicationAddressDeclaredChangeState, { hasChanged: true }>;
}

interface ToCommunicationPreferencesArgs {
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email?: string;
  emailVerified?: boolean;
}

interface ToContactInformationArgs {
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
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
      applicantInformation: applicationAdultState.applicantInformation,
      applicationYear: applicationAdultState.applicationYear,
      communicationPreferences: applicationAdultState.communicationPreferences,
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
      applicantInformation: applicationFamilyState.applicantInformation,
      applicationYear: applicationFamilyState.applicationYear,
      children: applicationFamilyState.children,
      communicationPreferences: applicationFamilyState.communicationPreferences,
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
      applicantInformation: applicationChildrenState.applicantInformation,
      applicationYear: applicationChildrenState.applicationYear,
      children: applicationChildrenState.children,
      communicationPreferences: applicationChildrenState.communicationPreferences,
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
  }: ToBenefitApplicationDtoArgs) {
    return {
      applicantInformation: this.toApplicantInformation({
        applicantInformation,
        maritalStatus,
        newOrReturningMember,
      }),
      applicationYearId: applicationYear.applicationYearId,
      children: this.toChildren(children),
      communicationPreferences: this.toCommunicationPreferences({ communicationPreferences, email, emailVerified }),
      contactInformation: this.toContactInformation({ phoneNumber, isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }),
      dateOfBirth: applicantInformation.dateOfBirth,
      maritalStatus,
      dentalBenefits: this.toDentalBenefits(dentalBenefits),
      dentalInsurance,
      livingIndependently,
      partnerInformation,
      termsAndConditions,
      typeOfApplication,
      userId: 'anonymous',
    };
  }

  private toApplicantInformation({ applicantInformation, maritalStatus, newOrReturningMember }: ToApplicantInformationArgs): ApplicantInformationDto {
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
      invariant(child.dentalBenefits?.value, 'Expected child.dentalBenefits.value to be defined');

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

  private toCommunicationPreferences({ communicationPreferences, email, emailVerified }: ToCommunicationPreferencesArgs): CommunicationPreferencesDto {
    invariant(communicationPreferences.value, 'Expected communicationPreferences.value to be defined');

    // Only include the email if the user has verified it. This handles the case where the user entered
    // an email, then navigated back and switched to a non-digital method.
    const effectiveEmail = emailVerified ? email : undefined;

    // Keep emailVerified aligned with the email value emitted by this mapper: when no effective email is
    // sent, omit emailVerified as well so we do not send a stale or contradictory false value.
    const effectiveEmailVerified = effectiveEmail ? true : undefined;

    return {
      email: effectiveEmail,
      emailVerified: effectiveEmailVerified,
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

  private toDentalBenefits(dentalBenefitsState?: BaseApplicationDentalBenefitsDeclaredChangeState) {
    // If dentalBenefitsState is undefined, it means the applicant did not interact with the dental
    // benefits section. This occurs in the context of a children-only application, where applicant-level
    // dental benefits are not collected. Return an empty array rather than omitting the field or returning undefined.
    if (!dentalBenefitsState) {
      return [];
    }

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
}
