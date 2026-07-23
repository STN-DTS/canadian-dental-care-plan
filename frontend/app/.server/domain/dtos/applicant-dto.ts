import type { ReadonlyDeep } from 'type-fest';

export type FindApplicantByBasicInfoDto = Readonly<{
  clientNumber: string;
  dateOfBirth: string;
  firstName: string;
  lastName: string;

  /** A unique identifier for the user making the request - used for auditing */
  userId: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for finding an applicant by SIN.
 */
export type FindApplicantBySinRequestDto = Readonly<{
  /** The SIN of the applicant. */
  sin: string;

  /** A unique identifier for the applicant - used for auditing */
  userId: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for an applicant.
 */
export type ApplicantDto = ReadonlyDeep<{
  /** The client ID of the applicant. */
  clientId: string;

  /** The client number of the applicant. */
  clientNumber: string;

  /** The date of birth of the applicant. */
  dateOfBirth: string;

  /** The first name of the applicant. */
  firstName: string;

  /** The last name of the applicant. */
  lastName: string;

  /** The social insurance number of the applicant. */
  socialInsuranceNumber?: string;

  /** The marital status of the applicant. */
  maritalStatus?: string;

  /** The communication preferences of the applicant */
  communicationPreferences: ApplicantCommunicationPreferencesDto;

  /** The contact information of the applicant */
  contactInformation: ApplicantContactInformationDto;
}>;

export type ApplicantCommunicationPreferencesDto = ReadonlyDeep<{
  preferredLanguage?: string;
  preferredMethodSunLife?: string;
  preferredMethodGovernmentOfCanada?: string;
}>;

export type ApplicantContactInformationDto = ReadonlyDeep<{
  /** Home address is optional because ITA clients initially have no home address */
  homeAddress?: ApplicantAddressDto;
  mailingAddress: ApplicantAddressDto;
  phoneNumber?: string;
  phoneNumberAlt?: string;
  email?: string;
}>;

/**
 * Represents an address with normalized fields for comparison purposes.
 */
type ApplicantAddressDto = ReadonlyDeep<{
  address: string;
  apartment?: string;
  city: string;
  country: string;
  postalCode?: string;
  province?: string;
}>;
