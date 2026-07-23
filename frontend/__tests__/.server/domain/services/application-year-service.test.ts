import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ApplicationYearResultDto } from '~/.server/domain/dtos';
import type { ApplicationYearResultEntity } from '~/.server/domain/entities';
import type { ApplicationYearDtoMapper } from '~/.server/domain/mappers';
import type { ApplicationYearRepository } from '~/.server/domain/repositories';
import { DefaultApplicationYearService } from '~/.server/domain/services';

describe('DefaultApplicationYearService', () => {
  const mockIntakeApplicationYearEntity: ApplicationYearResultEntity = {
    BenefitApplicationYear: {
      BenefitApplicationYearIdentification: {
        IdentificationID: '9bb21bc9-028c-ef11-8a69-000d3a0a1a29',
      },
      BenefitApplicationYearTaxYear: {
        YearDate: '2024',
      },
      DependentEligibilityEndDate: {
        date: '2025-06-01',
      },
    },
  };

  const mockRenewalApplicationYearEntity: ApplicationYearResultEntity = {
    BenefitApplicationYear: {
      BenefitApplicationYearIdentification: {
        IdentificationID: '9bb21bc9-028c-ef11-8a69-000d3a0a1a29',
      },
      BenefitApplicationYearTaxYear: {
        YearDate: '2024',
      },
      DependentEligibilityEndDate: {
        date: '2025-06-30',
      },
    },
  };

  const mockIntakeApplicationYearResultDto: ApplicationYearResultDto = {
    applicationYearId: '9bb21bc9-028c-ef11-8a69-000d3a0a1a29',
    applicationYear: '2025',
    taxYear: '2024',
    dependentEligibilityEndDate: '2025-06-01',
  };

  const mockRenewalApplicationYearResultDto: ApplicationYearResultDto = {
    applicationYearId: '9bb21bc9-028c-ef11-8a69-000d3a0a1a29',
    applicationYear: '2025',
    taxYear: '2024',
    dependentEligibilityEndDate: '2025-06-30',
  };

  const mockServerConfig = { LOOKUP_SVC_APPLICATION_YEAR_CACHE_TTL_SECONDS: 10 };

  describe('getIntakeApplicationYear', () => {
    it('should return the correct intake application year DTO', () => {
      const mockApplicationYearRepository = mock<ApplicationYearRepository>();
      mockApplicationYearRepository.getIntakeApplicationYear.mockReturnValue(mockIntakeApplicationYearEntity);

      const mockApplicationYearDtoMapper = mock<ApplicationYearDtoMapper>();
      mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto.mockReturnValue(mockIntakeApplicationYearResultDto);

      const service = new DefaultApplicationYearService(mockApplicationYearDtoMapper, mockApplicationYearRepository, mockServerConfig);

      const result = service.getIntakeApplicationYear('2024-01-01');

      expect(mockApplicationYearRepository.getIntakeApplicationYear).toHaveBeenCalledWith('2024-01-01');
      expect(mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto).toHaveBeenCalledWith(mockIntakeApplicationYearEntity);
      expect(result).toEqual(mockIntakeApplicationYearResultDto);
    });
  });

  describe('getRenewalApplicationYear', () => {
    it('should return the correct renewal application year DTO', () => {
      const mockApplicationYearRepository = mock<ApplicationYearRepository>();
      mockApplicationYearRepository.getRenewalApplicationYear.mockReturnValue(mockRenewalApplicationYearEntity);

      const mockApplicationYearDtoMapper = mock<ApplicationYearDtoMapper>();
      mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto.mockReturnValue(mockRenewalApplicationYearResultDto);

      const service = new DefaultApplicationYearService(mockApplicationYearDtoMapper, mockApplicationYearRepository, mockServerConfig);

      const result = service.getRenewalApplicationYear('2024-01-01');

      expect(mockApplicationYearRepository.getRenewalApplicationYear).toHaveBeenCalledWith('2024-01-01');
      expect(mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto).toHaveBeenCalledWith(mockRenewalApplicationYearEntity);
      expect(result).toEqual(mockRenewalApplicationYearResultDto);
    });
  });

  describe('caching', () => {
    it('should cache results for getIntakeApplicationYear', () => {
      const mockApplicationYearRepository = mock<ApplicationYearRepository>();
      mockApplicationYearRepository.getIntakeApplicationYear.mockReturnValue(mockIntakeApplicationYearEntity);

      const mockApplicationYearDtoMapper = mock<ApplicationYearDtoMapper>();
      mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto.mockReturnValue(mockIntakeApplicationYearResultDto);

      const service = new DefaultApplicationYearService(mockApplicationYearDtoMapper, mockApplicationYearRepository, mockServerConfig);

      // First call
      const result1 = service.getIntakeApplicationYear('2024-01-01');
      // Second call with same date should use cache
      const result2 = service.getIntakeApplicationYear('2024-01-01');

      expect(result1).toEqual(result2);
      // Repository should still be called twice (caching happens after repository call)
      expect(mockApplicationYearRepository.getIntakeApplicationYear).toHaveBeenCalledTimes(1);
      // Mapper should only be called once due to caching
      expect(mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto).toHaveBeenCalledTimes(1);
    });

    it('should cache results for getRenewalApplicationYear', () => {
      const mockApplicationYearRepository = mock<ApplicationYearRepository>();
      mockApplicationYearRepository.getRenewalApplicationYear.mockReturnValue(mockRenewalApplicationYearEntity);

      const mockApplicationYearDtoMapper = mock<ApplicationYearDtoMapper>();
      mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto.mockReturnValue(mockRenewalApplicationYearResultDto);

      const service = new DefaultApplicationYearService(mockApplicationYearDtoMapper, mockApplicationYearRepository, mockServerConfig);

      // First call
      const result1 = service.getRenewalApplicationYear('2024-01-01');
      // Second call with same date should use cache
      const result2 = service.getRenewalApplicationYear('2024-01-01');

      expect(result1).toEqual(result2);
      // Repository should still be called twice (caching happens after repository call)
      expect(mockApplicationYearRepository.getRenewalApplicationYear).toHaveBeenCalledTimes(1);
      // Mapper should only be called once due to caching
      expect(mockApplicationYearDtoMapper.mapApplicationYearResultEntityToApplicationYearResultDto).toHaveBeenCalledTimes(1);
    });
  });
});
