import type { ReadonlyDeep } from 'type-fest';

export type BenefitRenewalDto = ReadonlyDeep<{
  applicantInformation: RenewalApplicantInformationDto;
  applicationYearId: string;
  children: RenewalChildDto[];
  communicationPreferences: RenewalCommunicationPreferencesDto;
  contactInformation: RenewalContactInformationDto;
  emailAddress: RenewalEmailDto;
  dateOfBirth: string;
  dentalBenefits: string[];
  dentalInsurance?: DentalInsuranceDto;
  livingIndependently?: boolean;
  partnerInformation?: RenewalPartnerInformationDto;
  typeOfApplication: RenewalTypeOfApplicationDto;
  termsAndConditions: TermsAndConditionsDto;
  changeIndicators?: ChangeIndicatorsDto;

  /**
   * Indicates whether the renewal request is to create a new benefit application or renew an existing benefit
   * application.
   *
   * The current use case for "New" is when a primary dependent turning 18 years old renews their benefit as an
   * individual after being previously covered as a dependent under their parent's benefit. In this case, a new benefit
   * application needs to be created for the new adult. For all other renewal scenarios, the application category code
   * name will be "Renewal" since the benefit application will be renewed instead of a new application being created.
   */
  applicationCategoryCodeName: 'New' | 'Renewal';

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

export type RenewalApplicantInformationDto = ReadonlyDeep<{
  clientId: string;
  clientNumber: string;
  firstName: string;
  lastName: string;
  maritalStatus?: string;
  socialInsuranceNumber: string;
}>;

export type RenewalChildDto = ReadonlyDeep<{
  clientId: string;
  clientNumber: string;
  dentalBenefits: string[];
  dentalInsurance: DentalInsuranceDto;
  information: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    isParent: boolean;
    socialInsuranceNumber?: string;
  };
}>;

export type RenewalEmailDto = ReadonlyDeep<{
  value?: string;
  verified?: boolean;
}>;

export type RenewalCommunicationPreferencesDto = ReadonlyDeep<{
  preferredLanguage: string;
  preferredMethod: string;
  preferredMethodGovernmentOfCanada: string;
}>;

export type RenewalContactInformationDto = ReadonlyDeep<{
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
  phoneNumber?: string;
  phoneNumberAlt?: string;
}>;

export type RenewalPartnerInformationDto = ReadonlyDeep<{
  clientId?: string;
  consentToSharePersonalInformation: true;
  socialInsuranceNumber: string;
  yearOfBirth: string;
}>;

export type RenewalTypeOfApplicationDto = 'adult' | 'adult-child' | 'child';

type DentalInsuranceDto = ReadonlyDeep<{
  hasDentalInsurance: boolean;
  dentalInsuranceEligibilityConfirmation?: boolean;
}>;

type TermsAndConditionsDto = ReadonlyDeep<{
  acknowledgeTerms: boolean;
  acknowledgePrivacy: boolean;
  shareData: boolean;
}>;

export type ChangeIndicatorsDto = ReadonlyDeep<{
  hasAddressChanged?: boolean;
  hasMaritalStatusChanged?: boolean;
  hasPhoneChanged?: boolean;
  hasEmailChanged?: boolean;
}>;
