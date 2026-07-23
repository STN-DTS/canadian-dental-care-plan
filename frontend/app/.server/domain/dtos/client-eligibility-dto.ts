import type { ReadonlyDeep } from 'type-fest';

export type ClientEligibilityDto = ReadonlyDeep<{
  clientId: string;
  clientNumber: string;
  earnings: ReadonlyArray<{
    applicationYearId: string;
    /**
     * Valid coverage "Co-Pay Tier (TPC)" code for the earning taxation year.
     * Note: TPC stands for "Third Party Contractor"
     */
    coverageCopayTierTpcCode?: string;
    /** Earnings eligibility status code */
    eligibilityStatusCode: string;
    /** Earning taxation year */
    taxationYear: number;
  }>;
  firstName: string;
  lastName: string;
  /** Applicant profile current eligibility status code */
  eligibilityStatusCode?: string;
  /** Applicant profile next year eligibility status code */
  eligibilityStatusCodeNextYear?: string;
  /** Applicant profile enrollment status code */
  enrollmentStatusCode?: string;
}>;

export type ClientEligibilityRequestDto = ReadonlyDeep<
  Array<{
    clientNumber: string;
  }>
>;
