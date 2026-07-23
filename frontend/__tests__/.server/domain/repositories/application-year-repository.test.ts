import { afterEach, describe, expect, it, vi } from 'vitest';

import { DefaultApplicationYearRepository } from '~/.server/domain/repositories';

describe('DefaultApplicationYearRepository', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('getIntakeApplicationYear', () => {
    it('should return intake application year entity', () => {
      const repository = new DefaultApplicationYearRepository();

      const result = repository.getIntakeApplicationYear('2024-11-13');
      expect(result).toEqual({
        BenefitApplicationYear: {
          BenefitApplicationYearIdentification: {
            IdentificationID: '2c328e64-cec0-f011-8544-7ced8d05d4ca',
          },
          BenefitApplicationYearTaxYear: {
            YearDate: '2025',
          },
          DependentEligibilityEndDate: {
            date: '2026-06-01',
          },
        },
      });
    });
  });

  describe('getRenewalApplicationYear', () => {
    it('should return renewal application year entity', () => {
      const repository = new DefaultApplicationYearRepository();

      const result = repository.getIntakeApplicationYear('2024-11-13');
      expect(result).toEqual({
        BenefitApplicationYear: {
          BenefitApplicationYearIdentification: {
            IdentificationID: '2c328e64-cec0-f011-8544-7ced8d05d4ca',
          },
          BenefitApplicationYearTaxYear: {
            YearDate: '2025',
          },
          DependentEligibilityEndDate: {
            date: '2026-06-01',
          },
        },
      });
    });
  });
});
