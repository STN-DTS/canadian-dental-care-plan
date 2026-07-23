import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DefaultCoverageService } from '~/.server/domain/services/coverage-service';

describe('DefaultCoverageService', () => {
  let service: DefaultCoverageService;

  beforeEach(() => {
    service = new DefaultCoverageService();
  });

  describe('getCoverage', () => {
    it('should return coverage for date in January through June (first half)', () => {
      const date = new Date('2024-03-15');
      const result = service.getCoverage(date);

      expect(result).toEqual({
        endDate: '2024-06-30T23:59:59.999Z',
        endYear: 2024,
        startDate: '2023-07-01T00:00:00.000Z',
        startYear: 2023,
        taxationYear: 2022,
      });
    });

    it('should return coverage for date in July through December (second half)', () => {
      const date = new Date('2024-09-15');
      const result = service.getCoverage(date);

      expect(result).toEqual({
        endDate: '2025-06-30T23:59:59.999Z',
        endYear: 2025,
        startDate: '2024-07-01T00:00:00.000Z',
        startYear: 2024,
        taxationYear: 2023,
      });
    });

    it('should handle boundary case for June 30', () => {
      const date = new Date('2024-06-30');
      const result = service.getCoverage(date);

      expect(result).toEqual({
        endDate: '2024-06-30T23:59:59.999Z',
        endYear: 2024,
        startDate: '2023-07-01T00:00:00.000Z',
        startYear: 2023,
        taxationYear: 2022,
      });
    });

    it('should handle boundary case for July 1', () => {
      const date = new Date(2024, 6, 1, 0, 0, 0, 0);
      const result = service.getCoverage(date);

      expect(result).toEqual({
        endDate: '2025-06-30T23:59:59.999Z',
        endYear: 2025,
        startDate: '2024-07-01T00:00:00.000Z',
        startYear: 2024,
        taxationYear: 2023,
      });
    });
  });

  describe('getCurrentCoverage', () => {
    it('should return coverage for current date', () => {
      const mockDate = new Date('2024-08-15');
      vi.setSystemTime(mockDate);

      const result = service.getCurrentCoverage();

      expect(result).toEqual({
        endDate: '2025-06-30T23:59:59.999Z',
        endYear: 2025,
        startDate: '2024-07-01T00:00:00.000Z',
        startYear: 2024,
        taxationYear: 2023,
      });

      vi.useRealTimers();
    });
  });
});
