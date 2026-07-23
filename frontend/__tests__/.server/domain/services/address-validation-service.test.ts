import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AddressCorrectionRequestDto, AddressCorrectionResultDto } from '~/.server/domain/dtos';
import type { AddressCorrectionResultEntity } from '~/.server/domain/entities';
import type { AddressValidationDtoMapper } from '~/.server/domain/mappers';
import type { AddressValidationRepository } from '~/.server/domain/repositories';
import { DefaultAddressValidationService } from '~/.server/domain/services';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

describe('DefaultAddressValidationService', () => {
  describe('getAddressCorrectionResult', () => {
    it('should return address correction result DTO', async () => {
      const mockAddressCorrectionResultDto: AddressCorrectionResultDto = {
        status: 'corrected',
        address: '123 Fake St',
        city: 'North Pole',
        postalCode: 'H0H 0H0',
        provinceCode: 'ON',
      };
      const mockAddressValidationDtoMapper = mock<AddressValidationDtoMapper>();
      mockAddressValidationDtoMapper.mapAddressCorrectionResultEntityToAddressCorrectionResultDto.mockReturnValue(mockAddressCorrectionResultDto);
      mockAddressValidationDtoMapper.mapAddressCorrectionRequestDtoToAddressCorrectionResultDto.mockReturnValue(mockAddressCorrectionResultDto); // Added for error handling test

      const mockAddressCorrectionResultEntity: AddressCorrectionResultEntity = {
        'wsaddr:CorrectionResults': {
          'nc:AddressFullText': '123 Fake St',
          'nc:AddressCityName': 'North Pole',
          'nc:AddressPostalCode': 'H0H 0H0',
          'can:ProvinceCode': 'ON',
          'wsaddr:Information': {
            'wsaddr:StatusCode': 'Corrected',
          },
        },
      };
      const mockAddressValidationRepository = mock<AddressValidationRepository>();
      mockAddressValidationRepository.getAddressCorrectionResult.mockResolvedValue(mockAddressCorrectionResultEntity);

      const mockAuditService = mock<AuditService>();

      const service = new DefaultAddressValidationService(mockAddressValidationDtoMapper, mockAddressValidationRepository, mockAuditService);
      const mockAddressCorrectionRequestDto: AddressCorrectionRequestDto = {
        address: '123 Fake Street',
        city: 'North Pole',
        provinceCode: 'ON',
        postalCode: 'H0H 0H0',
        userId: 'userId',
      };

      const result = await service.getAddressCorrectionResult(mockAddressCorrectionRequestDto);
      expect(result).toEqual(mockAddressCorrectionResultDto);
    });

    it('should handle errors and return service unavailable status', async () => {
      const mockLogger = mock<Logger>();
      vi.mocked(createLogger).mockReturnValue(mockLogger);

      const mockAddressCorrectionResultDto: AddressCorrectionResultDto = {
        status: 'service-unavailable', // Expecting service unavailable status
        address: '123 Fake Street', // Expect original address
        city: 'North Pole', // Expect original city
        postalCode: 'H0H 0H0', // Expect original postal code
        provinceCode: 'ON', // Expect original province code
      };

      const mockAddressValidationDtoMapper = mock<AddressValidationDtoMapper>();
      mockAddressValidationDtoMapper.mapAddressCorrectionRequestDtoToAddressCorrectionResultDto.mockReturnValue(mockAddressCorrectionResultDto);

      const mockAddressValidationRepository = mock<AddressValidationRepository>();
      mockAddressValidationRepository.getAddressCorrectionResult.mockRejectedValue(new Error('Some error')); // Simulate an error

      const mockAuditService = mock<AuditService>();

      const service = new DefaultAddressValidationService(mockAddressValidationDtoMapper, mockAddressValidationRepository, mockAuditService);

      const mockAddressCorrectionRequestDto: AddressCorrectionRequestDto = {
        address: '123 Fake Street',
        city: 'North Pole',
        provinceCode: 'ON',
        postalCode: 'H0H 0H0',
        userId: 'userId',
      };
      const result = await service.getAddressCorrectionResult(mockAddressCorrectionRequestDto);

      expect(result).toEqual(mockAddressCorrectionResultDto);
      expect(mockLogger.warn).toHaveBeenCalledWith('Unexpected error occurred while getting address correction results. [%s]', new Error('Some error'));
    });
  });
});
