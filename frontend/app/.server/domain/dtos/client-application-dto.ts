import type { ReadonlyDeep } from 'type-fest';

export type ClientApplicationDto = ReadonlyDeep<{
  /**
   * The year ID of the application, which corresponds to the benefit application year in the database. This is used to
   * determine which year's rules and eligibility criteria to apply when processing the application.
   */
  applicationYearId: string;

  applicantInformation: ClientApplicantInformationDto;
  children: Array<ClientChildDto>;
  communicationPreferences: ClientCommunicationPreferencesDto;
  contactInformation: ClientContactInformationDto;

  /** Valid co-pay tier (1, 2 or 3) code for the earning taxation year */
  coverageCopayTierCode?: string;

  dateOfBirth: string;
  dentalBenefits?: Array<string>;

  /**
   * Applicant profile eligibility status code
   */
  eligibilityStatusCode?: string;

  livingIndependently?: boolean;
  partnerInformation?: ClientPartnerInformationDto;

  /**
   * Indicates if a renewal application has already been submitted for all members associated with a Primary Applicant
   * Family ID.
   */
  previousApplication?: boolean;

  privateDentalInsurance?: boolean;
  typeOfApplication: 'adult' | 'children' | 'family';
}>;

export type ClientApplicantInformationDto = Readonly<{
  firstName: string;
  lastName: string;
  /**
   * Marital status of the client. This field is optional, as ITA clients may not have an initial marital status.
   */
  maritalStatus?: string;
  /**
   * The client’s Social Insurance Number (SIN). This may be empty if the data is mapped from an ApplicantDto,
   * where the SIN is optional, particularly for some dependent applicants who are not required to provide a SIN.
   */
  socialInsuranceNumber: string;
  clientId: string;
  clientNumber: string;
}>;

export type ClientChildDto = ReadonlyDeep<{
  dentalBenefits: Array<string>;
  privateDentalInsurance: boolean;
  information: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    isParent: boolean;
    clientId: string;
    clientNumber: string;
    socialInsuranceNumber?: string;
  };
}>;

export type ClientCommunicationPreferencesDto = ReadonlyDeep<{
  preferredLanguage?: string;
  preferredMethodSunLife?: string;
  preferredMethodGovernmentOfCanada?: string;
}>;

export type ClientContactInformationDto = ReadonlyDeep<{
  copyMailingAddress?: boolean;
  /** Home address fields are optional because ITA clients initially have no home address */
  homeAddress?: ClientAddressDto;
  mailingAddress: ClientAddressDto;
  phoneNumber?: string;
  phoneNumberAlt?: string;
  email?: string;
  emailVerified?: boolean;
}>;

type ClientAddressDto = Readonly<{
  address: string;
  apartment?: string;
  city: string;
  country: string;
  postalCode?: string;
  province?: string;
}>;

export type ClientPartnerInformationDto = ReadonlyDeep<{
  clientId: string;
  clientNumber: string;
  yearOfBirth: string;
  firstName?: string;
  lastName?: string;
  socialInsuranceNumber: string;
}>;

export type ClientApplicationBasicInfoRequestDto = Readonly<{
  clientNumber: string;
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  applicationYearId?: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

export type ClientApplicationBasicInfoAndSinRequestDto = Readonly<{
  clientNumber: string;
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  applicationYearId?: string;
  sin: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

export type ClientApplicationSinRequestDto = Readonly<{
  sin: string;
  applicationYearId?: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;
