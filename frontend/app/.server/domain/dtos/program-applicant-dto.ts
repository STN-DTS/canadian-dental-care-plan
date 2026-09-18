import type { ReadonlyDeep } from 'type-fest';

/** Information used to find a program applicant by client number and identity details. */
export type FindProgramApplicantByBasicInfoDto = Readonly<{
  /** Applicant's client number. */
  clientNumber: string;

  /** Applicant's date of birth in ISO date format. */
  dateOfBirth: string;

  /** Applicant's first name. */
  firstName: string;

  /** Applicant's last name. */
  lastName: string;

  /** Unique identifier of the user making the request, used for auditing. */
  userId: string;
}>;

/** Information used to find a program applicant by Social Insurance Number (SIN). */
export type FindProgramApplicantBySinRequestDto = Readonly<{
  /** Applicant's SIN. */
  sin: string;

  /** Unique identifier of the user making the request, used for auditing. */
  userId: string;
}>;

/**
 * Applicant recognized as a program participant. Unlike `ApplicantDto`, this
 * contract requires both a program-assigned applicant type and a complete
 * mailing address.
 */
export type ProgramApplicantDto = ReadonlyDeep<{
  /** Program-assigned applicant type. */
  applicantType: string;

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
    homeAddress?: ProgramApplicantAddressDto;

    /** Complete mailing address required for program operations. */
    mailingAddress: ProgramApplicantAddressDto;

    /** Primary telephone number. */
    phoneNumber?: string;

    /** Alternate telephone number. */
    phoneNumberAlt?: string;

    /** Email address. */
    email?: string;
  };
}>;

/** Normalized program applicant address. */
type ProgramApplicantAddressDto = {
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
