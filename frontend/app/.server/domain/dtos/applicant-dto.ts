import type { ReadonlyDeep } from 'type-fest';

/** Information used to find an applicant by client number and identity details. */
export type FindApplicantByBasicInfoDto = Readonly<{
  /** Applicant's client number. */
  clientNumber: string;

  /** Applicant's date of birth in ISO date format. */
  dateOfBirth: string;

  /** Applicant's first name. */
  firstName: string;

  /** Applicant's last name. */
  lastName: string;
}>;

/** Information used to find an applicant by Social Insurance Number (SIN). */
export type FindApplicantBySinRequestDto = Readonly<{
  /** Applicant's SIN. */
  sin: string;
}>;

/**
 * Applicant record that may represent someone who has not yet completed a
 * program application. Program-assigned and incomplete contact fields may be
 * absent.
 */
export type ApplicantDto = ReadonlyDeep<{
  /**
   * The applicant type returned by Power Platform, when assigned.
   *
   * Power Platform assigns this value only after the applicant successfully
   * completes an application for the first time. It may be undefined until
   * then.
   */
  applicantType?: string;

  /** Applicant's internal client identifier. */
  clientId: string;

  /** Applicant's client number. */
  clientNumber: string;

  /** Applicant's date of birth in ISO date format. */
  dateOfBirth: string;

  /** Applicant's first name. */
  firstName: string;

  /** Applicant's last name. */
  lastName: string;

  /** Applicant's SIN, when available. */
  socialInsuranceNumber?: string;

  /** Applicant's marital status code, when assigned. */
  maritalStatus?: string;

  /** Applicant's communication preferences, when assigned. */
  communicationPreferences: {
    /** Preferred communication language code. */
    preferredLanguage?: string;

    /** Preferred communication method for Sun Life correspondence. */
    preferredMethodSunLife?: string;

    /** Preferred communication method for Government of Canada correspondence. */
    preferredMethodGovernmentOfCanada?: string;
  };

  /** Applicant's available contact information. */
  contactInformation: {
    /** Home address, when complete; ITA clients may initially have none. */
    homeAddress?: ApplicantAddressDto;

    /** Mailing address, when complete. */
    mailingAddress?: ApplicantAddressDto;

    /** Primary telephone number. */
    phoneNumber?: string;

    /** Alternate telephone number. */
    phoneNumberAlt?: string;

    /** Email address. */
    email?: string;
  };
}>;

/** Normalized applicant address. */
type ApplicantAddressDto = {
  /** Street address. */
  address: string;

  /** Apartment, suite, or unit identifier. */
  apartment?: string;

  /** City or municipality. */
  city: string;

  /** Country code. */
  country: string;

  /** Postal or ZIP code. */
  postalCode?: string;

  /** Province, territory, or state code. */
  province?: string;
};
