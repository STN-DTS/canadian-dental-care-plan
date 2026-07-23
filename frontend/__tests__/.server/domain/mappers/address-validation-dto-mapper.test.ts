import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ServerConfig } from '~/.server/configs';
import type { AddressCorrectionRequestDto, AddressCorrectionResultDto, AddressCorrectionStatus } from '~/.server/domain/dtos';
import type { AddressCorrectionResultEntity } from '~/.server/domain/entities';
import { DefaultAddressValidationDtoMapper } from '~/.server/domain/mappers';
import { formatPostalCode, isValidPostalCode } from '~/.server/utils/postal-zip-code-utils';

vi.mock('~/.server/utils/postal-zip-code-utils');

describe('DefaultAddressValidationDtoMapper', () => {
  const mockServerConfig: Pick<ServerConfig, 'CANADA_COUNTRY_ID'> = { CANADA_COUNTRY_ID: 'CA' };

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('mapAddressCorrectionResultEntityToAddressCorrectionResultDto', () => {
    it.each([
      { statusCode: 'Corrected', expectedStatus: 'corrected' as AddressCorrectionStatus },
      { statusCode: 'NotCorrect', expectedStatus: 'not-correct' as AddressCorrectionStatus },
      { statusCode: 'Valid', expectedStatus: 'valid' as AddressCorrectionStatus },
    ])('should map AddressCorrectionResultEntity to AddressCorrectionResultDto with correct status and format postal code', ({ statusCode, expectedStatus }) => {
      vi.mocked(isValidPostalCode).mockReturnValue(true);
      vi.mocked(formatPostalCode).mockReturnValue('H0H 0H0');

      const mockEntity: AddressCorrectionResultEntity = {
        'wsaddr:CorrectionResults': {
          'nc:AddressFullText': '123 Fake St',
          'nc:AddressCityName': 'North Pole',
          'nc:AddressPostalCode': 'h0h0h0',
          'can:ProvinceCode': 'ON',
          'wsaddr:Information': {
            'wsaddr:StatusCode': statusCode,
          },
        },
      };

      const expectedDto: AddressCorrectionResultDto = {
        status: expectedStatus,
        address: '123 Fake St',
        city: 'North Pole',
        postalCode: 'H0H 0H0',
        provinceCode: 'ON',
      };

      const mapper = new DefaultAddressValidationDtoMapper(mockServerConfig);
      const dto = mapper.mapAddressCorrectionResultEntityToAddressCorrectionResultDto(mockEntity);

      expect(dto).toEqual(expectedDto);
      expect(isValidPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'h0h0h0');
      expect(formatPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'h0h0h0');
    });

    it('should throw error for unknown status', () => {
      vi.mocked(isValidPostalCode).mockReturnValue(true);
      vi.mocked(formatPostalCode).mockReturnValue('H0H 0H0');

      const mockEntity: AddressCorrectionResultEntity = {
        'wsaddr:CorrectionResults': {
          'nc:AddressFullText': '123 Fake St',
          'nc:AddressCityName': 'North Pole',
          'nc:AddressPostalCode': 'H0H0H0',
          'can:ProvinceCode': 'ON',
          'wsaddr:Information': {
            'wsaddr:StatusCode': 'Invalid status',
          },
        },
      };

      const mapper = new DefaultAddressValidationDtoMapper(mockServerConfig);
      expect(() => mapper.mapAddressCorrectionResultEntityToAddressCorrectionResultDto(mockEntity)).toThrowError();
      expect(isValidPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'H0H0H0');
      expect(formatPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'H0H0H0');
    });
  });

  describe('mapAddressCorrectionRequestDtoToAddressCorrectionResultDto', () => {
    it('should map AddressCorrectionRequestDto to AddressCorrectionResultDto with service unavailable status and format postal code', () => {
      vi.mocked(isValidPostalCode).mockReturnValue(true);
      vi.mocked(formatPostalCode).mockReturnValue('H0H 0H0');

      const mockDto: AddressCorrectionRequestDto = {
        address: '123 fake st',
        city: 'north pole',
        postalCode: 'h0h0h0',
        provinceCode: 'ON',
        userId: 'test user',
      };

      const expectedResult: AddressCorrectionResultDto = {
        address: '123 FAKE ST',
        city: 'NORTH POLE',
        postalCode: 'H0H0H0',
        provinceCode: 'H0H 0H0',
        status: 'service-unavailable',
      };

      const mapper = new DefaultAddressValidationDtoMapper(mockServerConfig);
      const result = mapper.mapAddressCorrectionRequestDtoToAddressCorrectionResultDto(mockDto, 'service-unavailable');

      expect(result).toEqual(expectedResult);
      expect(isValidPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'h0h0h0');
      expect(formatPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'h0h0h0');
    });

    it('should handle invalid postal code', () => {
      vi.mocked(isValidPostalCode).mockReturnValue(false);
      vi.mocked(formatPostalCode).mockReturnValue('INVALID');

      const mockDto: AddressCorrectionRequestDto = {
        address: '123 fake st',
        city: 'north pole',
        postalCode: 'invalid',
        provinceCode: 'ON',
        userId: 'test user',
      };

      const expectedResult: AddressCorrectionResultDto = {
        address: '123 FAKE ST',
        city: 'NORTH POLE',
        postalCode: 'INVALID',
        provinceCode: 'INVALID',
        status: 'service-unavailable',
      };

      const mapper = new DefaultAddressValidationDtoMapper(mockServerConfig);
      const result = mapper.mapAddressCorrectionRequestDtoToAddressCorrectionResultDto(mockDto, 'service-unavailable');
      expect(result).toEqual(expectedResult);
      expect(isValidPostalCode).toHaveBeenCalledWith(mockServerConfig.CANADA_COUNTRY_ID, 'invalid');
      expect(formatPostalCode).not.toHaveBeenCalled();
    });
  });
});
