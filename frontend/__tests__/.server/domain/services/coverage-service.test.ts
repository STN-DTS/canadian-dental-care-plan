import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DefaultCoverageService } from '~/.server/domain/services/coverage-service';

describe('DefaultCoverageService', () => {
  let service: DefaultCoverageService;

  beforeEach(() => {
    service = new DefaultCoverageService();
  });

  describe('getCoverage', () => {
    it('should return coverage for date in January through June (first half)', () => {
      const date = Temporal.PlainDate.from('2024-03-15');
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
      const date = Temporal.PlainDate.from('2024-09-15');
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
      const date = Temporal.PlainDate.from('2024-06-30');
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
      const date = Temporal.PlainDate.from('2024-07-01');
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
      vi.useFakeTimers({ now: Temporal.Instant.from('2024-08-15T00:00:00Z') });

      const result = service.getCurrentCoverage();

      expect(result).toEqual({
        endDate: '2025-06-30T23:59:59.999Z',
        endYear: 2025,
        startDate: '2024-07-01T00:00:00.000Z',
        startYear: 2024,
        taxationYear: 2023,
      });
    });

    it('changes coverage at UTC midnight on July 1 regardless of the host timezone', () => {
      vi.useFakeTimers({ now: Temporal.Instant.from('2026-06-30T23:59:59.999Z') });
      expect(service.getCurrentCoverage()).toMatchObject({ startYear: 2025, endYear: 2026 });
      vi.advanceTimersByTime(1);
      expect(service.getCurrentCoverage()).toMatchObject({
        startYear: 2026,
        endYear: 2027,
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2027-06-30T23:59:59.999Z',
      });
    });
  });
});
