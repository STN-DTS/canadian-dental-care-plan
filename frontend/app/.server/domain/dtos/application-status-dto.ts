/**
 * Represents the basic information required to check the application status.
 */
export type ApplicationStatusBasicInfoRequestDto = Readonly<{
  /** The code associated with the specific application */
  applicationCode: string;

  /** First name of the applicant */
  firstName: string;

  /** Last name of the applicant */
  lastName: string;

  /** Applicant's date of birth in YYYY-MM-DD format */
  dateOfBirth: string;

  /** A unique identifier for the applicant - used for auditing */
  userId: string;
}>;

/**
 * Represents the Social Insurance Number information required to check the application status.
 */
export type ApplicationStatusSinRequestDto = Readonly<{
  /** The code associated with the specific application */
  applicationCode: string;

  /** Social Insurance Number of the applicant */
  sin: string;

  /** A unique identifier for the applicant - used for auditing */
  userId: string;
}>;
