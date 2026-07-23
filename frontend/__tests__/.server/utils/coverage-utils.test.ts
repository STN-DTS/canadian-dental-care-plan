import { describe, expect, it, vi } from 'vitest';

import { getCoveragePeriodFromTaxYear, isValidCoverageCopayTierCode } from '~/.server/utils/coverage-utils';

vi.mock('~/.server/utils/env-utils', () => ({
  getEnv: vi.fn(() => ({
    COVERAGE_TIER_CODE_TIER_1: 'TIER_1',
    COVERAGE_TIER_CODE_TIER_2: 'TIER_2',
    COVERAGE_TIER_CODE_TIER_3: 'TIER_3',
  })),
}));

describe('coverage-utils', () => {
  describe('isValidCoverageCopayTierCode', () => {
    it.each([['TIER_1'], ['TIER_2'], ['TIER_3']])(
      //
      'should return true for tier code "%s"',
      (tierCode) => {
        // Act & Assert
        expect(isValidCoverageCopayTierCode(tierCode)).toBe(true);
      },
    );

    it.each([['INVALID_CODE'], [''], ['TIER_4']])(
      //
      'should return false for invalid tier code "%s"',
      (invalidCode) => {
        // Act & Assert
        expect(isValidCoverageCopayTierCode(invalidCode)).toBe(false);
      },
    );
  });

  describe('getCoveragePeriodFromTaxYear', () => {
    it('should return correct coverage period for a valid tax year', () => {
      // Arrange
      const taxYear = 2024;

      // Act
      const coveragePeriod = getCoveragePeriodFromTaxYear(taxYear);

      // Assert
      expect(coveragePeriod).toEqual({
        startDate: Temporal.PlainDate.from('2025-07-01'),
        startYear: 2025,
        endDate: Temporal.PlainDate.from('2026-06-30'),
        endYear: 2026,
      });
    });

    it('should throw an error for an invalid tax year', () => {
      // Arrange
      const invalidTaxYear = 'invalid';

      // Act & Assert
      expect(() => getCoveragePeriodFromTaxYear(invalidTaxYear)).toThrow(TypeError);
    });

    it('should throw an error for a tax year out of range', () => {
      // Arrange
      const outOfRangeTaxYear = 2101;

      // Act & Assert
      expect(() => getCoveragePeriodFromTaxYear(outOfRangeTaxYear)).toThrow(TypeError);
    });
  });
});
