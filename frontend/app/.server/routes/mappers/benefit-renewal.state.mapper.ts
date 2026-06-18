import { invariant } from '@dts-stn/invariant';
import { injectable } from 'inversify';
import type { ReadonlyDeep } from 'type-fest';
import validator from 'validator';

import type {
  BenefitRenewalApplicantInformationDto,
  BenefitRenewalChildDto,
  BenefitRenewalCommunicationPreferencesDto,
  BenefitRenewalContactInformationDto,
  BenefitRenewalDto,
  BenefitRenewalEmailDto,
  BenefitRenewalPartnerInformationDto,
  ClientApplicantInformationDto,
  ClientApplicationDto,
  ClientChildDto,
  ClientCommunicationPreferencesDto,
  ClientContactInformationDto,
  ClientPartnerInformationDto,
} from '~/.server/domain/dtos';
import { checkValidAndVerifiedEmailAddress, isEmailAddressRequired, maritalStatusHasPartner } from '~/.server/routes/helpers/base-application-route-helpers';
import type {
  BaseApplicationAddressDeclaredChangeState,
  BaseApplicationApplicantInformationState,
  BaseApplicationChannelCodeState,
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
  channelCode: BaseApplicationChannelCodeState;
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
  channelCode: BaseApplicationChannelCodeState;
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
  channelCode: BaseApplicationChannelCodeState;
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
  mapBenefitRenewalAdultStateToBenefitRenewalDto(benefitrenewalAdultState: BenefitRenewalAdultState, options?: { userId?: string }): BenefitRenewalDto;
  mapBenefitRenewalFamilyStateToBenefitRenewalDto(benefitrenewalFamilyState: BenefitRenewalFamilyState, options?: { userId?: string }): BenefitRenewalDto;
  mapBenefitRenewalChildStateToBenefitRenewalDto(benefitRenewalChildState: BenefitRenewalChildState, options?: { userId?: string }): BenefitRenewalDto;
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
  applicationChannelCode: 'protected' | 'public';
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
  email: string | undefined;
  emailVerified: boolean | undefined;
  existingEmail: string | undefined;
  existingEmailVerified: boolean | undefined;
}

interface ToEmailAddressProtectedChannelArgs {
  email: string | undefined;
  emailVerified: boolean | undefined;
}

interface ToEmailAddressPublicChannelArgs {
  communicationPreferences: BaseApplicationCommunicationPreferencesDeclaredChangeState;
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

@injectable()
export class DefaultBenefitRenewalStateMapper implements BenefitRenewalStateMapper {
  mapBenefitRenewalAdultStateToBenefitRenewalDto(
    {
      channelCode,
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
    options?: { userId?: string },
  ): BenefitRenewalDto {
    const userId = options?.userId ?? 'anonymous';

    if (communicationPreferences === undefined) {
      throw new Error('Expected communicationPreferences to be defined');
    }

    if (clientApplication === undefined) {
      throw new Error('Expected clientApplication to be defined');
    }

    const emailAddress = this.toEmailAddress({
      applicationChannelCode: channelCode,
      communicationPreferences: communicationPreferences,
      email: email,
      emailVerified: emailVerified,
      existingEmail: clientApplication.contactInformation.email,
      existingEmailVerified: clientApplication.contactInformation.emailVerified,
    });

    return {
      applicationChannelCode: channelCode,
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
      emailAddress,
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
        hasEmailChanged: emailAddress.value !== clientApplication.contactInformation.email,
      },
    };
  }

  mapBenefitRenewalFamilyStateToBenefitRenewalDto(
    {
      channelCode,
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
    options?: { userId?: string },
  ): BenefitRenewalDto {
    const userId = options?.userId ?? 'anonymous';

    if (communicationPreferences === undefined) {
      throw new Error('Expected communicationPreferences to be defined');
    }

    if (clientApplication === undefined) {
      throw new Error('Expected clientApplication to be defined');
    }

    invariant(children.length > 0, 'Expected children to be non-empty for a family renewal');

    const emailAddress = this.toEmailAddress({
      applicationChannelCode: channelCode,
      communicationPreferences: communicationPreferences,
      email: email,
      emailVerified: emailVerified,
      existingEmail: clientApplication.contactInformation.email,
      existingEmailVerified: clientApplication.contactInformation.emailVerified,
    });

    return {
      applicationChannelCode: channelCode,
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
      emailAddress,
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
        hasEmailChanged: emailAddress.value !== clientApplication.contactInformation.email,
      },
    };
  }

  mapBenefitRenewalChildStateToBenefitRenewalDto(
    {
      channelCode,
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
    options?: { userId?: string },
  ): BenefitRenewalDto {
    const userId = options?.userId ?? 'anonymous';

    if (communicationPreferences === undefined) {
      throw new Error('Expected communicationPreferences to be defined');
    }

    if (clientApplication === undefined) {
      throw new Error('Expected clientApplication to be defined');
    }

    invariant(children.length > 0, 'Expected children to be non-empty for a child renewal');

    const emailAddress = this.toEmailAddress({
      applicationChannelCode: channelCode,
      communicationPreferences: communicationPreferences,
      email: email,
      emailVerified: emailVerified,
      existingEmail: clientApplication.contactInformation.email,
      existingEmailVerified: clientApplication.contactInformation.emailVerified,
    });

    return {
      applicationChannelCode: channelCode,
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
      emailAddress,
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
        hasEmailChanged: emailAddress.value !== clientApplication.contactInformation.email,
      },
    };
  }

  /**
   * Merges the existing applicant information with the renewed social insurance number and marital status to create a
   * RenewalApplicantInformationDto for the renewal application. The existing first name, last name, client ID, and
   * client number are retained. Marital status is used with the renewed values if provided. Social insurance number
   * is used with the renewed value if the existing social insurance number is empty; otherwise, the existing social
   * insurance number is retained.
   *
   * @param param0 - An object containing the existing applicant information, the renewed social insurance number, and the renewed marital status.
   * @returns A BenefitRenewalApplicantInformationDto object containing the merged applicant information for the renewal application.
   */
  private toApplicantInformation({ existingApplicantInformation, renewedSocialInsuranceNumber, renewedMaritalStatus }: ToApplicantInformationArgs): BenefitRenewalApplicantInformationDto {
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

  private toChildren({ existingChildren, renewedChildren }: ToChildrenArgs): BenefitRenewalChildDto[] {
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

  private toContactInformation({ existingContactInformation, isHomeAddressSameAsMailingAddress, renewedContactInformation, renewedHomeAddress, renewedMailingAddress }: ToContactInformationArgs): BenefitRenewalContactInformationDto {
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

  private toCommunicationPreferences({ existingCommunicationPreferences, communicationPreferences }: ToCommunicationPreferencesArgs): BenefitRenewalCommunicationPreferencesDto {
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

  /**
   * Maps email address fields to a {@link BenefitRenewalEmailDto} using channel-specific validation rules.
   * Delegates to {@link toEmailAddressProtectedChannel} for protected-channel renewals
   * and to {@link toEmailAddressPublicChannel} for public-channel renewals.
   */
  private toEmailAddress({ applicationChannelCode, communicationPreferences, email, emailVerified, existingEmail, existingEmailVerified }: ToEmailAddressArgs): BenefitRenewalEmailDto {
    if (applicationChannelCode === 'protected') {
      return this.toEmailAddressProtectedChannel({ email, emailVerified });
    }

    return this.toEmailAddressPublicChannel({ communicationPreferences, email, emailVerified, existingEmail, existingEmailVerified });
  }

  /**
   * Maps email address fields for a protected-channel renewal.
   * Protected-channel renewals always require a valid, verified email address;
   * throws if the email is absent or unverified.
   */
  private toEmailAddressProtectedChannel({ email, emailVerified }: ToEmailAddressProtectedChannelArgs): BenefitRenewalEmailDto {
    const result = checkValidAndVerifiedEmailAddress({ email, emailVerified });

    if (!result.success) {
      throw new Error('Expected a valid and verified email for protected application channel');
    }

    return { value: result.email, verified: result.emailVerified };
  }

  /**
   * Maps email address fields for a public-channel renewal.
   * If the communication preferences have not changed, or have changed but do not require an
   * email, the existing email and verification status are preserved to avoid data loss.
   * If the preferences have changed and a selected communication method requires email,
   * a valid, verified email is enforced and throws if absent or unverified.
   */
  private toEmailAddressPublicChannel({ communicationPreferences, email, emailVerified, existingEmail, existingEmailVerified }: ToEmailAddressPublicChannelArgs): BenefitRenewalEmailDto {
    if (
      !communicationPreferences.hasChanged ||
      !isEmailAddressRequired({
        preferredMethodSunLife: communicationPreferences.value.preferredMethod,
        preferredMethodGovernmentOfCanada: communicationPreferences.value.preferredNotificationMethod,
      })
    ) {
      // Preferences unchanged, or changed but email not required — retain existing email to avoid data loss.
      return { value: existingEmail, verified: existingEmailVerified };
    }

    // Preferences changed and a selected communication method requires email — must be valid and verified.
    const result = checkValidAndVerifiedEmailAddress({ email, emailVerified });

    if (!result.success) {
      throw new Error('Expected a valid and verified email for public application channel when communication preferences have changed and require an email');
    }

    return { value: result.email, verified: result.emailVerified };
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

  private toPartnerInformation({ effectiveMaritalStatus, existingPartnerInformation, renewedPartnerInformation }: ToPartnerInformationArgs): BenefitRenewalPartnerInformationDto | undefined {
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
