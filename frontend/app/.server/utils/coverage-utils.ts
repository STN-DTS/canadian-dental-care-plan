import { getEnv } from '~/.server/utils/env-utils';

/**
 * Returns `true` if the provided code is a valid coverage copay tier code (Tier 1, 2, or 3), otherwise `false`.
 * A valid code must be a string and match one of the predefined tier codes from the environment configuration.
 */
export function isValidCoverageCopayTierCode(code: string): boolean {
  const { COVERAGE_TIER_CODE_TIER_1, COVERAGE_TIER_CODE_TIER_2, COVERAGE_TIER_CODE_TIER_3 } = getEnv();
  return [COVERAGE_TIER_CODE_TIER_1, COVERAGE_TIER_CODE_TIER_2, COVERAGE_TIER_CODE_TIER_3].includes(code);
}

/**
 * Given a tax year, returns the corresponding coverage period with start and end dates.
 * The coverage period starts on July 1st of the year following the tax year and ends on June 30th of the subsequent year.
 *
 * @param taxYear - The tax year for which to calculate the coverage period. Must be a valid number between 2024 and 2100.
 * @returns An object containing the start date, start year, end date, and end year of the coverage period.
 * @throws {TypeError} If the provided tax year is not a valid number or is out of the acceptable range.
 */
export function getCoveragePeriodFromTaxYear(taxYear: string | number): {
  startDate: Temporal.PlainDate;
  startYear: number;
  endDate: Temporal.PlainDate;
  endYear: number;
} {
  const parsedTaxYear = Number.parseInt(taxYear.toString(), 10);

  if (Number.isNaN(parsedTaxYear) || parsedTaxYear < 2024 || parsedTaxYear > 2100) {
    throw new TypeError(`Invalid tax year: ${taxYear}`);
  }

  const startYear = parsedTaxYear + 1;
  const endYear = startYear + 1;

  return {
    startDate: Temporal.PlainDate.from(`${startYear}-07-01`),
    startYear: startYear,
    endDate: Temporal.PlainDate.from(`${endYear}-06-30`),
    endYear: endYear,
  };
}
