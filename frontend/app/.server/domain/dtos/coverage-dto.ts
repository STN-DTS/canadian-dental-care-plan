import type { ReadonlyDeep } from 'type-fest';

/**
 * Represents coverage information for a specific period.
 */
export type CoverageDto = ReadonlyDeep<{
  /** The end date of the coverage period in string format */
  endDate: string;
  /** The year when the coverage period ends */
  endYear: number;
  /** The start date of the coverage period in string format */
  startDate: string;
  /** The year when the coverage period begins */
  startYear: number;
  /** The taxation year associated with this coverage period */
  taxationYear: number;
}>;
