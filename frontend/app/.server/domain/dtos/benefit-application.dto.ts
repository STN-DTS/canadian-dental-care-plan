import type { ReadonlyDeep } from 'type-fest';

export type BenefitApplicationDto = ReadonlyDeep<{
  applicationChannelCode: 'protected' | 'public';
  applicantInformation: BenefitApplicationApplicantInformationDto;
  applicationYearId: string;
  children: BenefitApplicationChildDto[];
  communicationPreferences: BenefitApplicationCommunicationPreferencesDto;
  contactInformation: BenefitApplicationContactInformationDto;
  emailAddress: BenefitApplicationEmailDto;
  dateOfBirth: string;
  dentalBenefits: string[];
  dentalInsurance?: BenefitApplicationDentalInsuranceDto;
  livingIndependently?: boolean;
  partnerInformation?: BenefitApplicationPartnerInformationDto;
  termsAndConditions: BenefitApplicationTermsAndConditionsDto;
  typeOfApplication: BenefitApplicationTypeOfApplicationDto;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

export type BenefitApplicationApplicantInformationDto = ReadonlyDeep<{
  clientNumber?: string;
  firstName: string;
  lastName: string;
  maritalStatus: string;
  socialInsuranceNumber: string;
}>;

export type BenefitApplicationChildDto = ReadonlyDeep<{
  dentalBenefits: string[];
  dentalInsurance: BenefitApplicationDentalInsuranceDto;
  information: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    isParent: boolean;
    socialInsuranceNumber?: string;
  };
}>;

export type BenefitApplicationEmailDto = ReadonlyDeep<{
  value?: string;
  verified?: boolean;
}>;

export type BenefitApplicationCommunicationPreferencesDto = ReadonlyDeep<{
  preferredLanguage: string;
  preferredMethod: string;
  preferredMethodGovernmentOfCanada: string;
}>;

export type BenefitApplicationContactInformationDto = ReadonlyDeep<{
  copyMailingAddress: boolean;
  homeAddress: string;
  homeApartment?: string;
  homeCity: string;
  homeCountry: string;
  homePostalCode?: string;
  homeProvince?: string;
  mailingAddress: string;
  mailingApartment?: string;
  mailingCity: string;
  mailingCountry: string;
  mailingPostalCode?: string;
  mailingProvince?: string;
  phoneNumber: string;
  phoneNumberAlt?: string;
}>;

export type BenefitApplicationDentalInsuranceDto = ReadonlyDeep<{
  hasDentalInsurance: boolean;
  dentalInsuranceEligibilityConfirmation?: boolean;
}>;

export type BenefitApplicationTermsAndConditionsDto = ReadonlyDeep<{
  acknowledgeTerms: boolean;
  acknowledgePrivacy: boolean;
  shareData: boolean;
}>;

export type BenefitApplicationPartnerInformationDto = ReadonlyDeep<{
  consentToSharePersonalInformation: true;
  yearOfBirth: string;
  socialInsuranceNumber: string;
}>;

export type BenefitApplicationTypeOfApplicationDto = 'adult' | 'adult-child' | 'child';
