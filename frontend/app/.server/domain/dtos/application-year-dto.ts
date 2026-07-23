/**
 * Represents a Data Transfer Object (DTO) for an application year result.
 */
export type ApplicationYearResultDto = Readonly<{
  applicationYearId: string;
  applicationYear: string;
  taxYear: string;
  dependentEligibilityEndDate: string;
}>;
