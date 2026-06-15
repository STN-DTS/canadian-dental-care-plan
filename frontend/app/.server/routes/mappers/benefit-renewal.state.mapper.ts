import { invariant } from '@dts-stn/invariant';
import { injectable } from 'inversify';
import type { ReadonlyDeep } from 'type-fest';
import validator from 'validator';

import type {
  BenefitRenewalDto,
  ClientApplicantInformationDto,
  ClientApplicationDto,
  ClientChildDto,
  ClientCommunicationPreferencesDto,
  ClientContactInformationDto,
  ClientPartnerInformationDto,
  RenewalApplicantInformationDto,
  RenewalChildDto,
  RenewalCommunicationPreferencesDto,
  RenewalContactInformationDto,
  RenewalEmailDto,
  RenewalPartnerInformationDto,
} from '~/.server/domain/dtos';
import { maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type {
  BaseApplicationAddressDeclaredChangeState,
  BaseApplicationApplicantInformationState,
  BaseApplicationChildState,
  BaseApplicationCommunicationPreferencesDeclaredChangeState,
  BaseApplicationDentalBenefitsDeclaredChangeState,
  BaseApplicationDentalInsuranceState,
  BaseApplicationPartnerInformationState,
  BaseApplicationPhoneNumberDeclaredChangeState,
  BaseApplicationTermsAndConditionsState,
  BaseApplicationYearState,
} from '~/.server/routes/helpers/base-application-route-helpers';

export interface BenefitRenewalAdultState {
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  clientApplication?: ClientApplicationDto & { applicationCategoryCodeName: 'New' | 'Renewal' };
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  dentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
  dentalInsurance: BaseApplicationDentalInsuranceState;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  email?: string;
  emailVerified?: boolean;
  communicationPreferences?: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
}

export interface BenefitRenewalFamilyState {
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  children: BaseApplicationChildState[];
  clientApplication?: ClientApplicationDto & { applicationCategoryCodeName: 'New' | 'Renewal' };
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  dentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
  dentalInsurance: BaseApplicationDentalInsuranceState;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  email?: string;
  emailVerified?: boolean;
  communicationPreferences?: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
}

export interface BenefitRenewalChildState {
  applicantInformation: BaseApplicationApplicantInformationState;
  applicationYear: BaseApplicationYearState;
  clientApplication?: ClientApplicationDto & { applicationCategoryCodeName: 'New' | 'Renewal' };
  children: BaseApplicationChildState[];
  phoneNumber: BaseApplicationPhoneNumberDeclaredChangeState;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
  maritalStatus?: string;
  partnerInformation?: BaseApplicationPartnerInformationState;
  email?: string;
  emailVerified?: boolean;
  communicationPreferences?: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  termsAndConditions: BaseApplicationTermsAndConditionsState;
}

export interface BenefitRenewalStateMapper {
  mapBenefitRenewalAdultStateToBenefitRenewalDto(benefitrenewalAdultState: BenefitRenewalAdultState, userId?: string): BenefitRenewalDto;
  mapBenefitRenewalFamilyStateToBenefitRenewalDto(benefitrenewalFamilyState: BenefitRenewalFamilyState, userId?: string): BenefitRenewalDto;
  mapBenefitRenewalChildStateToBenefitRenewalDto(benefitRenewalChildState: BenefitRenewalChildState, userId?: string): BenefitRenewalDto;
}

interface ToApplicantInformationArgs {
  existingApplicantInformation: ReadonlyDeep<ClientApplicantInformationDto>;
  renewedSocialInsuranceNumber: string;
  renewedMaritalStatus?: string;
}

interface ToChildrenArgs {
  existingChildren: readonly ReadonlyDeep<ClientChildDto>[];
  renewedChildren: BaseApplicationChildState[];
}

interface ToCommunicationPreferencesArgs {
  existingCommunicationPreferences: ReadonlyDeep<ClientCommunicationPreferencesDto>;
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
}

interface ToEmailAddressArgs {
  email: string | undefined;
  emailVerified: boolean | undefined;
  existingEmail: string | undefined;
  existingEmailVerified: boolean | undefined;
}

interface ToContactInformationArgs {
  existingContactInformation: ReadonlyDeep<ClientContactInformationDto>;
  isHomeAddressSameAsMailingAddress: boolean | undefined;
  renewedContactInformation: BaseApplicationPhoneNumberDeclaredChangeState | undefined;
  renewedHomeAddress: BaseApplicationAddressDeclaredChangeState | undefined;
  renewedMailingAddress: BaseApplicationAddressDeclaredChangeState | undefined;
}

interface ToDentalBenefitsArgs {
  existingDentalBenefits?: readonly string[];
  renewedDentalBenefits?: BaseApplicationDentalBenefitsDeclaredChangeState;
}

interface ToHomeAddressArgs {
  existingContactInformation: ReadonlyDeep<ClientContactInformationDto>;
  homeAddress?: BaseApplicationAddressDeclaredChangeState;
  isHomeAddressSameAsMailingAddress?: boolean;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
}

interface ToMailingAddressArgs {
  existingContactInformation: ReadonlyDeep<ClientContactInformationDto>;
  mailingAddress?: BaseApplicationAddressDeclaredChangeState;
}

interface ToPartnerInformationArgs {
  effectiveMaritalStatus?: string;
  existingPartnerInformation?: ReadonlyDeep<ClientPartnerInformationDto>;
  renewedPartnerInformation?: BaseApplicationPartnerInformationState;
}

interface HasEmailChangedArgs {
  emailVerified: boolean | undefined;
  email: string | undefined;
  existingEmail: string | undefined;
}

@injectable()
export class DefaultBenefitRenewalStateMapper implements BenefitRenewalStateMapper {
  mapBenefitRenewalAdultStateToBenefitRenewalDto(
    {
      applicantInformation,
      applicationYear,
      clientApplication,
      communicationPreferences,
      dentalBenefits,
      dentalInsurance,
      email,
      emailVerified,
      homeAddress,
      isHomeAddressSameAsMailingAddress,
      mailingAddress,
      maritalStatus,
      partnerInformation,
      phoneNumber,
      termsAndConditions,
    }: BenefitRenewalAdultState,
    userId: string = 'anonymous',
  ): BenefitRenewalDto {
    if (communicationPreferences === undefined) {
      throw new Error('Expected communicationPreferences to be defined');
    }

    if (clientApplication === undefined) {
      throw new Error('Expected clientApplication to be defined');
    }

    const hasEmailChanged = this.hasEmailChanged({
      emailVerified,
      email,
      existingEmail: clientApplication.contactInformation.email,
    });

    return {
      applicationCategoryCodeName: clientApplication.applicationCategoryCodeName,
      dateOfBirth: clientApplication.dateOfBirth,
      applicantInformation: this.toApplicantInformation({
        existingApplicantInformation: clientApplication.applicantInformation,
        renewedSocialInsuranceNumber: applicantInformation.socialInsuranceNumber,
        renewedMaritalStatus: maritalStatus,
      }),
      applicationYearId: applicationYear.applicationYearId,
      children: [],
      communicationPreferences: this.toCommunicationPreferences({
        existingCommunicationPreferences: clientApplication.communicationPreferences,
        communicationPreferences,
      }),
      emailAddress: this.toEmailAddress({
        email: email,
        emailVerified: emailVerified,
        existingEmail: clientApplication.contactInformation.email,
        existingEmailVerified: clientApplication.contactInformation.emailVerified,
      }),
      contactInformation: this.toContactInformation({
        existingContactInformation: clientApplication.contactInformation,
        isHomeAddressSameAsMailingAddress,
        renewedContactInformation: phoneNumber,
        renewedHomeAddress: homeAddress,
        renewedMailingAddress: mailingAddress,
      }),
      dentalBenefits: this.toDentalBenefits({
        existingDentalBenefits: clientApplication.dentalBenefits,
        renewedDentalBenefits: dentalBenefits,
      }),
      dentalInsurance,
      livingIndependently: clientApplication.livingIndependently,
      partnerInformation: this.toPartnerInformation({
        effectiveMaritalStatus: maritalStatus ?? clientApplication.applicantInformation.maritalStatus,
        existingPartnerInformation: clientApplication.partnerInformation,
        renewedPartnerInformation: partnerInformation,
      }),
      typeOfApplication: 'adult',
      termsAndConditions,
      userId,
      changeIndicators: {
        hasMaritalStatusChanged: !!maritalStatus,
        hasAddressChanged: mailingAddress?.hasChanged,
        hasPhoneChanged: phoneNumber.hasChanged,
        hasEmailChanged,
      },
    };
  }

  mapBenefitRenewalFamilyStateToBenefitRenewalDto(
    {
      applicantInformation,
      applicationYear,
      children,
      clientApplication,
      phoneNumber,
      dentalBenefits,
      dentalInsurance,
      homeAddress,
      isHomeAddressSameAsMailingAddress,
      mailingAddress,
      maritalStatus,
      partnerInformation,
      email,
      emailVerified,
      communicationPreferences,
      termsAndConditions,
    }: BenefitRenewalFamilyState,
    userId: string = 'anonymous',
  ): BenefitRenewalDto {
    if (communicationPreferences === undefined) {
      throw new Error('Expected communicationPreferences to be defined');
    }

    if (clientApplication === undefined) {
      throw new Error('Expected clientApplication to be defined');
    }

    invariant(children.length > 0, 'Expected children to be non-empty for a family renewal');

    return {
      applicationCategoryCodeName: clientApplication.applicationCategoryCodeName,
      dateOfBirth: clientApplication.dateOfBirth,
      applicantInformation: this.toApplicantInformation({
        existingApplicantInformation: clientApplication.applicantInformation,
        renewedSocialInsuranceNumber: applicantInformation.socialInsuranceNumber,
        renewedMaritalStatus: maritalStatus,
      }),
      applicationYearId: applicationYear.applicationYearId,
      children: this.toChildren({
        existingChildren: clientApplication.children,
        renewedChildren: children,
      }),
      communicationPreferences: this.toCommunicationPreferences({
        existingCommunicationPreferences: clientApplication.communicationPreferences,
        communicationPreferences,
      }),
      emailAddress: this.toEmailAddress({
        email: email,
        emailVerified: emailVerified,
        existingEmail: clientApplication.contactInformation.email,
        existingEmailVerified: clientApplication.contactInformation.emailVerified,
      }),
      contactInformation: this.toContactInformation({
        existingContactInformation: clientApplication.contactInformation,
        isHomeAddressSameAsMailingAddress,
        renewedContactInformation: phoneNumber,
        renewedHomeAddress: homeAddress,
        renewedMailingAddress: mailingAddress,
      }),
      dentalBenefits: this.toDentalBenefits({
        existingDentalBenefits: clientApplication.dentalBenefits,
        renewedDentalBenefits: dentalBenefits,
      }),
      dentalInsurance,
      livingIndependently: clientApplication.livingIndependently,
      partnerInformation: this.toPartnerInformation({
        effectiveMaritalStatus: maritalStatus ?? clientApplication.applicantInformation.maritalStatus,
        existingPartnerInformation: clientApplication.partnerInformation,
        renewedPartnerInformation: partnerInformation,
      }),
      typeOfApplication: 'adult-child',
      termsAndConditions,
      userId,
      changeIndicators: {
        hasMaritalStatusChanged: !!maritalStatus,
        hasAddressChanged: mailingAddress?.hasChanged,
        hasPhoneChanged: phoneNumber.hasChanged,
        hasEmailChanged: this.hasEmailChanged({ emailVerified, email, existingEmail: clientApplication.contactInformation.email }),
      },
    };
  }

  mapBenefitRenewalChildStateToBenefitRenewalDto(
    {
      applicantInformation,
      applicationYear,
      children,
      clientApplication,
      phoneNumber,
      homeAddress,
      isHomeAddressSameAsMailingAddress,
      mailingAddress,
      maritalStatus,
      partnerInformation,
      email,
      emailVerified,
      communicationPreferences,
      termsAndConditions,
    }: BenefitRenewalChildState,
    userId: string = 'anonymous',
  ): BenefitRenewalDto {
    if (communicationPreferences === undefined) {
      throw new Error('Expected communicationPreferences to be defined');
    }

    if (clientApplication === undefined) {
      throw new Error('Expected clientApplication to be defined');
    }

    invariant(children.length > 0, 'Expected children to be non-empty for a child renewal');

    return {
      applicationCategoryCodeName: clientApplication.applicationCategoryCodeName,
      dateOfBirth: clientApplication.dateOfBirth,
      applicantInformation: this.toApplicantInformation({
        existingApplicantInformation: clientApplication.applicantInformation,
        renewedSocialInsuranceNumber: applicantInformation.socialInsuranceNumber,
        renewedMaritalStatus: maritalStatus,
      }),
      applicationYearId: applicationYear.applicationYearId,
      children: this.toChildren({
        existingChildren: clientApplication.children,
        renewedChildren: children,
      }),
      communicationPreferences: this.toCommunicationPreferences({
        existingCommunicationPreferences: clientApplication.communicationPreferences,
        communicationPreferences,
      }),
      emailAddress: this.toEmailAddress({
        email: email,
        emailVerified: emailVerified,
        existingEmail: clientApplication.contactInformation.email,
        existingEmailVerified: clientApplication.contactInformation.emailVerified,
      }),
      contactInformation: this.toContactInformation({
        existingContactInformation: clientApplication.contactInformation,
        isHomeAddressSameAsMailingAddress,
        renewedContactInformation: phoneNumber,
        renewedHomeAddress: homeAddress,
        renewedMailingAddress: mailingAddress,
      }),
      dentalBenefits: [],
      dentalInsurance: undefined,
      livingIndependently: clientApplication.livingIndependently,
      partnerInformation: this.toPartnerInformation({
        effectiveMaritalStatus: maritalStatus ?? clientApplication.applicantInformation.maritalStatus,
        existingPartnerInformation: clientApplication.partnerInformation,
        renewedPartnerInformation: partnerInformation,
      }),
      typeOfApplication: 'child',
      termsAndConditions,
      userId,
      changeIndicators: {
        hasMaritalStatusChanged: !!maritalStatus,
        hasAddressChanged: mailingAddress?.hasChanged,
        hasPhoneChanged: phoneNumber.hasChanged,
        hasEmailChanged: this.hasEmailChanged({ emailVerified, email, existingEmail: clientApplication.contactInformation.email }),
      },
    };
  }

  /**
   * Determines if the email has changed based on the emailVerified flag, the new email value, and the existing email
   * value. The email is considered changed if it is verified, not empty, and different from the existing email.
   *
   * @param param0 - An object containing the emailVerified flag, the new email value, and the existing email value.
   * @returns A boolean indicating whether the email has changed.
   */
  private hasEmailChanged({ emailVerified, email, existingEmail }: HasEmailChangedArgs): boolean {
    return emailVerified === true && email !== undefined && email.trim().length > 0 && email !== existingEmail;
  }

  /**
   * Merges the existing applicant information with the renewed social insurance number and marital status to create a
   * RenewalApplicantInformationDto for the renewal application. The existing first name, last name, client ID, and
   * client number are retained. Marital status is used with the renewed values if provided. Social insurance number
   * is used with the renewed value if the existing social insurance number is empty; otherwise, the existing social
   * insurance number is retained.
   *
   * @param param0 - An object containing the existing applicant information, the renewed social insurance number, and the renewed marital status.
   * @returns A RenewalApplicantInformationDto object containing the merged applicant information for the renewal application.
   */
  private toApplicantInformation({ existingApplicantInformation, renewedSocialInsuranceNumber, renewedMaritalStatus }: ToApplicantInformationArgs): RenewalApplicantInformationDto {
    // If the renewed marital status is provided, use it. Otherwise, use the existing marital status.
    const maritalStatus = renewedMaritalStatus ?? existingApplicantInformation.maritalStatus;

    // If the existing social insurance number is empty, use the renewed social insurance number. Otherwise, use the
    // existing social insurance number.
    const socialInsuranceNumber = existingApplicantInformation.socialInsuranceNumber || renewedSocialInsuranceNumber;

    return {
      clientId: existingApplicantInformation.clientId,
      clientNumber: existingApplicantInformation.clientNumber,
      firstName: existingApplicantInformation.firstName,
      lastName: existingApplicantInformation.lastName,
      maritalStatus,
      socialInsuranceNumber,
    };
  }

  private toChildren({ existingChildren, renewedChildren }: ToChildrenArgs): RenewalChildDto[] {
    return renewedChildren.map((renewedChild) => {
      const existingChild = existingChildren.find((existingChild) => existingChild.information.clientNumber === renewedChild.information?.memberId);
      invariant(existingChild, 'Expected existingChild to be defined');
      invariant(renewedChild.information, 'Expected renewedChild.information to be defined');

      if (renewedChild.dentalInsurance === undefined) {
        throw new Error('Expected renewedChild.dentalInsurance to be defined');
      }

      return {
        clientId: existingChild.information.clientId,
        clientNumber: existingChild.information.clientNumber,
        dentalBenefits: this.toDentalBenefits({
          existingDentalBenefits: existingChild.dentalBenefits,
          renewedDentalBenefits: renewedChild.dentalBenefits,
        }),
        dentalInsurance: renewedChild.dentalInsurance,
        information: {
          firstName: renewedChild.information.firstName,
          lastName: renewedChild.information.lastName,
          dateOfBirth: renewedChild.information.dateOfBirth,
          isParent: renewedChild.information.isParent,
          socialInsuranceNumber: renewedChild.information.socialInsuranceNumber ?? existingChild.information.socialInsuranceNumber,
        },
      };
    });
  }

  private toContactInformation({ existingContactInformation, isHomeAddressSameAsMailingAddress, renewedContactInformation, renewedHomeAddress, renewedMailingAddress }: ToContactInformationArgs): RenewalContactInformationDto {
    // If the phone number has changed, use the new phone number values. Otherwise, use the existing phone number values.
    const phoneNumbers = renewedContactInformation?.hasChanged
      ? {
          phoneNumber: renewedContactInformation.value.primary,
          phoneNumberAlt: renewedContactInformation.value.alternate,
        }
      : {
          phoneNumber: existingContactInformation.phoneNumber,
          phoneNumberAlt: existingContactInformation.phoneNumberAlt,
        };

    // Determine if the home address is the same as the mailing address. If either address has changed, use the
    // isHomeAddressSameAsMailingAddress value provided by the user. If neither address has changed, use the existing
    // copyMailingAddress value to maintain consistency with the existing data.
    const haveAddressesChanged = renewedHomeAddress?.hasChanged === true || renewedMailingAddress?.hasChanged === true;
    const resolvedIsHomeAddressSameAsMailingAddress = haveAddressesChanged ? isHomeAddressSameAsMailingAddress : existingContactInformation.copyMailingAddress;

    return {
      copyMailingAddress: !!resolvedIsHomeAddressSameAsMailingAddress,
      ...this.toHomeAddress({ existingContactInformation, isHomeAddressSameAsMailingAddress: resolvedIsHomeAddressSameAsMailingAddress, homeAddress: renewedHomeAddress, mailingAddress: renewedMailingAddress }),
      ...this.toMailingAddress({ existingContactInformation, mailingAddress: renewedMailingAddress }),
      ...phoneNumbers,
    };
  }

  private toHomeAddress({ existingContactInformation, isHomeAddressSameAsMailingAddress, homeAddress, mailingAddress }: ToHomeAddressArgs) {
    // If the home address is the same as the mailing address, we want to use the mailing address values, even if the
    // mailing address has not changed, to ensure that any changes to the mailing address are reflected in the home address.
    if (isHomeAddressSameAsMailingAddress) {
      // If the mailing address has changed, use the new mailing address values for the home address.
      if (mailingAddress?.hasChanged) {
        return {
          homeAddress: mailingAddress.value.address,
          homeApartment: undefined,
          homeCity: mailingAddress.value.city,
          homeCountry: mailingAddress.value.country,
          homePostalCode: mailingAddress.value.postalCode,
          homeProvince: mailingAddress.value.province,
        };
      }

      // If the mailing address has not changed, use the existing mailing address values for the home address.
      return {
        homeAddress: existingContactInformation.mailingAddress.address,
        homeApartment: existingContactInformation.mailingAddress.apartment,
        homeCity: existingContactInformation.mailingAddress.city,
        homeCountry: existingContactInformation.mailingAddress.country,
        homePostalCode: existingContactInformation.mailingAddress.postalCode,
        homeProvince: existingContactInformation.mailingAddress.province,
      };
    }

    // If the home address is not the same as the mailing address, we want to use the home address values, and any
    // changes to the home address, for the home address.
    invariant(homeAddress, 'Expected homeAddress to be defined');

    // If the home address has changed, use the new home address values.
    if (homeAddress.hasChanged) {
      return {
        homeAddress: homeAddress.value.address,
        homeApartment: undefined,
        homeCity: homeAddress.value.city,
        homeCountry: homeAddress.value.country,
        homePostalCode: homeAddress.value.postalCode,
        homeProvince: homeAddress.value.province,
      };
    }

    // If the home address has not changed, use the existing home address values.
    invariant(existingContactInformation.homeAddress, 'Expected existingContactInformation.homeAddress to be defined');
    return {
      homeAddress: existingContactInformation.homeAddress.address,
      homeApartment: existingContactInformation.homeAddress.apartment,
      homeCity: existingContactInformation.homeAddress.city,
      homeCountry: existingContactInformation.homeAddress.country,
      homePostalCode: existingContactInformation.homeAddress.postalCode,
      homeProvince: existingContactInformation.homeAddress.province,
    };
  }

  private toMailingAddress({ existingContactInformation, mailingAddress }: ToMailingAddressArgs) {
    // If the mailing address has changed, use the new mailing address values.
    if (mailingAddress?.hasChanged) {
      return {
        mailingAddress: mailingAddress.value.address,
        mailingApartment: undefined,
        mailingCity: mailingAddress.value.city,
        mailingCountry: mailingAddress.value.country,
        mailingPostalCode: mailingAddress.value.postalCode,
        mailingProvince: mailingAddress.value.province,
      };
    }

    // If the mailing address has not changed, use the existing mailing address values.
    return {
      mailingAddress: existingContactInformation.mailingAddress.address,
      mailingApartment: existingContactInformation.mailingAddress.apartment,
      mailingCity: existingContactInformation.mailingAddress.city,
      mailingCountry: existingContactInformation.mailingAddress.country,
      mailingPostalCode: existingContactInformation.mailingAddress.postalCode,
      mailingProvince: existingContactInformation.mailingAddress.province,
    };
  }

  private toCommunicationPreferences({ existingCommunicationPreferences, communicationPreferences }: ToCommunicationPreferencesArgs): RenewalCommunicationPreferencesDto {
    invariant(communicationPreferences, 'Expected communicationPreferences to be defined');

    if (communicationPreferences.hasChanged) {
      return {
        preferredLanguage: communicationPreferences.value.preferredLanguage,
        preferredMethod: communicationPreferences.value.preferredMethod,
        preferredMethodGovernmentOfCanada: communicationPreferences.value.preferredNotificationMethod,
      };
    }

    invariant(existingCommunicationPreferences.preferredLanguage, 'Expected existingCommunicationPreferences.preferredLanguage to be defined');
    invariant(existingCommunicationPreferences.preferredMethodSunLife, 'Expected existingCommunicationPreferences.preferredMethodSunLife to be defined');
    invariant(existingCommunicationPreferences.preferredMethodGovernmentOfCanada, 'Expected existingCommunicationPreferences.preferredMethodGovernmentOfCanada to be defined');

    return {
      preferredLanguage: existingCommunicationPreferences.preferredLanguage,
      preferredMethod: existingCommunicationPreferences.preferredMethodSunLife,
      preferredMethodGovernmentOfCanada: existingCommunicationPreferences.preferredMethodGovernmentOfCanada,
    };
  }

  private toEmailAddress({ email, emailVerified, existingEmail, existingEmailVerified }: ToEmailAddressArgs): RenewalEmailDto {
    return {
      value: email ?? existingEmail,
      verified: emailVerified ?? existingEmailVerified,
    };
  }

  private toDentalBenefits({ existingDentalBenefits, renewedDentalBenefits }: ToDentalBenefitsArgs): readonly string[] {
    if (!renewedDentalBenefits) {
      return [];
    }

    if (!renewedDentalBenefits.hasChanged) {
      invariant(existingDentalBenefits, 'Expected existingDentalBenefits to be defined when renewedDentalBenefits.hasChanged is false');
      return existingDentalBenefits;
    }

    const dentalBenefits = [];

    if (renewedDentalBenefits.value.hasFederalBenefits && renewedDentalBenefits.value.federalSocialProgram && !validator.isEmpty(renewedDentalBenefits.value.federalSocialProgram)) {
      dentalBenefits.push(renewedDentalBenefits.value.federalSocialProgram);
    }

    if (renewedDentalBenefits.value.hasProvincialTerritorialBenefits && renewedDentalBenefits.value.provincialTerritorialSocialProgram && !validator.isEmpty(renewedDentalBenefits.value.provincialTerritorialSocialProgram)) {
      dentalBenefits.push(renewedDentalBenefits.value.provincialTerritorialSocialProgram);
    }

    return dentalBenefits;
  }

  private toPartnerInformation({ effectiveMaritalStatus, existingPartnerInformation, renewedPartnerInformation }: ToPartnerInformationArgs): RenewalPartnerInformationDto | undefined {
    if (!maritalStatusHasPartner(effectiveMaritalStatus)) {
      return undefined;
    }

    if (renewedPartnerInformation) {
      return renewedPartnerInformation;
    }

    return existingPartnerInformation
      ? {
          clientId: existingPartnerInformation.clientId,
          socialInsuranceNumber: existingPartnerInformation.socialInsuranceNumber,
          yearOfBirth: existingPartnerInformation.yearOfBirth,
          // From a legal perspective, this should be true in all scenarios
          consentToSharePersonalInformation: true,
        }
      : undefined;
  }
}
